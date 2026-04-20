# Lumis Project

## Launching Lumis

Follow these steps to initialize the environment and launch the local development stack.

### 1. Initialize Infrastructure
Lumis requires Redis for task orchestration and caching.
```bash
docker run -p 6379:6379 -d redis
```

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
