# AITasker AI-Service — Technical Reference & Integration Manual

> **Purpose:** Definitive technical reference for the `ai-service` FastAPI microservice. This document strictly reflects the codebase in `ai-service/app/` as of July 2026.
>
> **Architecture:** FastAPI + Pydantic + OpenAI SDK (AsyncOpenAI) + Jinja2. The service is stateless and relies entirely on NestJS for DB persistence and orchestration. It communicates with the LLM via the OpenAI-compatible API standard (defaulting to Google Gemini's OpenAI-compatible endpoint).

---

## Table of Contents

1. [Architecture & Configuration](#1-architecture--configuration)
2. [Security & Access Control](#2-security--access-control)
3. [Prompt Engineering & Management](#3-prompt-engineering--management)
4. [Endpoint Reference (NestJS ↔ FastAPI)](#4-endpoint-reference-nestjs--fastapi)
5. [Core Engines & Business Logic](#5-core-engines--business-logic)
6. [Data Models (Pydantic Schemas)](#6-data-models-pydantic-schemas)
7. [Testing & Simulations Framework](#7-testing--simulations-framework)

---

## 1. Architecture & Configuration

The `ai-service` is an internal microservice exposed on port `8000`. It is never called directly by the Frontend. All requests originate from the NestJS backend.

### 1.1 Environment Variables (`ai-service/.env`)
| Variable | Default | Description |
|---|---|---|
| `LLM_API_KEY` / `ANTHROPIC_API_KEY` | `""` | API key for the LLM provider. Service runs in test mode if empty or starts with `test`. |
| `LLM_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta/openai/` | OpenAI-compatible base URL. |
| `LLM_MODEL` | `gemini-2.5-flash` | Model identifier. |
| `LLM_TEMPERATURE` | `0.1` | Default temperature for JSON generation. |
| `LLM_MAX_OUTPUT_TOKENS` | `8192` | Max output tokens. |
| `PORTFOLIO_EVAL_THRESHOLD` | `0.85` | Confidence required for Tier 2 upgrade. |
| `DISPUTE_EVAL_THRESHOLD` | `0.80` | Confidence required for auto-resolve. |
| `NESTJS_BASE_URL` | `http://localhost:3001` | NestJS URL for fetching DB prompt templates. |
| `INTERNAL_SERVICE_TOKEN` | `aitasker-internal-dev-secret-change-in-prod` | Shared secret for internal auth. |
| `PROMPT_CACHE_TTL_SEC` | `60` | TTL for DB-fetched prompt cache. |

### 1.2 LLM Client (`llm_client.py`)
The service uses the `openai` Python SDK asynchronously (`AsyncOpenAI`).
- **JSON Mode:** All structured endpoints use `response_format={"type": "json_object"}` to guarantee valid JSON outputs.
- **System + User Pattern:** Most calls use a `system` prompt (the Jinja2 template) and a `user` prompt (the dynamic context).
- **Deterministic Arbitration:** Dispute evaluation and criterion checking override the temperature to `0.0` for deterministic results.

---

## 2. Security & Access Control

The service implements a lightweight internal guard via FastAPI dependencies.

- **`verify_internal_token` (`app/dependencies.py`):** Checks the `x-internal-token` header against `settings.internal_service_token`.
  - If the secret is empty in `.env`, the guard is disabled (useful for local dev).
  - In production, NestJS must pass this header on every call to FastAPI.
- **CORS:** Configured to allow origins `["http://localhost:3000"]`. Since calls are server-to-server, CORS is largely irrelevant but configured for safety.

---

## 3. Prompt Engineering & Management

Prompts are managed dynamically via a hot-reload mechanism orchestrated by NestJS.

### 3.1 Prompt Service (`prompt_service.py`)
1. **Cache Check:** FastAPI checks an in-memory cache (`_cache: dict[str, _CacheEntry]`).
2. **DB Fetch (Priority 1):** If stale or missing, it calls `GET {NESTJS_BASE_URL}/internal/prompts/{stage}` with the `x-internal-token` header. NestJS reads from the `prompt_templates` table.
3. **File Fallback (Priority 2):** If NestJS returns 404 or fails, FastAPI falls back to the `.txt` file in `app/prompts/`.
4. **Cache Update:** The retrieved text is cached for `PROMPT_CACHE_TTL_SEC` (60s).
5. **Rendering:** The template is rendered with Jinja2 using the context provided by the specific engine.

### 3.2 Available Jinja2 Variables
| Stage Template | Context Variables |
|---|---|
| `stage1_extract.txt` | `archetypes` (list of dicts), `void_codes` (list of dicts) |
| `stage3_vagueness_check.txt` | *(None dynamic, system appends forgiveness text if non-technical)* |
| `stage5_synthesize.txt` | `domains` (list), `seams` (list), `archetypes` (list) |
| `portfolio_eval.txt` | `seam_definitions` (list), `evaluated_seam_code`, `evaluated_seam_name`, `evaluated_seam_desc` |
| `service_generate.txt` | `price_guidance` (dict), `claimed_domains` (list), `claimed_seams` (list), `is_pro_expert` (bool) |
| `criterion_check.txt` | `archetype_name` (string) |

### 3.3 Custom Jinja2 Filters
- `format_number`: Formats integers with commas (e.g., `5000000` → `5,000,000`). Used in `service_generate.txt`.

---

## 4. Endpoint Reference (NestJS ↔ FastAPI)

NestJS proxies all AI requests to FastAPI at port `8000`.

### Elicitation Engine (`/llm/elicitation`)
| Method | Path | NestJS Caller | Purpose |
|---|---|---|---|
| POST | `/llm/elicitation/stage1-extract` | `ElicitationService.submitStage1` | Extracts symptoms, voids, archetypes, critical artifacts. |
| POST | `/llm/elicitation/stage3-vagueness-check` | `ElicitationService.submitStage3` | Checks probe answers for vagueness and relevancy. Fails open. |
| POST | `/llm/elicitation/stage4-recommend` | `ElicitationService.recommendTechContext` | Recommends tech stack/integration for Stage 4 form. |
| POST | `/llm/elicitation/stage5-synthesize` | `ElicitationService.synthesize` | Full project synthesis. Returns 6 structured JSON blocks. |
| POST | `/llm/elicitation/milestone-chat` | `ProjectsService.milestoneChat` | Multi-turn chat about milestone framework. |

### Evaluation & Matching (`/llm`, `/projects`)
| Method | Path | NestJS Caller | Purpose |
|---|---|---|---|
| POST | `/llm/portfolio-eval` | `PortfolioService.submit` | Evaluates expert seam evidence. Returns pass/fail + advisory. |
| POST | `/llm/dispute-eval` | `DisputesService.fileDispute` | Neutral arbitration of deliverable vs criterion. Returns finding + confidence. |
| POST | `/llm/criterion-check` | `CriteriaService.create` | Detects subjective language in acceptance criteria. |
| POST | `/llm/service-generate` | `ListingsService.generateServiceDraft` | AI-assist for service listing creation. |
| POST | `/llm/matching` | `MatchingHelper.scoreEligibleExperts` | Pure Python (no LLM). Composite scoring of experts. |
| GET | `/projects/{project_id}/artifact-b` | `ProjectsService.getProject` | 4-condition gate check for Artifact B access. |

---

## 5. Core Engines & Business Logic

### 5.1 Elicitation Engine (`elicitation_engine.py`)

#### Stage 1: Extraction
- Validates that `symptom_text` is not empty.
- Extracts `critical_artifacts_required` (e.g., compliance ruleset, API docs). If the CEO mentions they have a specific technical document, the AI flags it as required.
- Validates `recommended_archetypes` against the provided DB list. Falls back to all defaults if the AI returns nothing valid.

#### Stage 3: Vagueness & Relevancy Check
- Evaluates both **vagueness** (too generic to act on) and **irrelevancy** (doesn't match project context).
- **Forgiveness Injection:** If `is_self_technical = false`, the system appends a strict directive to the LLM: *"Be highly forgiving on vagueness... do not demand deep architectural specifics."*
- **Fails Open:** If the LLM call throws an exception, the service returns empty arrays (200 OK) rather than blocking the CEO from advancing.

#### Stage 5: Synthesis
The most complex engine. It assembles all 4 stages into a final prompt.
- **Missing Artifacts Logic:** If `critical_artifacts_required` were flagged in Stage 1 but not provided in Stage 4 (`technical_artifacts` dict), the prompt explicitly tells the LLM to cap `completeness_score` at 0.60 and add `sdlc_notices`.
- **Validation:** The `_validate_stage5_response` function enforces strict enums:
  - `criticality` ∈ `load_bearing`, `significant`, `contributing`
  - `required_depth` ∈ `SURFACE`, `OPERATIONAL`, `DEEP`
  - `sign_off_authority` ∈ `CEO`, `TECH_TEAM`, `JOINT` (defaults to CEO if invalid)
  - `volume_tier` ∈ `TIER_1`, `TIER_2`, `TIER_3` (defaults to TIER_1 if invalid)
- **Immutability:** `payment_amount_vnd` is forced to `0` on all milestones regardless of LLM output. The CEO sets prices later.
- **Aggregates:** Computes `estimated_total_cost_vnd` and `estimated_total_duration_days` by summing milestone estimates.

#### Milestone Chat (`milestone_chat`)
- Uses `call_llm_with_system_and_messages` (multi-turn).
- **Edit Suggestions:** The AI is prompted to wrap suggested milestone edits in ` ```edit_suggestion { ... } ``` ` fences. The engine parses this out and returns it as a separate `suggestedEdit` JSON object, stripping it from the visible `reply` text.

### 5.2 Matching Engine (`matching_engine.py`)

**Pure Python arithmetic — no LLM calls.**

1. **Hard Gate (Claimed vs Verified):**
   Before scoring, experts are excluded if their ratio of `CLAIMED` to `EVIDENCE_BACKED` seams (among the *required* seams) exceeds 4:1.
   *Note: The gate only applies if `evidence_backed_count > 0`. An expert with 0 verified seams is NOT excluded by this gate.*

2. **Composite Score Formula:**
   `composite = (0.40 * seam_score) + (0.25 * domain_score) + (0.20 * portfolio_score) + (0.10 * archetype_score) + (0.05 * engagement_score)`
   - `engagement_score` is always 1.0 (NestJS pre-filters).
   - `portfolio_score` defaults to 0.5 if null.

3. **Seam Scoring & Gap Map:**
   - Weights: `load_bearing` = 3.0, `significant` = 2.0, `contributing` = 1.0.
   - Tiers: `EVIDENCE_BACKED` = 1.0 (Green), `CLAIMED` = 0.5 (Amber), Missing = 0.0 (Red).
   - `seam_score = Σ(tier_mult × criticality_weight) / Σ(criticality_weight)`

4. **Domain Scoring:**
   - `SURFACE` = 1, `OPERATIONAL` = 2, `DEEP` = 3.
   - If expert depth ≥ required depth → 1.0
   - If expert depth == required depth - 1 → 0.5
   - Else → 0.0

5. **Strength Labels:**
   - `STRONG_MATCH` ≥ 0.85
   - `GOOD_MATCH` ≥ 0.70
   - `POSSIBLE_MATCH` ≥ 0.55
   - `WEAK_MATCH` < 0.55

### 5.3 Evaluators (Portfolio, Dispute, Criterion)

#### Portfolio Evaluator
- Uses live `seam_definitions` from DB context.
- Threshold: `settings.portfolio_eval_threshold` (0.85).
- Enforces `passed_boolean = (confidence_score >= threshold)` in code, ignoring whatever the LLM outputs for the boolean.
- If failed, generates `gap_advisory` naming the missing signal type.

#### Dispute Evaluator
- Temperature: `0.0` (strictly deterministic).
- Context Injection: Receives `project_archetype`, `milestone_context`, and `prior_revision_count` to calibrate arbitration.
- Finding Validation: `finding` must be `expert_wins` or `client_wins`. Defaults to `client_wins` if LLM hallucinates a different string (conservative protection of client funds).
- The 0.80 auto-resolve threshold is **not** applied here; FastAPI returns the raw score and NestJS decides auto-resolve vs manual review.

#### Criterion Checker
- Temperature: `0.0`.
- Returns `is_subjective`, `suggestions` (list of rewrites), `severity` (LOW/MEDIUM/HIGH), and `context_note`.

### 5.4 Artifact B Guard (`artifact_b_guard.py`)
A pure Python function evaluating 4 conditions. The first failure determines the denial reason.
1. `engagement_state` ∈ `{"CONNECTED", "ACTIVE"}`
2. `bid_state` ∈ `{"TECH_APPROVED", "CEO_REVIEW", "SELECTED"}`
3. `expert_nda_accepted` is True
4. `ceo_nda_accepted` is True

### 5.5 Service Generator (`service_generator.py`)
- Receives expert's claimed domains/seams and DB price guidance.
- Injects these into the prompt so the AI references actual competencies.
- Clamps `suggested_price_vnd` to `[0, 2,000,000,000]`. If LLM returns a string or unparseable number, defaults to `0`.

---

## 6. Data Models (Pydantic Schemas)

All schemas are defined in `app/models/requests.py` and `app/models/responses.py`.

### Key Request Models

**`Stage5Request`**
```python
class Stage5Request(BaseModel):
    session_id: str
    stage1_symptoms: list[str]
    stage2_archetype: str
    stage3_probes: dict
    stage4_tech_inputs: dict
    void_list_json: list[dict]
    is_self_technical: bool = False
    estimated_budget_vnd: int | None = None
    critical_artifacts_required: list[dict] = []
    domains: list[dict] = []      # Live from DB
    seams: list[dict] = []        # Live from DB
    archetypes: list[dict] = []   # Live from DB
```

**`PortfolioEvalRequest`**
```python
class PortfolioEvalRequest(BaseModel):
    project_description: str
    decision_points: str
    seam_code: str
    seam_name: str | None = None
    seam_description: str | None = None
    all_seam_definitions: list[dict] = []
```

**`DisputeEvalRequest`**
```python
class DisputeEvalRequest(BaseModel):
    criterion_text: str
    deliverable_description: str
    files: list[str] = []
    project_archetype: str | None = None
    milestone_context: str | None = None
    prior_revision_count: int = 0
```

### Key Response Models

**`Stage5Response`**
```python
class Stage5Response(BaseModel):
    required_seams_json: list[dict]
    required_domains_json: list[dict]
    milestone_framework_json: list[dict]
    artifact_a_json: dict
    artifact_b_json: dict
    completeness_score: float
    estimated_total_cost_vnd: int | None = None
    estimated_total_duration_days: int | None = None
```

**`MatchResult`**
```python
class MatchResult(BaseModel):
    expert_id: str
    composite_score: float
    strength_label: str   # STRONG_MATCH, GOOD_MATCH, POSSIBLE_MATCH, WEAK_MATCH
    gap_map: list[GapMapItem]
```

---

## 7. Testing & Simulations Framework

The `ai-service` includes a robust testing framework separated into two categories:

### 7.1 Pytest Unit Tests (`tests/`)
- **Mocks:** Uses `unittest.mock.AsyncMock` to patch `call_llm_json_with_system`. No real API keys required for standard CI.
- **Fixtures:** `client` uses `httpx.ASGITransport` to call the FastAPI app in-process (no TCP sockets, uvicorn stays silent).
- **Windows Fix:** Enforces `WindowsSelectorEventLoopPolicy` at import time to prevent TLS cleanup crashes on Windows.
- **Integration Tests (`test_integration.py`):** Skipped automatically if `ANTHROPIC_API_KEY` is missing or starts with `test`. These hit the real LLM and validate schema shapes and code-enforced rules (e.g., payment_amount_vnd == 0).

### 7.2 HTTP Simulations (`simulations/`)
A custom scenario-based grader framework that hits a **real running uvicorn server** (localhost:8000).
- **Architecture:** `runner.py` loads scenarios from `scenarios/s01_...py` through `s07_...py`.
- **Grading Tiers:**
  - `SHAPE`: Structural validation (HTTP 200, field types, enum values). Blocks if failed.
  - `RULE`: Business rules enforced in code (e.g., `passed_boolean == (score >= 0.85)`). Blocks if failed.
  - `QUALITY`: Heuristic checks on LLM output (e.g., "title contains keyword", "suggestions contain digits"). Non-blocking.
- **Idempotency Testing:** `s04_dispute_eval.py` includes a special check that makes a synchronous second HTTP call inside a check function to verify temperature=0.0 produces identical results.