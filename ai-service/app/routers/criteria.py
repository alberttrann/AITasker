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
from app.services.prompt_service import get_rendered_prompt

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/criterion-check",
    response_model=CriterionCheckResponse,
    summary="Detect subjective language in an acceptance criterion",
)

async def criterion_check(request: CriterionCheckRequest):
    if not request.criterion_text.strip():
        raise HTTPException(status_code=422, detail="criterion_text must not be empty")

    context = {
        "archetype_name": request.archetype_name or "General AI project",
    }
    system = await get_rendered_prompt("criterion_check", context)

    context_line = ""
    if request.milestone_context:
        context_line = f"\nMILESTONE CONTEXT: {request.milestone_context}"
    if request.archetype_name:
        context_line += f"\nPROJECT TYPE: {request.archetype_name}"

    try:
        raw: dict = await llm_client.call_llm_json_with_system(
            prompt=f'Criterion to evaluate:\n"{request.criterion_text.strip()}"{context_line}',
            system=system,
            temperature=0.0,
        )
    except Exception as exc:
        logger.exception("criterion_check LLM call failed: %s", exc)
        raise HTTPException(status_code=503, detail="LLM service unavailable") from exc

    return CriterionCheckResponse(
        is_subjective=bool(raw.get("is_subjective", False)),
        suggestions=raw.get("suggestions", []),
        severity=raw.get("severity", "LOW") if raw.get("is_subjective") else "LOW",
        context_note=raw.get("context_note"),
    )