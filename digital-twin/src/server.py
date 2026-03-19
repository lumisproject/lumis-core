import logging
import requests
import json
from typing import Dict, Optional
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from src.agent import LumisAgent
from src.db_client import supabase, get_current_user, get_global_user_config
from src.config import Config
from src.jira_auth import jira_auth_router, get_valid_token
from src.jira_client import get_accessible_resources, get_projects
from src.notion_auth import notion_auth_router, get_valid_notion_token
from src.tasks_checking import check_taskes
from src.cryptography import encrypt_value
from src.stripe_router import stripe_router
from src.billing_middleware import verify_chat_limit, get_user_tier_and_usage, increment_query_usage

# --- CONFIGURATION ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("LumisAPI")

app = FastAPI(title="Lumis Brain API")

# Allow Frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Auth Routes
app.include_router(jira_auth_router)
app.include_router(notion_auth_router)
app.include_router(stripe_router)

# --- STATE MANAGEMENT ---
active_agents: Dict[str, LumisAgent] = {}
ingestion_state: Dict[str, Dict] = {}

# --- MODELS ---
class ChatRequest(BaseModel):
    project_id: str
    query: str
    mode: str = "single-turn"
    reasoning: bool = False
    user_config: Optional[Dict] = None

class IngestRequest(BaseModel):
    user_id: str
    repo_url: str
    user_config: Optional[Dict] = None

def get_repo_name_from_url(repo_url: str) -> str:
    """Normalize a GitHub URL to the `owner/repo` form expected by the API."""
    # strip .git suffix and any trailing slash
    name = repo_url.rstrip("/")
    if name.endswith(".git"):
        name = name[:-4]
    # remove protocol and domain if present
    for prefix in ("https://github.com/", "http://github.com/", "git@github.com:"):
        if name.startswith(prefix):
            name = name[len(prefix) :]
            break
    return name


def fetch_commits(repo_full_name: str):
    """Return the most recent commits for the repository as a normalized list."""
    url = f"https://api.github.com/repos/{repo_full_name}/commits"
    headers = {"Accept": "application/vnd.github.v3+json"}
    
    # Safely attach token if it exists
    if getattr(Config, 'GITHUB_TOKEN', None):
        headers["Authorization"] = f"token {Config.GITHUB_TOKEN}"
        
    try:
        resp = requests.get(url, headers=headers, params={"per_page": 10})
        resp.raise_for_status()
        commits_data = resp.json()
        
        formatted_commits = []
        for c in commits_data:
            formatted_commits.append({
                "sha": c.get("sha"),
                "message": c.get("commit", {}).get("message", "")
            })
        return formatted_commits
    except Exception as e:
        logger.error(f"Failed to fetch commits for {repo_full_name}. Ensure your GITHUB_TOKEN in .env has 'repo' access. Error: {e}")
        return []
    
def update_progress(project_id, task, message):
    if project_id not in ingestion_state:
        ingestion_state[project_id] = {"status": "processing", "logs": [], "step": "Starting"}
    
    state = ingestion_state[project_id]

    if task == "STARTING":
        state["status"] = "PROGRESSING"
        state["logs"] = []
        state["error"] = None
    elif task == "ANALYZING":
        state["status"] = "ANALYZING"
    elif task == "DONE" or task == "READY":
        state["status"] = "ready"
    elif task == "Error":
        state["status"] = "error"
    
    state["step"]=task

    if message:
        state["logs"].append(f"[{task}] {message}")

    # Persist critical status changes to the database inside the sync_state JSONB column
    # This ensures the frontend can see the current sync progress in real-time
    try:
        supabase.table("projects").update({
            "sync_state": {
                "status": state["status"],
                "step": state["step"],
                "logs": state["logs"][-20:] # Show last 20 logs for better live tracking
            }
        }).eq("id", project_id).execute()
    except Exception as db_err:
        logger.error(f"Failed to persist sync status to DB: {db_err}")

    if project_id in ingestion_state:
        ingestion_state[project_id] = state


async def run_ingestion_pipeline(repo_url: str, project_id: str, user_config: Dict = None, agent: LumisAgent = None):
    def progress_cb(t, m):
        update_progress(project_id, t, m)
        
    try:
        from src.ingestor import ingest_repo
        await ingest_repo(repo_url=repo_url, project_id=project_id, progress_callback=progress_cb, user_config=user_config)
        
        progress_cb("DONE", "Sync and analysis complete.")

    except Exception as e:
        logger.error(f"Ingestion Pipeline Error: {e}")
        progress_cb("Error", f"Pipeline failed: {str(e)}")


async def run_risk_analysis_task(project_id: str, user_config: Dict = None):
    def progress_cb(t, m):
        update_progress(project_id, t, m)

    try:
        from src.risk_engine import calculate_predictive_risks
        from src.code_reviewer import process_impact_review
        
        progress_cb("ANALYZING", "Neural Risk Engine: Initializing codebase scan...")
        await calculate_predictive_risks(project_id, user_config=user_config, log_callback=lambda msg: progress_cb("ANALYZING", msg))
        
        # Trigger the new Graph-RAG Impact Review
        await process_impact_review(
                    project_id, 
                    LumisAgent(project_id=project_id, user_config=user_config),
                    log_callback=lambda msg: progress_cb("ANALYZING", msg)
                )
        progress_cb("READY", "Neural Risk Analysis Complete.")
    except Exception as e:
        logger.error(f"Risk Analysis Error: {e}")
        progress_cb("Error", f"Risk analysis failed: {str(e)}")
            

# --- ENDPOINTS ---

@app.post("/api/webhook/{user_id}/{project_id}")
async def github_webhook(user_id: str, project_id: str, request: Request, background_tasks: BackgroundTasks):
    try:
        payload = await request.json()

        # 1. Handle GitHub Zen Ping immediately
        if "zen" in payload:
            logger.info("GitHub Zen ping received. Connection verified.")
            return {"status": "ok", "message": "Lumis Unified Gateway is listening"}

        # 2. Only proceed if it is a push to main or master
        ref = payload.get("ref", "")
        if ref not in ["refs/heads/main", "refs/heads/master"]:
            reason = f"Ignored event on branch: {ref}" if ref else "Unsupported webhook event (e.g. Pull Request)"
            logger.info(f"Webhook Ignored: {reason}")
            return {"status": "ignored", "reason": reason}

        global_config = get_global_user_config(user_id)
        global_config["user_id"] = user_id

        proj_row = (
            supabase.table("projects")
            .select("jira_project_id, notion_project_id")
            .eq("id", project_id)
            .limit(1)
            .execute()
        )
        
        db_user_config = {}
        jira_proj = None
        notion_proj = None

        if proj_row and proj_row.data:
            proj_data = proj_row.data[0] if isinstance(proj_row.data, list) else proj_row.data
            jira_proj = proj_data.get("jira_project_id")
            notion_proj = proj_data.get("notion_project_id")

        agent = LumisAgent(project_id=project_id, max_steps=3, user_config=global_config, mode="single-turn")

        # Extract commit data from main/master push
        new_sha = payload.get("after")
        repo_url = payload.get("repository", {}).get("clone_url")

        # Set status to syncing immediately
        supabase.table("projects").update({
            "last_commit": new_sha,
            "sync_state": {
                "status": "syncing",
                "step": "Webhook received",
                "logs": ["GitHub Push detected. Initializing Sync..."]
            }
        }).eq("id", project_id).execute()
        
        logger.info(f"Webhook Trigger: Push detected on {ref} (Commit: {new_sha[:7]})")

        update_progress(
            project_id, 
            "STARTING", 
            f"GitHub Push detected ({new_sha[:7]}). Initializing Unified Sync..."
        )

        background_tasks.add_task(
            run_ingestion_pipeline,
            repo_url=repo_url,
            project_id=project_id,
            user_config=db_user_config,
            agent=agent
        )

        raw_commits = payload.get("commits", [])
        repo_name = payload.get("repository", {}).get("full_name")

        normalized_commits = []
        for c in raw_commits:
            normalized_commits.append({
                "sha": c.get("id", c.get("sha")),
                "message": c.get("message", "")
            })

        check_taskes(
            user_id=user_id,
            project_id=project_id,
            commits=normalized_commits,
            repo_name=repo_name,
            background_tasks=background_tasks,
            jira_project_id=jira_proj,
            notion_project_id=notion_proj,
            agent=agent
        )
        
        return {"status": "sync_started", "commit": new_sha}

    except Exception as e:
        logger.error(f"CRITICAL: Unified Webhook Error: {str(e)}")
        return {"status": "error", "message": str(e)}

@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest, tier_data: dict = Depends(verify_chat_limit)):
    try:
        proj_row = supabase.table("projects").select("user_id").eq("id", req.project_id).limit(1).execute()
        if not proj_row or not proj_row.data:
            raise HTTPException(status_code=404, detail="Project not found")
            
        user_id = proj_row.data[0]["user_id"]
        
        # Security check: Ensure the authenticated user actually owns this project
        if str(user_id) != str(tier_data["user_id"]):
            raise HTTPException(status_code=403, detail="Forbidden: You do not own this project")
        
        global_config = get_global_user_config(user_id)
        global_config["user_id"] = user_id
        global_config["reasoning_enabled"] = req.reasoning
        global_config["mode"] = req.mode

        if req.project_id not in active_agents:
            logger.info(f"✨ Spawning agent for {req.project_id}")
            agent = LumisAgent(project_id=req.project_id, user_config=global_config)
            active_agents[req.project_id] = agent
        else:
            agent = active_agents[req.project_id]
            agent.user_config = global_config 

        async def event_generator():
            try:
                async for event_str in agent.ask_stream(req.query):
                    yield f"data: {event_str}\n\n"
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
                
                increment_query_usage(tier_data["user_id"])
            except Exception as e:
                logger.error(f"Stream error: {e}")
                yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

        return StreamingResponse(event_generator(), media_type="text/event-stream")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/api/ingest")
async def start_ingest(req: IngestRequest, background_tasks: BackgroundTasks, tier_data: dict = Depends(get_user_tier_and_usage)):
    try:
        # Security check: Ensure requested user_id matches the authenticated token
        if str(req.user_id) != str(tier_data["user_id"]):
            raise HTTPException(status_code=403, detail="Forbidden: User ID mismatch")

        # 1. Check if this is an existing project BEFORE applying limits
        existing = (
            supabase.table("projects")
            .select("id, last_commit, jira_project_id, notion_project_id") 
            .eq("repo_url", req.repo_url)
            .eq("user_id", req.user_id)
            .limit(1)
            .execute()
        )
        is_existing_project = existing and existing.data and len(existing.data) > 0

        # 2. Check Project Count Limit (only if it's a new project)
        if not is_existing_project:
            projects_res = supabase.table("projects").select("id", count="exact").eq("user_id", str(req.user_id)).execute()
            project_count = projects_res.count if projects_res.count is not None else 0
            
            limit = tier_data["limits"]["projects"]
            if limit is not None and project_count >= limit:
                raise HTTPException(
                    status_code=403, 
                    detail=f"Project limit of {limit} reached. Please upgrade your plan."
                )

        # 3. Check Storage Limit (ALWAYS check storage, even for updates)
        storage_limit = tier_data["limits"]["storage_gb"]
        if storage_limit is not None and storage_limit != float('inf'):
            try:
                storage_res = supabase.rpc("get_user_storage_bytes", {"target_user_id": str(req.user_id)}).execute()
                total_bytes = storage_res.data if storage_res.data else 0
                used_gb = total_bytes / (1024 * 1024 * 1024)
                if used_gb >= storage_limit:
                    raise HTTPException(
                        status_code=403, 
                        detail=f"Storage limit of {storage_limit} GB reached. Please upgrade or delete a project."
                    )
            except Exception as e:
                logger.error(f"Failed to check storage limit: {e}")

        logger.info(f"✨ Spawning agent for {req.repo_url}")

        # 4. Fetch Global Secure Config
        global_config = get_global_user_config(req.user_id)
        
        # Validate LLM Config: Must have either use_default=True 
        # OR all three: provider, api_key, and model.
        # For brand new users (use_default is None), we fallback to True.
        
        saved_use_default = global_config.get("use_default")
        is_default = saved_use_default is True or saved_use_default is None
        
        has_custom = all([
            global_config.get("provider"),
            global_config.get("api_key"),
            global_config.get("model")
        ])

        if not (is_default or has_custom):
            raise HTTPException(
                status_code=400, 
                detail="Inference Engine Offline: No valid LLM configuration found. Please setup your Provider, API Key, and Model in Settings."
            )
            
        # Ensure the fallback use_default flag is actively set in the config object
        # so downstream services know to use the default keys.
        if is_default:
            global_config["use_default"] = True

        global_config["user_id"] = req.user_id
        
        repo_name = get_repo_name_from_url(req.repo_url)
        all_commits = fetch_commits(repo_name)

        if is_existing_project:
            project_data = existing.data[0]
            project_id = project_data.get('id')
            jira_proj = project_data.get('jira_project_id')
            notion_proj = project_data.get('notion_project_id')
            last_commit = project_data.get('last_commit')
            logger.info(f"Existing project found for {req.repo_url} (ID: {project_id})")
            
            # --- NEW: Extract all commits since the last sync ---
            commits = []
            for c in all_commits:
                if c["sha"] == last_commit:
                    break
                commits.append(c)
                
            # Fallback if last_commit wasn't in the recent list or list is empty
            if not commits and all_commits:
                commits = [all_commits[0]]
                
        else:
            commits = [all_commits[0]] if all_commits else [] 
            latest_commit_sha = commits[0]["sha"] if commits else None
            
            insert_payload = {
                "user_id": req.user_id,
                "repo_url": req.repo_url,
                "jira_project_id": None,
                "notion_project_id": None,
                "last_commit": latest_commit_sha
            }
            res = supabase.table("projects").insert(insert_payload).execute()
            if not res or not res.data:
                raise Exception("Failed to create project in database")
                 
            project_id = res.data[0]['id']
            jira_proj = None
            notion_proj = None

        # 5. Initialize Agent
        agent = LumisAgent(project_id=project_id, max_steps=3, user_config=global_config)
        ingestion_state[project_id] = {"status": "starting", "logs": ["Request received..."], "step": "Init"}

        background_tasks.add_task(
            run_ingestion_pipeline,
            repo_url=req.repo_url,
            project_id=project_id,
            user_config=global_config,
            agent=agent 
        )

        check_taskes(
            user_id=req.user_id,
            project_id=project_id,
            commits=commits,
            repo_name=repo_name,
            background_tasks=background_tasks,
            jira_project_id=jira_proj,
            notion_project_id=notion_proj,
            agent=agent
        )

        return {"project_id": project_id, "status": "started"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ingest start failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/ingest/status/{project_id}")
async def get_ingest_status(project_id: str):
    return ingestion_state.get(project_id, {"status": "idle", "logs": [], "step": "Ready"})

@app.get("/api/get_risks/{project_id}")
async def get_risks_endpoint(project_id: str):
    response = supabase.table("project_risks")\
        .select("*")\
        .eq("project_id", project_id)\
        .order("created_at", desc=True)\
        .execute()
    
    risks_data = response.data if response and response.data else []
    
    return {"status": "success", "risks": risks_data}

@app.get("/api/stats/{project_id}")
async def get_project_stats(project_id: str):
    try:
        nodes_res = supabase.table("memory_units").select("id", count="exact").eq("project_id", project_id).execute()
        edges_res = supabase.table("graph_edges").select("id", count="exact").eq("project_id", project_id).execute()
        
        nodes_count = nodes_res.count if nodes_res.count is not None else 0
        edges_count = edges_res.count if edges_res.count is not None else 0
        
        health_percentage = min(100, max(0, int((nodes_count / (nodes_count + 100)) * 100))) if nodes_count > 0 else 0
            
        return {
            "status": "success",
            "nodes_count": nodes_count,
            "edges_count": edges_count,
            "health_percentage": health_percentage
        }
    except Exception as e:
        logger.error(f"Failed to fetch stats for {project_id}: {e}")
        return {"status": "error", "message": str(e)}

@app.get("/api/jira/projects/{user_id}")
async def get_user_jira_projects(user_id: str):
    access_token = get_valid_token(user_id)
    if not access_token:
        raise HTTPException(status_code=401, detail="Jira not connected")
        
    resources = get_accessible_resources(access_token)
    if not resources: return []
        
    cloud_id = resources[0]["id"]
    projects = get_projects(cloud_id, access_token)
    return [{"key": p["key"], "name": p["name"]} for p in projects]

@app.post("/api/settings/{user_id}")
async def update_user_settings(
    user_id: str, 
    payload: dict, 
    current_user = Depends(get_current_user)
):
    if str(current_user.id) != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    # 1. Encrypt the API key
    api_key = payload.get("apiKey")
    encrypted_key = None
    if api_key and not api_key.startswith("••••"):
        encrypted_key = encrypt_value(api_key)

    # 2. Build the Global Config
    new_user_config = {
        "provider": payload.get("provider"),
        "model": payload.get("selectedModel"),
        "use_default": payload.get("useDefault"),
    }
    
    if encrypted_key:
        new_user_config["api_key"] = encrypted_key
    elif api_key and api_key.startswith("••••"):
        # Retain existing key if they didn't change it
        existing_config = get_global_user_config(user_id)
        new_user_config["api_key"] = existing_config.get("api_key")

    # 3. Save to the new global table (Upsert handles both insert and update)
    try:
        supabase.table("user_settings").upsert({
            "user_id": user_id,
            "user_config": new_user_config
        }).execute()
        
        return {"status": "success", "message": "Global settings saved"}
    except Exception as e:
        logger.error(f"DB Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to save settings")

@app.delete("/api/projects/{user_id}/{project_id}")
async def delete_project(user_id: str, project_id: str):
    """
    Permanently deletes a project and all associated analysis data for a given user.
    """
    try:
        res = (
            supabase.table("projects")
            .select("id, user_id")
            .eq("id", project_id)
            .limit(1)
            .execute()
        )

        if not res or not res.data:
            raise HTTPException(status_code=404, detail="Project not found")

        db_project = res.data[0] if isinstance(res.data, list) else res.data
        if db_project.get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Forbidden")

        # Delete associated analysis data
        supabase.table("memory_units").delete().eq("project_id", project_id).execute()
        supabase.table("graph_edges").delete().eq("project_id", project_id).execute()
        supabase.table("project_risks").delete().eq("project_id", project_id).execute()

        # Delete the project record itself
        supabase.table("projects").delete().eq("id", project_id).eq("user_id", user_id).execute()

        # Clear in-memory state
        active_agents.pop(project_id, None)
        ingestion_state.pop(project_id, None)

        return {"status": "deleted"}
    except HTTPException:
        # Re-raise known HTTP errors
        raise
    except Exception as e:
        logger.error(f"Project delete failed for {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete project")

# --- NEW NOTION ENDPOINTS ---
@app.get("/api/notion/databases/{user_id}")
async def get_user_notion_databases(user_id: str):
    """Fetches all Notion databases available to the connected user."""
    from src.notion_client import get_accessible_databases 
    
    access_token = get_valid_notion_token(user_id)
    if not access_token:
        raise HTTPException(status_code=401, detail="Notion not connected")
        
    databases = get_accessible_databases(access_token)
    return databases

@app.post("/api/projects/{project_id}/jira-mapping")
async def update_jira_mapping(
    project_id: str, 
    payload: dict,
    current_user = Depends(get_current_user)
):
    jira_key = payload.get("jira_project_id")
    # If empty or 'none', set to None to clear the column in database
    if not jira_key or jira_key == "none":
        jira_key = None
        
    logger.info(f"Updating Jira mapping for project {project_id} to {jira_key} for user {current_user.id}")
        
    res = supabase.table("projects").select("user_id").eq("id", project_id).limit(1).execute()
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Project not found")
        
    if str(res.data[0]["user_id"]) != str(current_user.id):
        logger.warning(f"Ownership mismatch for project {project_id}: DB={res.data[0]['user_id']} vs Token={current_user.id}")
        raise HTTPException(status_code=403, detail="Forbidden: You do not own this project")

    supabase.table("projects").update({"jira_project_id": jira_key}).eq("id", project_id).execute()
    return {"status": "success", "jira_project_id": jira_key}


@app.post("/api/projects/{project_id}/notion-mapping")
async def update_notion_mapping(
    project_id: str, 
    payload: dict,
    current_user = Depends(get_current_user)
):
    """Saves the user's selected Notion database ID."""
    notion_db_id = payload.get("notion_project_id")
    # If empty or 'none', set to None to clear the column in database
    if not notion_db_id or notion_db_id == "none":
        notion_db_id = None

    logger.info(f"Updating Notion mapping for project {project_id} to {notion_db_id} for user {current_user.id}")
        
    res = supabase.table("projects").select("user_id").eq("id", project_id).limit(1).execute()
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Project not found")
        
    if str(res.data[0]["user_id"]) != str(current_user.id):
        logger.warning(f"Ownership mismatch for project {project_id}: DB={res.data[0]['user_id']} vs Token={current_user.id}")
        raise HTTPException(status_code=403, detail="Forbidden: You do not own this project")
        
    supabase.table("projects").update({"notion_project_id": notion_db_id}).eq("id", project_id).execute()
    return {"status": "success", "notion_project_id": notion_db_id}

@app.get("/api/projects/{project_id}/check-remote")
async def check_remote_sync(project_id: str):
    """Checks if the local project commit matches the latest remote commit."""
    try:
        res = supabase.table("projects").select("repo_url, last_commit").eq("id", project_id).limit(1).execute()
        if not res or not res.data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        project = res.data[0]
        repo_url = project.get("repo_url")
        local_commit = project.get("last_commit")
        
        if not repo_url:
            return {"up_to_date": True, "message": "No repository URL linked"}

        repo_name = get_repo_name_from_url(repo_url)
        remote_commits = fetch_commits(repo_name)
        
        if not remote_commits:
            # If we can't get remote info, we shouldn't assume it's up to date
            return {"up_to_date": True, "status": "unknown", "message": "Could not verify remote status"}
            
        latest_remote_sha = remote_commits[0]["sha"]
        
        # If local_commit is missing (unlikely but possible), it's definitely not up to date
        if not local_commit:
            return {
                "up_to_date": False,
                "remote_sha": latest_remote_sha,
                "message": "Local tracking metadata missing"
            }

        up_to_date = (local_commit == latest_remote_sha)
        
        return {
            "up_to_date": up_to_date,
            "local_sha": local_commit,
            "remote_sha": latest_remote_sha,
            "repo_name": repo_name
        }
    except Exception as e:
        logger.error(f"Sync check failed for {project_id}: {e}")
        return {"up_to_date": True, "error": str(e), "status": "error"}

@app.post("/api/projects/{project_id}/analyze-risks")
async def trigger_risk_analysis(project_id: str, background_tasks: BackgroundTasks):
    proj_row = supabase.table("projects").select("user_id").eq("id", project_id).limit(1).execute()
    if not proj_row or not proj_row.data:
        raise HTTPException(status_code=404, detail="Project not found")
        
    user_id = proj_row.data[0].get("user_id")
    user_config = get_global_user_config(user_id) if user_id else {}
    
    update_progress(project_id, "ANALYZING", "Queuing risk analysis task...")
    background_tasks.add_task(run_risk_analysis_task, project_id, user_config)
    
    return {"status": "analysis_started"}

@app.get("/api/status")
async def health_check():
    return {"status": "ok", "service": "Lumis Project"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=5000)