# AI Service (FastAPI)

## Purpose

The AI service is an internal Python microservice that provides LLM-powered intelligence to the AITasker platform. It is invoked **exclusively by the NestJS backend** via internal service tokens. The frontend never calls it directly.

## Endpoints (12 total)

| # | Method | Endpoint | LLM? | Purpose |
|---|--------|----------|------|---------|
| 1 | `GET` | `/health` | No | Liveness probe |
| 2 | `GET` | `/projects/{id}/artifact-b` | No | 4-condition security gate for Artifact B access |
| 3 | `POST` | `/llm/elicitation/stage1-extract` | Yes | Extract symptoms, scale signals, voids, archetypes from CEO text |
| 4 | `POST` | `/llm/elicitation/stage3-vagueness-check` | Yes | Check behavioral-probe answers for vagueness (fails open) |
| 5 | `POST` | `/llm/elicitation/stage4-recommend` | Yes | Recommend tech stack, integration patterns, data volume sizing |
| 6 | `POST` | `/llm/elicitation/stage5-synthesize` | Yes | Full project spec synthesis from all elicitation stages |
| 7 | `POST` | `/llm/elicitation/milestone-chat` | Yes | Multi-turn milestone editing assistant with conversation history |
| 8 | `POST` | `/llm/portfolio-eval` | Yes | Evaluate expert portfolio against a seam boundary |
| 9 | `POST` | `/llm/matching` | **No** | Pure Python: 5-dimension composite scoring of experts |
| 10 | `POST` | `/llm/dispute-eval` | Yes | Neutral arbitration of deliverable vs. acceptance criterion |
| 11 | `POST` | `/llm/criterion-check` | Yes | Detect subjective language in acceptance criteria |
| 12 | `POST` | `/llm/service-generate` | Yes | Generate marketplace listing from expert capabilities |

## Core Services

```
app/services/
├── llm_client.py             AsyncOpenAI client wrapper with 3 completion helpers
├── prompt_service.py         Dual-layer (DB + disk) prompt loader, 60s TTL cache, Jinja2 renderer
├── prompt_loader.py          Local disk .txt file loader with @lru_cache
├── elicitation_engine.py     Stages 1, 3, 4, 5 + milestone chat orchestration
├── matching_engine.py        Pure-Python 5-D composite scoring (40/25/20/10/5 weights)
├── portfolio_evaluator.py    Seam-boundary competency evaluation (threshold: 0.85)
├── dispute_evaluator.py      Dispute arbitration with safety rules & confidence gating
└── service_generator.py      Marketplace listing generation & structured output parsing
```

## Prompt Management System

### Resolution Priority
1. In-memory cache (TTL = 60s, configurable via `PROMPT_CACHE_TTL_SEC`)
2. NestJS DB fetch (`GET /internal/prompts/{stage}` with `X-Internal-Token`)
3. On-disk `.txt` fallback (canonical defaults in `app/prompts/`)
4. Jinja2 render with runtime context

### On-Disk Templates (9 files)
| Template | Purpose |
|---|---|
| `stage1_extract.txt` | Symptom extraction + archetype recommendation |
| `stage3_vagueness_check.txt` | Vagueness/irrelevancy detection |
| `stage4_recommend.txt` | Technical stack recommendation |
| `stage5_synthesize.txt` | Full project synthesis (largest template) |
| `milestone_chat.txt` | Multi-turn milestone editing |
| `portfolio_eval.txt` | Portfolio evidence verification |
| `dispute_eval.txt` | Neutral dispute arbitration |
| `criterion_check.txt` | Subjective language detection |
| `service_generate.txt` | Marketplace listing generation |

### Hot-Reload Flow
Admin edits prompts in NestJS CMS → PostgreSQL `prompt_templates` table → AI service fetches via HTTP on cache miss → Jinja2 renders with live context. Changes propagate within 60 seconds without container redeployment.

## Matching Engine (No LLM)

The matching engine is **pure Python arithmetic** — it does not call any LLM.

### 5-Dimension Composite Formula
| Dimension | Weight | Description |
|---|---|---|
| Seam Coverage | 40% | Criticality-weighted coverage of required cross-domain seams |
| Domain Depth | 25% | Depth of expertise in required domains |
| Portfolio Quality | 20% | Verification quality of submitted portfolio evidence |
| Archetype History | 10% | Past success on similar project archetypes |
| Engagement Compatibility | 5% | Engagement model and availability fit |

### Hard Gate MF-5
Experts with a claimed-to-verified seam ratio > 4:1 are excluded regardless of composite score.

### Strength Labels
- `STRONG_MATCH`: ≥ 0.85
- `GOOD_MATCH`: ≥ 0.70
- `POSSIBLE_MATCH`: ≥ 0.55
- `WEAK_MATCH`: < 0.55

## LLM Client Design

- Uses `AsyncOpenAI` SDK pointed at configurable `LLM_BASE_URL`
- Default provider: Gemini (`generativelanguage.googleapis.com/v1beta/openai/`) with `gemini-2.5-flash`
- Most calls use `response_format={"type": "json_object"}` with temperature 0.1
- Responses parsed into Pydantic v2 models before returning to NestJS
- Provider-agnostic: swap to DeepSeek or OpenAI via env vars only

## Security

### S2S Authentication
`X-Internal-Token` header verified by `dependencies.py`. Disabled in development when the secret is empty.

### Artifact B 4-Condition Gate
Pure Python guard (`guards/artifact_b_guard.py`) evaluated sequentially:
1. Engagement state must be `CONNECTED` or `ACTIVE`
2. Bid state must be `TECH_APPROVED`, `CEO_REVIEW`, or `SELECTED`
3. Expert must have signed NDA
4. CEO must have signed NDA

First failure returns a specific human-readable reason.

### Fails-Open Design
Stage 3 vagueness check returns empty arrays on LLM error — never blocks the elicitation pipeline. All other endpoints return HTTP 503 on unhandled LLM errors.

## Test Coverage

```
tests/
├── test_elicitation.py       Stage 1/3/4/5 + milestone chat
├── test_matching.py          Pure-Python scoring engine, hard gate MF-5
├── test_integration.py       Full end-to-end integration (largest suite)
├── test_service_gen.py       Marketplace listing generation
├── test_disputes.py          Dispute arbitration evaluation
├── test_portfolio.py         Portfolio evidence verification
├── test_criteria.py          Subjective language detection
├── test_artifact_b_guard.py  4-condition security gate
└── test_adaptive_prompts.py  Dynamic template rendering
```

Run with: `pytest` (configured for `asyncio` session scope via `pytest.ini`)

## Key Source Files

- Entrypoint & router mounting: `/ai-service/app/main.py`
- Config & thresholds: `/ai-service/app/config.py`
- S2S auth guard: `/ai-service/app/dependencies.py`
- Prompt loader: `/ai-service/app/services/prompt_service.py`
- Full technical reference: `/ai-service/TECHNICAL_DOC.md`
- API listing: `/ai-service/ai-swagger_endpoints_list.txt`

## Change Checklist

- New LLM endpoint: add router in `app/routers/`, service in `app/services/`, request/response model in `app/models/`
- New prompt: add `.txt` fallback in `app/prompts/`, seed DB template via `prisma/seed-prompts.ts` in backend
- Matching formula change: update `matching_engine.py`, update `test_matching.py`, document weight rationale
- LLM provider change: update `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY` env vars only
- Add tests for every new endpoint and service
