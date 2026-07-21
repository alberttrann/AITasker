"""
Dispute evaluator — neutral arbitration of deliverable vs acceptance criterion.
"""
import logging
from app.services import llm_client
from app.services.prompt_service import get_rendered_prompt
from app.models.requests import DisputeEvalRequest
from app.models.responses import DisputeEvalResponse

logger = logging.getLogger(__name__)
VALID_FINDINGS = {"expert_wins", "client_wins"}


async def evaluate(request: DisputeEvalRequest) -> DisputeEvalResponse:
    system = await get_rendered_prompt("dispute_eval", {})

    files_section = ""
    if request.files:
        file_list = "\n".join(f"  - {url}" for url in request.files)
        files_section = (
            "\n\nFILES SUBMITTED BY EXPERT (reference URLs only; contents not inspected):\n"
            f"{file_list}"
        )

    context_section = ""
    if request.project_archetype or request.milestone_context:
        context_section = "\n\nCONTEXT:"
        if request.project_archetype:
            archetype_label = request.project_archetype
            context_section += f"\n  Project Archetype: {archetype_label}"
        if request.milestone_context:
            context_section += f"\n  Milestone Scope: {request.milestone_context}"
        if request.prior_revision_count > 0:
            context_section += f"\n  Prior Revision Loops: {request.prior_revision_count}"

    user_prompt = (
        f"ACCEPTANCE CRITERION:\n{request.criterion_text.strip()}\n\n"
        f"DELIVERABLE DESCRIPTION:\n{request.deliverable_description.strip()}"
        f"{files_section}"
        f"{context_section}\n\n"
        "Evaluate objectively whether the deliverable meets the criterion as written."
    )

    raw: dict = await llm_client.call_llm_json_with_system(
        prompt=user_prompt, system=system, temperature=0.0,
    )

    logger.debug("dispute_eval: score=%s finding=%s", raw.get("confidence_score"), raw.get("finding"))

    raw_score = float(raw.get("confidence_score", 0.0))
    confidence_score = max(0.0, min(1.0, raw_score))

    finding = raw.get("finding", "client_wins")
    if finding not in VALID_FINDINGS:
        logger.warning("Unexpected finding from LLM: %s — defaulting to client_wins", finding)
        finding = "client_wins"

    reasoning = str(raw.get("reasoning", "")).strip()

    return DisputeEvalResponse(
        confidence_score=round(confidence_score, 4),
        finding=finding,
        reasoning=reasoning,
    )
