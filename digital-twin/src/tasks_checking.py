import re
import logging
import asyncio
from collections import defaultdict

from src.agent import LumisAgent
from src.services import get_commit_diff
from src.db_client import supabase

# Jira Integration Modules
from src.jira_auth import get_valid_token
from src.jira_client import (
    get_accessible_resources,
    get_active_issues,
    add_comment as add_jira_comment,
    transition_issue as transition_jira_issue,
    create_issue as create_jira_issue
)

# Notion Integration Modules
from src.notion_auth import get_valid_notion_token
from src.notion_client import (
    get_active_tasks as get_notion_tasks, 
    add_comment as add_notion_comment, 
    transition_task as transition_notion_task, 
    create_task as create_notion_task
)

logger = logging.getLogger(__name__)

def extract_jira_key(message: str) -> str:
    """Fast deterministic check for Jira keys in commit messages (e.g., PROJ-123)"""
    match = re.search(r'([A-Z]+-\d+)', message.upper())
    return match.group(1) if match else None

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
            # Optional: Strip lines that are just structural diff markers to save a few more tokens
            if line.strip() in ['+', '-']: continue 
            cleaned_lines.append(line)
            
    # Hard cutoff to protect LLM context windows (e.g., max 15,000 chars)
    result = '\n'.join(cleaned_lines)
    return result[:15000] + "\n...[Diff truncated for length]" if len(result) > 15000 else result

# --- NOTION BACKGROUND WORKER ---
async def process_notion(commits: list, repo_name:str, access_token: str, database_id: str, project_id: str, agent: LumisAgent = None):
    if not database_id:
        logger.info("No Notion Database ID mapped for this project. Skipping Notion sync.")
        return

    active_tasks = get_notion_tasks(database_id, access_token)
    
    task_commit_map = defaultdict(list)
    rogue_commits = []

    # 1. GROUP COMMITS BY TASK
    for commit in commits:
        message = commit.get("message", "")
        if not message or "merge" in message.lower():
            continue

        matched_task = None
        if active_tasks:
            # Unblock the server using asyncio.to_thread
            matched_task = await asyncio.to_thread(agent.match_task_to_commit, message, active_tasks)
            
        if matched_task:
            task_commit_map[matched_task["id"]].append(commit)
        else:
            rogue_commits.append(commit)

    # 2. PROCESS MATCHED TASKS
    for task_id, task_commits in task_commit_map.items():
        matched_task = next((i for i in active_tasks if i['id'] == task_id), None)
        task_summary = matched_task.get("summary", "No summary") if matched_task else "Unknown"
        logger.info(f"✅ Processing {len(task_commits)} commits for Notion Task: {task_summary}")

        try:
            combined_diff = ""
            for c in task_commits:
                raw_diff = get_commit_diff(repo_name, c["sha"])
                combined_diff += f"\n--- Commit {c['sha'][:7]} ---\n{clean_diff(raw_diff)}"

            ai_adapted_task = {"key": task_id, "fields": {"summary": task_summary, "description": ""}}
            
            # Execute LLM analysis in background thread
            analysis = await asyncio.to_thread(agent.analyze_fulfillment, issue=ai_adapted_task, code=combined_diff)

            status = analysis.get("fulfillment_status", "PARTIAL")
            comment_body = f"🤖 **Lumis AI Sync (Processed {len(task_commits)} commits)**\n\n{analysis.get('summary', 'Work processed.')}"

            if status != "COMPLETE":
                add_notion_comment(task_id, f"🛠️ **Progress Update**\n{comment_body}", access_token)
            else:
                add_notion_comment(task_id, f"✅ **Task Completed!**\n{comment_body}", access_token)
                transition_notion_task(task_id, access_token)

        except Exception as e:
            logger.error(f"❌ Failed to sync matched Notion tasks: {e}")

    # 3. PROCESS ROGUE COMMITS (SQUASHED)
    if rogue_commits:
        logger.info(f"Auto-generating Notion ticket for {len(rogue_commits)} rogue commits...")
        try:
            combined_diff = ""
            combined_messages = ""
            for c in rogue_commits:
                raw_diff = get_commit_diff(repo_name, c["sha"])
                combined_diff += f"\n--- Commit {c['sha'][:7]} ---\n{clean_diff(raw_diff)}"
                combined_messages += f"- {c.get('message', '')}\n"

            title = f"[Lumis Auto-Sync] {len(rogue_commits)} Unlinked Commits"
            desc = f"Auto-generated ticket for batch push in {repo_name}.\n\nMessages:\n{combined_messages}"
            new_task = create_notion_task(database_id, title, desc, access_token)
            
            if new_task:
                new_task_id = new_task['id']
                dummy_task = {"key": new_task_id, "fields": {"summary": title, "description": desc}}
                
                analysis = await asyncio.to_thread(agent.analyze_fulfillment, issue=dummy_task, code=combined_diff)
                
                status = analysis.get("fulfillment_status", "PARTIAL")
                risks = analysis.get("identified_risks", [])
                comment_body = f"🤖 **Lumis AI Sync**\n\n{analysis.get('summary', 'Code analyzed.')}"

                if status != "COMPLETE" or risks:
                    if not risks:
                        risks = [{"risk_type": "CODE_RISK", "severity": "Medium", "description": analysis.get("summary", "Potential issue in rogue commit."), "affected_units": [new_task_id]}]
                    
                    for risk in risks:
                        units = risk.get("affected_units", [])
                        if new_task_id not in units: units.append(new_task_id)
                        new_risk = {"project_id": project_id, "risk_type": risk.get("risk_type", "INCOMPLETE"), "severity": risk.get("severity", "Medium"), "description": risk.get("description", "Missing requirements or code errors"), "affected_units": units}
                        supabase.table("project_risks").insert(new_risk).execute()
                    
                    add_notion_comment(new_task_id, f"⚠️ **Risks Detected!**\n{comment_body}\n\n*Ticket left in To Do.*", access_token)
                else:
                    add_notion_comment(new_task_id, f"✅ **Auto-Completed!**\nPassed AI checks.\n\n{comment_body}", access_token)
                    transition_notion_task(new_task_id, access_token)

        except Exception as e:
            logger.error(f"❌ Failed to auto-create/process Notion rogue ticket: {e}")

    logger.info("--- Notion Sync Cycle Complete ---")


# --- JIRA BACKGROUND WORKER ---
async def process_jira(commits: list, repo_name: str, access_token: str, project_id: str, jira_project_id: str, agent: LumisAgent = None):
    if not jira_project_id:
        logger.info("No Jira Project ID explicitly mapped. Skipping Jira sync.")
        return

    resources = get_accessible_resources(access_token)
    if not resources:
        logger.error("No active Jira sites found for this user.")
        return
    
    current_cloud_id = resources[0]["id"]
    project_key = jira_project_id
    active_issues = get_active_issues(current_cloud_id, access_token, project_key)
    
    task_commit_map = defaultdict(list)
    rogue_commits = []

    # 1. GROUP COMMITS BY TASK
    for commit in commits:
        message = commit.get("message", "")
        if not message or "merge" in message.lower():
            continue

        extracted_key = extract_jira_key(message)
        matched_issue = None
        
        if extracted_key and active_issues:
            matched_issue = next((i for i in active_issues if i['key'] == extracted_key), None)

        if not matched_issue and active_issues:
            matched_issue = await asyncio.to_thread(agent.match_task_to_commit, message, active_issues)
        
        if matched_issue:
            task_commit_map[matched_issue["key"]].append(commit)
        else:
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
            
            # Unblock the server
            analysis = await asyncio.to_thread(agent.analyze_fulfillment, issue=matched_issue, code=combined_diff)

            status = analysis.get("fulfillment_status", "PARTIAL")
            risks = analysis.get("identified_risks", [])
            comment_body = f"🤖 **Lumis AI Sync (Processed {len(task_commits)} commits)**\n\n{analysis.get('summary', 'Work processed.')}"

            try:
                supabase.table("project_risks").delete().eq("project_id", project_id).contains("affected_units", [task_id]).execute()
            except Exception as e:
                logger.error(f"Could not clear old risks for {task_id}: {e}")

            if status != "COMPLETE":
                if not risks:
                    risks = [{"risk_type": "INCOMPLETE_FEATURE", "severity": "Low", "description": analysis.get("summary", "Partial update."), "affected_units": [task_id]}]
                for risk in risks:
                    units = risk.get("affected_units", [])
                    if task_id not in units: units.append(task_id)
                    new_risk = {"project_id": project_id, "risk_type": risk.get("risk_type", "INCOMPLETE"), "severity": risk.get("severity", "Medium"), "description": risk.get("description", "Missing requirements"), "affected_units": units}
                    supabase.table("project_risks").insert(new_risk).execute()
                
                add_jira_comment(current_cloud_id, task_id, f"🛠️ **Progress Update**\n{comment_body}\n\n⚠️ *Risks logged in Lumis.*", access_token)

            elif status == "COMPLETE" and not risks:
                add_jira_comment(current_cloud_id, task_id, f"✅ **Task Completed!**\n{comment_body}\n\n🎉 *All risks resolved.*", access_token)
                transition_jira_issue(current_cloud_id, task_id, access_token)

            for follow_up in analysis.get("follow_up_tasks", []):
                create_jira_issue(current_cloud_id, project_key, f"Follow-up: {follow_up['title'][:100]}", f"Created by Lumis based on recent commits:\n\n{follow_up['description']}", access_token)

        except Exception as e:
            logger.error(f"❌ Failed to sync task {task_id} with Jira: {e}")

    # 3. PROCESS ROGUE COMMITS (SQUASHED)
    if rogue_commits:
        logger.info(f"Auto-generating Jira ticket for {len(rogue_commits)} rogue commits...")
        try:
            combined_diff = ""
            combined_messages = ""
            for c in rogue_commits:
                raw_diff = get_commit_diff(repo_name, c["sha"])
                combined_diff += f"\n--- Commit {c['sha'][:7]} ---\n{clean_diff(raw_diff)}"
                combined_messages += f"- {c.get('message', '')}\n"

            title = f"[Lumis Auto-Sync] {len(rogue_commits)} Unlinked Commits"
            desc = f"Auto-generated ticket for batch push in {repo_name}.\n\nMessages:\n{combined_messages}"
            new_ticket = create_jira_issue(current_cloud_id, project_key, title, desc, access_token)
            new_task_id = new_ticket['key']
            
            dummy_issue = {"key": new_task_id, "fields": {"summary": title, "description": desc}}
            
            analysis = await asyncio.to_thread(agent.analyze_fulfillment, issue=dummy_issue, code=combined_diff)
            
            status = analysis.get("fulfillment_status", "PARTIAL")
            risks = analysis.get("identified_risks", [])
            comment_body = f"🤖 **Lumis AI Sync**\n\n{analysis.get('summary', 'Code analyzed.')}"

            if status != "COMPLETE" or risks:
                if not risks:
                    risks = [{"risk_type": "CODE_RISK", "severity": "Medium", "description": analysis.get("summary", "Potential issue in rogue commit."), "affected_units": [new_task_id]}]
                
                for risk in risks:
                    units = risk.get("affected_units", [])
                    if new_task_id not in units: units.append(new_task_id)
                    new_risk = {"project_id": project_id, "risk_type": risk.get("risk_type", "INCOMPLETE"), "severity": risk.get("severity", "Medium"), "description": risk.get("description", "Missing requirements or code errors"), "affected_units": units}
                    supabase.table("project_risks").insert(new_risk).execute()
                
                add_jira_comment(current_cloud_id, new_task_id, f"⚠️ **Risks Detected!**\n{comment_body}\n\n*Ticket left in To Do.*", access_token)
            else:
                add_jira_comment(current_cloud_id, new_task_id, f"✅ **Auto-Completed!**\nPassed AI checks.\n\n{comment_body}", access_token)
                transition_jira_issue(current_cloud_id, new_task_id, access_token)
                
        except Exception as e:
            logger.error(f"❌ Failed to process rogue commits: {e}")

    logger.info("--- Jira Sync Cycle Complete ---")


def check_taskes(user_id, project_id, commits, repo_name, background_tasks, jira_project_id, notion_project_id, agent):
    """Router function. Strictly mutually exclusive: Prefers Jira if mapped, otherwise Notion."""
    
    if jira_project_id:
        jira_token = get_valid_token(user_id)
        if jira_token:
            background_tasks.add_task(
                process_jira, commits=commits, repo_name=repo_name, access_token=jira_token,
                project_id=project_id, jira_project_id=jira_project_id, agent=agent
            )
            logger.info(f"Jira sync queued for user {user_id}")
        else:
            logger.warning(f"Jira Project mapped, but no valid Jira token for user {user_id}")
            
    elif notion_project_id:
        notion_token = get_valid_notion_token(user_id)
        if notion_token:
            background_tasks.add_task(
                process_notion, commits=commits, repo_name=repo_name, access_token=notion_token,
                database_id=notion_project_id, project_id=project_id, agent=agent
            )
            logger.info(f"Notion sync queued for user {user_id}")
        else:
            logger.warning(f"Notion Project mapped, but no valid Notion token for user {user_id}")
            
    else:
        logger.info(f"No Project Management integration mapped for project {project_id}. Skipping task checks.")