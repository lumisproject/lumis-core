import re
import logging
import asyncio
from collections import defaultdict

from src.agent import LumisAgent
from src.services import get_commit_diff

# Jira Integration Modules
from src.jira_client import (
    get_accessible_resources,
    get_active_issues,
    get_issue_details,
    add_comment as add_jira_comment,
    transition_issue as transition_jira_issue,
    create_issue as create_jira_issue,
    adf_to_markdown
)

logger = logging.getLogger(__name__)

def extract_jira_keys(message: str) -> list:
    """Extracts all Jira keys from a string (e.g. MATH-1)"""
    if not message: return []
    return list(set(re.findall(r'([A-Z]+-\d+)', message.upper())))

def clean_diff(raw_diff: str) -> str:
    """Removes lock files, minified files, and SVG noise from diffs to save LLM tokens."""
    if not raw_diff: return ""
    
    ignore_patterns = ['.lock', 'package-lock.json', 'yarn.lock', '.svg', '.min.js', '.map']
    cleaned_lines = []
    skip_file = False
    
    for line in raw_diff.split('\n'):
        if line.startswith('diff --git'):
            skip_file = any(ignored in line for ignored in ignore_patterns)
            
        if not skip_file:
            # Strip structural diff markers to save a few more tokens
            if line.strip() in ['+', '-']: continue 
            cleaned_lines.append(line)
            
    # Hard cutoff to protect LLM context windows
    result = '\n'.join(cleaned_lines)
    return result[:15000] + "\n...[Diff truncated for length]" if len(result) > 15000 else result

# --- JIRA BACKGROUND WORKER (Runs inside Celery) ---
async def process_jira(commits: list, repo_name: str, access_token: str, project_id: str, jira_project_id: str, agent: LumisAgent = None):
    if not jira_project_id:
        logger.info("No Jira Project ID explicitly mapped. Skipping Jira sync.")
        return

    # Properly await async Jira API calls
    resources = await get_accessible_resources(access_token)
    if not resources:
        return
    
    current_cloud_id = resources[0]["id"]
    project_key = jira_project_id.strip()
    
    # Fetch issues
    active_issues = await get_active_issues(current_cloud_id, access_token, project_key)
    logger.info(f"🔍 AVAILABLE JIRA ISSUES: {[i['key'] for i in active_issues]}")
    
    task_commit_map = defaultdict(list)
    rogue_commits = []

    # 1. GROUP COMMITS BY TASK
    for commit in commits:
        message = commit.get("message", "")
        if not message or "merge" in message.lower():
            continue

        extracted_keys = extract_jira_keys(message)
        logger.info(f"🔑 EXTRACTED KEYS from commit: {extracted_keys}")
        
        matched_issues = []
        if extracted_keys and active_issues:
            matched_issues = [i for i in active_issues if i['key'] in extracted_keys]

        # Semantic fallback if regex found nothing
        if not matched_issues and active_issues:
            matched_issue = await asyncio.to_thread(agent.match_task_to_commit, message, active_issues)
            if matched_issue:
                matched_issues = [matched_issue]
        
        if matched_issues:
            logger.info(f"✅ Commit successfully mapped to: {[m['key'] for m in matched_issues]}")
            for matched_issue in matched_issues:
                task_commit_map[matched_issue["key"]].append(commit)
        else:
            logger.warning(f"⚠️ Commit failed to map to any issue! Sending to rogue...")
            rogue_commits.append(commit)

    # 2. PROCESS MATCHED TASKS
    for task_id, task_commits in task_commit_map.items():
        matched_issue = next((i for i in active_issues if i['key'] == task_id), None)
        task_summary = matched_issue['fields'].get('summary', 'No summary') if matched_issue else "Unknown"
        logger.info(f"✅ Processing {len(task_commits)} commits for Jira Task: {task_id}")

        try:
            combined_diff = ""
            for c in task_commits:
                raw_diff = get_commit_diff(repo_name, c["sha"])
                combined_diff += f"\n--- Commit {c['sha'][:7]} ---\n{clean_diff(raw_diff)}"

            # Fetch previous context to give the LLM memory of past pushes!
            previous_context = ""
            try:
                issue_details = await get_issue_details(current_cloud_id, task_id, access_token)
                comments = issue_details.get("fields", {}).get("comment", {}).get("comments", [])
                
                lumis_comments = [c for c in comments if "Lumis AI" in str(c)]
                if lumis_comments:
                    last_c = lumis_comments[-1]
                    previous_context = adf_to_markdown(last_c.get("body"))
                else:
                    previous_context = "No previous pushes recorded."
            except Exception as e:
                logger.warning(f"Could not fetch previous comments for {task_id}: {e}")
            
            # Execute LLM analysis in a separate thread so it doesn't block
            analysis = await asyncio.to_thread(agent.analyze_fulfillment, issue=matched_issue, code=combined_diff, previous_context=previous_context)

            status = analysis.get("fulfillment_status", "PARTIAL")
            comment_body = f"🤖 **Lumis AI analysis:**\n\n{analysis.get('summary', 'Work processed.')}"

            if status != "COMPLETE":
                await add_jira_comment(current_cloud_id, task_id, f"🛠️ **Progress Update**\n\n{comment_body}", access_token)
                await transition_jira_issue(current_cloud_id, task_id, access_token, target="progress")
            else:
                await add_jira_comment(current_cloud_id, task_id, f"✅ **Task Completed!**\n\n{comment_body}", access_token)
                await transition_jira_issue(current_cloud_id, task_id, access_token, target="review")

        except Exception as e:
            logger.error(f"❌ Failed to sync task {task_id} with Jira: {e}")

    # 3. PROCESS ROGUE COMMITS (SQUASHED)
    if rogue_commits:
        logger.info(f"Evaluating {len(rogue_commits)} unlinked commits for ticket creation...")
        try:
            combined_diff = ""
            combined_messages = ""
            for c in rogue_commits:
                raw_diff = get_commit_diff(repo_name, c["sha"])
                combined_diff += f"\n--- Commit {c['sha'][:7]} ---\n{clean_diff(raw_diff)}"
                combined_messages += f"- {c.get('message', '')}\n"

            # Use the LLM to check if these commits actually deserve a ticket
            evaluation = await asyncio.to_thread(agent.evaluate_rogue_commits, combined_messages, combined_diff)
            
            if not evaluation.get("needs_ticket", True):
                logger.info(f"Rogue commits deemed trivial. No ticket created. Reason: {evaluation.get('summary')}")
            else:
                # Create the ticket using the AI's suggested title
                first_commit_msg = rogue_commits[0].get("message", "Unlinked Commit").split('\n')[0][:200]
                title = first_commit_msg if len(rogue_commits) == 1 else f"{first_commit_msg} (+{len(rogue_commits) - 1} more)"
                
                desc = f"Auto-generated ticket for batch push in {repo_name}.\n\nAI Summary: {evaluation.get('summary')}\n\nCommit Messages:\n{combined_messages}"
                
                new_ticket = await create_jira_issue(current_cloud_id, project_key, title, desc, access_token)
                new_task_id = new_ticket['key']
                
                # Now that the ticket exists, run the standard fulfillment check on it
                dummy_issue = {"key": new_task_id, "fields": {"summary": title, "description": desc}}
                analysis = await asyncio.to_thread(agent.analyze_fulfillment, issue=dummy_issue, code=combined_diff, previous_context="")
                
                status = analysis.get("fulfillment_status", "PARTIAL")
                comment_body = f"🤖 **Lumis AI analysis:**\n\n{analysis.get('summary', 'Code analyzed.')}"

                if status != "COMPLETE":
                    await add_jira_comment(current_cloud_id, new_task_id, f"🛠️ **Progress Update**\n\n{comment_body}\n\n*Moved to In Progress.*", access_token)
                    await transition_jira_issue(current_cloud_id, new_task_id, access_token, target="progress")
                else:
                    await add_jira_comment(current_cloud_id, new_task_id, f"✅ **Auto-Completed!**\nPassed AI checks.\n\n{comment_body}", access_token)
                    await transition_jira_issue(current_cloud_id, new_task_id, access_token, target="review")
                    
        except Exception as e:
            logger.error(f"❌ Failed to process rogue commits: {e}")

    logger.info("--- Jira Sync Cycle Complete ---")