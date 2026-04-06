import requests
from urllib.parse import urlencode
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import RedirectResponse
from src.config import Config
from src.db_client import supabase
import logging
import secrets

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("LumisAPI")

github_auth_router = APIRouter()

def build_github_auth_url(user_id: str):
    params = {
        "client_id": Config.GITHUB_CLIENT_ID,
        "redirect_uri": Config.GITHUB_REDIRECT_URI,
        "scope": "repo read:user admin:repo_hook", # 'repo' for code, 'admin:repo_hook' for webhooks
        "state": user_id,
    }
    return f"https://github.com/login/oauth/authorize?{urlencode(params)}"

def save_github_token(user_id: str, access_token: str):
    data = {
        "user_id": user_id, 
        "access_token": access_token
    }
    supabase.table("github_tokens").upsert(data).execute()

def exchange_code_for_github_token(code: str, user_id: str):
    payload = {
        "client_id": Config.GITHUB_CLIENT_ID,
        "client_secret": Config.GITHUB_CLIENT_SECRET,
        "code": code,
        "redirect_uri": Config.GITHUB_REDIRECT_URI
    }
    headers = {"Accept": "application/json"}
    
    res = requests.post("https://github.com/login/oauth/access_token", data=payload, headers=headers)
    res.raise_for_status()
    tokens = res.json()
    
    if "access_token" in tokens:
        save_github_token(user_id, tokens["access_token"])
    else:
        raise Exception(f"GitHub Auth Failed: {tokens}")
        
    return tokens

def get_valid_github_token(user_id: str):
    try:
        response = supabase.table("github_tokens").select("*").eq("user_id", user_id).execute()
        user_data = response.data[0] if response.data else None
        
        if not user_data: 
            return None
            
        return user_data["access_token"]
    except Exception as e:
        logger.error(f"❌ Error fetching GitHub token: {str(e)}")
        return None

@github_auth_router.get("/auth/github/connect")
def connect_github(state: str):
    return RedirectResponse(build_github_auth_url(state))

@github_auth_router.get("/auth/github/callback")
def github_callback(request: Request):
    code = request.query_params.get("code")
    state = request.query_params.get("state")  # This is the user_id
    
    if not code or not state: 
        return {"error": "Missing code or state"}
        
    try:
        exchange_code_for_github_token(code, state)
        return RedirectResponse(f"{Config.FRONTEND_URL}/app/settings?message=GitHub connected successfully")
    except Exception as e:
        logger.error(f"GitHub Callback error: {e}")
        return RedirectResponse(f"{Config.FRONTEND_URL}/app/settings?error=Failed to connect GitHub")

@github_auth_router.delete("/api/github/disconnect/{user_id}")
async def disconnect_github(user_id: str):
    try:
        supabase.table("github_tokens").delete().eq("user_id", user_id).execute()
        return {"status": "success", "message": "GitHub disconnected successfully"}
    except Exception as e:
        logger.error(f"GitHub Disconnect error: {e}")
        raise HTTPException(status_code=500, detail="Failed to disconnect GitHub")

@github_auth_router.get("/api/github/repos/{user_id}")
def get_user_repos(user_id: str):
    """Fetches all repositories the user has access to."""
    token = get_valid_github_token(user_id)
    if not token:
        raise HTTPException(status_code=401, detail="GitHub not connected")
    
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3+json"}
    # Fetch 100 most recently updated repos
    res = requests.get("https://api.github.com/user/repos?sort=updated&per_page=100", headers=headers)
    
    if res.status_code != 200:
        raise HTTPException(status_code=res.status_code, detail="Failed to fetch repos")
    
    repos = res.json()
    # Return a simplified list for the frontend dropdown
    return [{"id": r["id"], "name": r["name"], "full_name": r["full_name"], "url": r["clone_url"]} for r in repos]

@github_auth_router.post("/api/github/webhook")
@github_auth_router.post("/api/github/webhook")
async def setup_webhook(request: Request):
    """Automatically configures the Lumis webhook on the selected repository."""
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    user_id = payload.get("user_id")
    project_id = payload.get("project_id")
    repo_full_name = payload.get("repo_full_name")
    
    print(f"\n--- 🚀 STARTING WEBHOOK SETUP FOR: {repo_full_name} ---")
    
    token = get_valid_github_token(user_id)
    if not token:
        print("❌ ERROR: No GitHub token found in database.")
        raise HTTPException(status_code=401, detail="GitHub not connected")
        
    webhook_url = f"{Config.backend_url}/api/webhook/{user_id}/{project_id}"
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3+json"}
    
    print(f"🔍 1. Checking existing webhooks...")
    hooks_res = requests.get(f"https://api.github.com/repos/{repo_full_name}/hooks", headers=headers)
    print(f"   ↳ GitHub Response Code: {hooks_res.status_code}")
    
    if hooks_res.status_code != 200:
        print(f"   ↳ ❌ GitHub Error: {hooks_res.text}")
    else:
        for hook in hooks_res.json():
            if hook.get("config", {}).get("url") == webhook_url:
                print("✅ Webhook already exists!")
                return {"status": "exists", "message": "Webhook already configured"}
                
    print(f"⚡ 2. Attempting to create new webhook pointing to: {webhook_url}")
    
    # --- NEW: Generate a secure secret and save it to the project ---
    webhook_secret = secrets.token_hex(20)
    supabase.table("projects").update({"webhook_secret": webhook_secret}).eq("id", project_id).execute()
    
    hook_payload = {
        "name": "web",
        "active": True,
        "events": ["push"], 
        "config": {
            "url": webhook_url,
            "content_type": "json",
            "insecure_ssl": "0",
            "secret": webhook_secret # <--- NEW: Tell GitHub to use this secret
        }
    }
    
    res = requests.post(f"https://api.github.com/repos/{repo_full_name}/hooks", headers=headers, json=hook_payload)
    print(f"   ↳ GitHub Response Code: {res.status_code}")
    print(f"   ↳ GitHub Message: {res.text}")
    
    if res.status_code in [200, 201]:
        print("✅ SUCCESS: Webhook created successfully!\n")
        return {"status": "created", "message": "Webhook successfully created"}
    elif res.status_code == 404 or res.status_code == 403:
        # This specifically means Org Access was denied or hidden
        print("❌ FAILED: Organization access denied.\n")
        raise HTTPException(status_code=403, detail="ORG_ACCESS_REQUIRED")
    else:
        print("❌ FAILED to create webhook.\n")
        raise HTTPException(status_code=res.status_code, detail="Failed to create webhook")