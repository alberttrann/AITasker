"""
Elicitation engine — Stage 1 through Stage 5 + Milestone Chat.

All prompt loading uses prompt_service.get_rendered_prompt() which:
  1. Checks DB (via NestJS /internal/prompts/:stage) with 60s TTL cache
  2. Falls back to .txt file on disk
  3. Renders Jinja2 template with dynamic context (archetypes, domains, seams)
"""

import json as _json
import logging
import re as _re

from app.services import llm_client
from app.services.prompt_service import get_rendered_prompt
from app.models.requests import (
    Stage1Request, Stage3VaguenessCheckRequest, Stage4RecommendRequest,
    Stage5Request, MilestoneChatRequest,
)
from app.models.responses import (
    Stage1Response, VoidItem, CriticalArtifact,
    Stage3VaguenessCheckResponse, VaguenessFlag, RelevancyFlag,
    Stage4RecommendResponse,
    Stage5Response,
    MilestoneChatResponse,
)

logger = logging.getLogger(__name__)

# Fallback archetype codes for Stage 1 response validation when DB list is empty
_DEFAULT_ARCHETYPE_CODES = {"1", "2", "3", "4", "5", "6"}


async def stage1_extract(request: Stage1Request) -> Stage1Response:
    """
    Extract symptoms, scale signals, voids, recommended archetypes,
    and critical artifact requirements from CEO free-text input.

    Prompt is rendered with live archetype + void_code lists from DB,
    so removing/adding archetypes in the admin panel takes effect within 60s.
    """
    # Build Jinja2 context from DB-fetched config values
    prompt_context = {
        "archetypes": request.archetypes or [
            {"code": c, "name": c, "description": ""} for c in sorted(_DEFAULT_ARCHETYPE_CODES)
        ],
        "void_codes": request.void_codes or [
            {"code": "NO_GROUND_TRUTH", "description": "No labelled data or benchmark mentioned"},
            {"code": "UNCLEAR_SUCCESS_METRIC", "description": "Success criteria are vague"},
            {"code": "INTEGRATION_UNCLEAR", "description": "How AI connects to existing systems not described"},
            {"code": "MISSING_TECHNICAL_ARTIFACT", "description": "Critical technical document mentioned but not submitted"},
        ],
    }

    system = await get_rendered_prompt("stage1_extract", prompt_context)

    user_prompt = (
        f"CEO INPUT:\n{request.symptom_text.strip()}\n\n"
        "Extract the structured information from the above input."
    )

    raw: dict = await llm_client.call_llm_json_with_system(prompt=user_prompt, system=system)

    logger.debug("stage1_extract keys: %s", list(raw.keys()))

    # Validate voids
    voids = [
        VoidItem(void_code=v.get("void_code", "UNKNOWN"), severity=v.get("severity", "LOW"))
        for v in raw.get("voids", [])
        if isinstance(v, dict)
    ]

    # Validate recommended archetypes against known codes (DB list or fallback)
    valid_codes = {a["code"] for a in request.archetypes} if request.archetypes else _DEFAULT_ARCHETYPE_CODES
    seen: set[str] = set()
    recommended: list[str] = []
    for code in (raw.get("recommended_archetypes", []) or []):
        code_str = str(code)
        if code_str in valid_codes and code_str not in seen:
            recommended.append(code_str)
            seen.add(code_str)
    recommended = recommended[:5]
    if not recommended:
        logger.warning("AI returned no valid archetypes. Falling back to all defaults.")
        recommended = sorted(valid_codes)

    # parse critical artifacts
    critical_artifacts: list[CriticalArtifact] = []
    for a in raw.get("critical_artifacts_required", []):
        if not isinstance(a, dict) or not a.get("artifact_key"):
            continue
        critical_artifacts.append(CriticalArtifact(
            artifact_key=a["artifact_key"],
            label=a.get("label", a["artifact_key"].replace("_", " ").title()),
            reason=a.get("reason", ""),
            placeholder_prompt=a.get("placeholder_prompt", f"Please provide your {a['artifact_key'].replace('_', ' ')}"),
        ))

    return Stage1Response(
        symptoms=raw.get("symptoms", []),
        scale_signals=raw.get("scale_signals", {}),
        voids=voids,
        recommended_archetypes=recommended,
        critical_artifacts_required=critical_artifacts,
    )


async def stage3_vagueness_check(request: Stage3VaguenessCheckRequest) -> Stage3VaguenessCheckResponse:
    """
    Issue 2: Checks probe answers for BOTH:
      (a) Vagueness — answers that are too generic to act on
      (b) Relevancy — answers that don't match this project's context

    Fails open on any LLM/parsing issue.
    """
    system = await get_rendered_prompt("stage3_vagueness_check", {})

    if not request.is_self_technical:
        system += (
            "\n\nIMPORTANT CONTEXT: The user is a non-technical business executive. "
            "Be highly forgiving on vagueness — only flag answers as vague if they provide "
            "absolutely no useful business context (e.g., 'I don't know' or 'somehow'). "
            "Do not demand deep architectural specifics. HOWEVER, still flag any answers "
            "that are clearly irrelevant to the described project context."
        )

    # Build Q/A block from authoritative questions list
    if request.probe_questions:
        qa_block = "\n\n".join(
            f"Q: {q}\nA: {request.probe_responses.get(q, '(no answer)')}"
            for q in request.probe_questions
        )
    else:
        qa_block = "\n\n".join(f"Q: {q}\nA: {a}" for q, a in request.probe_responses.items())

    # Include symptom context for relevancy check
    symptoms_block = (
        "\n".join(f"- {s}" for s in request.stage1_symptoms)
        if request.stage1_symptoms
        else "(not provided)"
    )
    voids_block = (
        "\n".join(f"- [{v.get('severity','?')}] {v.get('void_code','?')}" for v in request.stage1_voids)
        if request.stage1_voids
        else "(none)"
    )

    user_prompt = (
        f"PROJECT CONTEXT (from Stage 1):\n{symptoms_block}\n\n"
        f"DETECTED VOIDS:\n{voids_block}\n\n"
        f"ARCHETYPE: {request.archetype}\n\n"
        f"QUESTION/ANSWER PAIRS:\n{qa_block}\n\n"
        "Review each answer for both vagueness AND relevancy to the project context above."
    )

    try:
        raw: dict = await llm_client.call_llm_json_with_system(prompt=user_prompt, system=system)
    except Exception as exc:
        logger.warning("stage3_vagueness_check LLM call failed, failing open: %s", exc)
        return Stage3VaguenessCheckResponse(vague_answers=[], irrelevant_answers=[])

    vague_flags = [
        VaguenessFlag(question=v.get("question", ""), reason=v.get("reason", ""))
        for v in raw.get("vague_answers", [])
        if isinstance(v, dict) and v.get("question")
    ]

    irrelevant_flags = [
        RelevancyFlag(question=r.get("question", ""), issue=r.get("issue", ""))
        for r in raw.get("irrelevant_answers", [])
        if isinstance(r, dict) and r.get("question")
    ]

    return Stage3VaguenessCheckResponse(
        vague_answers=vague_flags,
        irrelevant_answers=irrelevant_flags,
    )


async def stage4_recommend(request: Stage4RecommendRequest) -> Stage4RecommendResponse:
    """
    Issue 3: Now passes additional_requirement_1, budget, and void context.
    """
    system = await get_rendered_prompt("stage4_recommend", {})

    symptoms_block = "\n".join(f"- {s}" for s in request.stage1_symptoms) or "(none)"
    probes_block = "\n".join(f"Q: {k}\nA: {v}" for k, v in request.stage3_probes.items()) or "(none)"
    voids_block = (
        "\n".join(f"- [{v.get('severity','?')}] {v.get('void_code','?')}" for v in request.void_list_json)
        or "(none)"
    )
    budget_line = (
        f"\nESTIMATED BUDGET: {request.estimated_budget_vnd:,} VND\n"
        if request.estimated_budget_vnd
        else "\nESTIMATED BUDGET: Not specified\n"
    )
    add_req_line = (
        f"\nADDITIONAL REQUIREMENT FROM CEO/TECH LEAD:\n{request.additional_requirement_1}\n"
        if request.additional_requirement_1
        else ""
    )

    user_prompt = (
        f"SYMPTOMS:\n{symptoms_block}\n\n"
        f"ARCHETYPE: {request.stage2_archetype}\n"
        f"{budget_line}"
        f"VOIDS DETECTED:\n{voids_block}\n\n"
        f"PROBE RESPONSES:\n{probes_block}"
        f"{add_req_line}\n\n"
        "Recommend the technical context."
    )

    raw: dict = await llm_client.call_llm_json_with_system(prompt=user_prompt, system=system)

    return Stage4RecommendResponse(
        recommended_stack=raw.get("recommended_stack", "Python, REST API, Cloud Database"),
        recommended_integration=raw.get("recommended_integration", "REST API integration with existing systems."),
        recommended_legacy_volume=raw.get("recommended_legacy_volume", "Standard operational database volume."),
    )


async def stage5_synthesize(request: Stage5Request) -> Stage5Response:
    """
    Issue 1: Prompt is Jinja2-rendered with live domain/seam/archetype lists from DB.
    Issue 4: Technical artifacts injected into prompt for grounded synthesis.
    """
    # Build Jinja2 context
    prompt_context = {
        "domains":    request.domains,
        "seams":      request.seams,
        "archetypes": request.archetypes,
    }

    system = await get_rendered_prompt("stage5_synthesize", prompt_context)

    if not request.is_self_technical:
        system += (
            "\n\nIMPORTANT CONTEXT: The user is a non-technical business executive. "
            "Ensure artifact_a_json.sdlc_notices and milestone deliverable_statements "
            "are written in clear, accessible business language."
        )

    user_prompt = _build_stage5_prompt(request)

    raw: dict = await llm_client.call_llm_json_with_system(
        prompt=user_prompt, system=system, max_output_tokens=8192,
    )

    logger.debug(
        "stage5_synthesize: session=%s completeness=%.2f seams=%d domains=%d milestones=%d",
        request.session_id, raw.get("completeness_score", 0.0),
        len(raw.get("required_seams_json", [])),
        len(raw.get("required_domains_json", [])),
        len(raw.get("milestone_framework_json", [])),
    )

    return _validate_stage5_response(raw, request)


def _build_stage5_prompt(request: Stage5Request) -> str:
    symptoms_block = (
        "\n".join(f"- {s}" for s in request.stage1_symptoms)
        if request.stage1_symptoms else "(no symptoms captured)"
    )
    unresolved_voids = [v for v in request.void_list_json if not v.get("injected")]
    voids_block = (
        "\n".join(f"- [{v.get('severity','LOW')}] {v.get('void_code','UNKNOWN')}" for v in unresolved_voids)
        if unresolved_voids else "(no unresolved voids)"
    )
    probes_block = (
        "\n".join(f"  Q: {k}\n  A: {v}" for k, v in request.stage3_probes.items())
        if request.stage3_probes else "(no probe responses)"
    )
    tech_block = (
        "\n".join(f"  {k}: {v}" for k, v in request.stage4_tech_inputs.items()
                  if k != "technical_artifacts")
        if request.stage4_tech_inputs else "(no technical inputs provided)"
    )

    budget_line = (
        f"\nESTIMATED BUDGET: {request.estimated_budget_vnd:,} VND\n"
        if request.estimated_budget_vnd
        else "\nESTIMATED BUDGET: Not provided — derive from scope.\n"
    )

    # Build the submitted artifacts block
    technical_artifacts: dict = request.stage4_tech_inputs.get("technical_artifacts", {}) if request.stage4_tech_inputs else {}
    additional_req = request.stage4_tech_inputs.get("additional_requirement_1") if request.stage4_tech_inputs else None

    if technical_artifacts:
        artifacts_block = (
            "SUBMITTED TECHNICAL ARTIFACTS (use the actual content below for milestone definitions):\n"
            + "\n\n".join(
                f"=== {key.upper().replace('_', ' ')} ===\n{content}"
                for key, content in technical_artifacts.items()
                if content and str(content).strip()
            )
        )
    else:
        artifacts_block = ""

    # Determine missing critical artifacts
    submitted_keys = {
        key for key, content in technical_artifacts.items()
        if content and str(content).strip()
    }
    missing_artifacts = [
        a for a in request.critical_artifacts_required
        if a.get("artifact_key") and a["artifact_key"] not in submitted_keys
    ]
    if missing_artifacts:
        missing_block = (
            "⚠️  MISSING CRITICAL ARTIFACTS (cap completeness_score ≤ 0.60; add specific sdlc_notice per item):\n"
            + "\n".join(
                f"- {a.get('label', a.get('artifact_key','?'))}: {a.get('reason','')}"
                for a in missing_artifacts
            )
        )
    else:
        missing_block = ""

    add_req_block = f"\nADDITIONAL CEO/TECH REQUIREMENT:\n{additional_req}\n" if additional_req else ""

    return f"""SESSION ID: {request.session_id}
{budget_line}
STAGE 1 — SYMPTOMS:
{symptoms_block}

STAGE 1 — VOIDS:
{voids_block}

STAGE 2 — ARCHETYPE SELECTED: {request.stage2_archetype}

STAGE 3 — PROBE RESPONSES:
{probes_block}

STAGE 4 — TECHNICAL CONTEXT:
{tech_block}
{add_req_block}
{artifacts_block}
{missing_block}

Synthesise all of the above into a complete project specification."""


def _validate_stage5_response(raw: dict, request: Stage5Request) -> Stage5Response:
    valid_criticalities = {"load_bearing", "significant", "contributing"}
    seams = [
        {"seam_code": s["seam_code"], "criticality": s.get("criticality", "contributing")}
        for s in raw.get("required_seams_json", [])
        if isinstance(s, dict) and s.get("seam_code") and s.get("criticality") in valid_criticalities
    ]

    valid_depths = {"SURFACE", "OPERATIONAL", "DEEP"}
    # accept any non-empty domain code (DB is now the authority)
    domains = [
        {"domain_code": d["domain_code"], "required_depth": d.get("required_depth", "SURFACE")}
        for d in raw.get("required_domains_json", [])
        if isinstance(d, dict) and d.get("domain_code") and d.get("required_depth") in valid_depths
    ]

    valid_authorities = {"CEO", "TECH_TEAM", "JOINT"}
    milestones = [
        {
            "milestone_number":        int(m.get("milestone_number", i + 1)),
            "deliverable_statement":   str(m.get("deliverable_statement", "")),
            "sign_off_authority":      m.get("sign_off_authority", "CEO")
                                       if m.get("sign_off_authority") in valid_authorities else "CEO",
            "payment_amount_vnd":      0,
            "estimated_cost_vnd":      int(m.get("estimated_cost_vnd", 0)),
            "estimated_duration_days": int(m.get("estimated_duration_days", 0)),
        }
        for i, m in enumerate(raw.get("milestone_framework_json", []))
        if isinstance(m, dict)
    ]

    valid_tiers = {"TIER_1", "TIER_2", "TIER_3"}
    # accept any non-empty archetype code
    raw_a = raw.get("artifact_a_json", {}) or {}
    artifact_a = {
        "project_name":    str(raw_a.get("project_name", "AI Project")),
        "business_intent": str(raw_a.get("business_intent", "")),
        "archetype":       str(raw_a.get("archetype", request.stage2_archetype)),
        "stack_tags":      raw_a.get("stack_tags", []) if isinstance(raw_a.get("stack_tags"), list) else [],
        "volume_tier":     raw_a.get("volume_tier", "TIER_1") if raw_a.get("volume_tier") in valid_tiers else "TIER_1",
        "sdlc_notices":    raw_a.get("sdlc_notices", []) if isinstance(raw_a.get("sdlc_notices"), list) else [],
    }

    raw_b = raw.get("artifact_b_json", {}) or {}
    artifact_b = {
        "stack_tags":         raw_b.get("stack_tags", [])    if isinstance(raw_b.get("stack_tags"), list)    else [],
        "integration_method": str(raw_b.get("integration_method", "")),
        "legacy_volume":      str(raw_b.get("legacy_volume", "")),
        "schemas":            raw_b.get("schemas", [])       if isinstance(raw_b.get("schemas"), list)       else [],
        "contracts":          raw_b.get("contracts", [])     if isinstance(raw_b.get("contracts"), list)     else [],
    }

    try:
        completeness = float(raw.get("completeness_score", 0.0))
        completeness = max(0.0, min(1.0, completeness))
    except (TypeError, ValueError):
        completeness = 0.0

    # aggregate cost/duration
    total_cost = sum(m["estimated_cost_vnd"] for m in milestones)
    total_days = sum(m["estimated_duration_days"] for m in milestones)

    return Stage5Response(
        required_seams_json=seams,
        required_domains_json=domains,
        milestone_framework_json=milestones,
        artifact_a_json=artifact_a,
        artifact_b_json=artifact_b,
        completeness_score=round(completeness, 4),
        flagged_void=str(raw.get("flagged_void")) if raw.get("flagged_void") else None,
        estimated_total_cost_vnd=total_cost if total_cost > 0 else None,
        estimated_total_duration_days=total_days if total_days > 0 else None,
    )


# Milestone Chat

async def milestone_chat(request: MilestoneChatRequest) -> MilestoneChatResponse:
    system_template = await get_rendered_prompt("milestone_chat", {})
    system = (
        system_template
        .replace("{artifact_a}",          _json.dumps(request.artifact_a, ensure_ascii=False, indent=2))
        .replace("{milestone_framework}", _json.dumps(request.milestone_framework, ensure_ascii=False, indent=2))
        .replace("{budget_context}",      request.budget_context)
    )

    raw_reply = await llm_client.call_llm_with_system_and_messages(
        system=system,
        messages=request.conversation_history,
        max_output_tokens=1024,
    )

    suggested_edit = None
    fence_match = _re.search(r"```edit_suggestion\s*(\{.*?\})\s*```", raw_reply, _re.DOTALL)
    if fence_match:
        try:
            suggested_edit = _json.loads(fence_match.group(1))
        except _json.JSONDecodeError:
            pass
        raw_reply = _re.sub(r"```edit_suggestion.*?```", "", raw_reply, flags=_re.DOTALL).strip()

    return MilestoneChatResponse(reply=raw_reply, suggested_edit=suggested_edit)
