# AITasker AI-Service — Technical Architecture & Reference Guide
### FastAPI Microservice · Python 3.11 · Async OpenAI SDK · Jinja2 Prompt Templates

> **Purpose:** Canonical technical documentation for the `ai-service` microservice. This document details the microservice architecture, multi-provider LLM client integration, dynamic DB-backed prompt rendering with 60-second TTL caching, pure-Python expert matching engine mathematics, security access guards, and all 12 API endpoint specifications.

---

## 1. Architecture Overview

The `ai-service` is an internal Python microservice built with **FastAPI**, **Pydantic v2**, and **AsyncOpenAI**. It is isolated behind backend network boundaries and invoked **exclusively by the NestJS core backend** via internal service tokens (`X-Internal-Token`). Frontends never interact directly with this microservice.

```
┌─────────────────────────┐          ┌─────────────────────────────────────────────────────────┐
│                         │          │  FastAPI AI Service (`ai-service`)                      │
│                         │  HTTP    │                                                         │
│  NestJS Backend Core    ├─────────►│  1. Guard Verification (X-Internal-Token / Artifact B)  │
│  (Port 3001)            │ (S2S)    │  2. Prompt Fetching & Jinja2 Template Rendering         │
│                         │          │  3. Pure-Python Arithmetic Matching (No LLM)            │
│                         │◄─────────┤  4. Async LLM Invocations (OpenAI SDK / Gemini / etc.)  │
└────────────┬────────────┘          └────────────────────────────┬────────────────────────────┘
             │                                                    │
             │ GET /internal/prompts/:stage                       │ Chat Completions API
             ▼                                                    ▼
┌─────────────────────────┐                            ┌─────────────────────┐
│ PostgreSQL (Neon)       │                            │ LLM Provider        │
│ (`prompt_templates`,    │                            │ (Gemini / DeepSeek /│
│  CMS definitions)       │                            │  OpenAI Endpoint)   │
└─────────────────────────┘                            └─────────────────────┘
```

---

## 2. Directory Structure

```text
ai-service/
├── Dockerfile                  # Python 3.11-slim container definition
├── pytest.ini                  # Asyncio session-scoped test suite configuration
├── requirements.txt            # Microservice dependencies
├── .env.example                # Runtime environment template
└── app/
    ├── __init__.py
    ├── config.py               # Pydantic BaseSettings environment configuration
    ├── dependencies.py         # X-Internal-Token header verification guard
    ├── main.py                 # FastAPI application initialization & router mounting
    ├── database/
    │   ├── __init__.py
    │   └── db.py               # Database utilities (reserved for direct queries)
    ├── guards/
    │   ├── __init__.py
    │   └── artifact_b_guard.py # Pure-Python 4-condition security gate for Artifact B
    ├── models/
    │   ├── __init__.py
    │   ├── requests.py         # Pydantic v2 request DTO schemas
    │   └── responses.py        # Pydantic v2 response DTO schemas
    ├── prompts/                # Fallback Jinja2 prompt template text files
    │   ├── criterion_check.txt
    │   ├── dispute_eval.txt
    │   ├── milestone_chat.txt
    │   ├── portfolio_eval.txt
    │   ├── service_generate.txt
    │   ├── stage1_extract.txt
    │   ├── stage3_vagueness_check.txt
    │   ├── stage4_recommend.txt
    │   └── stage5_synthesize.txt
    ├── routers/                # FastAPI endpoint handlers
    │   ├── __init__.py
    │   ├── artifact_b.py       # Artifact B access evaluation router
    │   ├── criteria.py         # Criterion quality gate router
    │   ├── disputes.py         # Layer 1 dispute evaluation router
    │   ├── elicitation.py      # Elicitation engine (Stages 1, 3, 4, 5 + Chat) router
    │   ├── matching.py         # Expert matching engine router
    │   ├── portfolio.py        # Portfolio evidence verification router
    │   └── service_gen.py      # Marketplace service generator router
    └── services/
        ├── __init__.py
        ├── dispute_evaluator.py # Dispute arbitration logic & safety rules
        ├── elicitation_engine.py# 5-stage requirement discovery & synthesis
        ├── llm_client.py        # AsyncOpenAI client wrapper & JSON completion helpers
        ├── matching_engine.py   # Pure-Python candidate scoring & hard gate logic
        ├── portfolio_evaluator.py# Seam capability evaluation service
        ├── prompt_loader.py    # Local disk prompt file loader with lru_cache
        ├── prompt_service.py   # Dual-layer DB + Disk prompt loader with 60s cache
        └── service_generator.py# Marketplace service listing generation & parsing
```

---

## 3. Environment Configuration & Settings

Managed via `pydantic-settings` in `app/config.py`.

| Environment Variable | Type | Default Value | Description |
|---|:---:|---|---|
| `LLM_API_KEY` | `str` | `""` | Primary API key for the LLM gateway. |
| `ANTHROPIC_API_KEY` | `str` | `""` | Fallback key property selector (`active_api_key`). |
| `LLM_BASE_URL` | `str` | `https://generativelanguage.googleapis.com/v1beta/openai/` | OpenAI-compatible base endpoint URL. |
| `LLM_MODEL` | `str` | `gemini-2.5-flash` | Targeted LLM model identifier. |
| `LLM_TEMPERATURE` | `float` | `0.1` | Temperature setting (low default for structured JSON). |
| `LLM_MAX_OUTPUT_TOKENS` | `int` | `8192` | Maximum output token ceiling per completion call. |
| `PORTFOLIO_EVAL_THRESHOLD` | `float` | `0.85` | Required confidence score for Tier 2 seam verification. |
| `DISPUTE_EVAL_THRESHOLD` | `float` | `0.80` | Confidence threshold for dispute auto-resolution. |
| `PORT` | `int` | `8000` | HTTP service listening port. |
| `ENV` | `str` | `development` | Deployment environment name. |
| `NESTJS_BASE_URL` | `str` | `http://localhost:3001` | Core backend base URL for DB prompt template retrieval. |
| `INTERNAL_SERVICE_TOKEN` | `str` | `aitasker-internal-dev-secret-change-in-prod` | Shared secret for internal S2S request headers. |
| `PROMPT_CACHE_TTL_SEC` | `int` | `60` | In-memory prompt template cache TTL in seconds. |

### Derived Settings Properties
- **`active_api_key`**: Returns `LLM_API_KEY` if configured, otherwise falls back to `ANTHROPIC_API_KEY`.
- **`is_test_mode`**: Returns `true` if `active_api_key` is empty or starts with `"test"`. Automatically bypasses integration calls during unit tests.

---

## 4. LLM Client Architecture (`llm_client.py`)

The microservice encapsulates all model interactions through an `AsyncOpenAI` client instance pointing at `settings.llm_base_url`. This design decouples application logic from vendor-specific SDKs and allows switching between Gemini, DeepSeek, or native OpenAI endpoints via environment configuration alone.

### Client Completion Wrappers

```python
async def call_llm_json_with_system(
    prompt: str,
    system: str,
    temperature: float | None = None,
    max_output_tokens: int | None = None,
) -> dict[str, Any]:
    """
    Sends a system and user prompt with response_format={"type": "json_object"}.
    Parses and returns the resulting JSON string as a native Python dictionary.
    """
```

```python
async def call_llm_with_system_and_messages(
    system: str,
    messages: list[dict],
    max_output_tokens: int = 1024,
    json_mode: bool = False,
) -> str:
    """
    Executes multi-turn conversational completions. Prepends the system prompt
    to the conversation history list and returns the raw response string.
    """
```

---

## 5. Dynamic Prompt Template Service (`prompt_service.py`)

Prompts are rendered dynamically using **Jinja2** and support hot-reloading from the database without container redeployments.

### Dual-Layer Prompt Resolution Order
1. **In-Memory Cache Check**: Inspects local `_cache[stage]`. Returns cached template text if age `< PROMPT_CACHE_TTL_SEC` (60s).
2. **NestJS Internal API Fetch**: On cache miss or stale entry, issues an HTTP `GET` request to `{NESTJS_BASE_URL}/internal/prompts/{stage}` presenting header `x-internal-token: {INTERNAL_SERVICE_TOKEN}`.
3. **Database Override**: If NestJS returns `200 OK`, extracts `templateText` from the response and updates the in-memory cache.
4. **On-Disk File Fallback**: If NestJS returns `404 Not Found` or network connection fails, reads the default template file from `app/prompts/{stage}.txt` via `prompt_loader.py` (`@lru_cache`).
5. **Jinja2 Context Rendering**: Renders the loaded template string with runtime variables (`domains`, `seams`, `archetypes`, `void_codes`, `price_guidance`). Registers custom filters such as `format_number` for VND currency formatting.

```
NestJS CMS Edit (PUT /admin/prompts/:stage)
  │
  ▼
PostgreSQL `prompt_templates`
  │
  ▼ (HTTP GET /internal/prompts/:stage with X-Internal-Token)
FastAPI `prompt_service.py` (60s TTL Cache Miss/Refresh)
  │
  ▼ (Fallback if DB empty/unreachable)
On-disk File `app/prompts/{stage}.txt`
  │
  ▼
Jinja2 Render with Live Context → LLM Call
```

---

## 6. Security Gates & Access Guards

### 6.1 Internal Token Guard (`dependencies.py`)
Protects sensitive microservice endpoints from external calls. Checks incoming request header `X-Internal-Token` against `settings.internal_service_token`. Throws `HTTP 403 Forbidden` if secret verification fails.

### 6.2 Artifact B Security Guard (`guards/artifact_b_guard.py`)
Artifact B contains sensitive technical implementation context (schemas, architecture details, database contracts). Access is granted if and only if **all 4 conditions** are simultaneously satisfied:

```python
def check(
    engagement_state: str,
    bid_state: str,
    expert_nda_accepted: bool,
    ceo_nda_accepted: bool,
) -> GuardResult:
```

1. **Condition 1 (Engagement Lifecycle)**: `engagement_state` MUST be in `{'CONNECTED', 'ACTIVE'}`.
2. **Condition 2 (Bid Lifecycle)**: `bid_state` MUST be in `{'TECH_APPROVED', 'CEO_REVIEW', 'SELECTED'}`.
3. **Condition 3 (Expert NDA)**: `expert_nda_accepted` MUST be `True`.
4. **Condition 4 (Client CEO NDA)**: `ceo_nda_accepted` MUST be `True`.

*Evaluated sequentially — the first failing condition is returned as a specific denial reason.*

---

## 7. Endpoints & Routers Specifications (12 Endpoints)

### 7.1 Health Check
- **Endpoint**: `GET /health`
- **Router**: Mounted in `main.py`
- **LLM Invocations**: None
- **Response**: `{"status": "ok", "service": "aitasker-llm"}`

### 7.2 Artifact B Gate Check
- **Endpoint**: `GET /projects/{project_id}/artifact-b`
- **Router**: `routers/artifact_b.py`
- **LLM Invocations**: None
- **Query Parameters**: `engagement_state` (`str`), `bid_state` (`str`), `expert_nda_accepted` (`bool`), `ceo_nda_accepted` (`bool`)
- **Response**:
  - `200 OK`: `{"project_id": "uuid-string", "artifact_b_accessible": true}`
  - `403 Forbidden`: `{"detail": "<specific failing condition reason>"}`

### 7.3 Stage 1 — Symptom & Void Extraction
- **Endpoint**: `POST /llm/elicitation/stage1-extract`
- **Router**: `routers/elicitation.py`
- **LLM Invocations**: Yes (`stage1_extract` template)
- **Request (`Stage1Request`)**:
  ```json
  {
    "symptom_text": "We need an AI compliance classifier for our ad tech platform.",
    "archetypes": [{"code": "3", "name": "Classification", "description": "..."}],
    "void_codes": [{"code": "NO_GROUND_TRUTH", "description": "..."}]
  }
  ```
- **Response (`Stage1Response`)**:
  ```json
  {
    "symptoms": ["Ad compliance verification required"],
    "scale_signals": {
      "user_count": "100,000 daily ads",
      "data_volume": "2TB logs/month",
      "budget_vnd": 200000000
    },
    "voids": [{"void_code": "NO_GROUND_TRUTH", "severity": "HIGH"}],
    "recommended_archetypes": ["3", "1"],
    "critical_artifacts_required": [
      {
        "artifact_key": "compliance_ruleset",
        "label": "Compliance Ruleset",
        "reason": "Classifier criteria depend on explicit ad policy rules",
        "placeholder_prompt": "Please paste your compliance rule text here"
      }
    ]
  }
  ```

### 7.4 Stage 3 — Probe Answer Vagueness & Relevancy Check
- **Endpoint**: `POST /llm/elicitation/stage3-vagueness-check`
- **Router**: `routers/elicitation.py`
- **LLM Invocations**: Yes (`stage3_vagueness_check` template)
- **Behavior**: Evaluates CEO responses for vagueness AND irrelevancy to the project context. If `is_self_technical == false`, appends a forgiveness clause to the prompt to accommodate business language. Fails open on LLM error (returns empty arrays).
- **Request (`Stage3VaguenessCheckRequest`)**:
  ```json
  {
    "archetype": "3",
    "probe_questions": ["How many items per day?"],
    "probe_responses": {"How many items per day?": "A lot of items"},
    "is_self_technical": false,
    "stage1_symptoms": ["Ad compliance classification"],
    "stage1_voids": [{"void_code": "NO_GROUND_TRUTH", "severity": "HIGH"}]
  }
  ```
- **Response (`Stage3VaguenessCheckResponse`)**:
  ```json
  {
    "vague_answers": [{"question": "How many items per day?", "reason": "Specify estimated numeric item count per day."}],
    "irrelevant_answers": []
  }
  ```

### 7.5 Stage 4 — Technical Context Recommendation
- **Endpoint**: `POST /llm/elicitation/stage4-recommend`
- **Router**: `routers/elicitation.py`
- **LLM Invocations**: Yes (`stage4_recommend` template)
- **Request (`Stage4RecommendRequest`)**:
  ```json
  {
    "stage1_symptoms": ["Ad compliance classification"],
    "stage2_archetype": "3",
    "stage3_probes": {"How many items per day?": "50,000"},
    "void_list_json": [],
    "is_self_technical": false,
    "additional_requirement_1": "GDPR compliance",
    "estimated_budget_vnd": 200000000
  }
  ```
- **Response (`Stage4RecommendResponse`)**:
  ```json
  {
    "recommended_stack": "Python 3.11, FastAPI, PostgreSQL, PyTorch, Docker",
    "recommended_integration": "Async REST API webhooks with JWT authentication",
    "recommended_legacy_volume": "Standard database volume (~500GB)"
  }
  ```

### 7.6 Stage 5 — Project Specification Synthesis
- **Endpoint**: `POST /llm/elicitation/stage5-synthesize`
- **Router**: `routers/elicitation.py`
- **LLM Invocations**: Yes (`stage5_synthesize` template, 8192 token limit)
- **Behavior**: Synthesizes Artifact A, Artifact B, required seams/domains, and milestone framework.
  - **Artifact Grounding**: Injects submitted `technical_artifacts` into the prompt so milestones directly reference document contents.
  - **Missing Artifacts**: If required critical artifacts are unsubmitted, caps `completeness_score <= 0.60` and appends SDLC notices.
  - **Enum Validation**: Filters invalid authority, criticality, or depth enum strings. Forces `payment_amount_vnd = 0` across all milestone framework objects.
- **Request (`Stage5Request`)**:
  ```json
  {
    "session_id": "uuid-string",
    "stage1_symptoms": ["Ad compliance classification"],
    "stage2_archetype": "3",
    "stage3_probes": {"Item count": "50,000/day"},
    "stage4_tech_inputs": {
      "current_stack": "FastAPI, PostgreSQL",
      "technical_artifacts": {"compliance_ruleset": "Rule 1: No misleading health claims..."}
    },
    "void_list_json": [],
    "is_self_technical": false,
    "estimated_budget_vnd": 200000000,
    "critical_artifacts_required": [{"artifact_key": "compliance_ruleset"}],
    "domains": [{"code": "A", "name": "LLM App Engineering"}],
    "seams": [{"code": "A↔C", "name": "LLM output quality"}],
    "archetypes": [{"code": "3", "name": "Classification"}]
  }
  ```
- **Response (`Stage5Response`)**:
  ```json
  {
    "required_seams_json": [{"seam_code": "A↔C", "criticality": "load_bearing"}],
    "required_domains_json": [{"domain_code": "A", "required_depth": "DEEP"}],
    "milestone_framework_json": [
      {
        "milestone_number": 1,
        "deliverable_statement": "Implement compliance rule parser validating ad copy against ruleset Rule 1.",
        "sign_off_authority": "JOINT",
        "payment_amount_vnd": 0,
        "estimated_cost_vnd": 50000000,
        "estimated_duration_days": 10
      }
    ],
    "artifact_a_json": {
      "project_name": "Ad Compliance Classifier",
      "business_intent": "Automate ad text verification against internal compliance rulesets.",
      "archetype": "3",
      "stack_tags": ["FastAPI", "PyTorch"],
      "volume_tier": "TIER_2",
      "sdlc_notices": ["Rule parser requires integration testing against production ad logs."]
    },
    "artifact_b_json": {
      "stack_tags": ["Python 3.11", "FastAPI", "PostgreSQL"],
      "integration_method": "Async REST API",
      "legacy_volume": "50,000 ads/day",
      "schemas": [],
      "contracts": []
    },
    "completeness_score": 0.88,
    "flagged_void": null,
    "estimated_total_cost_vnd": 50000000,
    "estimated_total_duration_days": 10
  }
  ```

### 7.7 Milestone Chat Assistant
- **Endpoint**: `POST /llm/elicitation/milestone-chat`
- **Router**: `routers/elicitation.py`
- **LLM Invocations**: Yes (`milestone_chat` template, multi-turn chat)
- **Behavior**: Context-aware milestone planning assistant. Injects `{artifact_a}`, `{milestone_framework}`, `{budget_context}`, and `{terms_locked}` into system prompt. If `terms_locked == true`, enforces contract immutability directives and sets `suggested_edit: null`.
- **Request (`MilestoneChatRequest`)**:
  ```json
  {
    "artifact_a": {"project_name": "Ad Compliance Classifier"},
    "milestone_framework": [{"milestone_number": 1, "payment_amount_vnd": 50000000}],
    "budget_context": "Estimated total: 50,000,000 VND",
    "terms_locked": false,
    "conversation_history": [{"role": "user", "content": "Can we reduce milestone 1 price?"}],
    "user_message": "Reduce milestone 1 to 40M VND."
  }
  ```
- **Response (`MilestoneChatResponse`)**:
  ```json
  {
    "reply": "I have adjusted milestone 1 payment amount to 40,000,000 VND.",
    "suggested_edit": {
      "milestone_number": 1,
      "field": "payment_amount_vnd",
      "suggested_value": 40000000,
      "reason": "User requested cost reduction for initial milestone"
    }
  }
  ```

### 7.8 Seam Portfolio Evidence Evaluation
- **Endpoint**: `POST /llm/portfolio-eval`
- **Router**: `routers/portfolio.py`
- **LLM Invocations**: Yes (`portfolio_eval` template)
- **Behavior**: Evaluates expert portfolio submission across 4 signals: (1) seam decision points, (2) trade-off reasoning, (3) failure mode awareness, (4) measurable outcomes. Pass threshold is `confidence_score >= 0.85`.
- **Request (`PortfolioEvalRequest`)**:
  ```json
  {
    "project_description": "Built a high-throughput RAG search pipeline over 1M documents.",
    "decision_points": "Chose hybrid BM25 + dense vector reranking at seam A↔D to handle rare keywords.",
    "seam_code": "A↔D",
    "seam_name": "Retrieval-generation",
    "seam_description": "Integration boundary between vector retrieval and prompt context formatting.",
    "all_seam_definitions": [{"code": "A↔D", "name": "Retrieval-generation"}]
  }
  ```
- **Response (`PortfolioEvalResponse`)**:
  ```json
  {
    "confidence_score": 0.89,
    "passed_boolean": true,
    "gap_advisory": null
  }
  ```

### 7.9 Pure-Python Expert Matching Engine
- **Endpoint**: `POST /llm/matching`
- **Router**: `routers/matching.py`
- **LLM Invocations**: None (Pure-Python arithmetic)
- **Request (`MatchingRequest`)**:
  ```json
  {
    "required_seams_json": [{"seam_code": "A↔D", "criticality": "load_bearing"}],
    "required_domains_json": [{"domain_code": "A", "required_depth": "DEEP"}],
    "expert_profiles": [
      {
        "expert_id": "uuid-1",
        "seam_claims": [{"seam_code": "A↔D", "verification_tier": "EVIDENCE_BACKED"}],
        "domain_depths": [{"domain_code": "A", "depth_level": "DEEP"}],
        "portfolio_score": 0.90,
        "archetype_history": ["1"]
      }
    ],
    "project_archetype": "1"
  }
  ```
- **Response (`list[MatchResult]`)**:
  ```json
  [
    {
      "expert_id": "uuid-1",
      "composite_score": 0.875,
      "strength_label": "STRONG_MATCH",
      "gap_map": [{"seam_code": "A↔D", "color": "green"}]
    }
  ]
  ```

### 7.10 Dispute Layer 1 Arbitration
- **Endpoint**: `POST /llm/dispute-eval`
- **Router**: `routers/disputes.py`
- **LLM Invocations**: Yes (`dispute_eval` template, temperature = 0.0)
- **Safety Rules**: Unmeasurable subjective criteria capped at `confidence_score <= 0.60`. Gibberish or profanity inputs capped at `confidence_score <= 0.40` (forces manual admin escalation).
- **Request (`DisputeEvalRequest`)**:
  ```json
  {
    "criterion_text": "System processes 50,000 ad records with 0 unhandled exceptions.",
    "deliverable_description": "Completed batch pipeline; verified against 50,000 test logs.",
    "files": ["https://storage.example.com/test-report.pdf"],
    "project_archetype": "3",
    "milestone_context": "Phase 1 batch pipeline delivery",
    "prior_revision_count": 1
  }
  ```
- **Response (`DisputeEvalResponse`)**:
  ```json
  {
    "confidence_score": 0.88,
    "finding": "expert_wins",
    "reasoning": "Deliverable description confirms execution against specified test volume."
  }
  ```

### 7.11 Criterion Quality Gate Check
- **Endpoint**: `POST /llm/criterion-check`
- **Router**: `routers/criteria.py`
- **LLM Invocations**: Yes (`criterion_check` template, temperature = 0.0)
- **Request (`CriterionCheckRequest`)**:
  ```json
  {
    "criterion_text": "The UI must look intuitive and feel high quality.",
    "project_archetype": "1",
    "archetype_name": "RAG/Search",
    "milestone_context": "Frontend search interface"
  }
  ```
- **Response (`CriterionCheckResponse`)**:
  ```json
  {
    "is_subjective": true,
    "suggestions": [
      "Search page loads within 500ms at P95 latency",
      "Passes accessibility audit with 0 WCAG AA violations"
    ],
    "severity": "HIGH",
    "context_note": "Subjective terms 'intuitive' and 'high quality' are unmeasurable in dispute arbitration."
  }
  ```

### 7.12 AI Service Listing Generator
- **Endpoint**: `POST /llm/service-generate`
- **Router**: `routers/service_gen.py`
- **LLM Invocations**: Yes (`service_generate` template)
- **Behavior**: Generates marketplace service draft. Injects DB-driven price guidance and expert claimed competencies into Jinja2 prompt. Sanitizes `scope` into a clean array and `timeline` into newline-separated phase strings. Clamps price to `[0, 2,000,000,000]` VND.
- **Request (`ServiceGenerateRequest`)**:
  ```json
  {
    "expert_capabilities": ["RAG pipeline optimization", "pgvector indexing"],
    "target_use_cases": ["Enterprise document search"],
    "claimed_domains": [{"code": "A", "name": "LLM App Engineering", "depth": "DEEP"}],
    "claimed_seams": [{"code": "A↔D", "name": "Retrieval-generation"}],
    "price_guidance": {"small_min": 5000000, "medium_min": 15000000, "large_min": 50000000},
    "is_pro_expert": true
  }
  ```
- **Response (`ServiceGenerateResponse`)**:
  ```json
  {
    "title": "Enterprise RAG Pipeline & Vector Indexing Setup",
    "description": "End-to-end vector database setup, chunking optimization, and prompt retrieval integration.",
    "scope": [
      "Set up pgvector index with HNSW tuning",
      "Implement hybrid BM25 + dense retrieval pipeline",
      "EXCLUDED: Frontend web development"
    ],
    "timeline": "Phase 1: Architecture & Index Setup (1 week)\nPhase 2: Retrieval Pipeline Integration (2 weeks)\nTotal Estimated Time: 3 weeks",
    "suggested_price_vnd": 35000000,
    "suggested_domains": ["A", "D"],
    "suggested_seams": ["A↔D"],
    "pricing_rationale": "Medium complexity vector indexing and RAG pipeline integration."
  }
}
```

---

## 8. Pure-Python Matching Engine Mathematics (`matching_engine.py`)

Matching candidates against a project footprint is computed using pure Python arithmetic without external LLM calls, ensuring sub-10ms response times.

### 8.1 Hard Gate Rule (Claimed-to-Verified Ratio)
Prior to composite scoring, any expert whose ratio of `CLAIMED` to `EVIDENCE_BACKED` claims among project-relevant seams exceeds **4.0 (4:1)** is **excluded outright** if `evidence_backed_count > 0`:

```python
ratio = claimed_count / evidence_backed_count
if ratio > 4.0:
    # Exclude expert from shortlist
```

### 8.2 Composite Score Weight Distribution

$$\text{Composite Score} = 0.40(S) + 0.25(D) + 0.20(P) + 0.10(A) + 0.05(E)$$

#### 1. Seam Alignment Score ($S$ — 40% Weight)
Calculated as a criticality-weighted sum across required project seams:

$$S = \frac{\sum (\text{Criticality Weight} \times \text{Tier Multiplier})}{\sum \text{Criticality Weight}}$$

- **Criticality Weights**:
  - `load_bearing` = `3.0`
  - `significant` = `2.0`
  - `contributing` = `1.0`
- **Verification Tier Multipliers**:
  - `EVIDENCE_BACKED` = `1.0` (green in gap map)
  - `CLAIMED` = `0.5` (amber in gap map)
  - Missing claim = `0.0` (red in gap map)

#### 2. Domain Depth Match Score ($D$ — 25% Weight)
Evaluates expert depth against required domain depth across required project domains:
- Depth Levels: `SURFACE` = 1, `OPERATIONAL` = 2, `DEEP` = 3.
- If expert depth ≥ required depth $\rightarrow$ **`1.0`**
- If expert depth == required depth - 1 $\rightarrow$ **`0.5`**
- Otherwise $\rightarrow$ **`0.0`**

$$D = \frac{\sum \text{Domain Score}}{\text{Count of Required Domains}}$$

#### 3. Portfolio Quality Score ($P$ — 20% Weight)
Average `llm_confidence` score from expert's evaluated portfolio submissions. Defaults to **`0.5`** if no submissions exist.

#### 4. Archetype History Score ($A$ — 10% Weight)
- **`1.0`** if `project_archetype` exists in expert's `archetype_history_json`.
- **`0.0`** if missing.
- Defaults to **`0.5`** if `project_archetype` is null.

#### 5. Engagement Model Compatibility ($E$ — 5% Weight)
Always set to **`1.0`** (pre-filtered by NestJS query layer).

### 8.3 Qualitative Match Strength Labels
- **`STRONG_MATCH`**: Composite Score ≥ `0.85`
- **`GOOD_MATCH`**: Composite Score ≥ `0.70`
- **`POSSIBLE_MATCH`**: Composite Score ≥ `0.55`
- **`WEAK_MATCH`**: Composite Score < `0.55`

---

## 9. Pydantic v2 Data Models Reference

### `requests.py`
- `Stage1Request`
- `Stage3VaguenessCheckRequest`
- `Stage4RecommendRequest`
- `Stage5Request`
- `MilestoneChatRequest`
- `PortfolioEvalRequest`
- `MatchingRequest`
- `DisputeEvalRequest`
- `CriterionCheckRequest`
- `ServiceGenerateRequest`

### `responses.py`
- `VoidItem` (`void_code`, `severity`)
- `CriticalArtifact` (`artifact_key`, `label`, `reason`, `placeholder_prompt`)
- `Stage1Response`
- `VaguenessFlag` / `RelevancyFlag` / `Stage3VaguenessCheckResponse`
- `Stage4RecommendResponse`
- `Stage5Response`
- `MilestoneChatResponse`
- `PortfolioEvalResponse`
- `GapMapItem` / `MatchResult`
- `DisputeEvalResponse`
- `CriterionCheckResponse`
- `ServiceGenerateResponse`

---

## 10. Prompt Template Catalog & Jinja2 Contexts

All template text files reside in `app/prompts/` and are mirrored in the database `prompt_templates` table.

| Template File | Injection Context Variables | Key Output Schema Keys |
|---|---|---|
| `stage1_extract.txt` | `{{ archetypes }}`, `{{ void_codes }}` | `symptoms`, `scale_signals`, `voids`, `recommended_archetypes`, `critical_artifacts_required` |
| `stage3_vagueness_check.txt` | Context strings | `vague_answers`, `irrelevant_answers` |
| `stage4_recommend.txt` | Symptoms, archetype, probes | `recommended_stack`, `recommended_integration`, `recommended_legacy_volume` |
| `stage5_synthesize.txt` | `{{ domains }}`, `{{ seams }}`, `{{ archetypes }}` | `required_seams_json`, `required_domains_json`, `milestone_framework_json`, `artifact_a_json`, `artifact_b_json`, `completeness_score`, `flagged_void` |
| `milestone_chat.txt` | `{artifact_a}`, `{milestone_framework}`, `{budget_context}`, `{terms_locked}` | `reply`, `suggested_edit` |
| `portfolio_eval.txt` | `{{ seam_definitions }}`, `{{ evaluated_seam_code }}`, `{{ evaluated_seam_name }}`, `{{ evaluated_seam_desc }}` | `confidence_score`, `passed_boolean`, `gap_advisory` |
| `dispute_eval.txt` | Criterion, deliverable text, file URLs, revision count | `confidence_score`, `finding`, `reasoning` |
| `criterion_check.txt` | `{{ archetype_name }}` | `is_subjective`, `suggestions`, `severity`, `context_note` |
| `service_generate.txt` | `{{ price_guidance }}`, `{{ claimed_domains }}`, `{{ claimed_seams }}`, `{{ is_pro_expert }}` | `title`, `description`, `scope`, `timeline`, `suggested_price_vnd`, `suggested_domains`, `suggested_seams`, `pricing_rationale` |

---

## 11. Testing & Integration Strategy

### Pytest Configuration (`pytest.ini`)
- **Async Mode**: `asyncio_mode = auto`
- **Loop Scope**: `asyncio_default_fixture_loop_scope = session` (prevents closed event loop errors across httpx async clients).

### Test Suite Execution
```bash
# Run unit tests only (Fast, mock LLM, no API keys needed):
pytest -m "not integration" -v

# Run integration tests against real Gemini LLM API:
pytest -m integration -v
```

CI workflows execute unit tests exclusively (`ANTHROPIC_API_KEY = test-key-ci`), keeping builds fast, deterministic, and free of external API token costs. Integration tests are executed prior to release deployments.