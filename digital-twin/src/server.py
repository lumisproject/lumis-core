import os
import logging
import redis
from typing import Dict, Optional
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.db_client import supabase, get_current_user
from src.config import Config
from src.jira_auth import jira_auth_router
from src.notion_auth import notion_auth_router
from src.stripe_router import stripe_router
from src.billing_middleware import verify_chat_limit, get_user_tier_and_usage

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

# --- STATE MANAGEMENT (Now Stateless via Redis) ---
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)

# --- MODELS ---
class ChatRequest(BaseModel):
    project_id: str
    query: str
    mode: str = "single-turn"
    reasoning: bool = False
    user_config: Optional[Dict] = None
    session_id: Optional[str] = None  # NEW: Tracks active chat history

class IngestRequest(BaseModel):
    user_id: str
    repo_url: str
    user_config: Optional[Dict] = None

def get_repo_name_from_url(repo_url: str) -> str:
    """Normalize a GitHub URL to the `owner/repo` form expected by the API."""
    name = repo_url.rstrip("/")
    if name.endswith(".git"):
        name = name[:-4]
    for prefix in ("https://github.com/", "http://github.com/", "git@github.com:"):
        if name.startswith(prefix):
            name = name[len(prefix) :]
            break
    return name

def fetch_commits(repo_full_name: str):
    """Return the most recent commits for the repository as a normalized list."""
    import requests

    url = f"https://api.github.com/repos/{repo_full_name}/commits"
    headers = {"Accept": "application/vnd.github.v3+json"}
    
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
    import json

    # Fetch current state from Redis instead of RAM
    state_str = redis_client.get(f"sync_state:{project_id}")
    state = json.loads(state_str) if state_str else {"status": "processing", "logs": [], "step": "Starting"}

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
    
    state["step"] = task

    if message:
        state["logs"].append(f"[{task}] {message}")

    # Save back to Redis (expires after 24 hours to save memory)
    redis_client.setex(f"sync_state:{project_id}", 86400, json.dumps(state))

    # Persist critical status changes to the DB for real-time frontend updates
    try:
        supabase.table("projects").update({
            "sync_state": {
                "status": state["status"],
                "step": state["step"],
                "logs": state["logs"][-20:] # Show last 20 logs
            }
        }).eq("id", project_id).execute()
    except Exception as db_err:
        logger.error(f"Failed to persist sync status to DB: {db_err}")


# --- ENDPOINTS ---

@app.post("/api/webhook/{user_id}/{project_id}")
async def github_webhook(user_id: str, project_id: str, request: Request, background_tasks: BackgroundTasks):
    from src.worker import run_ingestion_pipeline_task
    from src.tasks_checking import check_taskes
    from src.db_client import get_global_user_config
    from src.agent import LumisAgent

    try:
        payload = await request.json()

        if "zen" in payload:
            logger.info("GitHub Zen ping received. Connection verified.")
            return {"status": "ok", "message": "Lumis Unified Gateway is listening"}

        ref = payload.get("ref", "")
        if ref not in ["refs/heads/main", "refs/heads/master"]:
            reason = f"Ignored event on branch: {ref}" if ref else "Unsupported webhook event"
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
        
        jira_proj = None
        notion_proj = None

        if proj_row and proj_row.data:
            proj_data = proj_row.data[0] if isinstance(proj_row.data, list) else proj_row.data
            jira_proj = proj_data.get("jira_project_id")
            notion_proj = proj_data.get("notion_project_id")

        new_sha = payload.get("after")
        repo_url = payload.get("repository", {}).get("clone_url")

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
            f"GitHub Push detected ({new_sha[:7]}). Dispatching to Worker..."
        )

        # Dispatch heavy indexing to Celery worker!
        run_ingestion_pipeline_task.delay(repo_url, project_id, global_config)

        raw_commits = payload.get("commits", [])
        repo_name = payload.get("repository", {}).get("full_name")

        normalized_commits = []
        for c in raw_commits:
            normalized_commits.append({
                "sha": c.get("id", c.get("sha")),
                "message": c.get("message", "")
            })

        # Agent instantiated on the fly for check_taskes
        agent = LumisAgent(project_id=project_id, max_steps=3, user_config=global_config, mode="single-turn")

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
        
        return {"status": "sync_queued", "commit": new_sha}

    except Exception as e:
        logger.error(f"CRITICAL: Unified Webhook Error: {str(e)}")
        return {"status": "error", "message": str(e)}

@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest, tier_data: dict = Depends(verify_chat_limit)):
    from src.billing_middleware import increment_query_usage
    from src.db_client import get_global_user_config
    from src.agent import LumisAgent
    from fastapi.responses import StreamingResponse
    import json

    try:
        proj_row = supabase.table("projects").select("user_id").eq("id", req.project_id).limit(1).execute()
        if not proj_row or not proj_row.data:
            raise HTTPException(status_code=404, detail="Project not found")
            
        user_id = proj_row.data[0]["user_id"]
        
        if str(user_id) != str(tier_data["user_id"]):
            raise HTTPException(status_code=403, detail="Forbidden: You do not own this project")
        
        global_config = get_global_user_config(user_id)
        global_config["user_id"] = user_id
        
        # Enforce tier-based capability restrictions
        limits = tier_data.get("limits", {})
        
        # If reasoning is requested but not allowed, override to False
        is_reasoning_allowed = limits.get("reasoning", False)
        if req.reasoning and not is_reasoning_allowed:
            logger.warning(f"Reasoning requested by Free user {user_id}. Restricting.")
            global_config["reasoning_enabled"] = False
        else:
            global_config["reasoning_enabled"] = req.reasoning

        # If multi-turn(memory) is requested but not allowed, override to single-turn
        is_memory_allowed = limits.get("memory", False)
        if req.mode == "multi-turn" and not is_memory_allowed:
            logger.warning(f"Multi-turn requested by Free user {user_id}. Restricting to single-turn.")
            global_config["mode"] = "single-turn"
        else:
            global_config["mode"] = req.mode


        logger.info(f"✨ Initializing stateless agent for project {req.project_id}")
        
        # Completely stateless. Creates a new agent, tying it to a session if provided
        agent = LumisAgent(project_id=req.project_id, user_config=global_config, session_id=req.session_id)

        async def event_generator():
            try:
                async for event_str in agent.ask_stream(req.query):
                    yield f"data: {event_str}\n\n"
                    
                # The agent automatically updates the DB inside its logic. We just return the session ID.
                yield f"data: {json.dumps({'type': 'done', 'session_id': agent.session_id})}\n\n"
                
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
    from src.worker import run_ingestion_pipeline_task
    from src.tasks_checking import check_taskes
    from src.db_client import get_global_user_config
    from src.agent import LumisAgent
    import json

    try:
        if str(req.user_id) != str(tier_data["user_id"]):
            raise HTTPException(status_code=403, detail="Forbidden: User ID mismatch")

        existing = (
            supabase.table("projects")
            .select("id, last_commit, jira_project_id, notion_project_id") 
            .eq("repo_url", req.repo_url)
            .eq("user_id", req.user_id)
            .limit(1)
            .execute()
        )
        is_existing_project = existing and existing.data and len(existing.data) > 0

        if not is_existing_project:
            projects_res = supabase.table("projects").select("id", count="exact").eq("user_id", str(req.user_id)).execute()
            project_count = projects_res.count if projects_res.count is not None else 0
            
            limit = tier_data["limits"]["projects"]
            if limit is not None and project_count >= limit:
                raise HTTPException(
                    status_code=403, 
                    detail=f"Project limit of {limit} reached. Please upgrade your plan."
                )

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

        logger.info(f"✨ Queuing ingestion for {req.repo_url}")

        global_config = get_global_user_config(req.user_id)
        
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
                detail="Inference Engine Offline: No valid LLM configuration found."
            )
            
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
            
            commits = []
            for c in all_commits:
                if c["sha"] == last_commit:
                    break
                commits.append(c)
                
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

        # Seed Redis state immediately
        redis_client.setex(f"sync_state:{project_id}", 86400, json.dumps({"status": "starting", "logs": ["Request received..."], "step": "Init"}))

        # Offload to Celery Background Worker
        run_ingestion_pipeline_task.delay(req.repo_url, project_id, global_config)

        agent = LumisAgent(project_id=project_id, max_steps=3, user_config=global_config)
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
    import json

    state_str = redis_client.get(f"sync_state:{project_id}")
    if state_str:
        return json.loads(state_str)
    return {"status": "idle", "logs": [], "step": "Ready"}

# --- NEW: CHAT HISTORY ENDPOINTS ---
@app.get("/api/chat/sessions/{project_id}")
async def get_chat_sessions(project_id: str, current_user = Depends(get_current_user)):
    """Fetches the history list for the left sidebar."""
    res = supabase.table("chat_sessions").select("id, title, updated_at").eq("project_id", project_id).eq("user_id", str(current_user.id)).order("updated_at", desc=True).execute()
    return res.data if res.data else []

@app.get("/api/chat/messages/{session_id}")
async def get_chat_messages(session_id: str, current_user = Depends(get_current_user)):
    """Fetches messages when a user clicks a past session."""
    res = supabase.table("chat_messages").select("role, content").eq("session_id", session_id).order("created_at", desc=False).execute()
    return res.data if res.data else []

@app.delete("/api/chat/sessions/{session_id}")
async def delete_chat_session(session_id: str, current_user = Depends(get_current_user)):
    """Deletes a chat session and its associated messages."""
    # First verify ownership
    owner_check = supabase.table("chat_sessions").select("user_id").eq("id", session_id).limit(1).execute()
    if not owner_check or not owner_check.data:
        raise HTTPException(status_code=404, detail="Session not found")
        
    if str(owner_check.data[0]["user_id"]) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Forbidden")

    # Cascading delete is handled by DB in common setups, but let's be explicit if needed
    # Actually Supabase/Supabase-py delete executes immediately.
    supabase.table("chat_messages").delete().eq("session_id", session_id).execute()
    supabase.table("chat_sessions").delete().eq("id", session_id).execute()
    
    return {"status": "deleted"}

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
    from src.jira_client import get_accessible_resources, get_projects
    from src.jira_auth import get_valid_token

    access_token = get_valid_token(user_id)
    if not access_token:
        raise HTTPException(status_code=401, detail="Jira not connected")
        
    resources = get_accessible_resources(access_token)
    if not resources: return []
        
    cloud_id = resources[0]["id"]
    projects = get_projects(cloud_id, access_token)
    return [{"key": p["key"], "name": p["name"]} for p in projects]

@app.get("/api/settings/{user_id}")
async def get_user_settings(user_id: str, current_user = Depends(get_current_user)):
    from src.db_client import get_global_user_config

    if str(current_user.id) != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    config = get_global_user_config(user_id)
    
    if config.get("use_default") is True:
        return {
            "provider": "",
            "selectedModel": "",
            "apiKey": "",
            "useDefault": True
        }
    
    return {
        "provider": config.get("provider", ""),
        "selectedModel": config.get("model", ""),
        "apiKey": "••••••••" if config.get("api_key") else "",
        "useDefault": False
    }

@app.post("/api/settings/{user_id}")
async def update_user_settings(user_id: str, payload: dict, current_user = Depends(get_current_user)):
    from src.cryptography import encrypt_value
    from src.db_client import get_global_user_config

    if str(current_user.id) != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    api_key = payload.get("apiKey")
    encrypted_key = None
    if api_key and not api_key.startswith("••••"):
        encrypted_key = encrypt_value(api_key)

    new_user_config = {
        "provider": payload.get("provider"),
        "model": payload.get("selectedModel"),
        "use_default": payload.get("useDefault"),
    }
    
    if encrypted_key:
        new_user_config["api_key"] = encrypted_key
    elif api_key and api_key.startswith("••••"):
        existing_config = get_global_user_config(user_id)
        new_user_config["api_key"] = existing_config.get("api_key")

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

        # Clear Redis in-memory state
        redis_client.delete(f"sync_state:{project_id}")

        return {"status": "deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Project delete failed for {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete project")

@app.get("/api/notion/databases/{user_id}")
async def get_user_notion_databases(user_id: str):
    from src.notion_client import get_accessible_databases
    from src.notion_auth import get_valid_notion_token
    
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
    if not jira_key or jira_key == "none":
        jira_key = None
        
    logger.info(f"Updating Jira mapping for project {project_id} to {jira_key} for user {current_user.id}")
        
    res = supabase.table("projects").select("user_id").eq("id", project_id).limit(1).execute()
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Project not found")
        
    if str(res.data[0]["user_id"]) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Forbidden: You do not own this project")

    supabase.table("projects").update({"jira_project_id": jira_key}).eq("id", project_id).execute()
    return {"status": "success", "jira_project_id": jira_key}


@app.post("/api/projects/{project_id}/notion-mapping")
async def update_notion_mapping(
    project_id: str, 
    payload: dict,
    current_user = Depends(get_current_user)
):
    notion_db_id = payload.get("notion_project_id")
    if not notion_db_id or notion_db_id == "none":
        notion_db_id = None

    logger.info(f"Updating Notion mapping for project {project_id} to {notion_db_id} for user {current_user.id}")
        
    res = supabase.table("projects").select("user_id").eq("id", project_id).limit(1).execute()
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Project not found")
        
    if str(res.data[0]["user_id"]) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Forbidden: You do not own this project")
        
    supabase.table("projects").update({"notion_project_id": notion_db_id}).eq("id", project_id).execute()
    return {"status": "success", "notion_project_id": notion_db_id}

@app.get("/api/projects/{project_id}/board")
async def get_project_board(project_id: str, tool: str = "jira", current_user = Depends(get_current_user)):
    """Fetches the synchronized Kanban board data."""
    from src.jira_client import get_project_statuses, get_board_issues
    from src.jira_auth import get_valid_token
    
    try:
        # 1. Get project info
        res = supabase.table("projects").select("user_id, jira_project_id").eq("id", project_id).limit(1).execute()
        if not res.data: raise HTTPException(status_code=404, detail="Project not found")
        
        project = res.data[0]
        if str(project["user_id"]) != str(current_user.id):
            raise HTTPException(status_code=403, detail="Forbidden")
        
        # Currently, we only support Jira as requested
        if tool == "jira" and project.get("jira_project_id"):
            access_token = get_valid_token(project["user_id"])
            if not access_token:
                raise HTTPException(status_code=401, detail="Jira authentication expired or missing.")
                
            from src.jira_client import get_accessible_resources
            resources = get_accessible_resources(access_token)
            cloud_id = resources[0]["id"]
            
            # Fetch Dynamic Columns & Tickets
            columns = get_project_statuses(cloud_id, project["jira_project_id"], access_token)
            tickets = get_board_issues(cloud_id, project["jira_project_id"], access_token)
            
            return {"columns": columns, "tickets": tickets}
            
        return {"columns": [], "tickets": []}
    except Exception as e:
        logger.error(f"Board fetch error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/api/projects/{project_id}/board/tickets/{ticket_id}")
async def update_ticket_status(project_id: str, ticket_id: str, payload: dict, tool: str = "jira", current_user = Depends(get_current_user)):
    """Moves a ticket. If Jira rejects it, this throws a 400 error to snap the UI back."""
    from src.jira_client import transition_issue_to_status
    from src.jira_auth import get_valid_token
    
    target_status_id = payload.get("status")
    try:
        res = supabase.table("projects").select("user_id").eq("id", project_id).limit(1).execute()
        if not res.data: raise HTTPException(status_code=404, detail="Project not found")
            
        user_id = res.data[0]["user_id"]
        if str(user_id) != str(current_user.id):
            raise HTTPException(status_code=403, detail="Forbidden")
            
        if tool == "jira":
            access_token = get_valid_token(user_id)
            from src.jira_client import get_accessible_resources
            cloud_id = get_accessible_resources(access_token)[0]["id"]
            
            try:
                # This will raise an exception if the Jira admin blocked this specific transition
                transition_issue_to_status(cloud_id, ticket_id, target_status_id, access_token)
            except Exception as transition_error:
                raise HTTPException(status_code=400, detail=str(transition_error))
                
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ticket move error: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@app.post("/api/projects/{project_id}/board/tickets")
async def create_board_ticket(project_id: str, payload: dict, tool: str = "jira"):
    """Creates a new ticket in the connected project management tool."""
    try:
        res = supabase.table("projects").select("user_id, jira_project_id").eq("id", project_id).limit(1).execute()
        if not res.data: raise HTTPException(status_code=404, detail="Project not found")
        
        project = res.data[0]
        user_id = project["user_id"]
        
        if tool == "jira" and project.get("jira_project_id"):
            from src.jira_auth import get_valid_token
            access_token = get_valid_token(user_id)
            if not access_token:
                raise HTTPException(status_code=401, detail="Jira authentication expired or missing.")
                
            from src.jira_client import get_accessible_resources, create_issue, transition_issue_to_status
            cloud_id = get_accessible_resources(access_token)[0]["id"]
            project_key = project["jira_project_id"]
            
            summary = payload.get("title", "New Task")
            description = payload.get("description", "")
            target_status_id = payload.get("status")
            assignee_id = payload.get("assigneeId") # NEW: Get assignee from frontend
            
            # 1. Create the issue in Jira
            new_issue = create_issue(cloud_id, project_key, summary, description, access_token)
            
            # 2. Move to column if needed
            if target_status_id:
                try:
                    transition_issue_to_status(cloud_id, new_issue["id"], target_status_id, access_token)
                except Exception as e:
                    logger.warning(f"Created ticket but couldn't move to target column: {e}")
                    
            # 3. Assign to user if selected
            if assignee_id:
                try:
                    from src.jira_client import assign_issue
                    assign_issue(cloud_id, new_issue["key"], assignee_id, access_token)
                except Exception as e:
                    logger.warning(f"Created ticket but couldn't assign user: {e}")
            
            return {"status": "success", "ticket_id": new_issue["id"], "ticket_key": new_issue["key"]}
        else:
            raise HTTPException(status_code=400, detail="Tool not supported or project not mapped.")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ticket creation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/projects/{project_id}/board/tickets/{ticket_id}/description")
async def update_ticket_description(project_id: str, ticket_id: str, payload: dict, tool: str = "jira"):
    """Updates the description of a ticket."""
    try:
        res = supabase.table("projects").select("user_id, jira_project_id").eq("id", project_id).limit(1).execute()
        if not res.data: raise HTTPException(status_code=404, detail="Project not found")
        
        project = res.data[0]
        if tool == "jira" and project.get("jira_project_id"):
            from src.jira_auth import get_valid_token
            access_token = get_valid_token(project["user_id"])
            if not access_token: raise HTTPException(status_code=401, detail="Jira authentication missing.")
                
            from src.jira_client import get_accessible_resources, update_issue_description
            cloud_id = get_accessible_resources(access_token)[0]["id"]
            
            description = payload.get("description", "")
            update_issue_description(cloud_id, ticket_id, description, access_token)
            
            return {"status": "success"}
        raise HTTPException(status_code=400, detail="Tool not supported.")
    except Exception as e:
        logger.error(f"Failed to update description: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/projects/{project_id}/board/tickets/{ticket_id}/comments")
async def add_ticket_comment(project_id: str, ticket_id: str, payload: dict, tool: str = "jira"):
    """Adds a new comment to a ticket."""
    try:
        res = supabase.table("projects").select("user_id, jira_project_id").eq("id", project_id).limit(1).execute()
        if not res.data: raise HTTPException(status_code=404, detail="Project not found")
        
        project = res.data[0]
        user_id = project["user_id"]
        
        if tool == "jira" and project.get("jira_project_id"):
            from src.jira_auth import get_valid_token
            access_token = get_valid_token(user_id)
            if not access_token: raise HTTPException(status_code=401, detail="Jira authentication missing.")
                
            from src.jira_client import get_accessible_resources, add_comment
            cloud_id = get_accessible_resources(access_token)[0]["id"]
            
            text = payload.get("text", "")
            if not text: raise HTTPException(status_code=400, detail="Comment text cannot be empty")
            
            add_comment(cloud_id, ticket_id, text, access_token)
            
            return {"status": "success"}
        else:
            raise HTTPException(status_code=400, detail="Tool not supported or project not mapped.")
    except Exception as e:
        logger.error(f"Comment creation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/projects/{project_id}/board/tickets/{ticket_id}/comments/{comment_id}")
async def delete_ticket_comment(project_id: str, ticket_id: str, comment_id: str, tool: str = "jira"):
    """Deletes a comment from a ticket."""
    try:
        res = supabase.table("projects").select("user_id, jira_project_id").eq("id", project_id).limit(1).execute()
        if not res.data: raise HTTPException(status_code=404, detail="Project not found")
        
        project = res.data[0]
        user_id = project["user_id"]
        
        if tool == "jira" and project.get("jira_project_id"):
            from src.jira_auth import get_valid_token
            access_token = get_valid_token(user_id)
            if not access_token: raise HTTPException(status_code=401, detail="Jira authentication missing.")
                
            from src.jira_client import get_accessible_resources, delete_comment
            cloud_id = get_accessible_resources(access_token)[0]["id"]
            
            delete_comment(cloud_id, ticket_id, comment_id, access_token)
            
            return {"status": "success"}
        else:
            raise HTTPException(status_code=400, detail="Tool not supported or project not mapped.")
    except Exception as e:
        import logging
        logging.getLogger("LumisAPI").error(f"Comment deletion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/projects/{project_id}/board/users")
async def get_team_members(project_id: str, tool: str = "jira"):
    """Fetches the team members available for assignment."""
    try:
        res = supabase.table("projects").select("user_id, jira_project_id").eq("id", project_id).limit(1).execute()
        if not res.data: raise HTTPException(status_code=404, detail="Project not found")
        
        project = res.data[0]
        if tool == "jira" and project.get("jira_project_id"):
            from src.jira_auth import get_valid_token
            access_token = get_valid_token(project["user_id"])
            if not access_token: raise HTTPException(status_code=401, detail="Jira authentication missing.")
                
            from src.jira_client import get_accessible_resources, get_assignable_users
            cloud_id = get_accessible_resources(access_token)[0]["id"]
            
            users = get_assignable_users(cloud_id, project["jira_project_id"], access_token)
            return {"users": users}
        return {"users": []}
    except Exception as e:
        import logging
        logging.getLogger("LumisAPI").error(f"Failed to fetch team members: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/projects/{project_id}/board/tickets/{ticket_id}/assignee")
async def update_ticket_assignee(project_id: str, ticket_id: str, payload: dict, tool: str = "jira"):
    """Updates the assignee of a ticket."""
    try:
        res = supabase.table("projects").select("user_id, jira_project_id").eq("id", project_id).limit(1).execute()
        if not res.data: raise HTTPException(status_code=404, detail="Project not found")
        
        project = res.data[0]
        if tool == "jira" and project.get("jira_project_id"):
            from src.jira_auth import get_valid_token
            access_token = get_valid_token(project["user_id"])
            if not access_token: raise HTTPException(status_code=401, detail="Jira authentication missing.")
                
            from src.jira_client import get_accessible_resources, assign_issue
            cloud_id = get_accessible_resources(access_token)[0]["id"]
            
            account_id = payload.get("accountId") # Can be empty string to unassign
            assign_issue(cloud_id, ticket_id, account_id, access_token)
            
            return {"status": "success"}
        raise HTTPException(status_code=400, detail="Tool not supported.")
    except Exception as e:
        import logging
        logging.getLogger("LumisAPI").error(f"Failed to assign ticket: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/projects/{project_id}/board/tickets/{ticket_id}")
async def delete_board_ticket(project_id: str, ticket_id: str, tool: str = "jira"):
    """Deletes a ticket from the connected project management tool."""
    try:
        res = supabase.table("projects").select("user_id, jira_project_id").eq("id", project_id).limit(1).execute()
        if not res.data: raise HTTPException(status_code=404, detail="Project not found")
        
        project = res.data[0]
        if tool == "jira" and project.get("jira_project_id"):
            from src.jira_auth import get_valid_token
            access_token = get_valid_token(project["user_id"])
            if not access_token: raise HTTPException(status_code=401, detail="Jira authentication missing.")
                
            from src.jira_client import get_accessible_resources, delete_issue
            cloud_id = get_accessible_resources(access_token)[0]["id"]
            
            delete_issue(cloud_id, ticket_id, access_token)
            
            return {"status": "success"}
        raise HTTPException(status_code=400, detail="Tool not supported.")
    except Exception as e:
        import logging
        logging.getLogger("LumisAPI").error(f"Failed to delete ticket: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/api/projects/{project_id}/check-remote")
async def check_remote_sync(project_id: str):
    
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
            return {"up_to_date": True, "status": "unknown", "message": "Could not verify remote status"}
            
        latest_remote_sha = remote_commits[0]["sha"]
        
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
async def trigger_risk_analysis(project_id: str):
    from src.worker import run_risk_analysis_task
    from src.db_client import get_global_user_config

    proj_row = supabase.table("projects").select("user_id").eq("id", project_id).limit(1).execute()
    if not proj_row or not proj_row.data:
        raise HTTPException(status_code=404, detail="Project not found")
        
    user_id = proj_row.data[0].get("user_id")
    user_config = get_global_user_config(user_id) if user_id else {}
    
    update_progress(project_id, "ANALYZING", "Queuing risk analysis task...")
    
    # Dispatch heavy analysis to Celery Worker
    run_risk_analysis_task.delay(project_id, user_config)
    
    return {"status": "analysis_queued"}

@app.get("/api/projects/{project_id}/architecture-graph")
async def get_architecture_graph(project_id: str):
    try:
        # 1. Fetch units (Functions, Classes, Methods)
        units_res = supabase.table("memory_units")\
            .select("unit_name, file_path, unit_type, last_modified_at")\
            .eq("project_id", project_id)\
            .execute()
        units = units_res.data or []

        # 2. Fetch edges (Who calls who)
        edges_res = supabase.table("graph_edges")\
            .select("source_unit_name, target_unit_name, edge_type")\
            .eq("project_id", project_id)\
            .execute()
        edges = edges_res.data or []

        # 3. Fetch ACTUAL risks
        risks_res = supabase.table("project_risks")\
            .select("severity, risk_type, affected_units")\
            .eq("project_id", project_id)\
            .execute()
        risks = risks_res.data or []

        severity_map = {"High": 85, "Medium": 50, "Low": 20}
        unit_risk_scores = {}
        unit_legacy_conflicts = set()
        
        for r in risks:
            severity_str = str(r.get("severity", "")).capitalize()
            sev_score = severity_map.get(severity_str, 0)
            is_legacy_conflict = r.get("risk_type") == "Legacy Conflict"
            
            for affected_unit in r.get("affected_units", []):
                if affected_unit not in unit_risk_scores or sev_score > unit_risk_scores[affected_unit]:
                    unit_risk_scores[affected_unit] = sev_score
                if is_legacy_conflict:
                    unit_legacy_conflicts.add(affected_unit)

        nodes_dict = {}
        links = []

        # 4. Build Nodes & Structural Links (File -> Function)
        for u in units:
            uname = u.get("unit_name")
            fpath = u.get("file_path")
            if not uname or not fpath: continue
            
            # A. Create the Big File Node (if it doesn't exist yet)
            if fpath not in nodes_dict:
                nodes_dict[fpath] = {
                    "id": fpath,
                    "label": fpath.split("/")[-1],
                    "fullPath": fpath,
                    "group": "file",
                    "risk_score": 0,
                    "legacy_flag": False,
                    "unit_count": 0
                }

            # B. Create the Function/Class Node
            short_name = uname.split("::")[-1] if "::" in uname else uname
            nodes_dict[uname] = {
                "id": uname,
                "label": short_name,
                "fullPath": fpath,
                "group": u.get("unit_type", "unknown"),
                "risk_score": unit_risk_scores.get(uname, 0),
                "legacy_flag": uname in unit_legacy_conflicts,
                "unit_count": 1
            }

            # Bubble up risk/legacy status to the parent file so it turns red/amber if a child is sick
            file_node = nodes_dict[fpath]
            file_node["unit_count"] += 1
            if nodes_dict[uname]["risk_score"] > file_node["risk_score"]:
                file_node["risk_score"] = nodes_dict[uname]["risk_score"]
            if nodes_dict[uname]["legacy_flag"]:
                file_node["legacy_flag"] = True

            # C. Link the Function to its Parent File (Structural Link)
            links.append({
                "source": fpath,
                "target": uname,
                "types": ["contains"],
                "weight": 2 # Stronger weight so functions stay near their files
            })

        # 5. Filter Noise & Build Dependency Links (Function -> Function)
        for e in edges:
            src = e.get("source_unit_name")
            tgt = e.get("target_unit_name")
            
            # NOISE FILTER: Only draw a connection if BOTH source and target exist in our parsed memory_units
            if src in nodes_dict and tgt in nodes_dict:
                links.append({
                    "source": src,
                    "target": tgt,
                    "types": [e.get("edge_type", "calls")],
                    "weight": 1
                })

        return {
            "nodes": list(nodes_dict.values()),
            "links": links
        }

    except Exception as e:
        import logging
        logging.getLogger("LumisAPI").error(f"Failed to generate architecture graph: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate graph data")

@app.get("/api/status")
async def health_check():
    return {"status": "ok", "service": "Lumis Project Stateless"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=5000)