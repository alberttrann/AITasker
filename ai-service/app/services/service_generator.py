"""
Service generator — drafts a marketplace listing for an expert.
"""
import logging
from app.services import llm_client
from app.services.prompt_service import get_rendered_prompt
from app.models.requests import ServiceGenerateRequest
from app.models.responses import ServiceGenerateResponse

logger = logging.getLogger(__name__)

_MIN_PRICE_VND = 0
_MAX_PRICE_VND = 2_000_000_000


async def generate(request: ServiceGenerateRequest) -> ServiceGenerateResponse:
    # Build default price guidance if not provided
    price_guidance = request.price_guidance or {
        "small_min":  5_000_000,  "small_max":  15_000_000,
        "medium_min": 15_000_000, "medium_max": 50_000_000,
        "large_min":  50_000_000,
    }

    prompt_context = {
        "price_guidance":  price_guidance,
        "claimed_domains": request.claimed_domains,
        "claimed_seams":   request.claimed_seams,
        "is_pro_expert":   request.is_pro_expert,
    }

    system = await get_rendered_prompt("service_generate", prompt_context)

    capabilities_block = "\n".join(
        f"- {cap.strip()}" for cap in request.expert_capabilities if cap.strip()
    )
    use_cases_block = "\n".join(
        f"- {uc.strip()}" for uc in request.target_use_cases if uc.strip()
    )

    domain_block = ""
    if request.claimed_domains:
        domain_block = "\n\nEXPERT'S CLAIMED DOMAIN EXPERTISE:\n" + "\n".join(
            f"- {d.get('code','?')} ({d.get('name','?')}): {d.get('depth','?')} level"
            for d in request.claimed_domains
        )

    seam_block = ""
    if request.claimed_seams:
        seam_block = "\n\nEXPERT'S CLAIMED SEAM COMPETENCIES:\n" + "\n".join(
            f"- {s.get('code','?')} ({s.get('name','?')})"
            for s in request.claimed_seams
        )

    user_prompt = (
        f"EXPERT CAPABILITIES:\n{capabilities_block}\n\n"
        f"TARGET USE CASES:\n{use_cases_block}"
        f"{domain_block}"
        f"{seam_block}\n\n"
        "Generate a compelling AI consulting service listing."
    )

    raw: dict = await llm_client.call_llm_json_with_system(prompt=user_prompt, system=system)
    logger.debug("service_generate raw keys: %s", list(raw.keys()))

    try:
        raw_price = int(raw.get("suggested_price_vnd", 0))
        price_vnd = max(_MIN_PRICE_VND, min(_MAX_PRICE_VND, raw_price))
    except (TypeError, ValueError):
        price_vnd = 0

    return ServiceGenerateResponse(
        title=str(raw.get("title", "AI Consulting Service")).strip(),
        description=str(raw.get("description", "")).strip(),
        scope=str(raw.get("scope", "")).strip(),
        timeline=str(raw.get("timeline", "")).strip(),
        suggested_price_vnd=price_vnd,
        suggested_domains=raw.get("suggested_domains", []),
        suggested_seams=raw.get("suggested_seams", []),
        pricing_rationale=str(raw.get("pricing_rationale", "")).strip(),
    )