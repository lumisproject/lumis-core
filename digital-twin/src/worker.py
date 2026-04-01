import os
import asyncio
from celery import Celery
import logging

# Set up Redis connection
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
celery_app = Celery("lumis_tasks", broker=REDIS_URL, backend=REDIS_URL)

logger = logging.getLogger("LumisWorker")

# Preload heavy modules
from src.ingestor import ingest_repo
from src.server import update_progress
from src.risk_engine import calculate_predictive_risks
from src.code_reviewer import process_impact_review
from src.agent import LumisAgent
from src.services import lc_embedder

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
        # Run the async ingest_repo function inside the synchronous Celery worker
        asyncio.run(ingest_repo(repo_url=repo_url, project_id=project_id, progress_callback=progress_cb, user_config=user_config))
        progress_cb("DONE", "Sync and analysis complete.")
    except Exception as e:
        logger.error(f"Ingestion Pipeline Error: {e}")
        progress_cb("Error", f"Pipeline failed: {str(e)}")

@celery_app.task(name="run_risk_analysis")
def run_risk_analysis_task(project_id: str, user_config: dict):
    """Offloads AST parsing and Graph-RAG risk checks."""

    
    def progress_cb(t, m):
        update_progress(project_id, t, m)

    try:
        progress_cb("ANALYZING", "Neural Risk Engine: Initializing codebase scan...")
        asyncio.run(calculate_predictive_risks(project_id, user_config=user_config, log_callback=lambda msg: progress_cb("ANALYZING", msg)))
        
        agent = LumisAgent(project_id=project_id, user_config=user_config)
        asyncio.run(process_impact_review(project_id, agent, log_callback=lambda msg: progress_cb("ANALYZING", msg)))
        
        progress_cb("READY", "Neural Risk Analysis Complete.")
    except Exception as e:
        logger.error(f"Risk Analysis Error: {e}")
        progress_cb("Error", f"Risk analysis failed: {str(e)}")