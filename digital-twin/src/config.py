import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    
    BACKEND_URL = "http://localhost:5000"
    FRONTEND_URL = "http://localhost:8080"

    # Default LLM settings
    DEFAULT_LLM_PROVIDER = os.getenv("DEFAULT_LLM_PROVIDER", "openrouter")
    DEFAULT_LLM_MODEL = os.getenv("MODEL", "stepfun/step-3.5-flash:free")
    DEFAULT_LLM_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
    
    DEFAULT_CHAT_MODEL = os.getenv("DEFAULT_CHAT_MODEL", "stepfun/step-3.5-flash:free")
    DEFAULT_RISK_MODEL = os.getenv("DEFAULT_RISK_MODEL", "openai/gpt-oss-120b")
    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
    GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
    
    # Embedding settings
    EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")

    # Jira settings
    JIRA_CLIENT_ID = os.getenv("JIRA_CLIENT_ID")
    JIRA_CLIENT_SECRET = os.getenv("JIRA_CLIENT_SECRET")
    JIRA_REDIRECT_URI = os.getenv("JIRA_REDIRECT_URI", BACKEND_URL+"/auth/jira/callback")
    JIRA_REDIRECT=os.getenv("JIRA_REDIRECT", FRONTEND_URL+"/app/settings")
    
    JIRA_AUTH_URL = "https://auth.atlassian.com/authorize"
    JIRA_TOKEN_URL = "https://auth.atlassian.com/oauth/token"
    JIRA_API_BASE = "https://api.atlassian.com"
    JIRA_API_BASE_URL = "https://api.atlassian.com/ex/jira"
    
    # Supabase settings
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_KEY")

    # Github settings
    GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

    # Notion settings
    NOTION_CLIENT_ID = os.getenv("NOTION_CLIENT_ID")
    NOTION_CLIENT_SECRET = os.getenv("NOTION_CLIENT_SECRET")
    NOTION_REDIRECT_URI = os.getenv("NOTION_REDIRECT_URI")

    # Encryption settings
    ENCRYPTION_KEY = os.getenv("FERNET_SECRET_KEY")

    # Billing settings
    STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
    STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

    # Redis settings
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # Gmail settings
    GMAIL_USER = os.getenv("GMAIL_USER")
    GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD")