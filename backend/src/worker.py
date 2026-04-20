import asyncio
from celery import Celery
import logging

from src.config import Config
from src.ingestor import ingest_repo
from src.server import update_progress
from src.risk_engine import calculate_predictive_risks
from src.code_reviewer import process_impact_review
from src.agent import LumisAgent
from src.services import lc_embedder


celery_app = Celery("lumis_tasks", broker=Config.REDIS_URL, backend=Config.REDIS_URL)
logger = logging.getLogger("LumisWorker")

# Warmup the model
logger.info("Warming up embedding model...")
lc_embedder.embed_query("warmup")


@celery_app.task(name="run_ingestion_pipeline")
def run_ingestion_pipeline_task(repo_url: str, project_id: str, user_config: dict):
    """Offloads the heavy Git cloning and embedding to a background worker."""
    logger.info(f"Worker picking up ingestion for {project_id}")
    
    def progress_cb(t, m):
        update_progress(project_id, t, m)
        
    try:
        asyncio.run(ingest_repo(repo_url=repo_url, project_id=project_id, progress_callback=progress_cb, user_config=user_config))
        progress_cb("DONE", "Sync and analysis complete.")
    except Exception as e:
        logger.error(f"Ingestion Pipeline Error: {e}", exc_info=True)
        progress_cb("Error", f"Pipeline failed: {str(e)}")
        raise e  

@celery_app.task(name="run_risk_analysis")
def run_risk_analysis_task(project_id: str, user_config: dict):
    """Offloads AST parsing and Graph-RAG risk checks."""
    
    def progress_cb(t, m):
        print(f"[{t}] {m}")
        update_progress(project_id, t, m)

    try:
        progress_cb("ANALYZING", "Neural Risk Engine: Initializing codebase scan...")
        asyncio.run(calculate_predictive_risks(project_id, user_config=user_config, log_callback=lambda msg: progress_cb("ANALYZING", msg)))
        
        agent = LumisAgent(project_id=project_id, user_config=user_config)
        asyncio.run(process_impact_review(project_id, agent, log_callback=lambda msg: progress_cb("ANALYZING", msg)))
        
        # --- NEW: Fire Slack Alert for manual Risk Analysis ---
        try:
            from src.db_client import supabase
            from src.slack_client import send_slack_risk_alert
            
            # Fetch the repo URL needed for the Slack message
            res = supabase.table("projects").select("repo_url").eq("id", project_id).execute()
            if res.data:
                repo_url = res.data[0].get("repo_url")
                send_slack_risk_alert(project_id, repo_url)
        except Exception as slack_err:
            logger.error(f"Slack Alert failed during manual analysis: {slack_err}")

        progress_cb("READY", "Neural Risk Analysis Complete.")
    except Exception as e:
        logger.error(f"Risk Analysis Error: {e}", exc_info=True)
        progress_cb("Error", f"Risk analysis failed: {str(e)}")
        raise e
    
@celery_app.task(name="sync_jira_tasks")
def sync_jira_tasks_task(user_id: str, project_id: str, commits: list, repo_name: str, jira_project_id: str, user_config: dict):
    from src.tasks_checking import process_jira
    from src.jira_auth import get_valid_token
    from src.agent import LumisAgent
    
    jira_token = get_valid_token(user_id)
    if not jira_token: return
    
    agent = LumisAgent(project_id=project_id, max_steps=5, user_config=user_config, mode="single-turn")
    asyncio.run(process_jira(commits, repo_name, jira_token, project_id, jira_project_id, agent))

@celery_app.task(name="send_email_notification")
def send_email_notification_task(subject: str, html_content: str):
    """Offloads SMTP email sending to Celery to prevent blocking the API event loop."""
    from src.mailer import send_smtp_notification
    send_smtp_notification(subject, html_content)