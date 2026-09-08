# AITasker — AI Marketplace Platform for Enterprise AI Services

**Group Name:** SWP391-SE1908-Group05 

**Software Type:** Full-Stack Web Application & Microservices Platform 

**Repository:** [github.com/alberttrann/AITasker](https://github.com/alberttrann/AITasker)

**SRS Document:** [Word Document](https://github.com/alberttrann/AITasker)

**Deployed Production Links:**: [Railway Frontend](https://aitasker-frontend-production.up.railway.app/)

**Online NestJS Backend Swagger Doc:** [NestJS Swagger API Doc](https://aitasker-backend-production.up.railway.app/api#/)

**Online FastAPI Swagger Doc:** [LLM Service API Doc](https://aitasker-ai-production.up.railway.app/redoc)

---

## Executive Summary

AITasker is a full-stack, AI-powered marketplace built to solve the "invisible risk" problem in Vietnamese enterprise AI procurement. It connects non-technical Client CEOs with verified AI Experts through structured, machine-readable specifications rather than vague proposals.

### Core Architectural Pillars

1. **5-Stage AI Elicitation Engine**: Converts business problem descriptions into structured project specifications (Artifact A), deep technical specifications (Artifact B), required cross-domain capabilities, milestone delivery frameworks, and cost/duration estimates.
2. **Seam-Based Matching Engine**: Scores AI Experts across 6 core domains (**A–F**) and 10 cross-domain competency seams (**A↔C**, **A↔F**, **A↔D**, **D↔E**, **D↔F**, **C↔F**, **E↔F**, **A↔B**, **B↔E**, **C↔E**) using a 5-dimension composite formula (40% seam coverage, 25% domain depth, 20% portfolio verification quality, 10% archetype history, 5% engagement model compatibility).
3. **Dual-Tier Verification System**: Distinguishes self-declared skill claims (`CLAIMED`) from AI-verified capabilities (`EVIDENCE_BACKED`). Automated portfolio evaluation evaluates evidence against seam boundaries with a 30-day lockout enforced after 5 failed attempts.
4. **Milestone Escrow & Double-Entry Ledger**: Built on PostgreSQL `BIGINT` integer representation in Vietnamese Dong (VND) with strict double-entry ledger audits (`wallet_transactions`). Inbound payments use SePay VietQR virtual account IPN callbacks secured by HMAC-SHA256 signature verification.
5. **2-Layer Dispute Arbitration**: Automated AI Layer 1 evaluation resolves disputed criteria when confidence $\ge 0.80$ (`EXPERT_WINS`, `CLIENT_WINS`, or 50/50 `SPLIT`). Cases with confidence $< 0.80$ escalate seamlessly to the Admin Dispute Monitor.
6. **Hot-Reload Prompt Management**: Admin CMS allows editing AI prompt templates in PostgreSQL. Templates hot-reload across FastAPI workers within 60 seconds without container restarts or deployments.

---

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
                                               │ Microservice  │ (40 Tables)
                                               └────────────┘  └──────────┘
```

### Technology Stack

| Layer | Framework / Technology | Role & Key Libraries |
|---|---|---|
| **Backend API** | NestJS 10 (Node.js 20) | REST API, Prisma ORM, Passport JWT, EventEmitters, Class-Validator, Zod |
| **AI Microservice** | FastAPI (Python 3.11) | OpenAI / Anthropic / Gemini SDKs, Jinja2 Prompt Engine, Pytest, Pydantic v2 |
| **Frontend** | React 19, TypeScript, Vite | Tailwind CSS v4, TanStack Query v5, Zustand, Lucide Icons, Recharts |
| **Database** | PostgreSQL 16 (Neon / Local) | 40 normalized tables, `pgcrypto`, `BIGINT` VND integers, JSONB specifications |
| **Real-Time Gateway** | Socket.io + Redis Adapter | Pub/sub WebSocket clustering, live chat messaging, instant UI state invalidation |
| **Payment Gateway** | SePay VietQR Network | Inbound payment collection, virtual account generation, HMAC-SHA256 webhooks |
| **Infrastructure** | Docker, Docker Compose, Nginx | Multi-stage container builds, tmpfs test database, health-check probes |

---

## Repository Structure

```text
alberttrann-aitasker/
├── docker-compose.yml              # Primary container orchestrator (App + AI + Frontend)
├── docker-compose.test.yml         # Isolated test suite container stack with tmpfs Postgres
├── .env.example                    # Root environment configuration template
├── ai-service/                     # Python FastAPI AI Microservice
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py                 # FastAPI application entrypoint & middleware
│   │   ├── config.py               # Pydantic environment & threshold configurations
│   │   ├── dependencies.py         # Internal S2S token guard middleware
│   │   ├── guards/                 # Security gates (Artifact B 4-condition guard)
│   │   ├── models/                 # Request & Response Pydantic data schemas
│   │   ├── prompts/                # Fallback Jinja2 on-disk prompt templates (.txt)
│   │   ├── routers/                # API Endpoints (Elicitation, Portfolio, Matching, Disputes, etc.)
│   │   └── services/               # Core engine math & LLM orchestration clients
│   └── tests/                      # Pytest unit and integration test suite
├── backend/                        # NestJS Backend API Application
│   ├── Dockerfile
│   ├── package.json
│   ├── prisma/
│   │   ├── schema.prisma           # Complete 40-table database schema
│   │   ├── seed-cms.ts             # CMS taxonomy seeder (Domains, Seams, Archetypes)
│   │   ├── seed-prompts.ts         # Prompt templates DB seeder
│   │   └── seed-void-codes.ts      # Elicitation void codes seeder
│   ├── scripts/
│   │   └── simulate_sepay_ipn.ts   # SePay webhook IPN simulation CLI tool
│   └── src/
│       ├── admin/                  # Platform administration & CMS configuration modules
│       ├── auth/                   # JWT auth, OTP verification, password recovery, role switching
│       ├── bids/                   # Capability bids & multi-round offer negotiation engine
│       ├── disputes/               # Dispute filing, AI Layer 1 evaluation, manual resolution
│       ├── elicitation/            # 5-stage discovery wizard & FastAPI integration client
│       ├── engagements/            # Contract lifecycle, dual NDA signatures, workspace access
│       ├── expert-profiles/        # Domain depths, seam claims, portfolio evidence submissions
│       ├── milestones/             # Milestone creation, criteria verification, DoD checklists
│       ├── payments/               # SePay IPN webhook handler, HMAC signature verifier, Bank Hub
│       ├── projects/               # Published specs, Artifact A/B access, matching shortlists
│       ├── reviews/                # Post-engagement peer reviews & structured technical signals
│       ├── shared/                 # Double-entry ledger service, VA generator, matching helpers
│       ├── submissions/            # Deliverable submissions & pay-gated document staging
│       ├── subscriptions/          # Wallet-deducted subscription activations & history
│       └── wallet/                 # Wallet transactions, VietQR top-ups, withdrawal management
└── frontend/                       # React 19 Frontend Web Application
    ├── Dockerfile
    ├── vite.config.ts
    ├── nginx/default.conf           # Production Nginx reverse proxy configuration
    └── src/
        ├── App.tsx                 # Application router & route guards
        ├── components/             # Reusable UI widgets, Modals, TopNav, Tables, Chat drawers
        ├── features/               # Role-segmented feature pages (admin, ceo, expert, tech-team)
        ├── hooks/                  # TanStack Query custom data-fetching hooks
        ├── lib/                    # API client instance, auth context, socket provider, utils
        └── store/                  # Zustand global state stores (auth, engagements, notifications)
```

---

## Prerequisites & System Requirements

Before running the application locally, ensure you have the following installed:

- **Node.js**: v20.x or higher
- **npm**: v10.x or higher
- **Python**: v3.11.x
- **PostgreSQL**: v16.x (or a free [Neon PostgreSQL](https://neon.tech) cloud database)
- **Docker Desktop**: v24.x or higher (for containerized setup)
- **Git**: v2.x or higher

---

## Environment Configuration

Copy the sample environment templates in each service directory and configure the required keys:

### 1. Backend Environment (`backend/.env`)

```bash
cp backend/.env.example backend/.env
```

Set the following variables:

```env
# Database connection (Neon or Local PostgreSQL)
DATABASE_URL="postgresql://user:password@localhost:5432/aitasker?schema=public&sslmode=require"
DIRECT_URL="postgresql://user:password@localhost:5432/aitasker?schema=public"

# Authentication Secrets
# Generate random 64-byte hex: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET="YOUR_64_BYTE_HEX_SECRET_STRING_HERE"
JWT_EXPIRES_IN="7d"

# Platform Settings
PLATFORM_SETTINGS_ID="00000000-0000-0000-0000-000000000004"
PLATFORM_FEE_PCT=0.05

# SePay Payment Gateway Integration
SEPAY_WEBHOOK_SECRET="your-sepay-webhook-secret-key"
SEPAY_SECRET_KEY="your-sepay-secret-key"
SEPAY_API_BASE="https://my.sepay.vn/userapi"

# Internal Service Networking
FASTAPI_URL="http://localhost:8000"
INTERNAL_SERVICE_TOKEN="aitasker-internal-dev-secret-change-in-prod"

# Application Config
PORT=3001
NODE_ENV="development"
CORS_ORIGIN="http://localhost:5173"
FRONTEND_URL="http://localhost:5173"

# Email Delivery (Gmail SMTP or Mailtrap)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
FROM_EMAIL="AITasker <noreply@aitasker.com>"
```

### 2. AI Service Environment (`ai-service/.env`)

```bash
cp ai-service/.env.example ai-service/.env
```

Set the following variables:

```env
# LLM Provider Configuration (OpenAI, Gemini, Anthropic, or DeepSeek via OpenAI-compatible endpoint)
LLM_API_KEY="your-llm-api-key"
LLM_BASE_URL="https://generativelanguage.googleapis.com/v1beta/openai/"
LLM_MODEL="gemini-2.5-flash"
LLM_TEMPERATURE=0.1
LLM_MAX_OUTPUT_TOKENS=8192

# Confidence Thresholds
PORTFOLIO_EVAL_THRESHOLD=0.85
DISPUTE_EVAL_THRESHOLD=0.80

# Microservice Network Settings
PORT=8000
ENV="development"
NESTJS_BASE_URL="http://localhost:3001"
INTERNAL_SERVICE_TOKEN="aitasker-internal-dev-secret-change-in-prod"
PROMPT_CACHE_TTL_SEC=60
```

### 3. Frontend Environment (`frontend/.env`)

```bash
cp frontend/.env.example frontend/.env
```

```env
VITE_API_BASE_URL="http://localhost:3001"
VITE_WS_URL="http://localhost:3001"
```

---

## Local Development Setup

### Step 1: Install Dependencies

```bash
# 1. Install Backend dependencies & generate Prisma client
cd backend
npm install
npx prisma generate

# 2. Install Frontend dependencies
cd ../frontend
npm install

# 3. Setup Python Virtual Environment for AI Service
cd ../ai-service
python -m venv venv

# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
cd ..
```

### Step 2: Provision & Seed Database

If pointing to a fresh local or Neon PostgreSQL instance, run migrations and seed initial CMS definitions:

```bash
cd backend

# Apply migrations
npx prisma db push

# Seed CMS Taxonomies, Prompt Templates, and Void Codes
npx ts-node prisma/seed-cms.ts
npx ts-node prisma/seed-prompts.ts
npx ts-node prisma/seed-void-codes.ts

cd ..
```

### Step 3: Launch Local Development Servers

Run the three services in separate terminal windows:

#### Terminal 1: NestJS Backend API
```bash
cd backend
npm run start:dev
```
*   **REST API**: [http://localhost:3001](http://localhost:3001)
*   **Swagger Docs**: [http://localhost:3001/api](http://localhost:3001/api)
*   **Health Check**: [http://localhost:3001/health](http://localhost:3001/health)

#### Terminal 2: FastAPI AI Microservice
```bash
cd ai-service
# Activate venv first
venv\Scripts\activate   # Windows
# source venv/bin/activate # macOS/Linux

uvicorn app.main:app --reload --port 8000
```
*   **AI Microservice**: [http://localhost:8000](http://localhost:8000)
*   **Interactive Redoc Docs**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
*   **Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

#### Terminal 3: React Frontend Web App
```bash
cd frontend
npm run dev
```
*   **Web Application**: [http://localhost:5173](http://localhost:5173)

---

## Docker Setup & Deployment

You can run the full application stack using Docker Compose:

### 1. Launch Services

```bash
docker compose up --build -d
```

### 2. Service Access Points

| Service | Local URL | Container Name | Healthcheck |
|---|---|---|---|
| **Frontend Web App** | [http://localhost](http://localhost) | `aitasker-frontend` | HTTP GET `/` |
| **NestJS Backend** | [http://localhost:3001/api](http://localhost:3001/api) | `aitasker-backend` | HTTP GET `/health` |
| **FastAPI AI Service** | [http://localhost:8000/docs](http://localhost:8000/docs) | `aitasker-ai` | Python urllib `/health` |

### 3. Container Management Commands

```bash
# View aggregated live logs
docker compose logs -f

# View logs for a specific service
docker compose logs -f backend

# Stop all containers
docker compose down

# Stop and wipe container volumes
docker compose down -v
```

---

## Testing & Quality Assurance

### 1. Backend Automated Tests (NestJS)

The NestJS test suite includes unit tests and E2E integration tests against an isolated PostgreSQL instance.

```bash
cd backend

# Run Unit Tests
npm run test

# Run Integration / E2E Tests (Requires running test database)
docker compose -f docker-compose.test.yml up -d
npm run test:e2e
docker compose -f docker-compose.test.yml down
```

### 2. AI Service Unit Tests (pytest)

FastAPI unit tests use mocked LLM responses and execute in under 1 second without incurring API token costs.

```bash
cd ai-service
venv\Scripts\activate

# Run unit tests with pytest
pytest tests/ -m "not integration" -v
```

### 3. Simulating Inbound Payments (SePay Webhook Simulator)

You can simulate bank transfers and test real-time wallet top-ups or milestone escrow locks using the included CLI simulator:

```bash
cd backend

# Simulate top-up for the latest active Virtual Account in the local DB
npm run simulate:ipn

# Simulate top-up for a specific Virtual Account number and custom amount
npm run simulate:ipn -- --va "WALLETTOPUP12345" --amount 10000000
```

---


## Production Cloud Deployment Architecture

AITasker is deployed on a multi-cloud infrastructure consisting of **Railway** (Microservices & Frontend hosting), **Neon** (Serverless PostgreSQL database), **Upstash** (Serverless Redis for WebSocket pub/sub clustering), and **SePay VietQR** (Inbound payment processing).

```
                            [ USER / BROWSER ]
                                    │
                                    │ HTTPS (Port 443)
                                    ▼
                 ┌──────────────────────────────────────┐
                 │          Frontend Service            │
                 │   `aitasker-frontend-production`     │
                 │     (Nginx Container / Port 80)      │
                 └──────────────────┬───────────────────┘
                                    │
                        WSS / REST  │ HTTPS (Port 443)
                                    ▼
┌───────────────────────────────────────────────────────────────────────┐
│                           Railway VPC                                 │
│                                                                       │
│  ┌─────────────────────────────────┐                                  │
│  │         Backend Service         │                                  │
│  │   `aitasker-backend-production` │                                  │
│  │       (NestJS Container)        │                                  │
│  └────────────────┬────────────────┘                                  │
│                   │                                                   │
│                   │ Internal HTTP (Port 8000)                         │
│                   │ Header: `x-internal-token: <INTERNAL_SECRET>`     │
│                   ▼                                                   │
│  ┌─────────────────────────────────┐                                  │
│  │           AI Service            │                                  │
│  │      `aitasker-ai-production`    │                                  │
│  │      (FastAPI Container)        │                                  │
│  └─────────────────────────────────┘                                  │
│                                                                       │
│  DNS: `http://aitasker-ai.railway.internal:8000`                       │
└──────────────┬─────────────────────────────┬──────────────────────────┘
               │                             │
    TLS / SSL  │ Connection                  │ TLS / SSL
      (Pooler) │                             │ (rediss://)
               ▼                             ▼
   ┌───────────────────────┐     ┌───────────────────────┐
   │    Neon PostgreSQL    │     │     Upstash Redis     │
   │  (Serverless DB v16)  │     │   (WebSocket Pub/Sub) │
   └───────────────────────┘     └───────────────────────┘
```

---

### 1. Network Topology & Microservice Communication

#### A. Railway Private Subnet (`.railway.internal`)
Communication between the NestJS Backend and FastAPI AI Service takes place over **Railway’s isolated IPv6 Private Network**, completely bypassing the public internet:

- **Public Hostname**: `https://aitasker-ai-production.up.railway.app`
- **Internal Private Mesh Endpoint**: `http://aitasker-ai.railway.internal:8000`

Setting `FASTAPI_URL="http://aitasker-ai.railway.internal:8000"` on the backend provides zero-latency internal routing and avoids exposing intermediate LLM calls to external networks.

#### B. S2S Authentication & Security Gate (`INTERNAL_SECRET`)
To prevent unauthorized invocation of internal LLM endpoints, NestJS passes a shared 256-bit secret token on every request header:

```http
X-Internal-Token: <<SECRET_INTERNAL_TOKEN>>
```

FastAPI’s `verify_internal_token` middleware (`ai-service/app/dependencies.py`) inspects incoming headers against `INTERNAL_SECRET`. Requests lacking or providing an invalid secret token are rejected with **HTTP 403 Forbidden**.

---

### 2. Cloud Data Layer (Neon + Upstash)

#### A. Neon Serverless PostgreSQL (`DATABASE_URL` vs `DIRECT_URL`)
AITasker utilizes Neon PostgreSQL 16 with separate connection strings configured for connection pooling and schema migrations:

- **`DATABASE_URL` (PgBouncer Pooled)**:  
  `postgresql://neondb_owner:...@ep-misty-morning-aoxdjg7d-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`  
  Used by active NestJS worker instances to handle high-concurrency connection spikes without exhausting database connections.
- **`DIRECT_URL` (Direct Instance Connection)**:  
  `postgresql://neondb_owner:...@ep-misty-morning-aoxdjg7d.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`  
  Used exclusively by Prisma CLI (`npx prisma db push` / migrations) to establish direct DDL locks.

#### B. Upstash Redis Cluster (`rediss://`)
To support horizontal scaling of Socket.io instances on Railway, NestJS binds to an Upstash Redis cluster via TLS (`rediss://` protocol):

```env
REDIS_URL="rediss://default:...@merry-haddock-156575.upstash.io:6379"
```

The `RedisIoAdapter` (`backend/src/common/adapters/redis-io.adapter.ts`) attaches `pubClient` and `subClient` instances to Redis, ensuring real-time events (`newMessage`, `milestone:updated`, `payment:confirmed`) broadcast seamlessly across all backend replicas.

---

### 3. Frontend Container & Nginx Proxy Setup

The frontend is packaged as a lightweight multi-stage Docker image (`frontend/Dockerfile`).

#### Stage 1: Build Time
Vite bakes environment variables directly into the compiled JavaScript bundle during `npm run build`:

```dockerfile
ARG VITE_API_BASE_URL="https://aitasker-backend-production.up.railway.app"
ARG VITE_WS_URL="https://aitasker-backend-production.up.railway.app"
```

#### Stage 2: Nginx Web Server (`nginx/default.conf`)
Nginx 1.27 Alpine serves static JS/CSS assets and handles SPA client-side routing fallback:

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Single-Page Application (SPA) Fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static Asset Caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

---

### 4. Production Money Flow & SePay Integration Topology

```
1. INBOUND PAYMENT (Client Top-Up or Milestone Funding):
   Client Bank App ──(VietQR Transfer)──► SePay Gateway
                                              │
                                              │ Signed Webhook Callback
                                              │ POST /webhooks/sepay/ipn
                                              ▼
                                   [ NestJS Backend ]
                                   1. Verify HMAC-SHA256 Signature (`SEPAY_WEBHOOK_SECRET`)
                                   2. Verify Idempotency (`wallet_transactions.reference_id`)
                                   3. Execute Atomic DB Transaction:
                                      - Deduct Client Available Balance
                                      - Credit Client Locked Balance
                                      - Create Escrow Account (`status = 'HELD'`)
                                      - Set Milestone `IN_PROGRESS`
                                      - Bulk Release Staged Pay-Gated Docs
                                   4. Emit Socket.io `payment:confirmed` Event

2. OUTBOUND DISBURSEMENT (Milestone Approval & Release):
   Reviewer Verifies Criteria ──► [ NestJS Ledger Engine ]
                                        │
                                        ├─► Calculate Platform Fee (5%) → Platform Wallet
                                        ├─► Calculate Net Payout (95%) → Expert Wallet Balance
                                        │
                                        └─► IF Expert Bank Account Linked:
                                            1. Create `withdrawal_requests` (`MILESTONE_RELEASE`)
                                            2. Debit Expert Available Balance
                                            3. Log `WITHDRAWAL` Transaction
                                            4. Admin Confirms Transfer via `/admin/withdrawals/:id/complete`
```

---

### 5. Production Environment Variable Reference

#### A. Backend Service Environment
| Variable Name | Value / Format | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://...pooler...` | Neon pooled connection string |
| `DIRECT_URL` | `postgresql://...aws.neon.tech...` | Neon direct DDL connection string |
| `JWT_SECRET` | 64-byte Hex String | Secret key for JWT access token signing |
| `SEPAY_WEBHOOK_SECRET` | `whsec_...` | HMAC-SHA256 secret for verifying SePay webhooks |
| `FASTAPI_URL` | `http://aitasker-ai.railway.internal:8000` | Railway internal private mesh endpoint |
| `REDIS_URL` | `rediss://...upstash.io:6379` | TLS-encrypted Upstash Redis connection string |
| `INTERNAL_SECRET` | 32-byte Hex String | Shared secret header passed to FastAPI microservice |
| `CORS_ORIGIN` | `https://aitasker-frontend-production...` | Whitelisted production frontend domain |

#### B. AI Service Environment
| Variable Name | Value / Format | Description |
|---|---|---|
| `ENV` | `production` | Production environment flag |
| `LLM_BASE_URL` | `https://api.xiaomimimo.com/v1` | OpenAI-compatible LLM Gateway Base URL |
| `LLM_MODEL` | `mimo-v2.5-pro` | Primary LLM model identifier |
| `INTERNAL_SECRET` | 32-byte Hex String | Shared secret required on `X-Internal-Token` header |
| `PORTFOLIO_EVAL_THRESHOLD` | `0.85` | Confidence threshold for Tier 2 seam verification |
| `DISPUTE_EVAL_THRESHOLD` | `0.80` | Confidence threshold for Layer 1 dispute auto-resolution |

#### C. Frontend Service Environment
| Variable Name | Value / Format | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `https://aitasker-backend-production...` | Production backend HTTPS URL |
| `VITE_WS_URL` | `https://aitasker-backend-production...` | Production WebSocket WSS URL |

---

### 6. Deployment Verification Checklist

After deploying to Railway, verify the operational status of all services:

```bash
# 1. Verify NestJS Health Probe
curl -I https://aitasker-backend-production.up.railway.app/health
# Response: HTTP/1.1 200 OK -> {"status":"ok","service":"aitasker-backend"}

# 2. Verify FastAPI Microservice Health Probe
curl -I https://aitasker-ai-production.up.railway.app/health
# Response: HTTP/1.1 200 OK -> {"status":"ok","service":"aitasker-llm"}

# 3. Test Unauthorized Internal Endpoint Access (Should return 403)
curl -X POST https://aitasker-ai-production.up.railway.app/llm/portfolio-eval
# Response: HTTP/403 Forbidden -> {"detail":"Not authorised"}
```

---

## Technical Documentation Index

Detailed architectural and technical specification documents are located in the repository:

- **[`00-master_reference.md`](docs/27_7/00-master_reference.md)**: Master taxonomy mapping, composite match score formula weights, 2-tier verification rules, security gates, and 40-table database summary.
- **[`01-er-plan.md`](docs/27_7/01-er-plan.md)**: Database schema specifications, column types, CHECK constraints, foreign key cascades, and unique indexes.
- **[`02-state-machines.md`](docs/27_7/02-state-machines.md)**: State machine transition logic for elicitation sessions, projects, capability bids, engagements, milestones, disputes, virtual accounts, and withdrawals.
- **[`03-business-rules.md`](docs/27_7/03-business-rules.m)**: 95 business rules across 13 core functional domains.
- **[`04-endpoints.md`](docs/27_7/04-endpoints.md)**: Complete endpoint catalog covering 213 HTTP routes, S2S internal APIs, and WebSocket events.
- **[`05-use-cases.md`](docs/27_7/05-use-cases.md)**: 200 use case specifications mapped across 18 Use Case Diagrams.
- **[`06-enum-domains.md`](docs/27_7/06-enum-domains.md)**: Bounds, status codes, and JSONB schema definitions for PostgreSQL JSONB columns and FastAPI Pydantic payload models.
- **[`07-scenario-paths.md`](docs/27_7/07-scenario-paths.md)**: 106 screens of frontend/ module, mapped with the system's tables & endpoints 

- **[`08-mainflows_redo.md`](docs/27_7/08-mainflows_redo.md)**: 20 end-to-end swimlane main flows with ASCII diagrams and step detail tables.

---

## Project Team

**SWP391 — SE1908 — Group 05**

- **Trần Võ Minh Hùng** (`hungminh.2310@gmail.com`) 
- **Bùi Phạm Chí Nhân** (`buiphamchinhan@gmail.com`) 
- **Võ Cao Minh** (`vocaominh7406@gmail.com`) 
- **Chiêm Minh Thức** (`minhthuctim13@gmail.com`) 
- **Huỳnh Tuấn Khang** (`khang55555@gmail.com`) 

---

&copy; 2026 AITasker Platform. All rights reserved.
