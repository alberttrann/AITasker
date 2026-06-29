"""
Elicitation engine — Stage 1 (symptom extraction), Stage 3 (vagueness check),
and Stage 5 (full synthesis).
"""

import logging
from app.services import llm_client
from app.services.prompt_loader import load_prompt
from app.models.requests import Stage1Request, Stage3VaguenessCheckRequest, Stage5Request
from app.models.responses import (
    Stage1Response, VoidItem,
    Stage3VaguenessCheckResponse, VaguenessFlag,
    Stage5Response,
)

logger = logging.getLogger(__name__)

VALID_ARCHETYPE_CODES = {"1", "2", "3", "4", "5", "6"}


# Stage 1

async def stage1_extract(request: Stage1Request) -> Stage1Response:
    """
    Extract structured symptoms, scale signals, voids, AND recommended
    archetypes from CEO free-text input. Returns empty defaults if
    input is sparse — never raises on missing fields.
    """
    system = load_prompt("stage1_extract")

    user_prompt = (
        f"CEO INPUT:\n{request.symptom_text.strip()}\n\n"
        "Extract the structured information from the above input."
    )

    raw: dict = await llm_client.call_llm_json_with_system(
        prompt=user_prompt,
        system=system,
    )

    logger.debug("stage1_extract keys: %s", list(raw.keys()))

    voids = [
        VoidItem(
            void_code=v.get("void_code", "UNKNOWN"),
            severity=v.get("severity", "LOW"),
        )
        for v in raw.get("voids", [])
        if isinstance(v, dict)
    ]

    # validate recommended_archetypes — only keep valid codes, dedupe
    # while preserving order, cap at 5 per blueprint ("3-5 AI-recommended").
    raw_archetypes = raw.get("recommended_archetypes", [])
    seen = set()
    recommended: list[str] = []
    if isinstance(raw_archetypes, list):
        for code in raw_archetypes:
            code_str = str(code)
            if code_str in VALID_ARCHETYPE_CODES and code_str not in seen:
                recommended.append(code_str)
                seen.add(code_str)
    recommended = recommended[:5]

    return Stage1Response(
        symptoms=raw.get("symptoms", []),
        scale_signals=raw.get("scale_signals", {}),
        voids=voids,
        recommended_archetypes=recommended,
    )


# Stage 3 — vagueness check 

async def stage3_vagueness_check(
    request: Stage3VaguenessCheckRequest,
) -> Stage3VaguenessCheckResponse:
    """
    Checks the 4 archetype-tailored behavioral probe answers for vagueness.
    Fails OPEN on any LLM/parsing issue — returns an empty vague_answers
    list rather than raising, since this is a UX quality enhancement, not
    a hard gate (NestJS's caller already treats a thrown exception here
    the same way — fail open — but doing it here too means a malformed
    LLM response doesn't surface as a 503 unnecessarily).
    """
    system = load_prompt("stage3_vagueness_check")
    if getattr(request, "is_self_technical", False) is False:
        system += "\n\nIMPORTANT CONTEXT: The user is a non-technical business executive. Be highly forgiving. Only flag answers as vague if they provide absolutely no useful business context (e.g., 'I don't know' or 'somehow'). Do not demand deep architectural specifics at this stage."
    
    qa_block = "\n\n".join(
        f"Q: {q}\nA: {a}" for q, a in request.probe_responses.items()
    )
    user_prompt = (
        f"ARCHETYPE: {request.archetype}\n\n"
        f"QUESTION/ANSWER PAIRS:\n{qa_block}\n\n"
        "Review each answer for vagueness per the instructions."
    )

    try:
        raw: dict = await llm_client.call_llm_json_with_system(
            prompt=user_prompt,
            system=system,
        )
    except Exception as exc:
        logger.warning("stage3_vagueness_check LLM call failed, failing open: %s", exc)
        return Stage3VaguenessCheckResponse(vague_answers=[])

    flags = [
        VaguenessFlag(
            question=v.get("question", ""),
            reason=v.get("reason", ""),
        )
        for v in raw.get("vague_answers", [])
        if isinstance(v, dict) and v.get("question")
    ]

    return Stage3VaguenessCheckResponse(vague_answers=flags)


# Stage 5

async def stage5_synthesize(request: Stage5Request) -> Stage5Response:
    """
    Synthesise all 4 elicitation stages into a complete project specification.
    """
    system = load_prompt("stage5_synthesize")
    if getattr(request, "is_self_technical", False) is False:
        system += "\n\nIMPORTANT CONTEXT: The user is a non-technical business executive. Ensure artifact_a_json.sdlc_notices and milestone deliverable_statements are written in clear, accessible business language, avoiding deep architectural jargon while preserving the core metrics."

    user_prompt = _build_stage5_prompt(request)

    raw: dict = await llm_client.call_llm_json_with_system(
        prompt=user_prompt,
        system=system,
        max_output_tokens=8192,
    )

    logger.debug(
        "stage5_synthesize: session=%s completeness=%.2f seams=%d domains=%d milestones=%d",
        request.session_id,
        raw.get("completeness_score", 0.0),
        len(raw.get("required_seams_json", [])),
        len(raw.get("required_domains_json", [])),
        len(raw.get("milestone_framework_json", [])),
    )

    return _validate_stage5_response(raw)


def _build_stage5_prompt(request: Stage5Request) -> str:
    symptoms_block = (
        "\n".join(f"- {s}" for s in request.stage1_symptoms)
        if request.stage1_symptoms
        else "(no symptoms captured)"
    )

    voids_block = (
        "\n".join(
            f"- [{v.get('severity', 'LOW')}] {v.get('void_code', 'UNKNOWN')}"
            for v in request.void_list_json
            if isinstance(v, dict)
        )
        if request.void_list_json
        else "(no voids detected)"
    )

    probes_block = (
        "\n".join(f"  Q: {k}\n  A: {v}" for k, v in request.stage3_probes.items())
        if request.stage3_probes
        else "(no probe responses)"
    )

    tech_block = (
        "\n".join(f"  {k}: {v}" for k, v in request.stage4_tech_inputs.items())
        if request.stage4_tech_inputs
        else "(no technical inputs provided)"
    )

    return f"""SESSION ID: {request.session_id}

STAGE 1 — SYMPTOMS EXTRACTED:
{symptoms_block}

STAGE 1 — VOIDS DETECTED:
{voids_block}

STAGE 2 — PROJECT ARCHETYPE SELECTED BY CEO: {request.stage2_archetype}

STAGE 3 — CLARIFYING PROBE RESPONSES:
{probes_block}

STAGE 4 — TECHNICAL CONTEXT PROVIDED BY TECH TEAM:
{tech_block}

Synthesise all of the above into a complete project specification."""


def _validate_stage5_response(raw: dict) -> Stage5Response:
    valid_criticalities = {"load_bearing", "significant", "contributing"}
    seams = [
        {"seam_code": s["seam_code"], "criticality": s.get("criticality", "contributing")}
        for s in raw.get("required_seams_json", [])
        if isinstance(s, dict) and s.get("seam_code")
        and s.get("criticality") in valid_criticalities
    ]

    valid_depths = {"SURFACE", "OPERATIONAL", "DEEP"}
    valid_domain_codes = {"A", "B", "C", "D", "E", "F"}
    domains = [
        {"domain_code": d["domain_code"], "required_depth": d.get("required_depth", "SURFACE")}
        for d in raw.get("required_domains_json", [])
        if isinstance(d, dict)
        and d.get("domain_code") in valid_domain_codes
        and d.get("required_depth") in valid_depths
    ]

    valid_authorities = {"CEO", "TECH_TEAM", "JOINT"}
    milestones = [
        {
            "milestone_number":      int(m.get("milestone_number", i + 1)),
            "deliverable_statement": str(m.get("deliverable_statement", "")),
            "sign_off_authority":    m.get("sign_off_authority", "CEO")
                                     if m.get("sign_off_authority") in valid_authorities
                                     else "CEO",
            "payment_amount_vnd":    0,
        }
        for i, m in enumerate(raw.get("milestone_framework_json", []))
        if isinstance(m, dict)
    ]

    raw_a = raw.get("artifact_a_json", {}) or {}
    valid_archetypes = VALID_ARCHETYPE_CODES
    valid_tiers = {"TIER_1", "TIER_2", "TIER_3"}
    artifact_a = {
        "business_intent": str(raw_a.get("business_intent", "")),
        "archetype":       raw_a.get("archetype", "1")
                           if raw_a.get("archetype") in valid_archetypes
                           else "1",
        "stack_tags":      raw_a.get("stack_tags", []) if isinstance(raw_a.get("stack_tags"), list) else [],
        "volume_tier":     raw_a.get("volume_tier", "TIER_1")
                           if raw_a.get("volume_tier") in valid_tiers
                           else "TIER_1",
        "sdlc_notices":    raw_a.get("sdlc_notices", []) if isinstance(raw_a.get("sdlc_notices"), list) else [],
    }

    raw_b = raw.get("artifact_b_json", {}) or {}
    artifact_b = {
        "stack_tags":          raw_b.get("stack_tags", [])     if isinstance(raw_b.get("stack_tags"), list)     else [],
        "integration_method":  str(raw_b.get("integration_method", "")),
        "legacy_volume":       str(raw_b.get("legacy_volume", "")),
        "schemas":             raw_b.get("schemas", [])        if isinstance(raw_b.get("schemas"), list)        else [],
        "contracts":           raw_b.get("contracts", [])      if isinstance(raw_b.get("contracts"), list)      else [],
    }

    try:
        completeness = float(raw.get("completeness_score", 0.0))
        completeness = max(0.0, min(1.0, completeness))
    except (TypeError, ValueError):
        completeness = 0.0

    return Stage5Response(
        required_seams_json=seams,
        required_domains_json=domains,
        milestone_framework_json=milestones,
        artifact_a_json=artifact_a,
        artifact_b_json=artifact_b,
        completeness_score=round(completeness, 4),
    )