"""
Elicitation engine — Stage 1 (symptom extraction) and Stage 5 (full synthesis).

Stage 1: extract symptoms, scale signals, voids from CEO free text.
Stage 5: synthesise all 4 elicitation stages into a complete project specification
         with 5 structured JSON outputs and a completeness score.
"""

import logging
from app.services import llm_client
from app.services.prompt_loader import load_prompt
from app.models.requests import Stage1Request, Stage5Request
from app.models.responses import (
    Stage1Response, VoidItem,
    Stage5Response,
)

logger = logging.getLogger(__name__)


# Stage 1 

async def stage1_extract(request: Stage1Request) -> Stage1Response:
    """
    Extract structured symptoms, scale signals and voids from CEO free-text input.
    Returns empty defaults if input is sparse — never raises on missing fields.
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

    return Stage1Response(
        symptoms=raw.get("symptoms", []),
        scale_signals=raw.get("scale_signals", {}),
        voids=voids,
    )


# Stage 5 

async def stage5_synthesize(request: Stage5Request) -> Stage5Response:
    """
    Synthesise all 4 elicitation stages into a complete project specification.

    One LLM call returns all 5 structured JSON outputs:
      required_seams_json        — seam codes + criticality
      required_domains_json      — domain codes + depth
      milestone_framework_json   — deliverables + sign-off authority
      artifact_a_json            — plain-English summary for CEO/shortlist
      artifact_b_json            — technical deep-dive for expert due-diligence
      completeness_score         — 0.0-1.0 quality gate

    Args:
        request: aggregated outputs from Stages 1-4 plus void list

    Returns:
        Stage5Response with validated fields.
        On any missing key, safe empty-structure defaults are applied.
    """
    system = load_prompt("stage5_synthesize")

    user_prompt = _build_stage5_prompt(request)

    raw: dict = await llm_client.call_llm_json_with_system(
        prompt=user_prompt,
        system=system,
        max_output_tokens=8192,   # stage5 is the largest output in the service
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
    """
    Assemble the full context prompt from all 4 elicitation stages.
    Each stage is a clearly labelled section so the LLM can reference all data.
    """
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

    # Stage 3 probes: dict of question → answer
    probes_block = (
        "\n".join(f"  Q: {k}\n  A: {v}" for k, v in request.stage3_probes.items())
        if request.stage3_probes
        else "(no probe responses)"
    )

    # Stage 4 tech inputs: dict of field → value
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
    """
    Validate and sanitise each field from the LLM response.
    Every field has a safe empty-structure default so the router never crashes.
    """
    # Seams: validate each entry has seam_code and criticality
    valid_criticalities = {"load_bearing", "significant", "contributing"}
    seams = [
        {"seam_code": s["seam_code"], "criticality": s.get("criticality", "contributing")}
        for s in raw.get("required_seams_json", [])
        if isinstance(s, dict) and s.get("seam_code")
        and s.get("criticality") in valid_criticalities
    ]

    # Domains: validate each entry has domain_code and required_depth
    valid_depths = {"SURFACE", "OPERATIONAL", "DEEP"}
    valid_domain_codes = {"A", "B", "C", "D", "E", "F"}
    domains = [
        {"domain_code": d["domain_code"], "required_depth": d.get("required_depth", "SURFACE")}
        for d in raw.get("required_domains_json", [])
        if isinstance(d, dict)
        and d.get("domain_code") in valid_domain_codes
        and d.get("required_depth") in valid_depths
    ]

    # Milestones: validate each entry
    valid_authorities = {"CEO", "TECH_TEAM", "JOINT"}
    milestones = [
        {
            "milestone_number":      int(m.get("milestone_number", i + 1)),
            "deliverable_statement": str(m.get("deliverable_statement", "")),
            "sign_off_authority":    m.get("sign_off_authority", "CEO")
                                     if m.get("sign_off_authority") in valid_authorities
                                     else "CEO",
            "payment_amount_vnd":    0,   # always 0 — client sets this
        }
        for i, m in enumerate(raw.get("milestone_framework_json", []))
        if isinstance(m, dict)
    ]

    # Artifact A: safe defaults for each sub-field
    raw_a = raw.get("artifact_a_json", {}) or {}
    valid_archetypes = {"1", "2", "3", "4", "5", "6"}
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

    # Artifact B
    raw_b = raw.get("artifact_b_json", {}) or {}
    artifact_b = {
        "stack_tags":          raw_b.get("stack_tags", [])     if isinstance(raw_b.get("stack_tags"), list)     else [],
        "integration_method":  str(raw_b.get("integration_method", "")),
        "legacy_volume":       str(raw_b.get("legacy_volume", "")),
        "schemas":             raw_b.get("schemas", [])        if isinstance(raw_b.get("schemas"), list)        else [],
        "contracts":           raw_b.get("contracts", [])      if isinstance(raw_b.get("contracts"), list)      else [],
    }

    # Completeness score: clamp to [0.0, 1.0]
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