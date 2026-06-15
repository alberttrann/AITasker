"""
LLM client — wraps Google Gemini via the google-genai SDK.

All ai-service endpoints call through this module.
Nothing else imports from google.genai directly.

Usage:
    from app.services.llm_client import call_llm_json_with_system, call_llm_text

    result: dict = await call_llm_json_with_system(
        prompt="...",
        system="You are...",
        temperature=0.0,
    )

CLIENT LIFECYCLE
----------------
genai.Client() is created fresh for each call rather than as a singleton.
This avoids async TLS connection cleanup races in test environments (especially
on Windows with ProactorEventLoop) where a stale internal httpx.AsyncClient
tries to close its connections against an already-transitioned event loop.

In production under uvicorn (single long-lived event loop) the overhead is
negligible: each call opens one TLS connection, LLM latency (~300-2000ms)
dwarfs connection setup (~30ms). For high-throughput scenarios a connection-
pooled singleton can be reintroduced via FastAPI lifespan management.
"""

import json
import logging
from typing import Any

from google import genai
from google.genai import types

from app.config import settings

logger = logging.getLogger(__name__)


# Client factory 

def get_client() -> genai.Client:
    """
    Create a Gemini client.

    Creates fresh per call — no singleton. Avoids async TLS cleanup issues
    where a module-level httpx.AsyncClient inside genai.Client holds open
    connections that fail to close cleanly across event loop transitions.
    """
    if not settings.gemini_api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY is not set. "
            "This env var holds the Gemini API key for the ai-service. "
            "Get a key at https://aistudio.google.com/app/apikey"
        )
    return genai.Client(api_key=settings.gemini_api_key)


# Primary call — structured JSON with system instruction 

async def call_llm_json_with_system(
    prompt:            str,
    system:            str,
    temperature:       float | None = None,
    max_output_tokens: int   | None = None,
) -> dict[str, Any]:
    """
    Call Gemini with a system instruction and return a parsed JSON dict.

    Uses response_mime_type='application/json' so the model is forced to emit
    valid JSON — no markdown fences, no preamble, no trailing text.

    Args:
        prompt:            User-turn content sent to the model.
        system:            System instruction (role, output contract, vocabulary).
        temperature:       Override global LLM_TEMPERATURE. Use 0.0 for
                           deterministic calls (criterion-check, dispute-eval).
        max_output_tokens: Override global LLM_MAX_OUTPUT_TOKENS.

    Raises:
        json.JSONDecodeError: if the model returns malformed JSON.
        google.genai.errors.APIError: on network/quota/auth failures.
    """
    client = get_client()

    config = types.GenerateContentConfig(
        system_instruction=system or None,
        temperature=temperature if temperature is not None else settings.llm_temperature,
        max_output_tokens=max_output_tokens or settings.llm_max_output_tokens,
        response_mime_type="application/json",
    )

    logger.debug(
        "call_llm_json_with_system model=%s temp=%s prompt_len=%d",
        settings.llm_model,
        temperature if temperature is not None else settings.llm_temperature,
        len(prompt),
    )

    response = await client.aio.models.generate_content(
        model=settings.llm_model,
        contents=prompt,
        config=config,
    )

    raw = response.text or ""
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.error(
            "Gemini returned invalid JSON.\nPrompt (first 300 chars): %s\nRaw response: %s",
            prompt[:300],
            raw[:500],
        )
        raise


# Secondary calls

async def call_llm_json(
    prompt:            str,
    temperature:       float | None = None,
    max_output_tokens: int   | None = None,
) -> dict[str, Any]:
    """
    Call Gemini without a system instruction and return a parsed JSON dict.
    Use call_llm_json_with_system instead when a system prompt is needed.
    """
    client = get_client()

    config = types.GenerateContentConfig(
        temperature=temperature if temperature is not None else settings.llm_temperature,
        max_output_tokens=max_output_tokens or settings.llm_max_output_tokens,
        response_mime_type="application/json",
    )

    response = await client.aio.models.generate_content(
        model=settings.llm_model,
        contents=prompt,
        config=config,
    )

    raw = response.text or ""
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.error("Gemini returned invalid JSON: %s", raw[:500])
        raise


async def call_llm_text(
    prompt:      str,
    temperature: float | None = None,
) -> str:
    """Call Gemini and return plain text (no JSON mode)."""
    client = get_client()

    config = types.GenerateContentConfig(
        temperature=temperature if temperature is not None else settings.llm_temperature,
        max_output_tokens=settings.llm_max_output_tokens,
    )

    response = await client.aio.models.generate_content(
        model=settings.llm_model,
        contents=prompt,
        config=config,
    )

    return response.text or ""