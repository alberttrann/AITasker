"""
Tests for POST /llm/service-generate

Key invariants tested:
  - All 5 response fields always present
  - suggested_price_vnd is always a non-negative integer
  - Price sanity bounds enforced (0 ≤ price ≤ 2,000,000,000)
  - Empty/whitespace-only capabilities → 422
  - Empty/whitespace-only use_cases → 422
  - Expert's capabilities and use cases appear in the prompt
  - LLM failure → 503
  - Partial/missing LLM fields get safe defaults (empty string / 0)
  - Unparseable price (string) → defaults to 0
"""

import pytest
from unittest.mock import AsyncMock, patch


# ── Fixtures ──────────────────────────────────────────────────────────────────

VALID_PAYLOAD = {
    "expert_capabilities": [
        "5 years building RAG pipelines for enterprise knowledge bases",
        "Expert in LangChain, LlamaIndex and custom retrieval architectures",
        "Deep experience with vector databases: Pinecone, Weaviate, pgvector",
        "Delivered 3 production RAG systems with >10k daily queries",
    ],
    "target_use_cases": [
        "Companies wanting to make internal documentation searchable via AI",
        "Legal firms needing case-law retrieval assistants",
        "E-commerce brands building product discovery AI",
    ],
}

FULL_LLM_RESPONSE = {
    "title": "Production RAG Pipeline Design & Implementation",
    "description": (
        "I build reliable, production-grade Retrieval-Augmented Generation systems "
        "that make your organisation's knowledge instantly queryable. Specialising in "
        "enterprise knowledge bases, legal research, and product discovery."
    ),
    "scope": (
        "Included: requirements workshop, architecture design, pipeline implementation, "
        "vector DB setup, evaluation framework, deployment guide.\n"
        "Not included: data labelling, model fine-tuning, ongoing maintenance."
    ),
    "timeline": "4 weeks: Week 1 discovery, Week 2-3 implementation, Week 4 testing & handover",
    "suggested_price_vnd": 45_000_000,
}


# ── Happy path ────────────────────────────────────────────────────────────────

async def test_service_generate_returns_all_fields(client):
    """All 5 response fields present and correctly typed."""
    with patch(
        "app.services.llm_client.call_llm_json_with_system",
        new=AsyncMock(return_value=FULL_LLM_RESPONSE),
    ):
        res = await client.post("/llm/service-generate", json=VALID_PAYLOAD)

    assert res.status_code == 200
    body = res.json()
    assert "title"               in body
    assert "description"         in body
    assert "scope"               in body
    assert "timeline"            in body
    assert "suggested_price_vnd" in body


async def test_service_generate_correct_field_values(client):
    """Response values match the LLM output."""
    with patch(
        "app.services.llm_client.call_llm_json_with_system",
        new=AsyncMock(return_value=FULL_LLM_RESPONSE),
    ):
        res = await client.post("/llm/service-generate", json=VALID_PAYLOAD)

    body = res.json()
    assert body["title"]               == FULL_LLM_RESPONSE["title"]
    assert body["suggested_price_vnd"] == 45_000_000
    assert "Retrieval-Augmented Generation" in body["description"]


async def test_service_generate_price_is_integer(client):
    """suggested_price_vnd must always be an integer, never a float."""
    with patch(
        "app.services.llm_client.call_llm_json_with_system",
        new=AsyncMock(return_value={**FULL_LLM_RESPONSE, "suggested_price_vnd": 12_500_000.99}),
    ):
        res = await client.post("/llm/service-generate", json=VALID_PAYLOAD)

    body = res.json()
    assert isinstance(body["suggested_price_vnd"], int)


# ── Price sanity bounds ───────────────────────────────────────────────────────

async def test_service_generate_price_zero_when_scope_unclear(client):
    """LLM returning 0 for price is valid — means scope too vague to estimate."""
    with patch(
        "app.services.llm_client.call_llm_json_with_system",
        new=AsyncMock(return_value={**FULL_LLM_RESPONSE, "suggested_price_vnd": 0}),
    ):
        res = await client.post("/llm/service-generate", json=VALID_PAYLOAD)

    assert res.status_code == 200
    assert res.json()["suggested_price_vnd"] == 0


async def test_service_generate_price_clamped_at_ceiling(client):
    """Hallucinated price above 2 billion VND is clamped."""
    with patch(
        "app.services.llm_client.call_llm_json_with_system",
        new=AsyncMock(return_value={**FULL_LLM_RESPONSE, "suggested_price_vnd": 999_999_999_999}),
    ):
        res = await client.post("/llm/service-generate", json=VALID_PAYLOAD)

    assert res.json()["suggested_price_vnd"] == 2_000_000_000


async def test_service_generate_negative_price_clamped_to_zero(client):
    """Negative price clamped to 0."""
    with patch(
        "app.services.llm_client.call_llm_json_with_system",
        new=AsyncMock(return_value={**FULL_LLM_RESPONSE, "suggested_price_vnd": -5_000_000}),
    ):
        res = await client.post("/llm/service-generate", json=VALID_PAYLOAD)

    assert res.json()["suggested_price_vnd"] == 0


async def test_service_generate_unparseable_price_defaults_to_zero(client):
    """LLM returning a string price (e.g. '15M') defaults to 0 without crashing."""
    with patch(
        "app.services.llm_client.call_llm_json_with_system",
        new=AsyncMock(return_value={**FULL_LLM_RESPONSE, "suggested_price_vnd": "15 million VND"}),
    ):
        res = await client.post("/llm/service-generate", json=VALID_PAYLOAD)

    assert res.status_code == 200
    assert res.json()["suggested_price_vnd"] == 0


# ── Prompt content verification ───────────────────────────────────────────────

async def test_service_generate_capabilities_in_prompt(client):
    """Each capability must appear in the prompt sent to Gemini."""
    mock = AsyncMock(return_value=FULL_LLM_RESPONSE)
    with patch("app.services.llm_client.call_llm_json_with_system", new=mock):
        await client.post("/llm/service-generate", json=VALID_PAYLOAD)

    prompt = mock.call_args.kwargs["prompt"]
    for cap in VALID_PAYLOAD["expert_capabilities"]:
        assert cap in prompt, f"Capability missing from prompt: {cap}"


async def test_service_generate_use_cases_in_prompt(client):
    """Each use case must appear in the prompt sent to Gemini."""
    mock = AsyncMock(return_value=FULL_LLM_RESPONSE)
    with patch("app.services.llm_client.call_llm_json_with_system", new=mock):
        await client.post("/llm/service-generate", json=VALID_PAYLOAD)

    prompt = mock.call_args.kwargs["prompt"]
    for uc in VALID_PAYLOAD["target_use_cases"]:
        assert uc in prompt, f"Use case missing from prompt: {uc}"


# ── Partial/missing LLM fields ────────────────────────────────────────────────

async def test_service_generate_missing_title_defaults_to_empty_string(client):
    """LLM omitting title gets a default — does not crash."""
    with patch(
        "app.services.llm_client.call_llm_json_with_system",
        new=AsyncMock(return_value={
            "description": "AI service",
            "scope": "TBD",
            "timeline": "2 weeks",
            "suggested_price_vnd": 10_000_000,
            # "title" is missing
        }),
    ):
        res = await client.post("/llm/service-generate", json=VALID_PAYLOAD)

    assert res.status_code == 200
    # Default title applied
    assert res.json()["title"] == "AI Consulting Service"


async def test_service_generate_missing_price_defaults_to_zero(client):
    """LLM omitting price → 0."""
    with patch(
        "app.services.llm_client.call_llm_json_with_system",
        new=AsyncMock(return_value={
            "title": "RAG Service",
            "description": "desc",
            "scope": "scope",
            "timeline": "4 weeks",
            # "suggested_price_vnd" is missing
        }),
    ):
        res = await client.post("/llm/service-generate", json=VALID_PAYLOAD)

    assert res.status_code == 200
    assert res.json()["suggested_price_vnd"] == 0


async def test_service_generate_whitespace_fields_stripped(client):
    """Whitespace in LLM string fields is stripped."""
    with patch(
        "app.services.llm_client.call_llm_json_with_system",
        new=AsyncMock(return_value={
            **FULL_LLM_RESPONSE,
            "title": "  RAG Pipeline Service   ",
            "description": "   Enterprise RAG   ",
        }),
    ):
        res = await client.post("/llm/service-generate", json=VALID_PAYLOAD)

    body = res.json()
    assert body["title"] == "RAG Pipeline Service"
    assert body["description"] == "Enterprise RAG"


# ── Validation ────────────────────────────────────────────────────────────────

async def test_service_generate_empty_capabilities_list_returns_422(client):
    """Empty capabilities list must be rejected."""
    res = await client.post("/llm/service-generate", json={
        **VALID_PAYLOAD,
        "expert_capabilities": [],
    })
    assert res.status_code == 422


async def test_service_generate_whitespace_only_capabilities_returns_422(client):
    """List of blank strings counts as empty — must be rejected."""
    res = await client.post("/llm/service-generate", json={
        **VALID_PAYLOAD,
        "expert_capabilities": ["   ", "  "],
    })
    assert res.status_code == 422


async def test_service_generate_empty_use_cases_returns_422(client):
    """Empty use cases list must be rejected."""
    res = await client.post("/llm/service-generate", json={
        **VALID_PAYLOAD,
        "target_use_cases": [],
    })
    assert res.status_code == 422


async def test_service_generate_missing_both_fields_returns_422(client):
    """Missing both required fields → 422."""
    res = await client.post("/llm/service-generate", json={})
    assert res.status_code == 422


# ── LLM failure ───────────────────────────────────────────────────────────────

async def test_service_generate_llm_failure_returns_503(client):
    with patch(
        "app.services.llm_client.call_llm_json_with_system",
        new=AsyncMock(side_effect=Exception("Gemini unavailable")),
    ):
        res = await client.post("/llm/service-generate", json=VALID_PAYLOAD)

    assert res.status_code == 503
    assert "unavailable" in res.json()["detail"].lower()