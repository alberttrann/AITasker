"""
Integration tests — real Gemini API calls, no mocks.

These tests simulate exactly what NestJS sends to ai-service in production.
They are skipped automatically when ANTHROPIC_API_KEY is unset or is a test key.

Run locally:
    cd ai-service
    venv\\Scripts\\activate
    pytest tests/test_integration.py -v -m integration -s

WHY THE UVICORN CONSOLE IS SILENT
-----------------------------------
Tests use httpx.AsyncClient(transport=ASGITransport(app=app)).
This calls the FastAPI ASGI app in-process — no TCP sockets, no HTTP layer.
Uvicorn sees zero traffic. Application logs appear in the pytest output
(log_cli = true in pytest.ini). This is intentional: tests work without
a running server and exercise the exact same application code paths.

ASSERTION PHILOSOPHY FOR LLM ENDPOINTS
----------------------------------------
LLM output is non-deterministic. Integration tests assert:
  ✓ HTTP status is 200 (endpoint works, no crash)
  ✓ Required fields are present (schema is correct)
  ✓ Value types are correct (int, float, str, list, bool)
  ✓ Numeric scores are in [0.0, 1.0] (clamping works)
  ✓ Enum values are within allowed sets (validation works)
  ✓ Business rules that are enforced IN CODE (not LLM):
      - payment_amount_vnd always 0 in stage5
      - passed_boolean computed from threshold, not LLM
  ✗ We do NOT assert specific LLM text, findings, or scores.
    Those are non-deterministic and belong in prompt eval benchmarks.

NESTJS CALL COVERAGE
---------------------
Each test group represents one NestJS service calling the ai-service.
All 7 endpoints + all primary code paths per endpoint are covered.
"""

import sys
import asyncio
import os
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.config import settings

# ── Windows ProactorEventLoop fix ─────────────────────────────────────────────
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


# ── Skip guard ────────────────────────────────────────────────────────────────
pytestmark = pytest.mark.integration

if settings.is_test_mode:
    pytest.skip(
        "Integration tests require a real ANTHROPIC_API_KEY (Gemini API key). "
        "Get one at https://aistudio.google.com/app/apikey and set in ai-service/.env",
        allow_module_level=True,
    )


# ── Client fixture ────────────────────────────────────────────────────────────
@pytest_asyncio.fixture
async def client():
    """
    In-process ASGI client — exercises full FastAPI + service + LLM stack.
    No running server required. Uvicorn console stays silent (expected).
    """
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        timeout=60.0,
    ) as ac:
        yield ac


# ── Shared response validators ────────────────────────────────────────────────
def assert_valid_score(score):
    assert isinstance(score, float), f"score must be float, got {type(score)}"
    assert 0.0 <= score <= 1.0,      f"score {score} out of [0.0, 1.0]"

def assert_valid_finding(finding):
    assert finding in ("expert_wins", "client_wins"), \
        f"finding '{finding}' not in allowed set"


# ═══════════════════════════════════════════════════════════════════════════════
# 1. HEALTH CHECK
# Called by: Railway health check, NestJS startup check
# ═══════════════════════════════════════════════════════════════════════════════

async def test_health(client):
    res = await client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["service"] == "aitasker-llm"


# ═══════════════════════════════════════════════════════════════════════════════
# 2. CRITERION CHECK — POST /llm/criterion-check
# Called by: NestJS MilestonesService.createAcceptanceCriterion()
#
# NestJS sends: { criterion_text: string }
# NestJS reads: { is_subjective: bool, suggestions: string[] }
# NestJS action: writes advisory_note to platform_decisions if is_subjective
# ═══════════════════════════════════════════════════════════════════════════════

async def test_criterion_check_subjective(client):
    """Vague criterion → model flags as subjective, returns rewrite suggestions."""
    res = await client.post("/llm/criterion-check", json={
        "criterion_text": "The AI system should respond quickly and produce good results",
    })
    assert res.status_code == 200
    body = res.json()

    assert isinstance(body["is_subjective"], bool)
    assert isinstance(body["suggestions"], list)
    assert body["is_subjective"] is True        # unambiguously vague → can assert
    assert len(body["suggestions"]) >= 1        # must provide at least one rewrite


async def test_criterion_check_objective(client):
    """Measurable criterion with numbers → model should NOT flag as subjective."""
    res = await client.post("/llm/criterion-check", json={
        "criterion_text": (
            "The recommendation endpoint must return HTTP 200 with a non-empty "
            "JSON array within 200ms at p95 under 1000 RPS sustained load."
        ),
    })
    assert res.status_code == 200
    body = res.json()

    assert isinstance(body["is_subjective"], bool)
    assert body["is_subjective"] is False       # unambiguously measurable → can assert
    assert body["suggestions"] == []


async def test_criterion_check_mixed_language(client):
    """Criterion with both objective and subjective parts — shape only."""
    res = await client.post("/llm/criterion-check", json={
        "criterion_text": "The model must achieve reasonable accuracy on the test set.",
    })
    assert res.status_code == 200
    body = res.json()
    assert isinstance(body["is_subjective"], bool)
    assert isinstance(body["suggestions"], list)
    # Do NOT assert is_subjective value — "reasonable" is ambiguous territory


# ═══════════════════════════════════════════════════════════════════════════════
# 3. STAGE 1 EXTRACT — POST /llm/elicitation/stage1-extract
# Called by: NestJS ElicitationService.submitStage1()
#
# NestJS sends: { symptom_text: string }
# NestJS reads: { symptoms[], scale_signals{}, voids[{void_code, severity}] }
# ═══════════════════════════════════════════════════════════════════════════════

VALID_SEVERITIES = {"HIGH", "MEDIUM", "LOW"}

async def test_stage1_extract_rich_input(client):
    """Rich CEO input → non-empty symptoms, valid voids."""
    res = await client.post("/llm/elicitation/stage1-extract", json={
        "symptom_text": (
            "Our customer service AI chatbot keeps giving wrong answers about our product catalogue. "
            "It hallucinates features that don't exist. We have 80,000 active users a day and the "
            "chatbot handles about 5,000 conversations daily. We need responses under 3 seconds. "
            "Right now we have no way to measure whether the answers are actually correct — "
            "we only find out when customers complain. The AI was trained 2 years ago and our "
            "product catalogue has changed a lot since then."
        ),
    })
    assert res.status_code == 200
    body = res.json()

    assert isinstance(body["symptoms"], list)
    assert isinstance(body["scale_signals"], dict)
    assert isinstance(body["voids"], list)
    assert len(body["symptoms"]) >= 1

    for void in body["voids"]:
        assert "void_code" in void
        assert "severity"  in void
        assert void["severity"] in VALID_SEVERITIES


async def test_stage1_extract_sparse_input(client):
    """Sparse CEO input → valid but potentially empty structure, not an error."""
    res = await client.post("/llm/elicitation/stage1-extract", json={
        "symptom_text": "We have some AI problem with our system.",
    })
    assert res.status_code == 200
    body = res.json()
    assert isinstance(body["symptoms"],     list)
    assert isinstance(body["scale_signals"], dict)
    assert isinstance(body["voids"],        list)
    # No assertion on lengths — sparse input may produce empty results


async def test_stage1_extract_empty_body_returns_422(client):
    """NestJS should never send empty text, but 422 is the contract."""
    res = await client.post("/llm/elicitation/stage1-extract",
                            json={"symptom_text": "   "})
    assert res.status_code == 422


# ═══════════════════════════════════════════════════════════════════════════════
# 4. PORTFOLIO EVAL — POST /llm/portfolio-eval
# Called by: NestJS PortfolioService.submitPortfolioEntry()
#
# NestJS sends: { seam_code, project_description, decision_points }
# NestJS reads: { confidence_score, passed_boolean, gap_advisory }
# NestJS action:
#   passed=True  → expert_seam_claims.verification_tier = EVIDENCE_BACKED
#   passed=False → increment failure count, check lockout
# ═══════════════════════════════════════════════════════════════════════════════

STRONG_PORTFOLIO_PAYLOAD = {
    "seam_code": "A↔D",
    "project_description": (
        "Built a production RAG pipeline for a 500-lawyer firm. "
        "Retrieves relevant case law from a 300k document corpus in Pinecone "
        "and generates cited summaries. 50k monthly queries, p95 latency <200ms."
    ),
    "decision_points": (
        "At the A↔D retrieval-generation boundary: evaluated text-embedding-3-large vs "
        "BGE-large on 150 annotated query-document pairs. BGE-large: nDCG@10=0.83 but "
        "40% higher latency. Chose text-embedding-3-large (nDCG@10=0.79, p95=180ms) "
        "to meet the 200ms SLA. Added hybrid dense+sparse retrieval with RRF reranking: "
        "+0.06 nDCG improvement. Cross-encoder reranker as final filter reduced "
        "hallucination rate from 22% to 4% on 50 annotated golden queries."
    ),
}

WEAK_PORTFOLIO_PAYLOAD = {
    "seam_code": "A↔D",
    "project_description": "Worked on an AI project.",
    "decision_points": "Used machine learning to solve the problem.",
}


async def test_portfolio_eval_response_shape(client):
    """All 3 fields present, types correct, score in [0,1]."""
    res = await client.post("/llm/portfolio-eval", json=STRONG_PORTFOLIO_PAYLOAD)
    assert res.status_code == 200
    body = res.json()

    assert "confidence_score" in body
    assert "passed_boolean"   in body
    assert "gap_advisory"     in body
    assert_valid_score(body["confidence_score"])
    assert isinstance(body["passed_boolean"], bool)


async def test_portfolio_eval_business_rule_passed_clears_gap_advisory(client):
    """BR-VER-03: gap_advisory must be None when passed_boolean is True."""
    res = await client.post("/llm/portfolio-eval", json=STRONG_PORTFOLIO_PAYLOAD)
    assert res.status_code == 200
    body = res.json()
    if body["passed_boolean"]:
        assert body["gap_advisory"] is None


async def test_portfolio_eval_business_rule_failed_sets_gap_advisory(client):
    """BR-VER-03: gap_advisory must be non-null string when passed_boolean is False."""
    res = await client.post("/llm/portfolio-eval", json=WEAK_PORTFOLIO_PAYLOAD)
    assert res.status_code == 200
    body = res.json()
    if not body["passed_boolean"]:
        assert body["gap_advisory"] is not None
        assert len(body["gap_advisory"]) > 0


async def test_portfolio_eval_threshold_computed_in_code_not_llm(client):
    """
    Business rule: passed_boolean = (confidence_score >= 0.85).
    This is enforced by our service code regardless of what the LLM returns.
    """
    res = await client.post("/llm/portfolio-eval", json=STRONG_PORTFOLIO_PAYLOAD)
    assert res.status_code == 200
    body = res.json()
    expected_pass = body["confidence_score"] >= settings.portfolio_eval_threshold
    assert body["passed_boolean"] == expected_pass


async def test_portfolio_eval_weak_submission_fails(client):
    """Generic submission with no seam-specific evidence should not pass."""
    res = await client.post("/llm/portfolio-eval", json=WEAK_PORTFOLIO_PAYLOAD)
    assert res.status_code == 200
    body = res.json()
    assert body["passed_boolean"] is False
    assert body["gap_advisory"]   is not None


# ═══════════════════════════════════════════════════════════════════════════════
# 5. DISPUTE EVAL — POST /llm/dispute-eval
# Called by: NestJS DisputeService.fileDispute()
#
# NestJS sends: { criterion_text, deliverable_description, files: string[] }
# NestJS reads: { confidence_score, finding }
# NestJS action:
#   confidence >= 0.80 → AUTO_RESOLVED (finding determines payment resolution)
#   confidence <  0.80 → MANUAL_REVIEW (admin queue)
#
# ASSERTION NOTE: finding is NOT asserted for specific values.
# The model's determination depends on its interpretation — asserting "expert_wins"
# on a specific scenario is a brittle prompt benchmark, not an integration test.
# We verify shape, types, and valid enum values only.
# ═══════════════════════════════════════════════════════════════════════════════

async def test_dispute_eval_response_shape(client):
    """All fields present, types correct, score in [0,1], finding is valid enum."""
    res = await client.post("/llm/dispute-eval", json={
        "criterion_text":          "The model must process 100 requests per second.",
        "deliverable_description": "System deployed and handling production traffic.",
        "files": [],
    })
    assert res.status_code == 200
    body = res.json()

    assert "confidence_score" in body
    assert "finding"          in body
    assert_valid_score(body["confidence_score"])
    assert_valid_finding(body["finding"])


async def test_dispute_eval_with_files(client):
    """Files list included — shape and types valid."""
    res = await client.post("/llm/dispute-eval", json={
        "criterion_text": (
            "The recommendation API must return HTTP 200 with a JSON array "
            "of at least 5 product IDs within 300ms for 95% of requests."
        ),
        "deliverable_description": (
            "Deployed recommendation endpoint. Load tested with k6 at 500 RPS. "
            "p95 latency: 187ms. p99 latency: 241ms. "
            "All 1000 test requests returned HTTP 200. "
            "Array sizes ranged from 6 to 12 product IDs. "
            "No errors or timeouts observed during 10-minute sustained run."
        ),
        "files": ["https://storage.example.com/k6-report.html"],
    })
    assert res.status_code == 200
    body = res.json()
    assert_valid_score(body["confidence_score"])
    assert_valid_finding(body["finding"])


async def test_dispute_eval_without_files(client):
    """No files — criterion evaluated on description text only."""
    res = await client.post("/llm/dispute-eval", json={
        "criterion_text":          "Model F1 >= 0.85 on provided 500-item holdout set.",
        "deliverable_description": "Trained model, no evaluation results provided.",
        "files":                   [],
    })
    assert res.status_code == 200
    body = res.json()
    assert_valid_score(body["confidence_score"])
    assert_valid_finding(body["finding"])
    # This should be client_wins — assertion acceptable for unambiguously missing evidence
    assert body["finding"] == "client_wins"


async def test_dispute_eval_temperature_zero_deterministic(client):
    """Two identical requests must return identical results (temperature=0.0)."""
    payload = {
        "criterion_text":          "API returns 200 within 500ms.",
        "deliverable_description": "Endpoint deployed. No performance testing done.",
        "files":                   [],
    }
    res1 = await client.post("/llm/dispute-eval", json=payload)
    res2 = await client.post("/llm/dispute-eval", json=payload)
    assert res1.status_code == 200
    assert res2.status_code == 200
    # With temperature=0.0, output must be identical
    assert res1.json()["finding"]          == res2.json()["finding"]
    assert res1.json()["confidence_score"] == res2.json()["confidence_score"]


async def test_dispute_eval_missing_fields_returns_422(client):
    """NestJS must always send both criterion and deliverable."""
    res = await client.post("/llm/dispute-eval", json={
        "criterion_text": "something",
        # missing deliverable_description
    })
    assert res.status_code == 422


# ═══════════════════════════════════════════════════════════════════════════════
# 6. SERVICE GENERATE — POST /llm/service-generate
# Called by: NestJS ListingsService.generateServiceDraft()
#
# NestJS sends: { expert_capabilities: string[], target_use_cases: string[] }
# NestJS reads: { title, description, scope, timeline, suggested_price_vnd }
# NestJS action: pre-fills the service creation form; expert edits and publishes
# ═══════════════════════════════════════════════════════════════════════════════

async def test_service_generate_all_fields_present(client):
    """All 5 fields present, correctly typed, price in valid range."""
    res = await client.post("/llm/service-generate", json={
        "expert_capabilities": [
            "7 years building production ML systems at scale",
            "Expert in LangChain, LlamaIndex, custom RAG architectures",
            "Pinecone, Weaviate, pgvector — deployed systems handling >10M daily queries",
        ],
        "target_use_cases": [
            "Enterprise knowledge base search",
            "Legal document retrieval",
            "Customer support automation",
        ],
    })
    assert res.status_code == 200
    body = res.json()

    for field in ("title", "description", "scope", "timeline", "suggested_price_vnd"):
        assert field in body

    assert isinstance(body["title"],               str)
    assert isinstance(body["description"],         str)
    assert isinstance(body["scope"],               str)
    assert isinstance(body["timeline"],            str)
    assert isinstance(body["suggested_price_vnd"], int)

    assert len(body["title"])       > 5
    assert len(body["description"]) > 20
    assert 0 <= body["suggested_price_vnd"] <= 2_000_000_000


async def test_service_generate_empty_capabilities_returns_422(client):
    """NestJS must send at least one non-empty capability."""
    res = await client.post("/llm/service-generate", json={
        "expert_capabilities": [],
        "target_use_cases":    ["something"],
    })
    assert res.status_code == 422


# ═══════════════════════════════════════════════════════════════════════════════
# 7. STAGE 5 SYNTHESIZE — POST /llm/elicitation/stage5-synthesize
# Called by: NestJS ElicitationService.submitStage4() (triggers synthesis)
#
# NestJS sends: all 4 stages + void list
# NestJS reads: all 6 structured outputs
# NestJS action:
#   completeness_score >= 0.70 → project.state = PUBLISHED
#   completeness_score <  0.70 → project.state = RETURNED_TO_CLIENT
# ═══════════════════════════════════════════════════════════════════════════════

STAGE5_PAYLOAD = {
    "session_id": "integ-test-session-001",
    "stage1_symptoms": [
        "Customer service chatbot hallucinating product features",
        "No way to measure answer accuracy",
        "Training data 2 years stale",
    ],
    "stage2_archetype": "1",
    "stage3_probes": {
        "What does success look like in 90 days?":
            "Chatbot accuracy >90% measured weekly by QA team",
        "Existing systems to integrate with?":
            "Zendesk ticketing + product catalogue REST API updated daily",
    },
    "stage4_tech_inputs": {
        "current_stack":       "Python FastAPI, PostgreSQL, AWS ECS",
        "data_available":      "6 months Zendesk exports (~200k conversations)",
        "latency_requirement": "< 3 seconds end-to-end",
    },
    "void_list_json": [
        {"void_code": "NO_GROUND_TRUTH",       "severity": "HIGH"},
        {"void_code": "UNCLEAR_SUCCESS_METRIC", "severity": "MEDIUM"},
    ],
}

VALID_CRITICALITIES  = {"load_bearing", "significant", "contributing"}
VALID_DOMAIN_CODES   = {"A", "B", "C", "D", "E", "F"}
VALID_DEPTHS         = {"SURFACE", "OPERATIONAL", "DEEP"}
VALID_AUTHORITIES    = {"CEO", "TECH_TEAM", "JOINT"}
VALID_ARCHETYPES     = {"1", "2", "3", "4", "5", "6"}
VALID_VOLUME_TIERS   = {"TIER_1", "TIER_2", "TIER_3"}


async def test_stage5_all_six_keys_present(client):
    """All 6 output keys present."""
    res = await client.post("/llm/elicitation/stage5-synthesize", json=STAGE5_PAYLOAD)
    assert res.status_code == 200
    body = res.json()
    for key in ("required_seams_json", "required_domains_json",
                "milestone_framework_json", "artifact_a_json",
                "artifact_b_json", "completeness_score"):
        assert key in body, f"Missing key: {key}"


async def test_stage5_seams_valid_enum_values(client):
    """All seam criticality values within allowed set."""
    res = await client.post("/llm/elicitation/stage5-synthesize", json=STAGE5_PAYLOAD)
    assert res.status_code == 200
    for seam in res.json()["required_seams_json"]:
        assert "seam_code"   in seam
        assert "criticality" in seam
        assert seam["criticality"] in VALID_CRITICALITIES


async def test_stage5_domains_valid_enum_values(client):
    """All domain codes and depth values within allowed sets."""
    res = await client.post("/llm/elicitation/stage5-synthesize", json=STAGE5_PAYLOAD)
    assert res.status_code == 200
    for domain in res.json()["required_domains_json"]:
        assert domain["domain_code"]    in VALID_DOMAIN_CODES
        assert domain["required_depth"] in VALID_DEPTHS


async def test_stage5_milestone_payment_always_zero(client):
    """Business rule: payment_amount_vnd = 0 always — CEO sets real amounts."""
    res = await client.post("/llm/elicitation/stage5-synthesize", json=STAGE5_PAYLOAD)
    assert res.status_code == 200
    for m in res.json()["milestone_framework_json"]:
        assert m["payment_amount_vnd"] == 0, \
            f"Milestone {m['milestone_number']} has non-zero payment"


async def test_stage5_milestone_sign_off_authority_valid(client):
    """All sign_off_authority values within allowed set."""
    res = await client.post("/llm/elicitation/stage5-synthesize", json=STAGE5_PAYLOAD)
    assert res.status_code == 200
    for m in res.json()["milestone_framework_json"]:
        assert m["sign_off_authority"] in VALID_AUTHORITIES


async def test_stage5_artifact_a_enum_values(client):
    """Artifact A archetype and volume_tier within allowed sets."""
    res = await client.post("/llm/elicitation/stage5-synthesize", json=STAGE5_PAYLOAD)
    assert res.status_code == 200
    a = res.json()["artifact_a_json"]
    assert a["archetype"]   in VALID_ARCHETYPES
    assert a["volume_tier"] in VALID_VOLUME_TIERS
    assert len(a["business_intent"]) > 10


async def test_stage5_completeness_score_in_range(client):
    """Completeness score in [0.0, 1.0]."""
    res = await client.post("/llm/elicitation/stage5-synthesize", json=STAGE5_PAYLOAD)
    assert res.status_code == 200
    assert_valid_score(res.json()["completeness_score"])


async def test_stage5_empty_symptoms_returns_422(client):
    res = await client.post("/llm/elicitation/stage5-synthesize",
                            json={**STAGE5_PAYLOAD, "stage1_symptoms": []})
    assert res.status_code == 422


# ═══════════════════════════════════════════════════════════════════════════════
# 8. MATCHING — POST /llm/matching
# Called by: NestJS ProjectsService.publishProject()
#
# NestJS sends: { required_seams_json, required_domains_json,
#                 expert_profiles, project_archetype }
# NestJS reads: [{ expert_id, composite_score, strength_label, gap_map }]
# NestJS action: displays top N results in CEO shortlist
# ═══════════════════════════════════════════════════════════════════════════════

MATCHING_PAYLOAD = {
    "required_seams_json": [
        {"seam_code": "A↔D", "criticality": "load_bearing"},
        {"seam_code": "C↔E", "criticality": "significant"},
    ],
    "required_domains_json": [
        {"domain_code": "A", "required_depth": "OPERATIONAL"},
        {"domain_code": "D", "required_depth": "DEEP"},
    ],
    "project_archetype": "1",
    "expert_profiles": [
        {
            "expert_id": "expert-strong",
            "seam_claims": [
                {"seam_code": "A↔D", "verification_tier": "EVIDENCE_BACKED"},
                {"seam_code": "C↔E", "verification_tier": "CLAIMED"},
            ],
            "domain_depths": [
                {"domain_code": "A", "depth_level": "DEEP"},
                {"domain_code": "D", "depth_level": "DEEP"},
            ],
            "portfolio_score":   0.91,
            "archetype_history": ["1", "4"],
        },
        {
            "expert_id": "expert-weak",
            "seam_claims":       [],
            "domain_depths":     [],
            "portfolio_score":   0.40,
            "archetype_history": ["3"],
        },
    ],
}


async def test_matching_returns_sorted_results(client):
    """Results sorted descending by composite_score."""
    res = await client.post("/llm/matching", json=MATCHING_PAYLOAD)
    assert res.status_code == 200
    results = res.json()
    assert len(results) == 2
    assert results[0]["composite_score"] >= results[1]["composite_score"]
    assert results[0]["expert_id"] == "expert-strong"


async def test_matching_all_result_fields_present(client):
    """All 4 result fields present for each expert."""
    res = await client.post("/llm/matching", json=MATCHING_PAYLOAD)
    assert res.status_code == 200
    for r in res.json():
        assert "expert_id"       in r
        assert "composite_score" in r
        assert "strength_label"  in r
        assert "gap_map"         in r
        assert_valid_score(r["composite_score"])
        assert r["strength_label"] in {"STRONG_MATCH", "GOOD_MATCH",
                                       "POSSIBLE_MATCH", "WEAK_MATCH"}


async def test_matching_gap_map_valid_colors(client):
    """All gap map entries have valid colors and cover all required seams."""
    res = await client.post("/llm/matching", json=MATCHING_PAYLOAD)
    assert res.status_code == 200
    for r in res.json():
        assert len(r["gap_map"]) == 2  # one per required seam
        for entry in r["gap_map"]:
            assert entry["color"] in ("green", "amber", "red")


async def test_matching_empty_profiles_returns_empty_list(client):
    """No experts → empty list, not an error."""
    res = await client.post("/llm/matching",
                            json={**MATCHING_PAYLOAD, "expert_profiles": []})
    assert res.status_code == 200
    assert res.json() == []


async def test_matching_no_requirements_returns_422(client):
    res = await client.post("/llm/matching", json={
        **MATCHING_PAYLOAD,
        "required_seams_json":   [],
        "required_domains_json": [],
    })
    assert res.status_code == 422


# ═══════════════════════════════════════════════════════════════════════════════
# 9. ARTIFACT B GUARD — GET /projects/{id}/artifact-b
# Called by: NestJS ProjectsService.getProject() before returning artifact_b_json
#
# NestJS sends: query params (engagement_state, bid_state, nda flags)
# NestJS reads: 200 → include artifact_b_json | 403 → omit it
# ═══════════════════════════════════════════════════════════════════════════════

async def test_artifact_b_all_conditions_met(client):
    res = await client.get(
        "/projects/proj-123/artifact-b"
        "?engagement_state=ACTIVE"
        "&bid_state=TECH_APPROVED"
        "&expert_nda_accepted=true"
        "&ceo_nda_accepted=true"
    )
    assert res.status_code == 200
    assert res.json()["artifact_b_accessible"] is True
    assert res.json()["project_id"] == "proj-123"


async def test_artifact_b_wrong_engagement_state(client):
    res = await client.get(
        "/projects/proj-123/artifact-b"
        "?engagement_state=PENDING"
        "&bid_state=TECH_APPROVED"
        "&expert_nda_accepted=true"
        "&ceo_nda_accepted=true"
    )
    assert res.status_code == 403
    assert "PENDING" in res.json()["detail"]


async def test_artifact_b_bid_not_approved(client):
    res = await client.get(
        "/projects/proj-123/artifact-b"
        "?engagement_state=CONNECTED"
        "&bid_state=SUBMITTED"
        "&expert_nda_accepted=true"
        "&ceo_nda_accepted=true"
    )
    assert res.status_code == 403


async def test_artifact_b_expert_nda_missing(client):
    res = await client.get(
        "/projects/proj-123/artifact-b"
        "?engagement_state=ACTIVE"
        "&bid_state=SELECTED"
        "&expert_nda_accepted=false"
        "&ceo_nda_accepted=true"
    )
    assert res.status_code == 403
    assert "NDA" in res.json()["detail"]


async def test_artifact_b_ceo_nda_missing(client):
    res = await client.get(
        "/projects/proj-123/artifact-b"
        "?engagement_state=ACTIVE"
        "&bid_state=CEO_REVIEW"
        "&expert_nda_accepted=true"
        "&ceo_nda_accepted=false"
    )
    assert res.status_code == 403