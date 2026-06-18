"""
Tests for POST /llm/criterion-check

All tests mock the Gemini client — no real API key required.
"""

import pytest
from unittest.mock import AsyncMock, patch


# ── Happy path — subjective criterion ────────────────────────────────────────

async def test_criterion_check_detects_subjective_language(client):
    """Vague qualifiers should be flagged as subjective."""
    with patch(
        "app.services.llm_client.call_llm_json_with_system",
        new=AsyncMock(return_value={
            "is_subjective": True,
            "suggestions": [
                "Response time must be under 200ms for 95th percentile of requests",
                "At least 90% of test cases pass the defined acceptance suite",
            ],
        }),
    ):
        res = await client.post(
            "/llm/criterion-check",
            json={"criterion_text": "The system should respond quickly and accurately"},
        )

    assert res.status_code == 200
    body = res.json()
    assert body["is_subjective"] is True
    assert len(body["suggestions"]) == 2
    assert "200ms" in body["suggestions"][0]


async def test_criterion_check_objective_criterion_returns_false(client):
    """Measurable criteria should not be flagged."""
    with patch(
        "app.services.llm_client.call_llm_json_with_system",
        new=AsyncMock(return_value={
            "is_subjective": False,
            "suggestions": [],
        }),
    ):
        res = await client.post(
            "/llm/criterion-check",
            json={"criterion_text": "API endpoint returns HTTP 200 within 150ms for 99% of requests under 1000 RPS"},
        )

    assert res.status_code == 200
    body = res.json()
    assert body["is_subjective"] is False
    assert body["suggestions"] == []


async def test_criterion_check_uses_zero_temperature(client):
    """criterion-check must use temperature=0.0 for deterministic results."""
    mock = AsyncMock(return_value={"is_subjective": False, "suggestions": []})
    with patch("app.services.llm_client.call_llm_json_with_system", new=mock):
        await client.post(
            "/llm/criterion-check",
            json={"criterion_text": "The model achieves at least 85% F1 score on the holdout set"},
        )

    assert mock.called
    call_kwargs = mock.call_args.kwargs
    assert call_kwargs.get("temperature") == 0.0


async def test_criterion_check_passes_criterion_text_in_prompt(client):
    """The criterion text must appear in the prompt sent to Gemini."""
    criterion = "Recall must be above 0.9 on the validation dataset"
    mock = AsyncMock(return_value={"is_subjective": False, "suggestions": []})
    with patch("app.services.llm_client.call_llm_json_with_system", new=mock):
        await client.post(
            "/llm/criterion-check",
            json={"criterion_text": criterion},
        )

    prompt_sent = mock.call_args.kwargs["prompt"]
    assert criterion in prompt_sent


# ── Validation ────────────────────────────────────────────────────────────────

async def test_criterion_check_empty_text_returns_422(client):
    """Empty criterion text should be rejected before the LLM call."""
    res = await client.post(
        "/llm/criterion-check",
        json={"criterion_text": "   "},
    )
    assert res.status_code == 422


async def test_criterion_check_missing_field_returns_422(client):
    """Missing criterion_text field returns 422."""
    res = await client.post("/llm/criterion-check", json={})
    assert res.status_code == 422


# ── LLM failure handling ──────────────────────────────────────────────────────

async def test_criterion_check_llm_failure_returns_503(client):
    """LLM API failure should return 503."""
    with patch(
        "app.services.llm_client.call_llm_json_with_system",
        new=AsyncMock(side_effect=RuntimeError("Gemini quota exceeded")),
    ):
        res = await client.post(
            "/llm/criterion-check",
            json={"criterion_text": "The model accuracy must exceed 80%"},
        )

    assert res.status_code == 503


# ── Partial LLM response handling ────────────────────────────────────────────

async def test_criterion_check_missing_suggestions_key_defaults_to_empty(client):
    """LLM omitting suggestions key should not crash."""
    with patch(
        "app.services.llm_client.call_llm_json_with_system",
        new=AsyncMock(return_value={"is_subjective": True}),  # missing suggestions
    ):
        res = await client.post(
            "/llm/criterion-check",
            json={"criterion_text": "The system should be good"},
        )

    assert res.status_code == 200
    assert res.json()["suggestions"] == []