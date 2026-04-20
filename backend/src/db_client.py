import os
from supabase import create_client, Client
from dotenv import load_dotenv
from fastapi import HTTPException, Header

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")

if not url or not key:
    raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in .env")

supabase: Client = create_client(url, key)

# --- READ OPERATIONS ---

def get_unit_footprint(project_id, unit_name):
    """Checks if a unit already exists and returns its hash to prevent overwrites."""
    try:
        res = supabase.table("memory_units")\
            .select("code_footprint")\
            .eq("project_id", project_id)\
            .eq("unit_name", unit_name)\
            .limit(1)\
            .execute()
        return res.data[0]['code_footprint'] if res.data else None
    except Exception:
        return None

def get_project_data(project_id):
    """Fetches the entire graph for risk analysis."""
    units_resp = supabase.table("memory_units")\
        .select("unit_name, file_path, last_modified_at, content, risk_score")\
        .eq("project_id", project_id).execute()
    
    edges_resp = supabase.table("graph_edges")\
        .select("source_unit_name, target_unit_name")\
        .eq("project_id", project_id).execute()
        
    return units_resp.data or [], edges_resp.data or []

# --- WRITE OPERATIONS ---

def save_memory_units(project_id, units_data_list):
    """Upserts multiple memory units in a single network transaction."""
    if not units_data_list: return
    
    payloads = []
    for unit_data in units_data_list:
        payloads.append({
            "project_id": project_id,
            "unit_name": unit_data["identifier"],
            "unit_type": unit_data.get("type", "unknown"),
            "file_path": unit_data["file_path"],
            "content": unit_data.get("content"),
            "code_footprint": unit_data.get("footprint"),
            "embedding": unit_data.get("embedding"),
            "last_modified_at": unit_data.get("last_modified_at"),
            "author_email": unit_data.get("author_email")
        })
    
    res = supabase.table("memory_units").upsert(
        payloads, on_conflict="project_id,unit_name"
    ).execute()
    
    # 1. Force an exception if Supabase returns an error internally
    if hasattr(res, "error") and res.error:
        raise Exception(f"Supabase Upsert Error (memory_units): {res.error}")
        
    # 2. Check for RLS silent blocking
    if hasattr(res, "data") and not res.data:
        raise Exception("Supabase inserted 0 rows into memory_units! Check if Row Level Security (RLS) is blocking the insert, or use your service_role key.")
        
    return res

def save_edges(project_id, edges_list_or_source=None, targets_list=None, edge_type="calls"):
    """Handles both single edge inserts and bulk lists."""
    if targets_list is not None:
        edges_list = [{
            "project_id": project_id, 
            "source_unit_name": edges_list_or_source, 
            "target_unit_name": target,
            "edge_type": edge_type
        } for target in targets_list]
    else:
        edges_list = edges_list_or_source

    if not edges_list: return
    
    source_units = list(set([edge["source_unit_name"] for edge in edges_list]))
    
    if source_units:
        del_res = supabase.table("graph_edges").delete().eq("project_id", project_id).in_("source_unit_name", source_units).execute()
        if hasattr(del_res, "error") and del_res.error:
             raise Exception(f"Supabase Edge Delete Error: {del_res.error}")
            
    res = supabase.table("graph_edges").insert(edges_list).execute()
    
    if hasattr(res, "error") and res.error:
        raise Exception(f"Supabase Edge Insert Error: {res.error}")
        
    if hasattr(res, "data") and not res.data:
        raise Exception("Supabase inserted 0 rows into graph_edges! Check if Row Level Security (RLS) is blocking the insert.")
        
    return res

def save_risk_alerts(project_id, risks):
    if not risks: return
    supabase.table("project_risks").delete().eq("project_id", project_id).in_("risk_type", ["Legacy Conflict", "Predictive Delay"]).execute()
    res = supabase.table("project_risks").insert(risks).execute()
    
    if hasattr(res, "error") and res.error:
        raise Exception(f"Supabase Risk Insert Error: {res.error}")

def get_global_user_config(user_id: str) -> dict:
    res = (
        supabase.table("user_settings")
        .select("user_config")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    db_config = res.data[0].get("user_config", {}) if res and res.data else {}

    if db_config.get("use_default") is True:
        return {
            "provider": None,
            "api_key": None,
            "model": None,
            "base_url": None, 
            "use_default": True,
            "intake_user": db_config.get("intake_user"),
            "intake_password": db_config.get("intake_password")
        }
    
    if not db_config:
        return {"use_default": True}
        
    return db_config

def get_current_user(authorization: str = Header(None)):
    import time
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    
    token = authorization.split(" ")[1]

    for attempt in range(3):
        try:
            user_response = supabase.auth.get_user(token)
            if not user_response or not user_response.user:
                raise HTTPException(status_code=401, detail="Invalid session")
            return user_response.user
        except Exception as e:
            # If it's the Windows socket error, wait a tiny bit and retry
            if "10035" in str(e) or "ReadError" in str(type(e).__name__):
                if attempt < 2:
                    time.sleep(0.2)
                    continue
            
            # If it's a real error (or we ran out of retries), fail securely
            import logging
            logging.getLogger("LumisAPI").error(f"Auth verification failed: {str(e)}")
            raise HTTPException(status_code=401, detail="Session verification failed")