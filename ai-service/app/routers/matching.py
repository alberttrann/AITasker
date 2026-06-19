"""
Matching router — handles /llm/matching.

Registered in main.py as:
    app.include_router(matching.router, prefix="/llm", tags=["Matching"])

Endpoints:
    POST /llm/matching
"""

import logging
from fastapi import APIRouter, HTTPException, status

from app.models.requests  import MatchingRequest
from app.models.responses import MatchResult
from app.services import matching_engine

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/matching",
    response_model=list[MatchResult],
    summary="Score and rank expert profiles against project requirements",
)
async def match_experts(request: MatchingRequest):
    """
    Called by NestJS ProjectsService when a CEO project is published.

    Scores each expert in expert_profiles using a 5-dimension composite:
      40% seam coverage (weighted by criticality)
      25% domain depth match
      20% portfolio evaluation quality
      10% archetype history match
       5% engagement model compat (always 1.0 — NestJS pre-filters)

    Returns experts sorted by composite_score descending.
    NestJS displays the top N results in the CEO shortlist view.

    Returns an empty list (not an error) if no experts were provided.
    """
    if not request.required_seams_json and not request.required_domains_json:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one of required_seams_json or required_domains_json must be non-empty",
        )

    try:
        return await matching_engine.rank_experts(request)
    except Exception as exc:
        logger.exception("matching failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Matching service error — retry in a moment",
        ) from exc