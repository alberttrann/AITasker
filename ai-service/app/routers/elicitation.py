"""
Elicitation router — /llm/elicitation/* endpoints.

Registered in main.py as:
    app.include_router(elicitation.router, prefix="/llm/elicitation", tags=["Elicitation"])

Endpoints:
    POST /llm/elicitation/stage1-extract            
    POST /llm/elicitation/stage3-vagueness-check   
    POST /llm/elicitation/stage5-synthesize         
"""

import logging
from fastapi import APIRouter, HTTPException, status

from app.models.requests import Stage1Request, Stage3VaguenessCheckRequest, Stage5Request
from app.models.responses import Stage1Response, Stage3VaguenessCheckResponse, Stage5Response
from app.services import elicitation_engine

logger = logging.getLogger(__name__)
router = APIRouter()


# Stage 1 — symptom extraction + archetype recommendation

@router.post(
    "/stage1-extract",
    response_model=Stage1Response,
    summary="Extract symptoms, scale signals, voids, and recommended archetypes from CEO free-text input",
)
async def stage1_extract(request: Stage1Request):
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


# Stage 3 — vagueness check 

@router.post(
    "/stage3-vagueness-check",
    response_model=Stage3VaguenessCheckResponse,
    summary="Check Stage 3 behavioral probe answers for vagueness",
)
async def stage3_vagueness_check(request: Stage3VaguenessCheckRequest):
    """
    Called by NestJS ElicitationService.processStage3() before advancing to
    Stage 4. Fails OPEN internally (see elicitation_engine) — this endpoint
    itself only raises 503 on a genuine unhandled error, never on "the LLM
    didn't flag anything," which always returns 200 with an empty list.
    """
    if not request.archetype.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="archetype must not be empty",
        )
    if not request.probe_responses:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="probe_responses must not be empty",
        )
    try:
        return await elicitation_engine.stage3_vagueness_check(request)
    except Exception as exc:
        logger.exception("stage3_vagueness_check failed: %s", exc)
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