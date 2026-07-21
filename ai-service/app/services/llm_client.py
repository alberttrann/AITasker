import json
import logging
from typing import Any
from openai import AsyncOpenAI
from app.config import settings

logger = logging.getLogger(__name__)

def get_client() -> AsyncOpenAI:
    if not settings.active_api_key:
        raise RuntimeError("LLM API Key is not set in environment.")
    
    return AsyncOpenAI(
        api_key=settings.active_api_key,
        base_url=settings.llm_base_url
    )

async def call_llm_json_with_system(
    prompt: str,
    system: str,
    temperature: float | None = None,
    max_output_tokens: int | None = None,
) -> dict[str, Any]:
    client = get_client()
    temp = temperature if temperature is not None else settings.llm_temperature
    
    try:
        response = await client.chat.completions.create(
            model=settings.llm_model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt}
            ],
            temperature=temp,
            max_completion_tokens=max_output_tokens or settings.llm_max_output_tokens,
            response_format={"type": "json_object"}
        )
        raw = response.choices[0].message.content or ""
        return json.loads(raw)
    except Exception as exc:
        logger.error("LLM JSON call failed", exc_info=True)
        raise

async def call_llm_json(prompt: str, temperature: float | None = None, max_output_tokens: int | None = None) -> dict[str, Any]:
    return await call_llm_json_with_system(prompt, "You are a helpful AI assistant outputting strict JSON.", temperature, max_output_tokens)

async def call_llm_text(prompt: str, temperature: float | None = None) -> str:
    client = get_client()
    temp = temperature if temperature is not None else settings.llm_temperature
    response = await client.chat.completions.create(
        model=settings.llm_model,
        messages=[{"role": "user", "content": prompt}],
        temperature=temp,
        max_completion_tokens=settings.llm_max_output_tokens
    )
    return response.choices[0].message.content or ""
async def call_llm_with_system_and_messages(
    system: str,
    messages: list[dict],
    max_output_tokens: int = 1024,
) -> str:
    """
    Multi-turn chat: prepends a system message then sends the full conversation
    history to the model.

    Uses the same AsyncOpenAI client and settings as every other function
    in this module — no separate SDK needed.

    messages: list of {"role": "user"|"assistant", "content": "..."} dicts,
              in chronological order. The most recent user message should be
              the last entry.
    """
    client = get_client()

    full_messages = [{"role": "system", "content": system}] + messages

    response = await client.chat.completions.create(
        model=settings.llm_model,
        messages=full_messages,
        temperature=settings.llm_temperature,
        max_completion_tokens=max_output_tokens,
    )
    return response.choices[0].message.content or ""