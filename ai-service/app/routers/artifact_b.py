"""
Artifact B router — handles /projects/{project_id}/artifact-b.

Registered in main.py as:
    app.include_router(artifact_b.router, prefix="/projects", tags=["Artifact B"])

Endpoints:
    GET /projects/{project_id}/artifact-b
"""

import logging
from fastapi import APIRouter, HTTPException, Query, status

from app.guards.artifact_b_guard import check

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/{project_id}/artifact-b",
    summary="Gate check — can this expert access the technical specification?",
)
async def artifact_b_gate(
    project_id:           str,
    engagement_state:     str  = Query(..., description="Current engagement state"),
    bid_state:            str  = Query(..., description="Current bid state"),
    expert_nda_accepted:  bool = Query(..., description="Has expert accepted NDA?"),
    ceo_nda_accepted:     bool = Query(..., description="Has CEO accepted NDA?"),
):
    """
    Called by NestJS ProjectsService before returning artifact_b_json to an expert.

    NestJS flow:
      1. Expert calls GET /projects/{id} (NestJS endpoint)
      2. NestJS fetches engagement + bid state from DB
      3. NestJS calls this endpoint with context
      4. If 200: NestJS includes artifact_b_json in the response
      5. If 403: NestJS returns project without artifact_b_json

    All 4 conditions must be true simultaneously.
    The first failing condition is returned as the denial reason.
    """
    result = check(
        engagement_state=engagement_state,
        bid_state=bid_state,
        expert_nda_accepted=expert_nda_accepted,
        ceo_nda_accepted=ceo_nda_accepted,
    )

    if not result.allowed:
        logger.info(
            "Artifact B denied for project=%s engagement=%s bid=%s reason=%s",
            project_id, engagement_state, bid_state, result.reason,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=result.reason,
        )

    return {
        "project_id":           project_id,
        "artifact_b_accessible": True,
    }