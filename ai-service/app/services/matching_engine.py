"""
Matching engine — composite-score expert ranking.

Pure Python arithmetic, no LLM calls.
Scores each expert across 5 dimensions and returns a sorted, annotated list.

WEIGHTS (must sum to 1.0):
  40% — seam coverage      (weighted by criticality of each required seam)
  25% — domain depth       (expert depth vs required depth per domain)
  20% — portfolio quality  (average portfolio evaluation score)
  10% — archetype history  (has expert completed similar project type?)
   5% — engagement compat  (all NestJS-filtered experts are compatible → always 1.0)

GAP MAP (per required seam):
  green  — expert has EVIDENCE_BACKED claim
  amber  — expert has CLAIMED (unverified)
  red    — expert does not cover this seam

STRENGTH LABELS:
  STRONG_MATCH   ≥ 0.85
  GOOD_MATCH     ≥ 0.70
  POSSIBLE_MATCH ≥ 0.55
  WEAK_MATCH      < 0.55
"""

import logging
from app.models.requests  import MatchingRequest
from app.models.responses import MatchResult, GapMapItem

logger = logging.getLogger(__name__)

# Constants

_WEIGHTS = {
    "seam":       0.40,
    "domain":     0.25,
    "portfolio":  0.20,
    "archetype":  0.10,
    "engagement": 0.05,
}

_CRITICALITY_WEIGHT = {
    "load_bearing": 3.0,
    "significant":  2.0,
    "contributing": 1.0,
}

_DEPTH_LEVEL = {"SURFACE": 1, "OPERATIONAL": 2, "DEEP": 3}

_STRENGTH_THRESHOLDS = [
    (0.85, "STRONG_MATCH"),
    (0.70, "GOOD_MATCH"),
    (0.55, "POSSIBLE_MATCH"),
]


# Public entry point 

async def rank_experts(request: MatchingRequest) -> list[MatchResult]:
    """
    Score and rank all expert profiles against the project requirements.

    Args:
        request: required seams, required domains, list of expert profile dicts,
                 optional project archetype

    Returns:
        List of MatchResult sorted by composite_score descending.
        Empty list if expert_profiles is empty.
    """
    if not request.expert_profiles:
        return []

    required_seams  = request.required_seams_json  or []
    required_domains = request.required_domains_json or []
    archetype       = request.project_archetype

    results: list[MatchResult] = []

    for expert in request.expert_profiles:
        expert_id = str(expert.get("expert_id", "unknown"))

        try:
            composite, gap_map = _score_expert(
                expert, required_seams, required_domains, archetype
            )
        except Exception as exc:
            logger.warning("Skipping expert %s due to scoring error: %s", expert_id, exc)
            continue

        results.append(MatchResult(
            expert_id=expert_id,
            composite_score=round(composite, 4),
            strength_label=_strength_label(composite),
            gap_map=gap_map,
        ))

    results.sort(key=lambda r: r.composite_score, reverse=True)

    logger.debug(
        "rank_experts: %d experts scored, top score=%.3f",
        len(results),
        results[0].composite_score if results else 0.0,
    )

    return results


# Scoring 

def _score_expert(
    expert: dict,
    required_seams:  list[dict],
    required_domains: list[dict],
    project_archetype: str | None,
) -> tuple[float, list[GapMapItem]]:
    """Return (composite_score, gap_map) for one expert."""

    seam_score, gap_map = _score_seams(expert, required_seams)
    domain_score        = _score_domains(expert, required_domains)
    portfolio_score     = _score_portfolio(expert)
    archetype_score     = _score_archetype(expert, project_archetype)
    engagement_score    = 1.0   # NestJS pre-filters on engagement model

    composite = (
        _WEIGHTS["seam"]       * seam_score +
        _WEIGHTS["domain"]     * domain_score +
        _WEIGHTS["portfolio"]  * portfolio_score +
        _WEIGHTS["archetype"]  * archetype_score +
        _WEIGHTS["engagement"] * engagement_score
    )

    return max(0.0, min(1.0, composite)), gap_map


def _score_seams(expert: dict, required_seams: list[dict]) -> tuple[float, list[GapMapItem]]:
    """
    Weighted seam coverage score and gap map.

    Returns (score 0.0-1.0, gap_map list).
    """
    if not required_seams:
        return 1.0, []   # no seams required — everyone passes

    # Build expert seam lookup: seam_code → tier
    expert_seams: dict[str, str] = {
        claim.get("seam_code", ""): claim.get("verification_tier", "")
        for claim in expert.get("seam_claims", [])
        if isinstance(claim, dict)
    }

    weighted_score = 0.0
    total_weight   = 0.0
    gap_map: list[GapMapItem] = []

    for seam in required_seams:
        if not isinstance(seam, dict):
            continue
        code        = seam.get("seam_code", "")
        criticality = seam.get("criticality", "contributing")
        weight      = _CRITICALITY_WEIGHT.get(criticality, 1.0)
        total_weight += weight

        tier = expert_seams.get(code)
        if tier == "EVIDENCE_BACKED":
            weighted_score += weight * 1.0
            color = "green"
        elif tier == "CLAIMED":
            weighted_score += weight * 0.5
            color = "amber"
        else:
            color = "red"

        gap_map.append(GapMapItem(seam_code=code, color=color))

    score = (weighted_score / total_weight) if total_weight > 0 else 0.0
    return score, gap_map


def _score_domains(expert: dict, required_domains: list[dict]) -> float:
    """Domain depth coverage score (0.0-1.0)."""
    if not required_domains:
        return 1.0

    expert_depths: dict[str, int] = {
        d.get("domain_code", ""): _DEPTH_LEVEL.get(d.get("depth_level", ""), 0)
        for d in expert.get("domain_depths", [])
        if isinstance(d, dict)
    }

    total_score = 0.0
    count       = 0

    for domain in required_domains:
        if not isinstance(domain, dict):
            continue
        code           = domain.get("domain_code", "")
        required_val   = _DEPTH_LEVEL.get(domain.get("required_depth", "SURFACE"), 1)
        expert_val     = expert_depths.get(code, 0)

        if expert_val >= required_val:
            total_score += 1.0
        elif expert_val == required_val - 1:
            total_score += 0.5
        # else: 0 (missing or too shallow)
        count += 1

    return (total_score / count) if count > 0 else 0.0


def _score_portfolio(expert: dict) -> float:
    """
    Portfolio quality score (0.0-1.0).
    Defaults to 0.5 if no evaluations have been run yet.
    """
    raw = expert.get("portfolio_score")
    if raw is None:
        return 0.5   # neutral — no history, not penalised
    try:
        score = float(raw)
        return max(0.0, min(1.0, score))
    except (TypeError, ValueError):
        return 0.5


def _score_archetype(expert: dict, project_archetype: str | None) -> float:
    """Archetype history match (0.0 or 1.0)."""
    if not project_archetype:
        return 0.5   # neutral — no archetype specified
    history = [str(a) for a in expert.get("archetype_history", [])]
    return 1.0 if str(project_archetype) in history else 0.0


def _strength_label(score: float) -> str:
    for threshold, label in _STRENGTH_THRESHOLDS:
        if score >= threshold:
            return label
    return "WEAK_MATCH"