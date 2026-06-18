"""
Dispute evaluator — neutral arbitration of deliverable vs acceptance criterion.

Threshold logic lives in NestJS (DisputeService), NOT here.
The ai-service returns raw (confidence_score, finding) and NestJS decides:
  confidence_score >= 0.80 → disputes.state = AUTO_RESOLVED
  confidence_score <  0.80 → disputes.state = MANUAL_REVIEW

This separation keeps the ai-service stateless and the threshold configurable
in the NestJS config without redeploying Python.
"""

import logging
from app.services import llm_client
from app.services.prompt_loader import load_prompt
from app.models.requests import DisputeEvalRequest
from app.models.responses import DisputeEvalResponse

logger = logging.getLogger(__name__)

VALID_FINDINGS = {"expert_wins", "client_wins"}


async def evaluate(request: DisputeEvalRequest) -> DisputeEvalResponse:
    """
    Evaluate whether a deliverable meets a stated acceptance criterion.

    Args:
        request: criterion_text, deliverable_description, files (URL list)

    Returns:
        DisputeEvalResponse with:
          confidence_score: 0.0–1.0 (how confident the LLM is in its finding)
          finding:          "expert_wins" | "client_wins"

    Note:
        Files are URL strings — the ai-service cannot fetch them. They are
        included in the prompt as context so the LLM knows what evidence exists,
        but evaluation is based on the deliverable_description text.
    """
    system = load_prompt("dispute_eval")

    files_section = ""
    if request.files:
        file_list = "\n".join(f"  - {url}" for url in request.files)
        files_section = f"\n\nFILES SUBMITTED BY EXPERT (URLs for reference):\n{file_list}"

    user_prompt = (
        f"ACCEPTANCE CRITERION:\n{request.criterion_text.strip()}\n\n"
        f"DELIVERABLE DESCRIPTION:\n{request.deliverable_description.strip()}"
        f"{files_section}\n\n"
        "Evaluate objectively whether the deliverable meets the criterion as written."
    )

    raw: dict = await llm_client.call_llm_json_with_system(
        prompt=user_prompt,
        system=system,
        temperature=0.0,   # zero temp — arbitration must be deterministic
    )

    logger.debug(
        "dispute_eval raw: score=%s finding=%s",
        raw.get("confidence_score"),
        raw.get("finding"),
    )

    # Clamp score to [0.0, 1.0]
    raw_score = float(raw.get("confidence_score", 0.0))
    confidence_score = max(0.0, min(1.0, raw_score))

    # Validate finding — default to "client_wins" on unexpected values
    # (conservative: unresolved ambiguity should not release expert payment)
    finding = raw.get("finding", "client_wins")
    if finding not in VALID_FINDINGS:
        logger.warning("Unexpected finding value from LLM: %s — defaulting to client_wins", finding)
        finding = "client_wins"

    return DisputeEvalResponse(
        confidence_score=round(confidence_score, 4),
        finding=finding,
    )