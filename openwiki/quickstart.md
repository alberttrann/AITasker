# AITasker — Quickstart

AITasker is a full-stack AI-powered marketplace that connects non-technical CEOs with verified AI Experts through structured, machine-readable project specifications. It addresses the "invisible risk" problem in Vietnamese enterprise AI procurement.

## System at a Glance

| Service | Technology | Role |
|---|---|---|
| **Frontend** | React 19, Vite, Tailwind v4, Zustand | Role-segmented UI (CEO, Expert, Tech Team, Admin) |
| **Backend** | NestJS 10, Prisma ORM, PostgreSQL 16 | REST API, auth, payments, business logic |
| **AI Service** | FastAPI (Python 3.11), AsyncOpenAI | LLM elicitation, matching, dispute evaluation |

The frontend communicates with the NestJS backend via REST/WebSocket. The NestJS backend calls the AI service over internal S2S HTTP (`X-Internal-Token`). The AI service calls LLM providers (Gemini by default, swappable).

See [architecture/overview.md](architecture/overview.md) for the full system design.

## Where to Start

- **[architecture/overview.md](architecture/overview.md)** — System architecture, data flow, key design decisions
- **[backend/overview.md](backend/overview.md)** — NestJS modules, 34-model database, API surface, wallet/ledger
- **[ai-service/overview.md](ai-service/overview.md)** — LLM endpoints, elicitation engine, matching math, prompt system
- **[frontend/overview.md](frontend/overview.md)** — Routing, state management, feature structure, real-time messaging
- **[operations/runbook.md](operations/runbook.md)** — Environment setup, Docker, testing, local development

## Core Platform Concepts

**5-Stage Elicitation Engine** — Converts a CEO's free-text business problem into structured project specs (Artifact A), deep technical specs (Artifact B), domain requirements, milestones, and cost/duration estimates. Driven by LLM calls orchestrated through the AI service.

**Seam-Based Matching** — Experts are scored across 6 core domains (A–F) and 10 cross-domain competency seams using a 5-dimension composite formula (seam coverage 40%, domain depth 25%, portfolio quality 20%, archetype history 10%, engagement compatibility 5%). Pure Python arithmetic — no LLM calls.

**Dual-Tier Verification** — Skill claims are either `CLAIMED` (self-declared) or `EVIDENCE_BACKED` (AI-verified via portfolio submission). Experts with >4:1 claimed-to-verified ratio are excluded from matching (hard gate MF-5).

**Milestone Escrow & Double-Entry Ledger** — Payments use PostgreSQL `BIGINT` (VND integers) with a double-entry ledger (`wallet_transactions`). Inbound payments via SePay VietQR virtual accounts with HMAC-SHA256 IPN verification.

**2-Layer Dispute Arbitration** — AI Layer 1 evaluates disputes when confidence ≥ 0.80. Cases below that threshold escalate to Admin manual resolution.

**Hot-Reload Prompt Management** — Admin CMS edits AI prompt templates in PostgreSQL. Changes propagate to the AI service within 60 seconds via HTTP fetch with TTL cache — no container restarts needed.

## Repository Map

```
AITasker/
├── backend/              NestJS API (port 3001)
│   ├── src/              ~22 feature modules
│   └── prisma/           34-model schema + seeders
├── ai-service/           FastAPI microservice (port 8000)
│   ├── app/routers/      12 API endpoints
│   ├── app/services/     Core engines (elicitation, matching, disputes)
│   └── app/prompts/      9 Jinja2 fallback templates
├── frontend/             React 19 SPA
│   └── src/
│       ├── features/     Role-segmented pages (ceo, expert, tech-team, admin)
│       ├── hooks/        26 TanStack Query hooks
│       └── store/        3 Zustand stores
├── docs/                 E2E QA manual, screen flow diagrams
├── docker-compose.yml    Primary orchestrator
└── .env.example          Root env template
```

## Existing Documentation

- **README.md** — Executive summary, architecture diagram, setup guide, repository structure
- **ai-service/TECHNICAL_DOC.md** — Full AI service technical reference (endpoints, matching math, prompt system)
- **docs/AITasker_E2E_QA_Execution_Manual.md** — End-to-end QA test procedures
- **docs/AITasker_FE_Screen_Flow_Diagrams_and_Documentation.md** — Frontend screen flows and UI documentation

## Backlog

None — all major domains are documented.
