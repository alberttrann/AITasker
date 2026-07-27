# Operations Runbook

## Prerequisites

- **Node.js**: v20.x+
- **npm**: v10.x+
- **Python**: v3.11.x
- **PostgreSQL**: v16.x (local or Neon cloud)
- **Docker Desktop**: v24.x+ (for containerized setup)

## Environment Configuration

Each service has its own `.env` file. Copy the examples:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp ai-service/.env.example ai-service/.env
cp frontend/.env.example frontend/.env
```

### Backend (`backend/.env`)
- `DATABASE_URL` — PostgreSQL connection string (Neon or local)
- `JWT_SECRET` — 64-byte hex string (`node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)
- `PLATFORM_FEE_PCT` — Platform fee percentage (default 0.05)
- SePay API keys for payment integration

### AI Service (`ai-service/.env`)
- `LLM_API_KEY` — API key for the LLM provider
- `LLM_BASE_URL` — Provider base URL (Gemini by default)
- `LLM_MODEL` — Model name (default `gemini-2.5-flash`)
- `INTERNAL_TOKEN` — Shared secret with NestJS backend
- `BACKEND_INTERNAL_URL` — NestJS internal endpoint for prompt DB fetch

### Frontend (`frontend/.env`)
- `VITE_API_BASE_URL` — Backend API URL (default `http://localhost:3001`)

## Docker Setup

### Primary Stack
```bash
docker compose up -d
```
Starts: NestJS backend (port 3001), AI service (port 8000), React frontend (port 5173), PostgreSQL.

### Test Stack
```bash
docker compose -f docker-compose.test.yml up -d
```
Isolated test stack with tmpfs PostgreSQL for fast, clean test runs.

## Local Development

### Backend
```bash
cd backend
npm install
npx prisma migrate dev
npx prisma db seed
npm run start:dev          # port 3001
```

### AI Service
```bash
cd ai-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev                # port 5173, proxies /api to port 3001
```

## Testing

### Backend
```bash
cd backend
npm run test:unit          # Unit tests
npm run test:e2e           # End-to-end tests
npm run test:all           # All tests
npm run test:cov           # Coverage report
```

### AI Service
```bash
cd ai-service
pytest                     # All tests (asyncio session scope)
pytest tests/test_matching.py -v   # Specific test file
```

### Frontend
```bash
cd frontend
npm run build              # TypeScript check + production build
```

## Database

### Migrations
```bash
cd backend
npx prisma migrate dev --name <migration_name>
```

### Seeding
```bash
cd backend
npx prisma db seed
```
Runs CMS taxonomies (domains, seams, archetypes), prompt templates, and void codes.

### Reset
```bash
cd backend
npx prisma migrate reset
```

## Simulations

The backend includes simulation scripts for testing payment flows without real bank transfers:

```bash
cd backend
npx ts-node scripts/simulate_sepay_ipn.ts   # Simulate SePay payment webhook
npx ts-node simulate_milestone_payment.ts    # Simulate milestone escrow flow
```

Bash-based mainflow validation scripts are in `backend/simulations/mainflow-validation/`.

## Health Checks

| Service | Endpoint | Expected |
|---|---|---|
| Backend | `GET http://localhost:3001/health` | `{"status":"ok"}` |
| AI Service | `GET http://localhost:8000/health` | `{"status":"ok","service":"aitasker-llm"}` |
| Frontend | `http://localhost:5173` | Landing page renders |

## Common Issues

- **Database connection refused**: Ensure PostgreSQL is running. Check `DATABASE_URL` in `backend/.env`.
- **AI service returns 403**: Verify `INTERNAL_TOKEN` matches between `backend/.env` and `ai-service/.env`.
- **Frontend CORS errors in dev**: Vite proxy should handle `/api` → `localhost:3001`. Check `vite.config.ts`.
- **Prisma migration conflicts**: Reset with `npx prisma migrate reset` (destroys data).
- **WebSocket not connecting**: Check Redis is running for the adapter, or verify in-memory fallback is active.
