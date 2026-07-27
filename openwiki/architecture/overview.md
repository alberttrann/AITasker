# Architecture Overview

## System Architecture

```
                               ┌──────────────────────────────────────────┐
                               │           React 19 Frontend              │
                               │      Vite + Tailwind v4 + Zustand        │
                               └────────────────────┬─────────────────────┘
                                                    │ REST / WebSocket
                                                    ▼
┌─────────────────────────┐    HMAC Webhook    ┌──────────────────────────┐
│   SePay VietQR Gateway  │───────────────────►│      NestJS Backend      │
└─────────────────────────┘                    │ (Port 3001 / Prisma ORM) │
                                               └──────┬──────────────┬────┘
                                                      │              │
                                         S2S Internal │              │ PostgreSQL 16
                                          (Port 8000) │              │ (Neon Database)
                                                      ▼              ▼
                                               ┌────────────┐  ┌──────────┐
                                               │ FastAPI AI │  │ Database │
                                               │ Microservice  │ (34 Tables)
                                               └────────────┘  └──────────┘
```

## Technology Stack

| Layer | Technology | Key Libraries |
|---|---|---|
| **Backend API** | NestJS 10 (Node.js 20) | Prisma ORM, Passport JWT, Socket.io, Zod, Class-Validator |
| **AI Microservice** | FastAPI (Python 3.11) | AsyncOpenAI SDK, Jinja2, Pydantic v2, Pytest |
| **Frontend** | React 19, TypeScript, Vite | Tailwind CSS v4, TanStack Query v5, Zustand, Recharts |
| **Database** | PostgreSQL 16 | 34 tables, pgcrypto, BIGINT VND integers, JSONB specs |
| **Real-Time** | Socket.io + Redis Adapter | Pub/sub WebSocket clustering, live chat, push notifications |
| **Payments** | SePay VietQR Network | Virtual account generation, HMAC-SHA256 IPN webhooks |
| **Infrastructure** | Docker, Docker Compose, Nginx | Multi-stage builds, tmpfs test database, health checks |

## Data Flow

1. **Frontend → Backend**: REST API calls (Axios with JWT Bearer tokens) and WebSocket connections (Socket.io with Redis adapter). Vite dev server proxies `/api` to port 3001.

2. **Backend → AI Service**: Internal S2S HTTP calls on port 8000, authenticated via `X-Internal-Token` header (verified in `ai-service/app/dependencies.py`). The AI service is never exposed to the frontend.

3. **AI Service → LLM Providers**: AsyncOpenAI SDK pointed at configurable `LLM_BASE_URL`. Default: Gemini (`generativelanguage.googleapis.com`). Swappable to DeepSeek or native OpenAI via env vars.

4. **Backend → Database**: Prisma ORM with connection pooling. Uses Neon PostgreSQL (serverless) in production, local PostgreSQL for development.

5. **Payments**: SePay VietQR gateway sends IPN (Instant Payment Notification) webhooks with HMAC-SHA256 signatures to the backend's `/payments/ipn` endpoint.

## Key Architectural Decisions

### Microservice Isolation
The AI service is isolated behind the NestJS backend. Frontend never calls it directly. This allows independent scaling, separate deployment, and the ability to swap LLM providers without touching frontend or backend business logic.

### Dual-Layer Validation
Both Zod (`ZodValidationPipe`) and NestJS `ValidationPipe` (whitelist, forbidNonWhitelisted) validate incoming requests. This defense-in-depth catches malformed payloads at two levels.

### Provider-Agnostic LLM Client
The AI service uses the standard AsyncOpenAI SDK pointed at a configurable base URL. Switching from Gemini to DeepSeek or OpenAI requires only environment variable changes — no code changes.

### Feature-Sliced by Role (Frontend)
The frontend is organized by user role (`ceo/`, `expert/`, `tech-team/`, `admin/`) rather than by domain (`projects/`, `bids/`). Each role has its own dashboard layout with nested sub-routes, and all route-level components are lazy-loaded for code splitting.

### Dual-Layer State (Frontend)
TanStack Query manages server state (API data with 30s stale time), while Zustand manages client-side state (auth tokens, engagement unread counts, notifications). Zustand stores use localStorage persistence where appropriate.

### No-LLM Matching Engine
Expert-to-project matching is pure Python arithmetic — a 5-dimension weighted composite with a hard gate (MF-5). This keeps matching deterministic, fast, and cost-free (no LLM tokens consumed for scoring).

### Hot-Reload Prompts
Admin-edited prompt templates live in PostgreSQL (`prompt_templates` table). The AI service fetches them via HTTP with a 60-second TTL cache and renders with Jinja2. On-disk `.txt` files serve as canonical fallbacks when the backend/DB is unreachable.

## Security Boundaries

| Boundary | Mechanism |
|---|---|
| Frontend ↔ Backend | JWT Bearer tokens (7-day expiry), refresh token rotation |
| Backend ↔ AI Service | `X-Internal-Token` header (shared secret) |
| Backend ↔ SePay | HMAC-SHA256 webhook signature verification |
| Admin ↔ Backend | JWT + role guard (`ADMIN` role) |
| Artifact B access | 4-condition pure-Python gate: engagement state, bid state, expert NDA, CEO NDA |

## Source Locations

- Backend entry: `/backend/src/app.module.ts`, `/backend/src/main.ts`
- AI service entry: `/ai-service/app/main.py`
- Frontend entry: `/frontend/src/main.tsx`, `/frontend/src/App.tsx`
- Database schema: `/backend/prisma/schema.prisma`
- Docker orchestration: `/docker-compose.yml`, `/docker-compose.test.yml`
