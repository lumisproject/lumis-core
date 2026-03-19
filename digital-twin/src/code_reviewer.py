import logging
from src.agent import LumisAgent
from src.db_client import supabase
from src.retriever import GraphRetriever

logger = logging.getLogger(__name__)

async def process_impact_review(project_id: str, agent: LumisAgent, log_callback=None):
    """
    Smart Code Review: Only reviews recently changed units (Hotspots) 
    and their Graph-RAG neighbors to save LLM tokens and increase accuracy.
    """
    logger.info(f"--- Running Impact-Based Code Review for Project: {project_id} ---")
    
    # Clear old architectural risks before a new scan
    risk_types_to_clear = ["ARCHITECTURAL_FLAW", "TIGHT_COUPLING", "CIRCULAR_DEPENDENCY", "CONTRACT_BREAK"]
    supabase.table("project_risks").delete().eq("project_id", project_id).in_("risk_type", risk_types_to_clear).execute()
    
    # 1. HOTSPOT FILTER: Fetch only the top 15 most recently modified units
    res = supabase.table("memory_units")\
        .select("unit_name, content, file_path")\
        .eq("project_id", project_id)\
        .order("last_modified_at", desc=True)\
        .limit(15)\
        .execute()
        
    if not res or not res.data:
        logger.warning("No files found in memory_units for impact scan.")
        return
        
    hotspots = res.data
    retriever = GraphRetriever(project_id)
    all_risks = []

    for unit in hotspots:
        unit_name = unit.get("unit_name", "unknown_unit")
        content = unit.get("content", "")
        
        # Skip empty files
        if not content or len(content.strip()) == 0:
            continue
        
        logger.info(f"Analyzing impact radius for: {unit_name}")
        if log_callback: 
            log_callback(f"Tracing architectural blast radius for {unit_name}...")
            
        try:
            # 2. GRAPH-RAG: Use your existing retriever to fetch callers/callees
            graph_context = retriever.get_architectural_context([unit_name])
            
            # 3. AI AGENT: Pass the Slice to the Aggressive Architect
            analysis = agent.analyze_architectural_risks(
                unit_name=unit_name,
                code=content,
                graph_context=graph_context
            )
            
            risks = analysis.get("identified_risks", [])
            
            if risks:
                for risk in risks:
                    # Merge affected neighbors from the LLM with the core unit
                    affected = [unit_name] + risk.get("affected_neighbors", [])
                    
                    all_risks.append({
                        "project_id": project_id, 
                        "risk_type": risk.get("risk_type", "ARCHITECTURAL_FLAW"), 
                        "severity": risk.get("severity", "Medium"), 
                        "description": f"[{unit_name}] {risk.get('description', 'Architectural issue detected')}", 
                        "affected_units": list(set(affected))  # Deduplicate
                    })
                
                logger.info(f"⚠️ Found {len(risks)} architectural risks in {unit_name}.")
                if log_callback: 
                    log_callback(f"⚠️ Found {len(risks)} risks in {unit_name}.")
                    
        except Exception as e:
            logger.error(f"❌ Failed to analyze impact for {unit_name}: {e}")
            if log_callback: 
                log_callback(f"❌ Failed to analyze {unit_name}")
    
    # 4. BATCH SAVE: Insert all found risks efficiently
    if all_risks:
        supabase.table("project_risks").insert(all_risks).execute()

    logger.info("✅ Impact-based codebase review complete.")
    if log_callback: 
        log_callback("✅ Impact-based review complete.")