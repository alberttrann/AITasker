"""
Tests for POST /llm/dispute-eval

Key invariants tested:
  - finding validated to "expert_wins" | "client_wins" only
  - invalid finding defaults to "client_wins" (conservative — protects client)
  - files are included in the prompt when provided
  - score clamped to [0.0, 1.0]
  - temperature=0.0 enforced for deterministic arbitration
  - threshold logic is NOT in ai-service (NestJS decides AUTO_RESOLVED vs MANUAL_REVIEW)
"""

import pytest
from unittest.mock import AsyncMock, patch


# ── Fixtures ──────────────────────────────────────────────────────────────────

VALID_PAYLOAD = {
    "criterion_text": (
        "The recommendation endpoint must return HTTP 200 with a JSON array "
        "of at least 5 product IDs within 500ms for 95% of requests under 1000 RPS load."
    ),
    "deliverable_description": (
        "Implemented /api/recommendations endpoint. Load tested with k6: "
        "p95 latency = 312ms at 1000 RPS. Returns array of 8 product IDs. "
        "All 200 test requests returned HTTP 200."
    ),
    "files": [],
}


# ── Happy path — expert wins ──────────────────────────────────────────────────

async def test_dispute_eval_expert_wins_high_confidence(client):
    """Clear criterion match → expert_wins with high confidence."""
    with patch(
        "app.services.llm_client.call_llm_json_with_system",
        new=AsyncMock(return_value={
            "confidence_score": 0.94,
            "finding": "expert_wins",
        }),
    ):
        res = await client.post("/llm/dispute-eval", json=VALID_PAYLOAD)

    assert res.status_code == 200
    body = res.json()
    assert body["finding"] == "expert_wins"
    assert body["confidence_score"] == 0.94


async def test_dispute_eval_client_wins_high_confidence(client):
    """Clear criterion miss → client_wins with high confidence."""
    with patch(
        "app.services.llm_client.call_llm_json_with_system",
        new=AsyncMock(return_value={
            "confidence_score": 0.88,
            "finding": "client_wins",
        }),
    ):
        res = await client.post("/llm/dispute-eval", json={
            **VALID_PAYLOAD,
            "deliverable_description": "Endpoint deployed but no load test was performed.",
        })

    body = res.json()
    assert body["finding"] == "client_wins"
    assert body["confidence_score"] == 0.88


async def test_dispute_eval_low_confidence_returns_correctly(client):
    """
    Low confidence (< 0.80) is returned as-is — NestJS decides MANUAL_REVIEW.
    The ai-service does NOT apply the threshold — that is NestJS's responsibility.
    """
    with patch(
        "app.services.llm_client.call_llm_json_with_system",
        new=AsyncMock(return_value={
            "confidence_score": 0.55,
            "finding": "client_wins",
        }),
    ):
        res = await client.post("/llm/dispute-eval", json=VALID_PAYLOAD)

    body = res.json()
    # ai-service just returns the values — no threshold blocking
    assert body["confidence_score"] == 0.55
    assert body["finding"] == "client_wins"
    assert res.status_code == 200


# ── Conservative default — invalid finding ────────────────────────────────────

async def test_dispute_eval_invalid_finding_defaults_to_client_wins(client):
    """
    Unexpected finding value defaults to client_wins.
    Conservative: ambiguous/broken LLM output should not release expert payment.
    """
    with patch(
        "app.services.llm_client.call_llm_json_with_system",
        new=AsyncMock(return_value={
            "confidence_score": 0.85,
            "finding": "draw",          # not a valid finding
        }),
    ):
        res = await client.post("/llm/dispute-eval", json=VALID_PAYLOAD)

    assert res.json()["finding"] == "client_wins"


async def test_dispute_eval_missing_finding_key_defaults_to_client_wins(client):
    """Missing finding key → client_wins default."""
    with patch(
        "app.services.llm_client.call_llm_json_with_system",
        new=AsyncMock(return_value={"confidence_score": 0.80}),
    ):
        res = await client.post("/llm/dispute-eval", json=VALID_PAYLOAD)

    assert res.json()["finding"] == "client_wins"


# ── Files in prompt ───────────────────────────────────────────────────────────

async def test_dispute_eval_files_included_in_prompt(client):
    """File URLs must appear in the prompt sent to Gemini."""
    file_urls = [
        "https://storage.example.com/deliverable/load-test-report.pdf",
        "https://storage.example.com/deliverable/screenshot.png",
    ]
    mock = AsyncMock(return_value={"confidence_score": 0.88, "finding": "expert_wins"})
    with patch("app.services.llm_client.call_llm_json_with_system", new=mock):
        await client.post("/llm/dispute-eval", json={
            **VALID_PAYLOAD,
            "files": file_urls,
        })

    prompt = mock.call_args.kwargs["prompt"]
    assert file_urls[0] in prompt
    assert file_urls[1] in prompt


async def test_dispute_eval_empty_files_list_no_files_section_in_prompt(client):
    """Empty files list → no FILES SUBMITTED section in prompt."""
    mock = AsyncMock(return_value={"confidence_score": 0.88, "finding": "expert_wins"})
    with patch("app.services.llm_client.call_llm_json_with_system", new=mock):
        await client.post("/llm/dispute-eval", json=VALID_PAYLOAD)

    prompt = mock.call_args.kwargs["prompt"]
    assert "FILES SUBMITTED" not in prompt


# ── Temperature enforcement ───────────────────────────────────────────────────

async def test_dispute_eval_uses_zero_temperature(client):
    """Dispute arbitration must be deterministic — temperature=0.0 required."""
    mock = AsyncMock(return_value={"confidence_score": 0.88, "finding": "expert_wins"})
    with patch("app.services.llm_client.call_llm_json_with_system", new=mock):
        await client.post("/llm/dispute-eval", json=VALID_PAYLOAD)

    assert mock.call_args.kwargs.get("temperature") == 0.0


# ── Score clamping ────────────────────────────────────────────────────────────

async def test_dispute_eval_clamps_score_above_1(client):
    with patch(
        "app.services.llm_client.call_llm_json_with_system",
        new=AsyncMock(return_value={"confidence_score": 1.8, "finding": "expert_wins"}),
    ):
        res = await client.post("/llm/dispute-eval", json=VALID_PAYLOAD)

    assert res.json()["confidence_score"] <= 1.0


async def test_dispute_eval_clamps_score_below_0(client):
    with patch(
        "app.services.llm_client.call_llm_json_with_system",
        new=AsyncMock(return_value={"confidence_score": -0.3, "finding": "client_wins"}),
    ):
        res = await client.post("/llm/dispute-eval", json=VALID_PAYLOAD)

    assert res.json()["confidence_score"] == 0.0


# ── Validation ────────────────────────────────────────────────────────────────

async def test_dispute_eval_empty_criterion_returns_422(client):
    res = await client.post("/llm/dispute-eval", json={
        **VALID_PAYLOAD,
        "criterion_text": "   ",
    })
    assert res.status_code == 422


async def test_dispute_eval_empty_deliverable_returns_422(client):
    res = await client.post("/llm/dispute-eval", json={
        **VALID_PAYLOAD,
        "deliverable_description": "",
    })
    assert res.status_code == 422


async def test_dispute_eval_missing_both_fields_returns_422(client):
    res = await client.post("/llm/dispute-eval", json={})
    assert res.status_code == 422


# ── LLM failure ───────────────────────────────────────────────────────────────

async def test_dispute_eval_llm_failure_returns_503(client):
    with patch(
        "app.services.llm_client.call_llm_json_with_system",
        new=AsyncMock(side_effect=Exception("Gemini timeout")),
    ):
        res = await client.post("/llm/dispute-eval", json=VALID_PAYLOAD)

    assert res.status_code == 503