"""
Portfolio router — handles /llm/portfolio-eval.

Registered in main.py as:
    app.include_router(portfolio.router, prefix="/llm", tags=["Portfolio"])

Endpoints:
    POST /llm/portfolio-eval
"""

import logging
from fastapi import APIRouter, HTTPException, status

from app.models.requests import PortfolioEvalRequest
from app.models.responses import PortfolioEvalResponse
from app.services import portfolio_evaluator

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/portfolio-eval",
    response_model=PortfolioEvalResponse,
    summary="Evaluate expert portfolio submission for seam-boundary competency",
)
async def portfolio_eval(request: PortfolioEvalRequest):
    """
    Called by NestJS PortfolioService after an expert submits a portfolio entry.

    Flow (NestJS side):
      1. Increment expert_seam_claims.submission_count
      2. Call this endpoint
      3. If passed_boolean = True → update verification_tier to EVIDENCE_BACKED
      4. If passed_boolean = False → increment failure count, check lockout threshold
      5. Write platform_decisions row with confidence + gap_advisory

    Returns:
        PortfolioEvalResponse — confidence_score, passed_boolean, gap_advisory
    """
    _validate_request(request)

    try:
        return await portfolio_evaluator.evaluate(request)
    except Exception as exc:
        logger.exception("portfolio_eval failed for seam=%s: %s", request.seam_code, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LLM service unavailable — retry in a moment",
        ) from exc


def _validate_request(request: PortfolioEvalRequest) -> None:
    errors = []
    if not request.project_description.strip():
        errors.append("project_description must not be empty")
    if not request.decision_points.strip():
        errors.append("decision_points must not be empty")
    if not request.seam_code.strip():
        errors.append("seam_code must not be empty")
    if errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=errors,
        )