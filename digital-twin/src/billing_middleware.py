import logging
from datetime import datetime
from fastapi import HTTPException, Depends
from src.db_client import supabase, get_current_user

logger = logging.getLogger("LumisAPI")

# Define the limits for each tier
TIER_LIMITS = {
    "free": {"queries": 50, "projects": 1, "storage_gb": 1},
    "pro": {"queries": 500, "projects": 5, "storage_gb": 10},
    "team": {"queries": float('inf'), "projects": float('inf'), "storage_gb": float('inf')}
}

async def get_user_tier_and_usage(current_user=Depends(get_current_user)):
    """Fetches the user's active tier and their usage stats for the current month."""
    user_id = str(current_user.id)
    current_month = datetime.utcnow().strftime('%Y-%m')

    # 1. Get current tier
    sub_res = supabase.table("user_subscriptions").select("tier").eq("user_id", user_id).execute()
    tier = sub_res.data[0].get("tier", "free") if sub_res.data else "free"

    # 2. Get or initialize current month's usage
    usage_res = supabase.table("usage_stats").select("*").eq("user_id", user_id).eq("billing_month", current_month).execute()
    
    if not usage_res.data:
        # First time this user is making a request this month, initialize row
        new_usage = {"user_id": user_id, "billing_month": current_month, "query_count": 0}
        supabase.table("usage_stats").insert(new_usage).execute()
        usage = new_usage
    else:
        usage = usage_res.data[0]

    return {
        "user_id": user_id,
        "tier": tier,
        "usage": usage,
        "limits": TIER_LIMITS[tier]
    }

async def verify_chat_limit(tier_data: dict = Depends(get_user_tier_and_usage)):
    """Middleware to block chat requests if monthly limit is exceeded."""
    if tier_data["usage"]["query_count"] >= tier_data["limits"]["queries"]:
        raise HTTPException(
            status_code=403, 
            detail=f"Monthly query limit of {tier_data['limits']['queries']} reached. Please upgrade your plan."
        )
    return tier_data

async def verify_project_limit(tier_data: dict = Depends(get_user_tier_and_usage)):
    """Middleware to block new project ingestion if project count OR storage limit is exceeded."""
    user_id_str = str(tier_data["user_id"])
    
    # 1. Check Project Count Limit
    projects_res = supabase.table("projects").select("id", count="exact").eq("user_id", user_id_str).execute()
    project_count = projects_res.count if projects_res.count is not None else 0

    if project_count >= tier_data["limits"]["projects"]:
        raise HTTPException(
            status_code=403, 
            detail=f"Project limit of {tier_data['limits']['projects']} reached. Please upgrade your plan."
        )

    # 2. Check Storage Limit (team tier are excluded)
    if tier_data["limits"]["storage_gb"] != float('inf'):
        try:
            # Call the Supabase RPC we created
            storage_res = supabase.rpc("get_user_storage_bytes", {"target_user_id": user_id_str}).execute()
            total_bytes = storage_res.data if storage_res.data else 0
            
            # Convert bytes to Gigabytes (1 GB = 1024^3 bytes)
            used_gb = total_bytes / (1024 * 1024 * 1024)
            
            if used_gb >= tier_data["limits"]["storage_gb"]:
                raise HTTPException(
                    status_code=403, 
                    detail=f"Storage limit of {tier_data['limits']['storage_gb']} GB reached. Please upgrade your plan or delete an existing project."
                )
        except Exception as e:
            logger.error(f"Failed to check storage limit for user {user_id_str}: {e}")

    return tier_data

def increment_query_usage(user_id: str):
    """Utility function to call AFTER a successful LLM generation."""
    current_month = datetime.utcnow().strftime('%Y-%m')
    
    # Fetch current count
    usage_res = supabase.table("usage_stats").select("query_count").eq("user_id", user_id).eq("billing_month", current_month).execute()
    if usage_res.data:
        current_count = usage_res.data[0].get("query_count", 0)
        # Increment by 1
        supabase.table("usage_stats").update({"query_count": current_count + 1}).eq("user_id", user_id).eq("billing_month", current_month).execute()