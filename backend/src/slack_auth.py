import requests
import secrets
from urllib.parse import urlencode
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import RedirectResponse
from src.config import Config
from src.db_client import supabase
from src.limiter import limiter
import logging

logger = logging.getLogger("LumisAPI")
slack_auth_router = APIRouter()

# Bot scopes allow Lumis to read public channels (to list them in settings) and post messages
SCOPES = ["channels:read", "groups:read", "chat:write", "chat:write.public", "app_mentions:read"]

def get_valid_slack_token(user_id: str):
    res = supabase.table("slack_tokens").select("access_token").eq("user_id", user_id).execute()
    if res.data:
        return res.data[0]["access_token"]
    return None

@slack_auth_router.get("/auth/slack/connect")
@limiter.limit("5/minute")
def connect_slack(state: str, request: Request):
    import redis
    redis_client = redis.Redis.from_url(Config.REDIS_URL, decode_responses=True)
    
    nonce = secrets.token_hex(16)
    redis_client.setex(f"oauth_state:{nonce}", 600, state) # state here is the user_id
    
    full_redirect_uri = f"{Config.FRONTEND_URL.rstrip('/')}{Config.SLACK_REDIRECT_URI}"
    
    params = {
        "client_id": Config.SLACK_CLIENT_ID,
        "scope": ",".join(SCOPES),
        "redirect_uri": full_redirect_uri,
        "state": nonce,
    }
    return RedirectResponse(f"https://slack.com/oauth/v2/authorize?{urlencode(params)}")

@slack_auth_router.get("/auth/slack/callback")
@limiter.limit("10/minute")
def slack_callback(request: Request):
    import redis
    redis_client = redis.Redis.from_url(Config.REDIS_URL, decode_responses=True)

    code = request.query_params.get("code")
    state = request.query_params.get("state")
    
    if not code or not state: 
        return RedirectResponse(f"{Config.SLACK_REDIRECT}?error=Missing code or state")

    user_id = redis_client.get(f"oauth_state:{state}")
    if not user_id:
        logger.warning(f"Invalid or expired OAuth state received for Slack: {state}")
        return RedirectResponse(f"{Config.SLACK_REDIRECT}?error=Session expired. Please try again.")
    
    redis_client.delete(f"oauth_state:{state}")
    
    try:
        full_redirect_uri = f"{Config.FRONTEND_URL.rstrip('/')}{Config.SLACK_REDIRECT_URI}"
        res = requests.post("https://slack.com/api/oauth.v2.access", data={
            "client_id": Config.SLACK_CLIENT_ID,
            "client_secret": Config.SLACK_CLIENT_SECRET,
            "code": code,
            "redirect_uri": full_redirect_uri
        })
        res.raise_for_status()
        data = res.json()
        
        if not data.get("ok"):
            logger.error(f"Slack OAuth Error: {data.get('error')}")
            return RedirectResponse(f"{Config.SLACK_REDIRECT}?error=Failed to connect Slack: {data.get('error')}")
            
        access_token = data.get("access_token")
        team_id = data.get("team", {}).get("id")
        team_name = data.get("team", {}).get("name")
        
        # Save to DB
        supabase.table("slack_tokens").upsert({
            "user_id": user_id,
            "access_token": access_token,
            "team_id": team_id,
            "team_name": team_name
        }).execute()
        
        return RedirectResponse(f"{Config.SLACK_REDIRECT}?message=Slack connected successfully")
    except Exception as e:
        logger.error(f"Slack Callback error: {e}")
        return RedirectResponse(f"{Config.SLACK_REDIRECT}?error=Failed to connect Slack")

@slack_auth_router.delete("/api/slack/disconnect/{user_id}")
async def disconnect_slack(user_id: str):
    try:
        supabase.table("slack_tokens").delete().eq("user_id", user_id).execute()
        # Also clear all project mappings for this user
        supabase.table("projects").update({"slack_channel_id": None}).eq("user_id", user_id).execute()
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Disconnect error: {e}")
        raise HTTPException(status_code=500, detail="Failed to disconnect Slack")