# AITasker — ai-service Technical Documentation

> **Audience:** NestJS backend engineers integrating with ai-service  
> **Module owner:** Minh Hùng  
> **Last updated:** 2026-06-15

---

## 1. Overview

`ai-service` is a FastAPI microservice that provides all LLM-powered reasoning for the AITasker platform. It runs as a sidecar to the NestJS backend on Railway. NestJS calls it over the internal Railway network; it is **not** exposed to the public internet.

```
Browser → NestJS (port 3000) → ai-service (port 8000, internal)
```

The service has two types of endpoints:

| Type | Description | Examples |
|---|---|---|
| **LLM endpoints** | Call Gemini 2.5 Flash, return structured JSON | `/llm/*` |
| **Algorithm endpoints** | Pure arithmetic, no LLM | `/llm/matching`, `/projects/*/artifact-b` |

---

## 2. Environment Setup

### Required environment variable

```env
# ai-service/.env
ANTHROPIC_API_KEY=YOUR_GEMINI_API_KEY   # Key from aistudio.google.com
```

The variable name is `ANTHROPIC_API_KEY` for backward compatibility — it holds a **Gemini AI Studio key**, not an Anthropic key.

### Running locally

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux

pip install -r requirements.txt

# Dev server — watches only app/ so simulations/ don't trigger reloads
uvicorn app.main:app --reload --reload-dir app --port 8000
```

### Docker

```bash
cd aitasker
docker compose build ai-service
docker compose up -d ai-service
```

**Warning:** If you edit source files, the Docker container serves the OLD image until rebuilt. Always use local uvicorn during development.

---

## 3. Domain Reference Tables

These tables are the shared vocabulary between ai-service output and NestJS database schema. Use them for dropdown labels, validation, and display text in the CEO/Expert UIs.

### Domain codes (A–F)

| Code | Domain | Role on a project |
|---|---|---|
| `A` | LLM App Engineering | Building the LLM application layer, prompt engineering, output handling |
| `B` | MLOps / LLMOps | Deployment pipelines, model serving, CI/CD for AI |
| `C` | AI Eval & Quality | Evaluation frameworks, hallucination detection, quality metrics |
| `D` | Vector DB & Embeddings | Retrieval systems, embedding models, vector stores |
| `E` | Data & Pipeline Engineering | ETL, feature stores, data ingestion pipelines |
| `F` | ML Modeling & Fine-Tuning | Training, fine-tuning, LoRA/RLHF, custom model development |

### Seam codes (10 cross-domain boundaries)

A "seam" is a boundary between two domains where the expert must demonstrate cross-domain competency. These appear in `required_seams_json` (stage5) and expert `seam_claims` (matching).

| Code | Boundary | Description |
|---|---|---|
| `A↔C` | LLM output ↔ AI Eval | LLM output quality contract |
| `A↔D` | LLM App ↔ Vector DB | Retrieval-generation contract |
| `A↔B` | LLM App ↔ MLOps | Deployment-inference boundary |
| `A↔F` | LLM App ↔ ML Modeling | Fine-tuned model integration |
| `D↔E` | Vector DB ↔ Data Pipeline | Embedding pipeline contract |
| `D↔F` | Vector DB ↔ ML Modeling | Model-vector alignment |
| `C↔E` | AI Eval ↔ Data Pipeline | Ground-truth pipeline |
| `C↔F` | AI Eval ↔ ML Modeling | Eval-model feedback loop |
| `E↔F` | Data Pipeline ↔ ML Modeling | Training data pipeline |
| `B↔E` | MLOps ↔ Data Pipeline | Monitoring-pipeline boundary |

### Archetype codes (1–6)

Returned in `artifact_a_json.archetype` from stage5-synthesize. Use for display labels in CEO project dashboard and expert shortlist.

| Code | Archetype | Typical use case |
|---|---|---|
| `1` | RAG / Search | Chatbots, knowledge base Q&A, document retrieval |
| `2` | Recommendation | Product, content, or user recommendation engines |
| `3` | Classification | Fraud detection, sentiment analysis, categorisation |
| `4` | Generation | Content generation, code generation, creative AI |
| `5` | Prediction / Forecasting | Churn prediction, demand forecasting, time-series |
| `6` | Multimodal | Vision + language, audio + text, cross-modal AI |

### Volume tier thresholds

Returned in `artifact_a_json.volume_tier` from stage5-synthesize.

| Tier | Scale | Typical characteristics |
|---|---|---|
| `TIER_1` | < 10k users, simple data | Proof of concept, small team tools, low transaction rate |
| `TIER_2` | 10k – 100k users | Moderate complexity, standard SLA, typical commercial project |
| `TIER_3` | > 100k users | High complexity, strict SLA, enterprise-grade reliability required |

### Seam criticality weights (used by matching engine)

| Criticality | Weight multiplier | Meaning |
|---|---|---|
| `load_bearing` | 3.0 | Project cannot function without this seam |
| `significant` | 2.0 | Important but has workarounds |
| `contributing` | 1.0 | Useful but not essential |

### Expert seam verification tiers

| Tier | Gap map color | Score multiplier |
|---|---|---|
| `EVIDENCE_BACKED` | 🟢 green | 1.0 |
| `CLAIMED` | 🟡 amber | 0.5 |
| Not present | 🔴 red | 0.0 |

---

## 4. Endpoint Reference

All request/response bodies are JSON. Content-Type: `application/json`.

---

### `GET /health`

**NestJS caller:** Railway health check + `AppService.onModuleInit()` startup check  
**Purpose:** Confirms ai-service is alive and running.

**Response (200):**
```json
{ "status": "ok", "service": "aitasker-llm" }
```

No request body or parameters.

---

### `POST /llm/criterion-check`

**NestJS caller:** `MilestonesService.createAcceptanceCriterion()`  
**Purpose:** Flags subjective language in milestone acceptance criteria and suggests measurable rewrites.

**Request:**
```json
{
  "criterion_text": "The AI should respond quickly and produce good results"
}
```

**Response:**
```json
{
  "is_subjective": true,
  "suggestions": [
    "The recommendation API must return results within 200ms at p95.",
    "The model must achieve CTR >= 15% on recommended items."
  ]
}
```

| Field | Type | Notes |
|---|---|---|
| `is_subjective` | `boolean` | `true` if any qualifier is unmeasurable |
| `suggestions` | `string[]` | Empty array `[]` when `is_subjective=false` |

**NestJS action:** If `is_subjective=true`, write advisory to `platform_decisions` table and display inline in criterion editor. **Does not block saving.**

---

### `POST /llm/elicitation/stage1-extract`

**NestJS caller:** `ElicitationService.submitStage1(session_id, symptom_text)`  
**Purpose:** Extracts structured AI problem signals from the CEO's free-text Stage 1 description.

**Request:**
```json
{
  "symptom_text": "Our chatbot keeps giving wrong answers about our product catalogue. 50k users daily, no eval system in place."
}
```

**Response:**
```json
{
  "symptoms": [
    "Chatbot provides incorrect product information to customers.",
    "No system exists to measure chatbot answer accuracy."
  ],
  "scale_signals": {
    "user_count": "50,000 daily users",
    "data_volume": null,
    "transaction_rate": null,
    "latency_requirement": null
  },
  "voids": [
    { "void_code": "NO_GROUND_TRUTH", "severity": "HIGH" },
    { "void_code": "UNCLEAR_SUCCESS_METRIC", "severity": "MEDIUM" }
  ]
}
```

| Field | Type | Notes |
|---|---|---|
| `symptoms` | `string[]` | Distinct pain points, full sentences. May be empty for very sparse input. |
| `scale_signals` | `object` | **Always exactly 4 keys**, all nullable. Never add new keys. |
| `scale_signals.user_count` | `string \| null` | Free-text string as stated by CEO, e.g. `"50,000 monthly active users"` |
| `scale_signals.data_volume` | `string \| null` | Free-text, e.g. `"2TB purchase history"` |
| `scale_signals.transaction_rate` | `string \| null` | Free-text, e.g. `"500,000 transactions per day"` |
| `scale_signals.latency_requirement` | `string \| null` | Free-text, e.g. `"under 500ms"` |
| `voids` | `array` | May be empty. Each item has `void_code` and `severity`. |

**Void codes:** `NO_GROUND_TRUTH`, `NO_BASELINE`, `UNCLEAR_SUCCESS_METRIC`, `DATA_PRIVACY_CONSTRAINT`, `INTEGRATION_UNCLEAR`, `TIMELINE_UNREALISTIC`, `SCOPE_CREEP_RISK`  
**Void severities:** `HIGH`, `MEDIUM`, `LOW`

**NestJS action:** Persist all three fields to `elicitation_sessions`. Voids carry forward into Stage 5 and penalise `completeness_score`.

---

### `POST /llm/elicitation/stage5-synthesize`

**NestJS caller:** `ElicitationService.submitStage4()` — triggers synthesis after CEO completes all 4 stages  
**Purpose:** Single LLM call that synthesises all 4 elicitation stages into the full project specification.

**Request:**
```json
{
  "session_id": "uuid-here",
  "stage1_symptoms": [
    "Chatbot provides incorrect product information.",
    "No system to measure answer accuracy."
  ],
  "stage2_archetype": "1",
  "stage3_probes": {
    "What does success look like in 90 days?": "Chatbot correct for 90% of queries, escalation drops below 15%.",
    "Existing systems to integrate with?": "Zendesk REST API and PostgreSQL product catalogue updated daily."
  },
  "stage4_tech_inputs": {
    "current_stack": "Python FastAPI, PostgreSQL, AWS ECS",
    "data_available": "200k Zendesk conversation logs, 50k SKU catalogue",
    "latency_requirement": "Under 3 seconds end-to-end"
  },
  "void_list_json": [
    { "void_code": "NO_GROUND_TRUTH", "severity": "HIGH" },
    { "void_code": "UNCLEAR_SUCCESS_METRIC", "severity": "MEDIUM" }
  ]
}
```

**Response:**
```json
{
  "required_seams_json": [
    { "seam_code": "A↔D", "criticality": "load_bearing" },
    { "seam_code": "A↔C", "criticality": "significant" },
    { "seam_code": "D↔E", "criticality": "significant" }
  ],
  "required_domains_json": [
    { "domain_code": "A", "required_depth": "OPERATIONAL" },
    { "domain_code": "C", "required_depth": "DEEP" },
    { "domain_code": "D", "required_depth": "DEEP" }
  ],
  "milestone_framework_json": [
    {
      "milestone_number": 1,
      "deliverable_statement": "Functional RAG prototype with daily catalogue sync via PostgreSQL, accessible via API.",
      "sign_off_authority": "TECH_TEAM",
      "payment_amount_vnd": 0
    },
    {
      "milestone_number": 2,
      "deliverable_statement": "Production chatbot integrated with Zendesk achieving 90% accuracy and <15% escalation rate.",
      "sign_off_authority": "CEO",
      "payment_amount_vnd": 0
    }
  ],
  "artifact_a_json": {
    "business_intent": "Deploy accurate RAG chatbot to reduce agent escalation from 40% to under 15%.",
    "archetype": "1",
    "stack_tags": ["Python", "FastAPI", "PostgreSQL", "AWS ECS"],
    "volume_tier": "TIER_2",
    "sdlc_notices": [
      "Integration risk with Zendesk REST API.",
      "Daily catalogue sync cadence must match product update frequency."
    ]
  },
  "artifact_b_json": {
    "stack_tags": ["LangChain", "Pinecone", "OpenAI", "Zendesk REST API"],
    "integration_method": "REST API for Zendesk ticketing. Direct PostgreSQL connection for daily catalogue sync.",
    "legacy_volume": "200k Zendesk conversation logs (18 months). 50k SKU product catalogue.",
    "schemas": [],
    "contracts": []
  },
  "completeness_score": 0.95
}
```

**Response field reference:**

| Field | Type | Notes |
|---|---|---|
| `required_seams_json` | `array` | 2–5 seam objects typical. Each: `seam_code` + `criticality`. |
| `required_domains_json` | `array` | Domains the project requires. Each: `domain_code` + `required_depth`. |
| `milestone_framework_json` | `array` | Ordered milestones. Fields: `milestone_number`, `deliverable_statement`, `sign_off_authority`, `payment_amount_vnd`. |
| `artifact_a_json.business_intent` | `string` | 2–3 sentence plain-English summary for the expert shortlist display. |
| `artifact_a_json.archetype` | `string` | `"1"`–`"6"`. See archetype table in Section 3. |
| `artifact_a_json.stack_tags` | `string[]` | CEO-mentioned tech stack. |
| `artifact_a_json.volume_tier` | `string` | `TIER_1`, `TIER_2`, or `TIER_3`. See volume tier table. |
| `artifact_a_json.sdlc_notices` | `string[]` | Integration risks, compliance notes, data concerns. May be empty. |
| `artifact_b_json.integration_method` | `string` | How AI connects to existing systems. Always non-empty for complete sessions. |
| `artifact_b_json.legacy_volume` | `string` | Data volume description. Always non-empty for complete sessions. |
| `artifact_b_json.schemas` | `array` | **Always `[]`** unless CEO provided actual schema URLs during elicitation. |
| `artifact_b_json.contracts` | `array` | **Always `[]`** unless CEO provided API contract references. |
| `completeness_score` | `float` | `[0.0, 1.0]`. Threshold at 0.70 — see NestJS action below. |

**Business rules (code-enforced — never re-implement in NestJS):**

| Rule | Enforced by |
|---|---|
| `payment_amount_vnd` is always `0` on every milestone | `elicitation_engine.py` |
| All enum fields (`criticality`, `domain_code`, `required_depth`, `sign_off_authority`, `archetype`, `volume_tier`) validated before returning | `_validate_stage5_response()` |

**NestJS action:**
- `completeness_score >= 0.70` → `project.state = PUBLISHED` → triggers matching
- `completeness_score < 0.70` → `project.state = RETURNED_TO_CLIENT` → CEO prompted to add more detail

---

### `POST /llm/portfolio-eval`

**NestJS caller:** `PortfolioService.submitPortfolioEntry(expert_id, seam_code, ...)`  
**Purpose:** Evaluates whether an expert's portfolio submission demonstrates cross-domain competency at a specific seam boundary. Threshold is computed in code, not by the LLM.

**Request:**
```json
{
  "seam_code": "A↔D",
  "project_description": "Built RAG pipeline for 500-lawyer firm. 50k queries/month, p95 < 200ms.",
  "decision_points": "Chose text-embedding-3-large over BGE-large: nDCG@10=0.79 vs 0.83 but 40% lower latency. Added cross-encoder reranker: hallucination dropped from 22% to 4% on 50 annotated queries."
}
```

**Response:**
```json
{
  "confidence_score": 0.95,
  "passed_boolean": true,
  "gap_advisory": null
}
```

| Field | Type | Notes |
|---|---|---|
| `confidence_score` | `float` | `[0.0, 1.0]`. Raw LLM score before threshold. |
| `passed_boolean` | `boolean` | `true` if `confidence_score >= 0.85`. **Computed in code.** |
| `gap_advisory` | `string \| null` | `null` when passed. Non-null string with specific gap description when failed. |

**Business rules (code-enforced — BR-VER-03):**

| Rule | Description |
|---|---|
| `passed_boolean = (confidence_score >= 0.85)` | Threshold computed in `portfolio_evaluator.py`, not by LLM |
| `gap_advisory = null` when `passed_boolean = true` | Code-enforced |
| `gap_advisory = <string>` when `passed_boolean = false` | Code-enforced |

**NestJS action:**
- `passed_boolean = true` → `expert_seam_claims.verification_tier = EVIDENCE_BACKED`
- `passed_boolean = false` → increment `expert_seam_claims.failure_count`, check lockout threshold

---

### `POST /llm/dispute-eval`

**NestJS caller:** `DisputeService.fileDispute(engagement_id, milestone_id)`  
**Purpose:** Neutral arbitration of milestone disputes. Returns a finding and confidence score. The AUTO_RESOLVE vs MANUAL_REVIEW threshold lives in NestJS, not ai-service.

**Request:**
```json
{
  "criterion_text": "API p95 latency < 300ms under 500 RPS. HTTP 200. JSON array >= 5 items.",
  "deliverable_description": "k6 load test at 500 RPS: p95=187ms. All 1000 requests returned HTTP 200. Array sizes 6–12 items. No errors.",
  "files": ["https://storage.example.com/k6-report.html"]
}
```

**Important on `files`:** These are URL strings only. The ai-service **cannot fetch URLs**. The model evaluates solely from `criterion_text` and `deliverable_description`. Include URLs for record-keeping only — they do not affect the evaluation.

**Response:**
```json
{
  "confidence_score": 1.0,
  "finding": "expert_wins"
}
```

| Field | Type | Notes |
|---|---|---|
| `finding` | `string` | `"expert_wins"` or `"client_wins"` only. No other values possible. |
| `confidence_score` | `float` | `[0.0, 1.0]`. Raw confidence in the finding. |

**NestJS action (threshold lives in NestJS, not ai-service):**
- `confidence_score >= 0.80` → `dispute.state = AUTO_RESOLVED` (finding determines payment release)
- `confidence_score < 0.80` → `dispute.state = MANUAL_REVIEW` (added to admin queue)

**Prompt behaviour:**
- Temperature = `0.0` → deterministic, idempotent. Two identical calls return identical results.
- Conservative default: `client_wins` on ambiguity (protects client payment)
- Subjective criteria (e.g. "easy to use", "modern-looking") → `confidence_score <= 0.60` regardless of deliverable, always routes to MANUAL_REVIEW

---

### `POST /llm/service-generate`

**NestJS caller:** `ListingsService.generateServiceDraft(expert_id)`  
**Purpose:** Generates a marketplace listing draft from the expert's declared capabilities. Expert reviews and edits before publishing — nothing is auto-published.

**Request:**
```json
{
  "expert_capabilities": [
    "5 years building production RAG systems at Fortune 500 scale",
    "LangChain, LlamaIndex, Pinecone, RAGAS evaluation framework"
  ],
  "target_use_cases": [
    "Enterprise knowledge base Q&A",
    "Legal document analysis and contract review"
  ]
}
```

**Response:**
```json
{
  "title": "Enterprise RAG System Design & Optimization Consulting",
  "description": "Unlock hallucination-free information retrieval for your enterprise...",
  "scope": "Included:\n- Architecture design and implementation\n- Evaluation framework setup\nNot included:\n- Full-stack application development",
  "timeline": "Phase 1: Discovery (2-3 weeks)\nPhase 2: Implementation (4-6 weeks)\nPhase 3: Handover (1 week)",
  "suggested_price_vnd": 65000000
}
```

| Field | Type | Notes |
|---|---|---|
| `title` | `string` | Specific to the expert's capabilities. Never empty. |
| `description` | `string` | Marketing copy. Never empty. |
| `scope` | `string` | What is and is not included. Multi-line string. Never empty. |
| `timeline` | `string` | Phased timeline. Multi-line string. Never empty. |
| `suggested_price_vnd` | `integer` | Vietnamese Dong. `0` means scope too vague to quote. Clamped to `[0, 2,000,000,000]` in code. |

**Business rules (code-enforced):**
- `suggested_price_vnd` always clamped to `[0, 2_000_000_000]`
- `suggested_price_vnd = 0` when capabilities are too vague to scope

---

### `POST /llm/matching`

**NestJS caller:** `ProjectsService.publishProject(project_id)`  
**Purpose:** Scores and ranks all eligible experts against the published project's requirements. Pure arithmetic — no LLM call.

**Request:**
```json
{
  "project_archetype": "1",
  "required_seams_json": [
    { "seam_code": "A↔D", "criticality": "load_bearing" },
    { "seam_code": "D↔E", "criticality": "significant" }
  ],
  "required_domains_json": [
    { "domain_code": "A", "required_depth": "OPERATIONAL" },
    { "domain_code": "D", "required_depth": "DEEP" }
  ],
  "expert_profiles": [
    {
      "expert_id": "uuid",
      "seam_claims": [
        { "seam_code": "A↔D", "verification_tier": "EVIDENCE_BACKED" },
        { "seam_code": "D↔E", "verification_tier": "CLAIMED" }
      ],
      "domain_depths": [
        { "domain_code": "A", "depth_level": "DEEP" },
        { "domain_code": "D", "depth_level": "DEEP" }
      ],
      "portfolio_score": 0.92,
      "archetype_history": ["1", "4"]
    }
  ]
}
```

**Request field notes:**
- `project_archetype` — optional. If omitted, archetype dimension scores `0.5` (neutral) for all experts.
- `expert_profiles` — may be an empty array `[]`. Returns `[]` response, not an error.
- `verification_tier` in seam claims — `"EVIDENCE_BACKED"` or `"CLAIMED"`. Any other value treated as missing.
- `depth_level` in domain_depths — `"SURFACE"`, `"OPERATIONAL"`, or `"DEEP"`.

**Response:** Sorted array, descending by `composite_score`. Empty array `[]` if no experts provided.
```json
[
  {
    "expert_id": "uuid",
    "composite_score": 0.8643,
    "strength_label": "STRONG_MATCH",
    "gap_map": [
      { "seam_code": "A↔D", "color": "green" },
      { "seam_code": "D↔E", "color": "amber" }
    ]
  }
]
```

**`gap_map` always contains one entry per required seam** — including seams the expert doesn't cover (color: `"red"`).

**Composite score formula:**
```
composite = 0.40 × seam_score
          + 0.25 × domain_score
          + 0.20 × portfolio_score
          + 0.10 × archetype_score
          + 0.05 × engagement_score  (always 1.0 — NestJS pre-filters by engagement)

seam_score = Σ(tier_mult × criticality_mult for each seam) / Σ(criticality_mult for all seams)
  tier_mult:         EVIDENCE_BACKED=1.0, CLAIMED=0.5, missing=0.0
  criticality_mult:  load_bearing=3.0, significant=2.0, contributing=1.0

domain_score = average of per-domain scores
  expert_depth >= required_depth  → 1.0
  expert_depth == required_depth - 1 → 0.5
  else → 0.0

archetype_score = 1.0 if project_archetype in expert.archetype_history else 0.0
  (0.5 if project_archetype not specified in request)

portfolio_score = expert.portfolio_score (default 0.5 if null)
```

**Strength labels:**

| Score | Label |
|---|---|
| `>= 0.85` | `STRONG_MATCH` |
| `>= 0.70` | `GOOD_MATCH` |
| `>= 0.55` | `POSSIBLE_MATCH` |
| `< 0.55` | `WEAK_MATCH` |

---

### `GET /projects/{project_id}/artifact-b`

**NestJS caller:** `ProjectsService.getProject()` — called before returning `artifact_b_json` to a requesting expert  
**Purpose:** Access gate — checks whether the expert is entitled to see Artifact B. No LLM.

**Query parameters (all required):**

| Parameter | Required | Valid values that pass |
|---|---|---|
| `engagement_state` | ✓ | `ACTIVE`, `CONNECTED` |
| `bid_state` | ✓ | `TECH_APPROVED`, `CEO_REVIEW`, `SELECTED` |
| `expert_nda_accepted` | ✓ | `true` |
| `ceo_nda_accepted` | ✓ | `true` |

**All four conditions must be true simultaneously.** Any single failure returns 403.

**Response (200 — access granted):**
```json
{ "artifact_b_accessible": true, "project_id": "proj-uuid" }
```

**Response (403 — access denied):**
```json
{ "detail": "Engagement state PENDING does not grant Artifact B access" }
```

The `detail` message names the specific failing condition — useful for logging.

**NestJS action:**
- `200` → include `artifact_b_json` in the project response payload
- `403` → omit `artifact_b_json` entirely from the response (do not return null or empty)

---

## 5. Running the Test Suite

Unit + integration tests using pytest.

```bash
cd ai-service
source .venv/bin/activate   # or .venv\Scripts\activate on Windows

# Unit tests only — no API key needed, fast (~0.4s), always run in CI
pytest tests/ -m "not integration" -v --tb=short

# Integration tests — requires real ANTHROPIC_API_KEY in .env, ~90s
pytest tests/ -m integration -v -s

# All tests
pytest tests/ -v
```

**Test files:**

| File | What it tests |
|---|---|
| `tests/conftest.py` | Shared fixtures, Windows event loop fix, mock_llm fixture |
| `tests/test_elicitation.py` | stage1 extract + stage5 synthesize unit tests |
| `tests/test_criteria.py` | criterion-check unit tests |
| `tests/test_portfolio.py` | portfolio-eval unit tests + threshold business rule |
| `tests/test_disputes.py` | dispute-eval unit tests + idempotency |
| `tests/test_service_gen.py` | service-generate unit tests + price clamping |
| `tests/test_matching.py` | matching algorithm unit tests + weight formula |
| `tests/test_artifact_b_guard.py` | artifact-b access guard unit tests |
| `tests/test_integration.py` | Real Gemini API calls, ASGI transport, all 7 endpoints |

**CI behaviour:** Unit tests (`-m "not integration"`) run automatically on every PR. Integration tests **do not run in CI** — they are run manually before pushing using the simulation suite below.

---

## 6. Running the Simulation Suite

Simulations hit the **live running server** via real HTTP. Uvicorn console will show all request logs. Run the full suite before pushing to validate prompt quality and catch LLM regressions.

```bash
# Terminal 1 — keep server running
cd ai-service
uvicorn app.main:app --reload --reload-dir app --port 8000

# Terminal 2 — run simulations
cd ai-service

python simulations/runner.py criterion_check     # 5 scenarios
python simulations/runner.py stage1_extract      # 5 scenarios
python simulations/runner.py portfolio_eval      # 8 scenarios
python simulations/runner.py dispute_eval        # 6 scenarios
python simulations/runner.py service_generate    # 4 scenarios
python simulations/runner.py stage5_synthesize   # 4 scenarios (~2-3 min)
python simulations/runner.py matching            # 5 scenarios, no LLM, ~2s

python simulations/runner.py                     # run all 37 scenarios

python simulations/runner.py --no-color > report.txt   # save to file
python simulations/runner.py --url http://ai-service:8000  # Docker URL
```

**Scenario files:**

| File | Endpoint | Scenarios | LLM? |
|---|---|---|---|
| `simulations/scenarios/s01_criterion_check.py` | `/llm/criterion-check` | 5 | Yes |
| `simulations/scenarios/s02_stage1_extract.py` | `/llm/elicitation/stage1-extract` | 5 | Yes |
| `simulations/scenarios/s03_portfolio_eval.py` | `/llm/portfolio-eval` | 8 | Yes |
| `simulations/scenarios/s04_dispute_eval.py` | `/llm/dispute-eval` | 6 | Yes |
| `simulations/scenarios/s05_service_generate.py` | `/llm/service-generate` | 4 | Yes |
| `simulations/scenarios/s06_stage5_synthesize.py` | `/llm/elicitation/stage5-synthesize` | 4 | Yes |
| `simulations/scenarios/s07_matching.py` | `/llm/matching` | 5 | No |

**Check tiers:**

| Tier | Blocks verdict? | What it validates |
|---|---|---|
| `SHAPE` | Yes | Field presence, types, enum bounds, list structure |
| `RULE` | Yes | Business rules enforced in code (thresholds, nullability, sorting) |
| `QUALITY` | No (affects ★ grade only) | LLM output quality heuristics |

**Grading:** `PASS` = all SHAPE+RULE pass AND quality ≥ ★★☆ · `WARN` = SHAPE+RULE pass AND quality < ★★☆ · `FAIL` = any SHAPE or RULE check failed

JSON reports saved to `simulations/reports/` (git-ignored).

---

## 7. Architecture Notes for NestJS Integration

### Internal URLs

| Environment | URL |
|---|---|
| Railway (production) | `http://ai-service.railway.internal:8000` |
| Docker Compose (local dev) | `http://ai-service:8000` |
| Direct local (uvicorn) | `http://localhost:8000` |

### Error handling

| HTTP status | Meaning | NestJS action |
|---|---|---|
| `200` | Success | Read response body normally |
| `422` | Validation error — bad request shape | Log + surface generic error to user |
| `503` | LLM unavailable — invalid key or quota exceeded | Retry once after 2s, then surface error |
| `500` | Unexpected server error | Log + alert on-call |

### Timeout recommendations

| Endpoint | Recommended timeout |
|---|---|
| `/health`, `/llm/matching`, `/projects/*/artifact-b` | 5s |
| `/llm/criterion-check`, `/llm/portfolio-eval`, `/llm/dispute-eval`, `/llm/service-generate`, `/llm/elicitation/stage1-extract` | 30s |
| `/llm/elicitation/stage5-synthesize` | 90s |

### Business rules: what lives where

**Computed in ai-service — use as-is, never re-implement in NestJS:**

| Value | Endpoint | Rule |
|---|---|---|
| `passed_boolean` | portfolio-eval | `confidence_score >= 0.85` |
| `gap_advisory` nullability | portfolio-eval | null when passed, non-null when failed |
| `payment_amount_vnd = 0` | stage5-synthesize | Always zero on all milestones |
| `composite_score` | matching | Weighted formula, see Section 4 |
| `strength_label` | matching | Derived from composite_score thresholds |
| `gap_map` colors | matching | green/amber/red from verification tier |

**Threshold logic lives in NestJS — ai-service returns raw scores only:**

| Decision | Threshold | Where |
|---|---|---|
| Dispute AUTO_RESOLVE vs MANUAL_REVIEW | `confidence_score >= 0.80` | `DisputeService` |
| Project PUBLISHED vs RETURNED_TO_CLIENT | `completeness_score >= 0.70` | `ElicitationService` |