# AITasker AI-Service — Technical Reference & Architecture Guide

> **Purpose:** Definitive technical reference for the `ai-service` (FastAPI) microservice. This document covers all 12 endpoints, internal architecture, LLM client rules, dynamic prompt rendering, and pure-Python matching engine logic.
>
> **Tech Stack:** Python 3.11 · FastAPI · Pydantic v2 · OpenAI SDK (Async) · Jinja2.

---

## 1. Architecture Overview

The AI-Service is an internal microservice called **exclusively** by the NestJS backend. It never interacts with the FE directly. 

### 1.1 Directory Structure
```text
ai-service/
├── app/
│   ├── main.py              # FastAPI app init, CORS, router registration
│   ├── config.py            # Pydantic Settings (env vars)
│   ├── dependencies.py      # Internal token guard
│   ├── guards/
│   │   └── artifact_b_guard.py  # 4-condition business logic gate
│   ├── models/
│   │   ├── requests.py      # Pydantic request schemas
│   │   └── responses.py     # Pydantic response schemas
│   ├── prompts/             # Default .txt prompt templates (Jinja2)
│   ├── routers/             # API route handlers
│   │   ├── elicitation.py   # Stage 1, 3, 4, 5 + Milestone Chat
│   │   ├── portfolio.py     # Tier 2 upgrade eval
│   │   ├── matching.py      # Composite scoring engine
│   │   ├── disputes.py      # Dispute Layer 1 eval
│   │   ├── criteria.py      # Acceptance criteria quality gate
│   │   ├── service_gen.py   # Marketplace listing AI generator
│   │   └── artifact_b.py    # Artifact B access check
│   └── services/
│       ├── llm_client.py        # OpenAI Async wrapper
│       ├── prompt_service.py    # DB + .txt prompt loader with 60s cache
│       ├── elicitation_engine.py
│       ├── portfolio_evaluator.py
│       ├── matching_engine.py   # Pure Python arithmetic (no LLM)
│       ├── dispute_evaluator.py
│       └── service_generator.py
└── .env                     # Environment variables
```

### 1.2 Environment Variables (`config.py`)
Configured via `pydantic-settings`. Reads from `.env`.

| Variable | Default | Description |
|---|---|---|
| `LLM_API_KEY` | `""` | Primary API key for LLM provider. |
| `ANTHROPIC_API_KEY` | `""` | Fallback API key. |
| `LLM_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta/openai/` | OpenAI-compatible base URL (e.g., Gemini, DeepSeek). |
| `LLM_MODEL` | `gemini-2.5-flash` | Model identifier. |
| `LLM_TEMPERATURE` | `0.1` | Default temperature for non-deterministic calls. |
| `LLM_MAX_OUTPUT_TOKENS` | `8192` | Max tokens for LLM output. |
| `PORTFOLIO_EVAL_THRESHOLD` | `0.85` | Confidence required for Tier 2 upgrade. |
| `DISPUTE_EVAL_THRESHOLD` | `0.80` | Confidence required for auto-resolve (informational; NestJS applies the threshold). |
| `NESTJS_BASE_URL` | `http://localhost:3001` | NestJS URL for fetching DB prompt templates. |
| `INTERNAL_SERVICE_TOKEN` | `aitasker-internal-dev-secret-change-in-prod` | Shared secret for `/internal/prompts/:stage`. |
| `PROMPT_CACHE_TTL_SEC` | `60` | TTL for prompt template cache. |

### 1.3 LLM Client Rules (`llm_client.py`)
The service uses the `openai` Python SDK configured with a custom `base_url` to support various providers (Gemini, DeepSeek, OpenAI).
- **`call_llm_json_with_system(prompt, system, temp, max_tokens)`**: Sends a system and user message. Forces `response_format={"type": "json_object"}`. Returns a parsed `dict`.
- **`call_llm_text(prompt, temp)`**: Simple text completion.
- **`call_llm_with_system_and_messages(system, messages, max_tokens)`**: Multi-turn chat used by the Milestone Chat Assistant. Prepends the system message to the history list.

### 1.4 Dynamic Prompt System (`prompt_service.py`)
Prompts are NOT hardcoded. They are rendered dynamically using Jinja2.
1. **Fetch from DB**: Calls NestJS `GET /internal/prompts/:stage` with `x-internal-token`.
2. **Fallback**: If NestJS returns 404 or errors, falls back to local `.txt` file in `app/prompts/`.
3. **Cache**: Results are cached in-memory for 60 seconds (`PROMPT_CACHE_TTL_SEC`).
4. **Rendering**: `get_rendered_prompt(stage, context)` fetches the template string and renders it with Jinja2, passing context variables (e.g., `{{ archetypes }}`).

---

## 2. Endpoints Overview (12 Total)

| # | Method | Path | Description | LLM Call |
|---|---|---|---|---|
| 1 | GET | `/health` | Health check | No |
| 2 | GET | `/projects/{project_id}/artifact-b` | Artifact B 4-condition gate | No |
| 3 | POST | `/llm/criterion-check` | Check criterion subjectivity | Yes |
| 4 | POST | `/llm/dispute-eval` | Arbitrate dispute | Yes |
| 5 | POST | `/llm/elicitation/stage1-extract` | Extract symptoms | Yes |
| 6 | POST | `/llm/elicitation/stage3-vagueness-check` | Check probe vagueness | Yes |
| 7 | POST | `/llm/elicitation/stage4-recommend` | Recommend tech context | Yes |
| 8 | POST | `/llm/elicitation/stage5-synthesize` | Synthesize project spec | Yes |
| 9 | POST | `/llm/elicitation/milestone-chat` | Chat about milestones | Yes |
| 10 | POST | `/llm/matching` | Score experts | No (Pure Python) |
| 11 | POST | `/llm/portfolio-eval` | Evaluate portfolio evidence | Yes |
| 12 | POST | `/llm/service-generate` | Generate service listing | Yes |

---

## 3. Elicitation Engine Endpoints

### 3.1 `POST /llm/elicitation/stage1-extract`
Extracts structured symptoms, scale signals, voids, and recommended archetypes from CEO free-text.

**Request (`Stage1Request`):**
```json
{
  "symptom_text": "string",
  "archetypes": [{"code": "1", "name": "RAG/Search", "description": "..."}],
  "void_codes": [{"code": "NO_GROUND_TRUTH", "description": "..."}]
}
```

**Response (`Stage1Response`):**
```json
{
  "symptoms": ["string"],
  "scale_signals": {"user_count": "string|null", "data_volume": "string|null", "transaction_rate": "string|null", "latency_requirement": "string|null", "budget_vnd": "int|null"},
  "voids": [{"void_code": "string", "severity": "HIGH|MEDIUM|LOW"}],
  "recommended_archetypes": ["1", "3"],
  "critical_artifacts_required": [
    {
      "artifact_key": "compliance_ruleset",
      "label": "Compliance Ruleset",
      "reason": "string",
      "placeholder_prompt": "string"
    }
  ]
}
```
**Logic:**
- Jinja2 context: `{{ archetypes }}`, `{{ void_codes }}`.
- Validates `recommended_archetypes` against the provided `archetypes` list. Falls back to all archetypes if none returned.

### 3.2 `POST /llm/elicitation/stage3-vagueness-check`
Checks Stage 3 probe answers for both vagueness and relevancy.

**Request (`Stage3VaguenessCheckRequest`):**
```json
{
  "archetype": "1",
  "probe_questions": ["Question 1?", "Question 2?"],
  "probe_responses": {"Question 1?": "Answer 1", "Question 2?": "Answer 2"},
  "is_self_technical": false,
  "stage1_symptoms": ["symptom"],
  "stage1_voids": [{"void_code": "NO_GROUND_TRUTH", "severity": "HIGH"}]
}
```
**Response (`Stage3VaguenessCheckResponse`):**
```json
{
  "vague_answers": [{"question": "string", "reason": "string"}],
  "irrelevant_answers": [{"question": "string", "issue": "string"}]
}
```
**Logic:**
- If `is_self_technical == false`, appends a forgiveness clause to the system prompt to be lenient on non-technical CEOs.
- Fails open: if LLM call fails, returns empty arrays (does not block elicitation).

### 3.3 `POST /llm/elicitation/stage4-recommend`
Recommends tech stack and integration methods for non-technical CEOs.

**Request (`Stage4RecommendRequest`):**
```json
{
  "stage1_symptoms": ["string"],
  "stage2_archetype": "1",
  "stage3_probes": {"q": "a"},
  "void_list_json": [{"void_code": "NO_GROUND_TRUTH", "severity": "HIGH"}],
  "is_self_technical": false,
  "additional_requirement_1": "string|null",
  "estimated_budget_vnd": 1000000|null
}
```
**Response (`Stage4RecommendResponse`):**
```json
{
  "recommended_stack": "string",
  "recommended_integration": "string",
  "recommended_legacy_volume": "string"
}
```

### 3.4 `POST /llm/elicitation/stage5-synthesize`
Synthesizes the complete project spec from all 4 stages.

**Request (`Stage5Request`):**
```json
{
  "session_id": "uuid",
  "stage1_symptoms": ["string"],
  "stage2_archetype": "1",
  "stage3_probes": {"q": "a"},
  "stage4_tech_inputs": {
    "current_stack": "...",
    "technical_artifacts": {"compliance_ruleset": "Rule 1..."}
  },
  "void_list_json": [{"void_code": "...", "severity": "..."}],
  "is_self_technical": false,
  "estimated_budget_vnd": 1000000|null,
  "critical_artifacts_required": [{"artifact_key": "compliance_ruleset"}],
  "domains": [{"code": "A", "name": "LLM App"}],
  "seams": [{"code": "A↔C", "name": "LLM output"}],
  "archetypes": [{"code": "1", "name": "RAG"}]
}
```

**Response (`Stage5Response`):**
```json
{
  "required_seams_json": [{"seam_code": "A↔C", "criticality": "load_bearing"}],
  "required_domains_json": [{"domain_code": "A", "required_depth": "DEEP"}],
  "milestone_framework_json": [
    {
      "milestone_number": 1,
      "deliverable_statement": "string",
      "sign_off_authority": "JOINT",
      "payment_amount_vnd": 0,
      "estimated_cost_vnd": 50000000,
      "estimated_duration_days": 14
    }
  ],
  "artifact_a_json": {
    "project_name": "string",
    "business_intent": "string",
    "archetype": "1",
    "stack_tags": ["Python"],
    "volume_tier": "TIER_2",
    "sdlc_notices": ["string"]
  },
  "artifact_b_json": {
    "stack_tags": ["Python"],
    "integration_method": "string",
    "legacy_volume": "string",
    "schemas": [],
    "contracts": []
  },
  "completeness_score": 0.85,
  "estimated_total_cost_vnd": 50000000,
  "estimated_total_duration_days": 14
}
```
**Logic:**
- Jinja2 context: `{{ domains }}`, `{{ seams }}`, `{{ archetypes }}`.
- Enforces `payment_amount_vnd = 0` on all milestones (CEO sets actual prices later).
- If `is_self_technical == false`, appends a clause to use accessible business language.
- **Artifact Grounding:** If `technical_artifacts` are provided, the prompt instructs the LLM to use their actual content for milestone deliverables.
- **Missing Artifacts:** If `critical_artifacts_required` are not found in `technical_artifacts`, it caps `completeness_score` at 0.60 and adds `sdlc_notices`.
- Validates all enum values (`criticality`, `required_depth`, `sign_off_authority`, `volume_tier`) and drops invalid ones.

### 3.5 `POST /llm/elicitation/milestone-chat`
Context-aware milestone editing assistant.

**Request (`MilestoneChatRequest`):**
```json
{
  "artifact_a": {},
  "milestone_framework": [],
  "budget_context": "string",
  "conversation_history": [{"role": "user", "content": "hi"}],
  "user_message": "Why 3 milestones?"
}
```
**Response (`MilestoneChatResponse`):**
```json
{
  "reply": "string",
  "suggested_edit": {
    "milestone_number": 2,
    "field": "paymentAmountVnd",
    "suggested_value": 30000000,
    "reason": "string"
  }
}
```
**Logic:**
- Injects project context via string replacement (`{artifact_a}`, `{milestone_framework}`, `{budget_context}`) into the system prompt.
- Calls `call_llm_with_system_and_messages` with the conversation history.
- Parses ` ```edit_suggestion ... ``` ` JSON blocks from LLM output to extract `suggested_edit`.

---

## 4. Expert Profile & Matching Endpoints

### 4.1 `POST /llm/portfolio-eval`
Evaluates expert portfolio submission for seam-boundary competency.

**Request (`PortfolioEvalRequest`):**
```json
{
  "project_description": "string",
  "decision_points": "string",
  "seam_code": "A↔C",
  "seam_name": "LLM output quality",
  "seam_description": "string",
  "all_seam_definitions": [{"code": "A↔C", "name": "LLM output", "description": "..."}]
}
```
**Response (`PortfolioEvalResponse`):**
```json
{
  "confidence_score": 0.92,
  "passed_boolean": true,
  "gap_advisory": "string|null"
}
```
**Logic:**
- Jinja2 context: `{{ seam_definitions }}`, `{{ evaluated_seam_code }}`, `{{ evaluated_seam_name }}`, `{{ evaluated_seam_desc }}`.
- `passed_boolean` is computed in code: `confidence_score >= settings.portfolio_eval_threshold` (0.85).
- `gap_advisory` is `null` if passed, otherwise extracted from LLM response.

### 4.2 `POST /llm/matching`
Pure Python arithmetic scoring engine. **No LLM call.**

**Request (`MatchingRequest`):**
```json
{
  "required_seams_json": [{"seam_code": "A↔C", "criticality": "load_bearing"}],
  "required_domains_json": [{"domain_code": "A", "required_depth": "DEEP"}],
  "expert_profiles": [
    {
      "expert_id": "uuid",
      "seam_claims": [{"seam_code": "A↔C", "verification_tier": "EVIDENCE_BACKED"}],
      "domain_depths": [{"domain_code": "A", "depth_level": "DEEP"}],
      "portfolio_score": 0.9,
      "archetype_history": ["1"]
    }
  ],
  "project_archetype": "1"
}
```
**Response (`list[MatchResult]`):**
```json
[
  {
    "expert_id": "uuid",
    "composite_score": 0.85,
    "strength_label": "STRONG_MATCH",
    "gap_map": [{"seam_code": "A↔C", "color": "green"}]
  }
]
```

#### Matching Engine Rules (`matching_engine.py`)
1. **Hard Gate (4:1 Ratio):** Before scoring, if an expert has `> 4` CLAIMED seams for every 1 EVIDENCE_BACKED seam (among required seams), they are excluded entirely.
2. **Weights:**
   - 40% Seam Coverage
   - 25% Domain Depth
   - 20% Portfolio Quality (defaults to 0.5 if null)
   - 10% Archetype History
   - 5% Engagement Model (always 1.0)
3. **Seam Scoring:**
   - `EVIDENCE_BACKED` = 1.0 (Green)
   - `CLAIMED` = 0.5 (Amber)
   - Missing = 0.0 (Red)
   - Criticality weights: `load_bearing` (3.0), `significant` (2.0), `contributing` (1.0).
4. **Domain Scoring:**
   - Exact match = 1.0
   - One level below = 0.5
   - >1 level below / missing = 0.0
5. **Strength Labels:**
   - `>= 0.85` → `STRONG_MATCH`
   - `>= 0.70` → `GOOD_MATCH`
   - `>= 0.55` → `POSSIBLE_MATCH`
   - `< 0.55` → `WEAK_MATCH`

---

## 5. Marketplace & Project Endpoints

### 5.1 `POST /llm/service-generate`
Drafts a marketplace service listing based on expert capabilities.

**Request (`ServiceGenerateRequest`):**
```json
{
  "expert_capabilities": ["Python", "RAG"],
  "target_use_cases": ["Enterprise Search"],
  "claimed_domains": [{"code": "A", "name": "LLM App", "depth": "DEEP"}],
  "claimed_seams": [{"code": "A↔C", "name": "LLM output"}],
  "price_guidance": {"small_min": 5000000, "small_max": 15000000, "medium_min": 15000000, "medium_max": 50000000, "large_min": 50000000},
  "is_pro_expert": true
}
```
**Response (`ServiceGenerateResponse`):**
```json
{
  "title": "string",
  "description": "string",
  "scope": "string",
  "timeline": "string",
  "suggested_price_vnd": 45000000,
  "suggested_domains": ["A"],
  "suggested_seams": ["A↔C"],
  "pricing_rationale": "string"
}
```
**Logic:**
- Jinja2 context: `{{ price_guidance }}`, `{{ claimed_domains }}`, `{{ claimed_seams }}`, `{{ is_pro_expert }}`.
- Custom Jinja2 filter `format_number` is used to format VND prices.
- Clamps price to `[0, 2,000,000,000]`.

### 5.2 `GET /projects/{project_id}/artifact-b`
Gate check — can this expert access the technical specification (Artifact B)?

**Query Params:**
- `engagement_state` (string)
- `bid_state` (string)
- `expert_nda_accepted` (bool)
- `ceo_nda_accepted` (bool)

**Response:**
- `200 OK`: `{"project_id": "uuid", "artifact_b_accessible": true}`
- `403 Forbidden`: `{"detail": "<reason>"}`

#### Artifact B Guard Rules (`artifact_b_guard.py`)
Checks 4 conditions in order. Returns the first failing condition as the `reason`.
1. `engagement_state IN ('CONNECTED', 'ACTIVE')`
2. `bid_state IN ('TECH_APPROVED', 'CEO_REVIEW', 'SELECTED')`
3. `expert_nda_accepted == True`
4. `ceo_nda_accepted == True`

---

## 6. Execution & Dispute Endpoints

### 6.1 `POST /llm/criterion-check`
Detects subjective language in acceptance criteria.

**Request (`CriterionCheckRequest`):**
```json
{
  "criterion_text": "The system should respond quickly.",
  "project_archetype": "1",
  "archetype_name": "RAG/Search",
  "milestone_context": "Build the retrieval pipeline."
}
```
**Response (`CriterionCheckResponse`):**
```json
{
  "is_subjective": true,
  "suggestions": ["Response time must be under 200ms at P95."],
  "severity": "HIGH",
  "context_note": "Vague latency requirement."
}
```
**Logic:**
- Temperature = `0.0` (deterministic).
- Jinja2 context: `{{ archetype_name }}`.
- If `is_subjective == false`, forces `severity="LOW"` and `context_note=null`.

### 6.2 `POST /llm/dispute-eval`
Neutral arbitration of deliverable vs acceptance criterion.

**Request (`DisputeEvalRequest`):**
```json
{
  "criterion_text": "string",
  "deliverable_description": "string",
  "files": ["url1", "url2"],
  "project_archetype": "1",
  "milestone_context": "string",
  "prior_revision_count": 0
}
```
**Response (`DisputeEvalResponse`):**
```json
{
  "confidence_score": 0.85,
  "finding": "expert_wins",
  "reasoning": "string"
}
```
**Logic:**
- Temperature = `0.0` (deterministic).
- Validates `finding` ∈ `{"expert_wins", "client_wins"}`. Defaults to `"client_wins"` on unexpected values (conservative).
- Note: The ai-service does NOT apply the 0.80 threshold. It returns the raw score and finding; NestJS applies the threshold to determine `AUTO_RESOLVED` vs `MANUAL_REVIEW`.

---

## 7. Pydantic Models Reference

All request and response models are defined in `app/models/requests.py` and `app/models/responses.py` using Pydantic v2.

### 7.1 Elicitation Models
- `Stage1Request` / `Stage1Response`
- `Stage3VaguenessCheckRequest` / `Stage3VaguenessCheckResponse`
- `Stage4RecommendRequest` / `Stage4RecommendResponse`
- `Stage5Request` / `Stage5Response`
- `MilestoneChatRequest` / `MilestoneChatResponse`

### 7.2 Matching Models
- `MatchingRequest`
- `MatchResult` (includes `GapMapItem`)

### 7.3 Evaluation Models
- `PortfolioEvalRequest` / `PortfolioEvalResponse`
- `DisputeEvalRequest` / `DisputeEvalResponse`
- `CriterionCheckRequest` / `CriterionCheckResponse`

### 7.4 Service Generation Models
- `ServiceGenerateRequest` / `ServiceGenerateResponse`

---

## 8. Prompt Template Management

Prompts are stored as Jinja2 templates. The system checks the DB (via NestJS internal API) first, then falls back to local `.txt` files.

### Available Stages:
1. `stage1_extract`
2. `stage3_vagueness_check`
3. `stage4_recommend`
4. `stage5_synthesize`
5. `milestone_chat`
6. `criterion_check`
7. `dispute_eval`
8. `portfolio_eval`
9. `service_generate`

### Jinja2 Variables Available per Stage:
| Stage | Variables |
|---|---|
| `stage1_extract` | `{{ archetypes }}`, `{{ void_codes }}` |
| `stage5_synthesize` | `{{ domains }}`, `{{ seams }}`, `{{ archetypes }}` |
| `portfolio_eval` | `{{ seam_definitions }}`, `{{ evaluated_seam_code }}`, `{{ evaluated_seam_name }}`, `{{ evaluated_seam_desc }}` |
| `service_generate` | `{{ price_guidance }}`, `{{ claimed_domains }}`, `{{ claimed_seams }}`, `{{ is_pro_expert }}` |
| `criterion_check` | `{{ archetype_name }}` |

**Cache Invalidation:** The cache TTL is 60 seconds. Admin updates to `prompt_templates` in DB will take effect within 1 minute. No service restart is required.