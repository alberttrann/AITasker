"""
Criteria router — handles /llm/criterion-check.

Registered in main.py as:
    app.include_router(criteria.router, prefix="/llm", tags=["Criteria"])

Endpoints:
    POST /llm/criterion-check
"""

import logging
from fastapi import APIRouter, HTTPException, status

from app.models.requests import CriterionCheckRequest
from app.models.responses import CriterionCheckResponse
from app.services import llm_client
from app.services.prompt_loader import load_prompt

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/criterion-check",
    response_model=CriterionCheckResponse,
    summary="Detect subjective language in an acceptance criterion",
)
async def criterion_check(request: CriterionCheckRequest):
    """
    Called by NestJS MilestonesService when an acceptance criterion is saved.

    Returns:
        is_subjective: True if the criterion uses unmeasurable language
        suggestions: concrete rewritten versions if subjective, empty if already objective

    This is advisory only — the criterion is saved regardless. NestJS surfaces
    the advisory_note to the author via platform_decisions table.
    """
    if not request.criterion_text.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="criterion_text must not be empty",
        )

    system = load_prompt("criterion_check")

    try:
        raw: dict = await llm_client.call_llm_json_with_system(
            prompt=f'Criterion to evaluate:\n"{request.criterion_text.strip()}"',
            system=system,
            temperature=0.0,   # zero temperature — deterministic for advisory checks
        )
    except Exception as exc:
        logger.exception("criterion_check LLM call failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LLM service unavailable — retry in a moment",
        ) from exc

    return CriterionCheckResponse(
        is_subjective=bool(raw.get("is_subjective", False)),
        suggestions=raw.get("suggestions", []),
    )