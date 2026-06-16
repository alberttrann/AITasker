"""
Service generator router — handles /llm/service-generate.

Registered in main.py as:
    app.include_router(service_gen.router, prefix="/llm", tags=["Service Generator"])

Endpoints:
    POST /llm/service-generate
"""

import logging
from fastapi import APIRouter, HTTPException, status

from app.models.requests import ServiceGenerateRequest
from app.models.responses import ServiceGenerateResponse
from app.services import service_generator

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/service-generate",
    response_model=ServiceGenerateResponse,
    summary="Generate a structured AI consulting service listing draft",
)
async def service_generate(request: ServiceGenerateRequest):
    """
    Called by NestJS ListingsService when an expert uses the AI-assist feature.

    Flow (NestJS side):
      1. Expert clicks 'Generate with AI' on the service creation form
      2. Frontend sends expert's capabilities + intended use cases to NestJS
      3. NestJS calls this endpoint
      4. Draft is pre-filled into the form; expert edits and publishes

    The generated draft is not persisted directly — the expert always reviews.
    suggested_price_vnd=0 means the LLM could not estimate from the scope given.
    """
    _validate_request(request)

    try:
        return await service_generator.generate(request)
    except Exception as exc:
        logger.exception("service_generate failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LLM service unavailable — retry in a moment",
        ) from exc


def _validate_request(request: ServiceGenerateRequest) -> None:
    errors = []

    non_empty_caps = [c for c in request.expert_capabilities if c.strip()]
    non_empty_ucs  = [u for u in request.target_use_cases if u.strip()]

    if not non_empty_caps:
        errors.append("expert_capabilities must contain at least one non-empty entry")
    if not non_empty_ucs:
        errors.append("target_use_cases must contain at least one non-empty entry")

    if errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=errors,
        )