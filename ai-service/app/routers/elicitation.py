"""
Elicitation router — /llm/elicitation/* endpoints.

Registered in main.py as:
    app.include_router(elicitation.router, prefix="/llm/elicitation", tags=["Elicitation"])

Endpoints:
    POST /llm/elicitation/stage1-extract      ← Part 2 ✓
    POST /llm/elicitation/stage5-synthesize   ← Part 5 ✓
"""

import logging
from fastapi import APIRouter, HTTPException, status

from app.models.requests import Stage1Request, Stage5Request
from app.models.responses import Stage1Response, Stage5Response
from app.services import elicitation_engine

logger = logging.getLogger(__name__)
router = APIRouter()


# Stage 1 — symptom extraction

@router.post(
    "/stage1-extract",
    response_model=Stage1Response,
    summary="Extract symptoms, scale signals and voids from CEO free-text input",
)
async def stage1_extract(request: Stage1Request):
    """
    Called by NestJS ElicitationService after CEO submits Stage 1 text.
    Returns an empty structure (not an error) if input is sparse.
    NestJS decides whether to prompt the CEO for more detail.
    """
    if not request.symptom_text.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="symptom_text must not be empty",
        )
    try:
        return await elicitation_engine.stage1_extract(request)
    except Exception as exc:
        logger.exception("stage1_extract failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LLM service unavailable — retry in a moment",
        ) from exc


# Stage 5 — full project synthesis

@router.post(
    "/stage5-synthesize",
    response_model=Stage5Response,
    summary="Synthesise complete project spec from all 4 elicitation stages",
)
async def stage5_synthesize(request: Stage5Request):
    """
    Called by NestJS ElicitationService when the CEO completes Stage 4.

    Flow (NestJS side after success):
      1. Write required_seams_json + required_domains_json to projects table
      2. Write milestone_framework_json to projects table
      3. Write artifact_a_json to projects table (CEO-visible)
      4. Write artifact_b_json to projects table (expert-only, gated until TECH_APPROVED bid)
      5. Write completeness_score to platform_decisions
      6. If completeness_score < 0.70:
            project.state = RETURNED_TO_CLIENT (CEO must add more detail)
         else:
            project.state = PUBLISHED (visible to experts)
    """
    if not request.session_id.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="session_id must not be empty",
        )
    if not request.stage1_symptoms:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="stage1_symptoms must not be empty — run stage1-extract first",
        )

    try:
        return await elicitation_engine.stage5_synthesize(request)
    except Exception as exc:
        logger.exception("stage5_synthesize failed for session=%s: %s", request.session_id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LLM service unavailable — retry in a moment",
        ) from exc