import logging
from src.agent import LumisAgent
from src.services import get_commit_diff
from src.db_client import supabase

logger = logging.getLogger(__name__)

async def process_code_review(project_id: str, commits: list, repo_name: str, agent: LumisAgent):
    """Standalone code review that runs for specific commit diffs (used for webhooks)."""
    # Note: Removed the delete() here so we don't wipe out the full scan results on a small push
    for commit in commits:
        message = commit.get("message", "")
        sha = commit.get("sha")
        
        if sha is None: sha = "unknown"
        if not message or "merge" in message.lower():
            continue

        logger.info(f"--- Running Code Review for Commit Diff: {sha[:7]} ---")

        try:
            diff_text = get_commit_diff(repo_name, sha)
            if not diff_text:
                continue
                
            analysis = agent.analyze_risks(commit_message=message, code_diff=diff_text)
            risks = analysis.get("identified_risks", [])

            if risks:
                for risk in risks:
                    new_risk = {
                        "project_id": project_id, 
                        "risk_type": risk.get("risk_type", "CODE_RISK"), 
                        "severity": risk.get("severity", "Medium"), 
                        "description": f"[{sha[:7]}] {risk.get('description', 'Code issue detected')}", 
                        "affected_units": risk.get("affected_units", [])
                    }
                    try:
                        supabase.table("project_risks").insert(new_risk).execute()
                    except Exception as db_err:
                        if "project_risks_project_id_fkey" in str(db_err):
                            logger.warning(f"Project {project_id} was deleted during analysis. Stopping review.")
                            return 
                        else:
                            raise db_err
                
                logger.info(f"⚠️ Diff review found {len(risks)} risks for {sha[:7]}.")
            else:
                logger.info(f"✅ Diff review passed for {sha[:7]} (No risks).")

        except Exception as e:
            logger.error(f"❌ Failed to process diff code review for {sha}: {e}")


async def process_full_codebase_review(project_id: str, agent: LumisAgent):
    """Scans the entire codebase stored in memory_units for bugs (used for ingestion/sync)."""
    logger.info(f"--- Running Full Codebase Review for Project: {project_id} ---")
    
    # Clear old risks before a full scan
    supabase.table("project_risks").delete().eq("project_id", project_id).eq("risk_type", "CODE_RISK").execute()
    
    # Fetch all code files from the database that were just ingested
    res = supabase.table("memory_units").select("unit_name, content").eq("project_id", project_id).execute()
    if not res or not res.data:
        logger.warning("No files found in memory_units for full scan.")
        return
        
    for file in res.data:
        file_name = file.get("unit_name", "unknown_file")
        content = file.get("content", "")
        
        # Skip empty files
        if not content or len(content.strip()) == 0:
            continue
        
        logger.info(f"Analyzing full file: {file_name}")
        try:
            # Pass the full file content to the LLM
            analysis = agent.analyze_risks(
                commit_message=f"Full repository scan: analyzing {file_name}", 
                code_diff=f"File: {file_name}\n\n{content}"
            )
            risks = analysis.get("identified_risks", [])
            
            if risks:
                for risk in risks:
                    new_risk = {
                        "project_id": project_id, 
                        "risk_type": risk.get("risk_type", "CODE_RISK"), 
                        "severity": risk.get("severity", "Medium"), 
                        "description": f"[{file_name}] {risk.get('description', 'Code issue detected')}", 
                        "affected_units": [file_name]
                    }
                    supabase.table("project_risks").insert(new_risk).execute()
                logger.info(f"⚠️ Found {len(risks)} risks in {file_name}.")
        except Exception as e:
            logger.error(f"❌ Failed to analyze {file_name}: {e}")
    
    logger.info("✅ Full codebase review complete.")