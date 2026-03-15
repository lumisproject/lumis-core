import logging
from src.agent import LumisAgent
from src.db_client import supabase

logger = logging.getLogger(__name__)

async def process_full_codebase_review(project_id: str, agent: LumisAgent, log_callback=None):
    """Scans the entire codebase stored in memory_units for bugs (used for ingestion/sync)."""
    logger.info(f"--- Running Full Codebase Review for Project: {project_id} ---")
    
    # Clear old risks before a full scan
    risk_types_to_clear = ["CODE_RISK", "SECURITY_FLAW", "BUG", "TECH_DEBT", "BREAKING_CHANGE"]
    supabase.table("project_risks").delete().eq("project_id", project_id).in_("risk_type", risk_types_to_clear).execute()
    
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
        
        # FIX: Trigger the UI log update
        if log_callback: 
            log_callback(f"Scanning file for vulnerabilities: {file_name}...")
            
        try:
            # Pass the full file content to the LLM
            analysis = agent.analyze_risks(
                commit_message=f"Full repository scan: analyzing {file_name}", 
                code=f"File: {file_name}\n\n{content}"
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
                
                # FIX: Send found risks to the UI log stream
                if log_callback: 
                    log_callback(f"⚠️ Found {len(risks)} risks in {file_name}.")
                    
        except Exception as e:
            logger.error(f"❌ Failed to analyze {file_name}: {e}")
            if log_callback: 
                log_callback(f"❌ Failed to analyze {file_name}")
    
    logger.info("✅ Full codebase review complete.")
    if log_callback: 
        log_callback("✅ Full codebase review complete.")