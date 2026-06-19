"""
Tests for POST /llm/portfolio-eval

Key invariants tested:
  - passed_boolean is ALWAYS computed from confidence_score, never from LLM boolean
  - gap_advisory is None on pass, non-null on failure
  - score clamped to [0.0, 1.0]
  - threshold boundary: 0.85 passes, 0.8499 fails
"""

import pytest
from unittest.mock import AsyncMock, patch


# ── Fixtures ──────────────────────────────────────────────────────────────────

VALID_PAYLOAD = {
    "seam_code": "A↔C",
    "project_description": (
        "Built a RAG pipeline for a legal firm. The system retrieves case precedents "
        "from a 500k document corpus and generates summaries for lawyers."
    ),
    "decision_points": (
        "At the A↔C seam: decided to use BERTScore instead of ROUGE for evaluation "
        "because legal language has low lexical overlap with reference summaries. "
        "Implemented a rejection threshold — if BERTScore < 0.72, the retrieval "
        "step triggers a re-query with a broadened filter. This reduced hallucination "
        "rate from 18% to 4% on our holdout set of 200 annotated cases."
    ),
}


# ── Happy path — passing evaluation ──────────────────────────────────────────

async def test_portfolio_eval_passing_score(client):
    """Score >= 0.85 → passed_boolean=True, gap_advisory=None."""
    with patch(
        "app.services.llm_client.call_llm_json_with_system",
        new=AsyncMock(return_value={
            "confidence_score": 0.92,
            "passed_boolean": True,
            "gap_advisory": None,
        }),
    ):
        res = await client.post("/llm/portfolio-eval", json=VALID_PAYLOAD)

    assert res.status_code == 200
    body = res.json()
    assert body["passed_boolean"] is True
    assert body["confidence_score"] == 0.92
    assert body["gap_advisory"] is None


async def test_portfolio_eval_failing_score_has_gap_advisory(client):
    """Score < 0.85 → passed_boolean=False, gap_advisory is a non-empty string."""
    with patch(
        "app.services.llm_client.call_llm_json_with_system",
        new=AsyncMock(return_value={
            "confidence_score": 0.71,
            "passed_boolean": False,
            "gap_advisory": "Missing failure mode reasoning at the A↔C boundary",
        }),
    ):
        res = await client.post("/llm/portfolio-eval", json=VALID_PAYLOAD)

    assert res.status_code == 200
    body = res.json()
    assert body["passed_boolean"] is False
    assert body["confidence_score"] == 0.71
    assert body["gap_advisory"] == "Missing failure mode reasoning at the A↔C boundary"


# ── Critical: threshold computed in service, not taken from LLM ──────────────

async def test_portfolio_eval_ignores_llm_boolean_on_conflict(client):
    """
    LLM says passed_boolean=False but score=0.92 → service must set True.
    The LLM's boolean is advisory only; our threshold is authoritative.
    """
    with patch(
        "app.services.llm_client.call_llm_json_with_system",
        new=AsyncMock(return_value={
            "confidence_score": 0.92,
            "passed_boolean": False,     # LLM contradicts itself
            "gap_advisory": "some gap",
        }),
    ):
        res = await client.post("/llm/portfolio-eval", json=VALID_PAYLOAD)

    body = res.json()
    # Service overrides — score 0.92 >= 0.85 threshold → must pass
    assert body["passed_boolean"] is True
    # gap_advisory cleared on pass
    assert body["gap_advisory"] is None


async def test_portfolio_eval_ignores_llm_boolean_when_llm_says_pass_but_score_fails(client):
    """
    LLM says passed_boolean=True but score=0.70 → service must set False.
    """
    with patch(
        "app.services.llm_client.call_llm_json_with_system",
        new=AsyncMock(return_value={
            "confidence_score": 0.70,
            "passed_boolean": True,     # LLM wrong
            "gap_advisory": None,
        }),
    ):
        res = await client.post("/llm/portfolio-eval", json=VALID_PAYLOAD)

    body = res.json()
    assert body["passed_boolean"] is False
    assert body["gap_advisory"] is not None   # must be set on failure


# ── Threshold boundary tests ──────────────────────────────────────────────────

async def test_portfolio_eval_exact_threshold_passes(client):
    """Score exactly 0.85 must pass (>= not >)."""
    with patch(
        "app.services.llm_client.call_llm_json_with_system",
        new=AsyncMock(return_value={"confidence_score": 0.85, "gap_advisory": None}),
    ):
        res = await client.post("/llm/portfolio-eval", json=VALID_PAYLOAD)

    assert res.json()["passed_boolean"] is True


async def test_portfolio_eval_just_below_threshold_fails(client):
    """Score of 0.8499 must fail."""
    with patch(
        "app.services.llm_client.call_llm_json_with_system",
        new=AsyncMock(return_value={"confidence_score": 0.8499, "gap_advisory": "Close but missing trade-off evidence"}),
    ):
        res = await client.post("/llm/portfolio-eval", json=VALID_PAYLOAD)

    assert res.json()["passed_boolean"] is False


# ── Score clamping ────────────────────────────────────────────────────────────

async def test_portfolio_eval_clamps_score_above_1(client):
    """LLM returning score > 1.0 must be clamped to 1.0."""
    with patch(
        "app.services.llm_client.call_llm_json_with_system",
        new=AsyncMock(return_value={"confidence_score": 1.5, "gap_advisory": None}),
    ):
        res = await client.post("/llm/portfolio-eval", json=VALID_PAYLOAD)

    body = res.json()
    assert body["confidence_score"] <= 1.0
    assert body["passed_boolean"] is True


async def test_portfolio_eval_clamps_score_below_0(client):
    """LLM returning negative score must be clamped to 0.0."""
    with patch(
        "app.services.llm_client.call_llm_json_with_system",
        new=AsyncMock(return_value={"confidence_score": -0.5, "gap_advisory": "Very poor"}),
    ):
        res = await client.post("/llm/portfolio-eval", json=VALID_PAYLOAD)

    body = res.json()
    assert body["confidence_score"] == 0.0
    assert body["passed_boolean"] is False


# ── LLM prompt content ────────────────────────────────────────────────────────

async def test_portfolio_eval_includes_seam_code_in_prompt(client):
    """Seam code must appear in the prompt sent to Gemini."""
    mock = AsyncMock(return_value={"confidence_score": 0.90, "gap_advisory": None})
    with patch("app.services.llm_client.call_llm_json_with_system", new=mock):
        await client.post("/llm/portfolio-eval", json=VALID_PAYLOAD)

    prompt = mock.call_args.kwargs["prompt"]
    assert "A↔C" in prompt
    assert VALID_PAYLOAD["decision_points"][:50] in prompt


# ── Gap advisory defaults ─────────────────────────────────────────────────────

async def test_portfolio_eval_gap_advisory_default_on_missing_key(client):
    """LLM omitting gap_advisory on failure gets a default message."""
    with patch(
        "app.services.llm_client.call_llm_json_with_system",
        new=AsyncMock(return_value={"confidence_score": 0.60}),  # no gap_advisory key
    ):
        res = await client.post("/llm/portfolio-eval", json=VALID_PAYLOAD)

    body = res.json()
    assert body["passed_boolean"] is False
    assert body["gap_advisory"] is not None
    assert len(body["gap_advisory"]) > 0


# ── Validation ────────────────────────────────────────────────────────────────

async def test_portfolio_eval_empty_project_description_returns_422(client):
    res = await client.post("/llm/portfolio-eval", json={
        **VALID_PAYLOAD,
        "project_description": "   ",
    })
    assert res.status_code == 422


async def test_portfolio_eval_empty_decision_points_returns_422(client):
    res = await client.post("/llm/portfolio-eval", json={
        **VALID_PAYLOAD,
        "decision_points": "",
    })
    assert res.status_code == 422


async def test_portfolio_eval_missing_fields_returns_422(client):
    res = await client.post("/llm/portfolio-eval", json={"seam_code": "A↔C"})
    assert res.status_code == 422


# ── LLM failure ───────────────────────────────────────────────────────────────

async def test_portfolio_eval_llm_failure_returns_503(client):
    with patch(
        "app.services.llm_client.call_llm_json_with_system",
        new=AsyncMock(side_effect=Exception("Gemini rate limit")),
    ):
        res = await client.post("/llm/portfolio-eval", json=VALID_PAYLOAD)

    assert res.status_code == 503