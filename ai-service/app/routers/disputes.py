"""
Disputes router — handles /llm/dispute-eval.

Registered in main.py as:
    app.include_router(disputes.router, prefix="/llm", tags=["Disputes"])

Endpoints:
    POST /llm/dispute-eval
"""

import logging
from fastapi import APIRouter, HTTPException, status

from app.models.requests import DisputeEvalRequest
from app.models.responses import DisputeEvalResponse
from app.services import dispute_evaluator

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/dispute-eval",
    response_model=DisputeEvalResponse,
    summary="Neutral arbitration — evaluate deliverable against acceptance criterion",
)
async def dispute_eval(request: DisputeEvalRequest):
    """
    Called by NestJS DisputeService immediately after a dispute is filed.

    Flow (NestJS side):
      1. Create dispute row (state = LAYER_1_EVAL)
      2. Call this endpoint
      3. Write llm_confidence to dispute row
      4. If confidence_score >= 0.80:
            state = AUTO_RESOLVED
            call LedgerService.resolveDispute() with finding-based resolution
         else:
            state = MANUAL_REVIEW
            admin sees it in the Dispute Monitor dashboard

    Returns:
        DisputeEvalResponse — confidence_score, finding ("expert_wins"|"client_wins")
    """
    _validate_request(request)

    try:
        return await dispute_evaluator.evaluate(request)
    except Exception as exc:
        logger.exception("dispute_eval failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LLM service unavailable — retry in a moment",
        ) from exc


def _validate_request(request: DisputeEvalRequest) -> None:
    errors = []
    if not request.criterion_text.strip():
        errors.append("criterion_text must not be empty")
    if not request.deliverable_description.strip():
        errors.append("deliverable_description must not be empty")
    if errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=errors,
        )