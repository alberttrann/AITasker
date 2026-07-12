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

def _parse_scope(raw_scope) -> list[str]:
    """
    Coerce scope to list[str] regardless of what the LLM returned.
    Handles: proper list, Python-repr string, comma-separated string,
    newline-separated string, bare string.
    """
    if isinstance(raw_scope, list):
        # Happy path — LLM followed instructions
        return [str(item).strip() for item in raw_scope if str(item).strip()]

    if not isinstance(raw_scope, str):
        return []

    s = raw_scope.strip()

    # Strip Python list repr: "['a', 'b']" → "a', 'b"
    if s.startswith("[") and s.endswith("]"):
        import ast
        try:
            parsed = ast.literal_eval(s)
            if isinstance(parsed, list):
                return [str(i).strip() for i in parsed if str(i).strip()]
        except Exception:
            pass
        # Fallback: strip brackets and split on "', '"
        s = s[1:-1]

    # Split on newline or comma+space
    if "\n" in s:
        items = s.split("\n")
    else:
        items = s.split(",")

    # Strip quotes and whitespace from each item
    cleaned = []
    for item in items:
        item = item.strip().strip("'\"").strip()
        if item:
            cleaned.append(item)
    return cleaned


def _sanitise_timeline(raw_timeline) -> str:
    """
    Ensure timeline is a newline-separated string, not comma-separated.
    Leaves well-formed strings alone.
    """
    if not isinstance(raw_timeline, str):
        return str(raw_timeline).strip()

    t = raw_timeline.strip()

    # Already has newlines — good
    if "\n" in t:
        return t


    import re
    # Insert newline before each "Phase N:" and before "Total Estimated Time:"
    t = re.sub(r",?\s*(Phase\s+\d+:)", r'\n\1', t) 
    t = re.sub(r",?\s*(Total Estimated Time:)", r'\nTotal Estimated Time:', t) 
    return t.strip()


async def generate(request: ServiceGenerateRequest) -> ServiceGenerateResponse:
    """
    Generate a structured service listing draft from expert capabilities and use cases.
    """
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

    # Fetch and render the DB-backed prompt template dynamically (Jinja2)
    system = await get_rendered_prompt("service_generate", prompt_context)

    capabilities_block = "\n".join(
        f"- {cap.strip()}" for cap in request.expert_capabilities if cap.strip()
    )
    use_cases_block = "\n".join(
        f"- {uc.strip()}" for uc in request.target_use_cases if uc.strip()
    )

    # Inject expert context if provided (from our AI context patch)
    expert_context_block = ""
    if getattr(request, "claimed_domains", None):
        expert_context_block += "\nEXPERT DOMAINS:\n" + "\n".join(
            f"- {d}" for d in request.claimed_domains
        )
    if getattr(request, "claimed_seams", None):
        expert_context_block += "\nEXPERT SEAMS:\n" + "\n".join(
            f"- {s}" for s in request.claimed_seams
        )

    user_prompt = (
        f"EXPERT CAPABILITIES:\n{capabilities_block}\n\n"
        f"TARGET USE CASES:\n{use_cases_block}\n"
        f"{expert_context_block}\n"
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

    scope   = _parse_scope(raw.get("scope", []))
    timeline = _sanitise_timeline(raw.get("timeline", ""))

    return ServiceGenerateResponse(
        title=str(raw.get("title", "AI Consulting Service")).strip(),
        description=str(raw.get("description", "")).strip(),
        scope=scope,
        timeline=timeline,
        suggested_price_vnd=price_vnd,
        suggested_domains=raw.get("suggested_domains", []),
        suggested_seams=raw.get("suggested_seams", []),
        pricing_rationale=str(raw.get("pricing_rationale", "")).strip(),
    )