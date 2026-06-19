"""
Service generator — drafts a structured marketplace listing for an expert.

Called by NestJS ListingsService when an expert requests AI-assisted service creation.
The expert reviews and edits the draft before publishing.

No threshold logic here — all fields are returned as-is from the LLM.
The suggested_price_vnd is 0 when scope is too vague to estimate; NestJS
surfaces this as a reminder for the expert to set a price manually.
"""

import logging
from app.services import llm_client
from app.services.prompt_loader import load_prompt
from app.models.requests import ServiceGenerateRequest
from app.models.responses import ServiceGenerateResponse

logger = logging.getLogger(__name__)

# Price sanity bounds (VND) — reject clearly hallucinated values
_MIN_PRICE_VND = 0
_MAX_PRICE_VND = 2_000_000_000   # 2 billion VND ≈ $80k — hard ceiling


async def generate(request: ServiceGenerateRequest) -> ServiceGenerateResponse:
    """
    Generate a structured service listing draft from expert capabilities and use cases.

    Args:
        request.expert_capabilities: list of skill/experience statements
        request.target_use_cases:    list of problems the expert can solve

    Returns:
        ServiceGenerateResponse — title, description, scope, timeline, suggested_price_vnd
    """
    system = load_prompt("service_generate")

    capabilities_block = "\n".join(
        f"- {cap.strip()}" for cap in request.expert_capabilities if cap.strip()
    )
    use_cases_block = "\n".join(
        f"- {uc.strip()}" for uc in request.target_use_cases if uc.strip()
    )

    user_prompt = (
        f"EXPERT CAPABILITIES:\n{capabilities_block}\n\n"
        f"TARGET USE CASES:\n{use_cases_block}\n\n"
        "Generate a compelling AI consulting service listing for this expert."
    )

    raw: dict = await llm_client.call_llm_json_with_system(
        prompt=user_prompt,
        system=system,
    )

    logger.debug("service_generate raw keys: %s", list(raw.keys()))

    # Parse and sanitise suggested_price_vnd
    try:
        raw_price = int(raw.get("suggested_price_vnd", 0))
        price_vnd = max(_MIN_PRICE_VND, min(_MAX_PRICE_VND, raw_price))
    except (TypeError, ValueError):
        logger.warning("Could not parse suggested_price_vnd: %s", raw.get("suggested_price_vnd"))
        price_vnd = 0

    return ServiceGenerateResponse(
        title=str(raw.get("title", "AI Consulting Service")).strip(),
        description=str(raw.get("description", "")).strip(),
        scope=str(raw.get("scope", "")).strip(),
        timeline=str(raw.get("timeline", "")).strip(),
        suggested_price_vnd=price_vnd,
    )