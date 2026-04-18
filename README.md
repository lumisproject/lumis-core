# Lumis Project

## Launching Lumis

<<<<<<< HEAD
Lumis is an advanced AI-powered platform for codebase analysis, agent orchestration, and modular project management. It integrates natural language processing with robust API handling to facilitate deep architecture synthesizing, chat interactions, and automated tool invocation.
=======
Follow these steps to initialize the environment and launch the local development stack.
>>>>>>> 577830115cf4c3323e2a9929130b4bf6707d3df3

### 1. Initialize Infrastructure
Lumis requires Redis for task orchestration and caching.
```bash
docker run -p 6379:6379 -d redis
```

<<<<<<< HEAD
- **Modular Agent System**: Advanced orchestration for handling user queries, tools, and plugins.
- **Deep Codebase Indexing**: Synthesizes and maps complex architectures for AI analysis.
- **Multi-Provider Support**: Seamless integration with OpenAI, Anthropic, Gemini, Groq, and OpenRouter.
- **Structured Memory**: High-density memory management supporting both context-aware chat and semantic search.
- **Ecosystem Integration**: Built-in support for GitHub synchronization, Jira tickets, and Notion documentation.

---

## Launching Lumis

Follow these steps to initialize the environment and launch the local development stack.

### 1. Initialize Infrastructure
Lumis requires Redis for task orchestration and caching.
```bash
docker run -p 6379:6379 -d redis
```

=======
>>>>>>> 577830115cf4c3323e2a9929130b4bf6707d3df3
### 2. Start Web Interface
Navigate to the web directory and start the Vite development server.
```bash
cd web
npm run dev
```

### 3. Start Backend Services
Open two separate terminal nodes for the API server and the background worker.

**API Server:**
```bash
cd backend
python -m uvicorn src.server:app --port 5000
```

**Celery Worker:**
*Ensure your virtual environment is active (.venv).*
```bash
cd backend
celery -A src.worker.celery_app worker --loglevel=info --pool=solo
```

---

## Stripe Integration (Billing & Subscriptions)

To facilitate local payment processing and subscription management:

1. **Download Stripe CLI**: Obtain the binary from [Stripe CLI Releases](https://github.com/stripe/stripe-cli/releases).
2. **Setup**: Move `stripe.exe` into the `backend/` directory.
3. **Authentication**:
   ```bash
   stripe login
   ```
4. **Listen for Webhooks**:
   ```bash
   stripe listen --forward-to localhost:5000/api/billing/webhook
   ```

---

## Technical Stack

- **Frontend**: React, Vite, Framer Motion, Tailwind CSS
- **Backend**: Python, FastAPI, Celery
- **Database**: Supabase (PostgreSQL), Redis
- **DevOps**: Docker, Stripe CLI
