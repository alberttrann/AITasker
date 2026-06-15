"""
Tests for:
  POST /llm/elicitation/stage1-extract
  POST /llm/elicitation/stage5-synthesize
"""

import pytest
from unittest.mock import AsyncMock, patch


# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 1 TESTS
# ═══════════════════════════════════════════════════════════════════════════════

STAGE1_LLM_RESPONSE = {
    "symptoms": [
        "Recommendation engine returns irrelevant results for 30% of queries",
        "Cold-start problem for new users with no purchase history",
    ],
    "scale_signals": {
        "user_count":           "50,000 monthly active users",
        "data_volume":          "3 years of purchase history (~2TB)",
        "transaction_rate":     None,
        "latency_requirement":  "under 500ms",
    },
    "voids": [
        {"void_code": "NO_GROUND_TRUTH",       "severity": "HIGH"},
        {"void_code": "UNCLEAR_SUCCESS_METRIC", "severity": "MEDIUM"},
    ],
}

RICH_CEO_INPUT = """
Our e-commerce recommendation system keeps suggesting products users already bought.
We have 50k monthly active users and 3 years of purchase history (~2TB).
We need recommendations under 500ms. New users get terrible suggestions.
We have no way to measure if recommendations are actually good right now.
"""


async def test_stage1_extract_returns_correct_shape(client):
    with patch("app.services.llm_client.call_llm_json_with_system",
               new=AsyncMock(return_value=STAGE1_LLM_RESPONSE)):
        res = await client.post("/llm/elicitation/stage1-extract",
                                json={"symptom_text": RICH_CEO_INPUT})
    assert res.status_code == 200
    body = res.json()
    assert isinstance(body["symptoms"], list)
    assert isinstance(body["scale_signals"], dict)
    assert isinstance(body["voids"], list)
    assert body["voids"][0]["void_code"] == "NO_GROUND_TRUTH"
    assert body["voids"][0]["severity"] == "HIGH"


async def test_stage1_extract_llm_prompt_contains_input(client):
    mock = AsyncMock(return_value=STAGE1_LLM_RESPONSE)
    with patch("app.services.llm_client.call_llm_json_with_system", new=mock):
        await client.post("/llm/elicitation/stage1-extract",
                          json={"symptom_text": RICH_CEO_INPUT})
    assert RICH_CEO_INPUT.strip() in mock.call_args.kwargs["prompt"]
    assert len(mock.call_args.kwargs.get("system", "")) > 50


async def test_stage1_extract_empty_llm_response_is_valid(client):
    with patch("app.services.llm_client.call_llm_json_with_system",
               new=AsyncMock(return_value={"symptoms": [], "scale_signals": {}, "voids": []})):
        res = await client.post("/llm/elicitation/stage1-extract",
                                json={"symptom_text": "We have some AI problem."})
    assert res.status_code == 200
    assert res.json()["symptoms"] == []


async def test_stage1_extract_partial_llm_response_uses_defaults(client):
    with patch("app.services.llm_client.call_llm_json_with_system",
               new=AsyncMock(return_value={"symptoms": ["latency issue"]})):
        res = await client.post("/llm/elicitation/stage1-extract",
                                json={"symptom_text": "Our system is slow."})
    body = res.json()
    assert body["symptoms"] == ["latency issue"]
    assert body["voids"] == []
    assert body["scale_signals"] == {}


async def test_stage1_extract_empty_input_returns_422(client):
    res = await client.post("/llm/elicitation/stage1-extract",
                            json={"symptom_text": "   "})
    assert res.status_code == 422


async def test_stage1_extract_missing_field_returns_422(client):
    res = await client.post("/llm/elicitation/stage1-extract", json={})
    assert res.status_code == 422


async def test_stage1_extract_llm_error_returns_503(client):
    with patch("app.services.llm_client.call_llm_json_with_system",
               new=AsyncMock(side_effect=Exception("Gemini timeout"))):
        res = await client.post("/llm/elicitation/stage1-extract",
                                json={"symptom_text": RICH_CEO_INPUT})
    assert res.status_code == 503


# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 5 TESTS
# ═══════════════════════════════════════════════════════════════════════════════

VALID_STAGE5_PAYLOAD = {
    "session_id": "sess-abc123",
    "stage1_symptoms": [
        "Recommendation engine returns irrelevant results for 30% of queries",
        "Cold-start problem for new users",
    ],
    "stage2_archetype": "2",
    "stage3_probes": {
        "What does success look like in 6 months?":
            "At least 15% increase in click-through rate on recommended products",
        "Do you have any existing recommendation logic?":
            "Basic collaborative filtering that hasn't been updated in 3 years",
    },
    "stage4_tech_inputs": {
        "current_stack":      "Python Django backend, PostgreSQL, Redis cache",
        "data_warehouse":     "Google BigQuery with 3 years of clickstream data",
        "integration_method": "REST API consumed by React frontend",
    },
    "void_list_json": [
        {"void_code": "NO_GROUND_TRUTH",       "severity": "HIGH"},
        {"void_code": "UNCLEAR_SUCCESS_METRIC", "severity": "MEDIUM"},
    ],
}

FULL_STAGE5_LLM_RESPONSE = {
    "required_seams_json": [
        {"seam_code": "A↔D", "criticality": "load_bearing"},
        {"seam_code": "D↔E", "criticality": "significant"},
        {"seam_code": "C↔E", "criticality": "contributing"},
    ],
    "required_domains_json": [
        {"domain_code": "A", "required_depth": "OPERATIONAL"},
        {"domain_code": "D", "required_depth": "DEEP"},
        {"domain_code": "C", "required_depth": "SURFACE"},
        {"domain_code": "E", "required_depth": "OPERATIONAL"},
    ],
    "milestone_framework_json": [
        {
            "milestone_number":      1,
            "deliverable_statement": "Evaluation framework: baseline metric established, 200-item ground-truth set labelled",
            "sign_off_authority":    "JOINT",
            "payment_amount_vnd":    0,
        },
        {
            "milestone_number":      2,
            "deliverable_statement": "Vector embedding pipeline deployed, latency <200ms p95 under 1k RPS load test",
            "sign_off_authority":    "TECH_TEAM",
            "payment_amount_vnd":    0,
        },
        {
            "milestone_number":      3,
            "deliverable_statement": "Recommendation API live, A/B test shows ≥15% CTR uplift over baseline",
            "sign_off_authority":    "CEO",
            "payment_amount_vnd":    0,
        },
    ],
    "artifact_a_json": {
        "business_intent": "Build a personalised product recommendation system to increase CTR by 15% within 6 months.",
        "archetype":       "2",
        "stack_tags":      ["Python", "BigQuery", "Vector DB", "Embeddings"],
        "volume_tier":     "TIER_2",
        "sdlc_notices":    ["Cold-start handling required", "Ground-truth labelling is a dependency"],
    },
    "artifact_b_json": {
        "stack_tags":          ["Django REST", "PostgreSQL", "BigQuery", "Redis", "React"],
        "integration_method":  "REST API — recommendation endpoint called by React frontend",
        "legacy_volume":       "3 years clickstream data in BigQuery, ~2TB",
        "schemas":             [],
        "contracts":           [],
    },
    "completeness_score": 0.82,
}


async def test_stage5_returns_all_six_keys(client):
    with patch("app.services.llm_client.call_llm_json_with_system",
               new=AsyncMock(return_value=FULL_STAGE5_LLM_RESPONSE)):
        res = await client.post("/llm/elicitation/stage5-synthesize",
                                json=VALID_STAGE5_PAYLOAD)
    assert res.status_code == 200
    body = res.json()
    assert "required_seams_json"      in body
    assert "required_domains_json"    in body
    assert "milestone_framework_json" in body
    assert "artifact_a_json"          in body
    assert "artifact_b_json"          in body
    assert "completeness_score"       in body


async def test_stage5_seams_shape_correct(client):
    with patch("app.services.llm_client.call_llm_json_with_system",
               new=AsyncMock(return_value=FULL_STAGE5_LLM_RESPONSE)):
        res = await client.post("/llm/elicitation/stage5-synthesize",
                                json=VALID_STAGE5_PAYLOAD)
    seams = res.json()["required_seams_json"]
    assert len(seams) == 3
    assert seams[0]["seam_code"]   == "A↔D"
    assert seams[0]["criticality"] == "load_bearing"


async def test_stage5_milestone_payment_always_zero(client):
    """payment_amount_vnd is always 0 regardless of LLM output."""
    response_with_nonzero_price = {
        **FULL_STAGE5_LLM_RESPONSE,
        "milestone_framework_json": [
            {**m, "payment_amount_vnd": 50_000_000}
            for m in FULL_STAGE5_LLM_RESPONSE["milestone_framework_json"]
        ],
    }
    with patch("app.services.llm_client.call_llm_json_with_system",
               new=AsyncMock(return_value=response_with_nonzero_price)):
        res = await client.post("/llm/elicitation/stage5-synthesize",
                                json=VALID_STAGE5_PAYLOAD)
    for m in res.json()["milestone_framework_json"]:
        assert m["payment_amount_vnd"] == 0


async def test_stage5_completeness_score_clamped(client):
    """Score clamped to [0.0, 1.0]."""
    with patch("app.services.llm_client.call_llm_json_with_system",
               new=AsyncMock(return_value={**FULL_STAGE5_LLM_RESPONSE, "completeness_score": 1.5})):
        res = await client.post("/llm/elicitation/stage5-synthesize",
                                json=VALID_STAGE5_PAYLOAD)
    assert res.json()["completeness_score"] <= 1.0


async def test_stage5_completeness_low_score_still_returned(client):
    """Low score (< 0.70) is returned as-is — NestJS decides to return to CEO."""
    with patch("app.services.llm_client.call_llm_json_with_system",
               new=AsyncMock(return_value={**FULL_STAGE5_LLM_RESPONSE, "completeness_score": 0.45})):
        res = await client.post("/llm/elicitation/stage5-synthesize",
                                json=VALID_STAGE5_PAYLOAD)
    assert res.status_code == 200
    assert res.json()["completeness_score"] == 0.45


async def test_stage5_invalid_seam_criticality_filtered_out(client):
    """Seams with invalid criticality are dropped — not passed to NestJS."""
    bad_seams = [
        {"seam_code": "A↔D", "criticality": "load_bearing"},    # valid
        {"seam_code": "D↔E", "criticality": "critical"},         # invalid → dropped
        {"seam_code": "C↔E", "criticality": "contributing"},     # valid
    ]
    with patch("app.services.llm_client.call_llm_json_with_system",
               new=AsyncMock(return_value={**FULL_STAGE5_LLM_RESPONSE,
                                           "required_seams_json": bad_seams})):
        res = await client.post("/llm/elicitation/stage5-synthesize",
                                json=VALID_STAGE5_PAYLOAD)
    seams = res.json()["required_seams_json"]
    assert len(seams) == 2
    codes = [s["seam_code"] for s in seams]
    assert "A↔D" in codes
    assert "C↔E" in codes


async def test_stage5_invalid_domain_code_filtered_out(client):
    """Domains with unknown domain_code are dropped."""
    bad_domains = [
        {"domain_code": "A", "required_depth": "DEEP"},      # valid
        {"domain_code": "Z", "required_depth": "SURFACE"},   # invalid code → dropped
        {"domain_code": "D", "required_depth": "INVALID"},   # invalid depth → dropped
    ]
    with patch("app.services.llm_client.call_llm_json_with_system",
               new=AsyncMock(return_value={**FULL_STAGE5_LLM_RESPONSE,
                                           "required_domains_json": bad_domains})):
        res = await client.post("/llm/elicitation/stage5-synthesize",
                                json=VALID_STAGE5_PAYLOAD)
    domains = res.json()["required_domains_json"]
    assert len(domains) == 1
    assert domains[0]["domain_code"] == "A"


async def test_stage5_invalid_sign_off_authority_defaults_to_ceo(client):
    """Invalid sign_off_authority falls back to CEO."""
    bad_milestones = [{"milestone_number": 1,
                       "deliverable_statement": "Something",
                       "sign_off_authority":    "MANAGER",   # invalid
                       "payment_amount_vnd":    0}]
    with patch("app.services.llm_client.call_llm_json_with_system",
               new=AsyncMock(return_value={**FULL_STAGE5_LLM_RESPONSE,
                                           "milestone_framework_json": bad_milestones})):
        res = await client.post("/llm/elicitation/stage5-synthesize",
                                json=VALID_STAGE5_PAYLOAD)
    assert res.json()["milestone_framework_json"][0]["sign_off_authority"] == "CEO"


async def test_stage5_artifact_a_invalid_archetype_defaults_to_1(client):
    """Invalid archetype code defaults to '1'."""
    bad_a = {**FULL_STAGE5_LLM_RESPONSE["artifact_a_json"], "archetype": "99"}
    with patch("app.services.llm_client.call_llm_json_with_system",
               new=AsyncMock(return_value={**FULL_STAGE5_LLM_RESPONSE, "artifact_a_json": bad_a})):
        res = await client.post("/llm/elicitation/stage5-synthesize",
                                json=VALID_STAGE5_PAYLOAD)
    assert res.json()["artifact_a_json"]["archetype"] == "1"


async def test_stage5_all_data_appears_in_prompt(client):
    """All 4 stages of context must appear in the prompt sent to Gemini."""
    mock = AsyncMock(return_value=FULL_STAGE5_LLM_RESPONSE)
    with patch("app.services.llm_client.call_llm_json_with_system", new=mock):
        await client.post("/llm/elicitation/stage5-synthesize", json=VALID_STAGE5_PAYLOAD)

    prompt = mock.call_args.kwargs["prompt"]
    assert "sess-abc123"                     in prompt   # session_id
    assert "Cold-start problem for new users" in prompt  # stage1 symptom
    assert "15% increase in click-through"   in prompt  # stage3 probe answer
    assert "Google BigQuery"                 in prompt  # stage4 tech input
    assert "NO_GROUND_TRUTH"                 in prompt  # void


async def test_stage5_missing_session_id_returns_422(client):
    res = await client.post("/llm/elicitation/stage5-synthesize",
                            json={**VALID_STAGE5_PAYLOAD, "session_id": "  "})
    assert res.status_code == 422


async def test_stage5_empty_symptoms_returns_422(client):
    res = await client.post("/llm/elicitation/stage5-synthesize",
                            json={**VALID_STAGE5_PAYLOAD, "stage1_symptoms": []})
    assert res.status_code == 422


async def test_stage5_missing_required_fields_returns_422(client):
    res = await client.post("/llm/elicitation/stage5-synthesize", json={})
    assert res.status_code == 422


async def test_stage5_llm_error_returns_503(client):
    with patch("app.services.llm_client.call_llm_json_with_system",
               new=AsyncMock(side_effect=Exception("Gemini overloaded"))):
        res = await client.post("/llm/elicitation/stage5-synthesize",
                                json=VALID_STAGE5_PAYLOAD)
    assert res.status_code == 503


async def test_stage5_empty_llm_output_returns_safe_defaults(client):
    """Completely empty LLM response returns safe empty structures, not a crash."""
    with patch("app.services.llm_client.call_llm_json_with_system",
               new=AsyncMock(return_value={})):
        res = await client.post("/llm/elicitation/stage5-synthesize",
                                json=VALID_STAGE5_PAYLOAD)
    assert res.status_code == 200
    body = res.json()
    assert body["required_seams_json"]      == []
    assert body["required_domains_json"]    == []
    assert body["milestone_framework_json"] == []
    assert body["completeness_score"]       == 0.0