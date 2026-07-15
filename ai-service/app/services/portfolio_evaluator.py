"""
Portfolio evaluator — assesses expert seam-boundary competency submissions.
"""
import logging
from app.services import llm_client
from app.services.prompt_service import get_rendered_prompt
from app.models.requests import PortfolioEvalRequest
from app.models.responses import PortfolioEvalResponse
from app.config import settings

logger = logging.getLogger(__name__)

# Fallback set when DB seam definitions not available
_DEFAULT_SEAM_CODES = {
    "A↔C", "A↔F", "A↔D", "D↔E", "D↔F",
    "C↔F", "E↔F", "A↔B", "B↔E", "C↔E",
}


async def evaluate(request: PortfolioEvalRequest) -> PortfolioEvalResponse:
    # Build Jinja2 context from live seam definitions (DB-fetched by NestJS)
    seam_defs = request.all_seam_definitions or []
    if not seam_defs:
        logger.warning("No seam_definitions in request — using fallback list")

    prompt_context = {
        "seam_definitions": seam_defs,
        "evaluated_seam_code":  request.seam_code,
        "evaluated_seam_name":  request.seam_name or request.seam_code,
        "evaluated_seam_desc":  request.seam_description or "",
    }

    system = await get_rendered_prompt("portfolio_eval", prompt_context)

    # Validate seam code against DB-fetched codes or fallback
    valid_codes = {s["code"] for s in seam_defs} if seam_defs else _DEFAULT_SEAM_CODES
    if request.seam_code not in valid_codes:
        logger.warning("Unexpected seam_code: %s", request.seam_code)

    user_prompt = (
        f"SEAM BEING EVALUATED: {request.seam_code}"
        + (f" — {request.seam_name}" if request.seam_name else "")
        + f"\n\nPROJECT DESCRIPTION:\n{request.project_description.strip()}\n\n"
        f"DECISION POINTS AT THE SEAM BOUNDARY:\n{request.decision_points.strip()}\n\n"
        f"Evaluate whether this practitioner has demonstrated genuine cross-domain "
        f"competency specifically at the {request.seam_code} boundary."
    )

    raw: dict = await llm_client.call_llm_json_with_system(prompt=user_prompt, system=system)

    logger.debug("portfolio_eval: seam=%s score=%s", request.seam_code, raw.get("confidence_score"))

    raw_score = float(raw.get("confidence_score", 0.0))
    confidence_score = max(0.0, min(1.0, raw_score))
    passed = confidence_score >= settings.portfolio_eval_threshold

    gap_advisory: str | None = None
    if not passed:
        gap_advisory = raw.get("gap_advisory") or "Insufficient evidence at the seam boundary"

    return PortfolioEvalResponse(
        confidence_score=round(confidence_score, 4),
        passed_boolean=passed,
        gap_advisory=gap_advisory,
    )