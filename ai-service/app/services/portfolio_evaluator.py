"""
Portfolio evaluator — assesses expert seam-boundary competency submissions.

Business rules enforced here:
  BR-VER-03: passed_boolean = (confidence_score >= 0.85)
  gap_advisory is set to None on pass — never shown to passing experts.

The LLM's own passed_boolean field is IGNORED. We compute it from the score
so the threshold can be changed in config without touching any prompt.
"""

import logging
from app.services import llm_client
from app.services.prompt_loader import load_prompt
from app.models.requests import PortfolioEvalRequest
from app.models.responses import PortfolioEvalResponse
from app.config import settings

logger = logging.getLogger(__name__)

# Valid seam codes for reference / logging — DB enforces the constraint
VALID_SEAM_CODES = {
    "A↔C", "A↔F", "A↔D", "D↔E", "D↔F",
    "C↔F", "E↔F", "A↔B", "B↔E", "C↔E",
}


async def evaluate(request: PortfolioEvalRequest) -> PortfolioEvalResponse:
    """
    Evaluate an expert's portfolio submission for seam-boundary competency.

    Args:
        request: contains seam_code, project_description, decision_points

    Returns:
        PortfolioEvalResponse with:
          confidence_score: 0.0–1.0
          passed_boolean:   True iff score >= settings.portfolio_eval_threshold (0.85)
          gap_advisory:     specific gap description on failure, None on pass
    """
    if request.seam_code not in VALID_SEAM_CODES:
        logger.warning("Unexpected seam_code received: %s", request.seam_code)

    system = load_prompt("portfolio_eval")

    user_prompt = (
        f"SEAM CODE BEING EVALUATED: {request.seam_code}\n\n"
        f"PROJECT DESCRIPTION:\n{request.project_description.strip()}\n\n"
        f"DECISION POINTS AT THE SEAM BOUNDARY:\n{request.decision_points.strip()}\n\n"
        f"Evaluate whether this practitioner has demonstrated genuine cross-domain "
        f"competency specifically at the {request.seam_code} boundary."
    )

    raw: dict = await llm_client.call_llm_json_with_system(
        prompt=user_prompt,
        system=system,
    )

    logger.debug(
        "portfolio_eval raw: seam=%s score=%s",
        request.seam_code,
        raw.get("confidence_score"),
    )

    # Clamp score to [0.0, 1.0] — never trust raw LLM floats
    raw_score = float(raw.get("confidence_score", 0.0))
    confidence_score = max(0.0, min(1.0, raw_score))

    # BR-VER-03: threshold computed here, not taken from LLM
    passed = confidence_score >= settings.portfolio_eval_threshold

    # gap_advisory: only meaningful on failure — clear it on pass
    gap_advisory: str | None = None
    if not passed:
        gap_advisory = raw.get("gap_advisory") or "Insufficient evidence at the seam boundary"

    return PortfolioEvalResponse(
        confidence_score=round(confidence_score, 4),
        passed_boolean=passed,
        gap_advisory=gap_advisory,
    )