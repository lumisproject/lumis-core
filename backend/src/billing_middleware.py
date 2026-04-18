import logging
from datetime import datetime
from fastapi import HTTPException, Depends
from src.db_client import supabase, get_current_user

logger = logging.getLogger("LumisAPI")

# VERSION: 1.6.0
logger.info("Initializing Billing Middleware v1.6.0 - 100MB Free Storage Support")

def get_tier_limits(tier: str):
    """Returns a fresh copy of limits for a given tier. Avoids global mutation."""
    limits = {
        "free": {
            "queries": 50, 
            "projects": 3, 
            "storage_gb": 0.1,  # 100 MB Limit
            "reasoning": False,
            "memory": False
        },
        "premium": {
            "queries": float('inf'), 
            "projects": float('inf'), 
            "storage_gb": float('inf'),
            "reasoning": True,
            "memory": True
        }
    }
    return limits.get(tier, limits["free"]).copy()


async def get_user_tier_and_usage(current_user=Depends(get_current_user)):
    """Fetches the user's active tier and their usage stats for the current month."""
    try:
        user_id = str(current_user.id)
        current_month = datetime.utcnow().strftime('%Y-%m')

        # 1. Get current tier
        sub_res = supabase.table("user_subscriptions").select("tier").eq("user_id", user_id).execute()
        tier = sub_res.data[0].get("tier", "free") if sub_res.data else "free"

        # 2. Get or initialize current month's usage
        usage_res = supabase.table("usage_stats").select("*").eq("user_id", user_id).eq("billing_month", current_month).execute()
        
        if not usage_res.data:
            new_usage = {"user_id": user_id, "billing_month": current_month, "query_count": 0}
            supabase.table("usage_stats").insert(new_usage).execute()
            usage = new_usage
        else:
            usage = usage_res.data[0]

        # 3. Calculate current storage usage via RPC
        storage_bytes = 0
        try:
            storage_res = supabase.rpc("get_user_storage_bytes", {"target_user_id": user_id}).execute()
            storage_bytes = storage_res.data if storage_res.data else 0
        except Exception as e:
            logger.error(f"Failed to fetch storage bytes for user {user_id}: {e}")

        # Add storage bytes to the usage dictionary for the frontend
        usage["storage_bytes"] = storage_bytes

        return {
            "user_id": user_id,
            "tier": tier,
            "usage": usage,
            "limits": get_tier_limits(tier)
        }
    except Exception as e:
        logger.error(f"Error in get_user_tier_and_usage: {e}")
        raise HTTPException(status_code=500, detail="Billing check failed")

async def verify_chat_limit(tier_data: dict = Depends(get_user_tier_and_usage)):
    """Middleware to block chat requests if monthly limit is exceeded."""
    limits = tier_data.get("limits", {})
    usage = tier_data.get("usage", {})
    
    query_count = usage.get("query_count", 0) or 0
    query_limit = limits.get("queries", 0) or 0
    
    logger.info(f"VerifyChatLimit: User={tier_data['user_id']} Usage={query_count} Limit={query_limit}")

    if query_limit != float('inf'):
        if int(query_count) >= int(query_limit):
            raise HTTPException(
                status_code=403, 
                detail=f"Monthly query limit of {query_limit} reached. Please upgrade your plan."
            )
    return tier_data

async def verify_project_limit(tier_data: dict = Depends(get_user_tier_and_usage)):
    """Middleware to block new project ingestion if project count OR storage limit is exceeded."""
    user_id_str = str(tier_data["user_id"])
    limits = tier_data.get("limits", {})
    usage = tier_data.get("usage", {})
    
    # 1. Check Project Count Limit
    projects_res = supabase.table("projects").select("id", count="exact").eq("user_id", user_id_str).execute()
    project_count = projects_res.count if projects_res.count is not None else 0

    project_limit = limits.get("projects")
    if project_limit is not None and project_limit != float('inf'):
        if int(project_count) >= int(project_limit):
            raise HTTPException(
                status_code=403, 
                detail=f"Project limit of {project_limit} reached. Please upgrade your plan."
            )

    # 2. Check Storage Limit
    storage_limit_gb = limits.get("storage_gb")
    if storage_limit_gb is not None and storage_limit_gb != float('inf'):
        # usage["storage_bytes"] is populated in get_user_tier_and_usage
        total_bytes = usage.get("storage_bytes", 0)
        used_gb = total_bytes / (1024 * 1024 * 1024)
        
        if used_gb >= storage_limit_gb:
            # Convert back to MB for a clearer error message
            limit_mb = int(storage_limit_gb * 1024)
            raise HTTPException(
                status_code=403, 
                detail=f"Storage limit of {limit_mb} MB reached. Please upgrade your plan."
            )

    return tier_data

def increment_query_usage(user_id: str):
    """Utility function to call AFTER a successful LLM generation."""
    current_month = datetime.utcnow().strftime('%Y-%m')
    try:
        usage_res = supabase.table("usage_stats").select("query_count").eq("user_id", user_id).eq("billing_month", current_month).execute()
        if usage_res.data:
            current_count = usage_res.data[0].get("query_count", 0) or 0
            supabase.table("usage_stats").update({"query_count": current_count + 1}).eq("user_id", user_id).eq("billing_month", current_month).execute()
    except Exception as e:
        logger.error(f"Failed to increment query usage for {user_id}: {e}")