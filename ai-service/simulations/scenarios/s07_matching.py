"""
Simulation scenarios — POST /llm/matching

NestJS trigger: ProjectsService.publishProject(project_id)

NestJS flow:
  1. CEO publishes a project (state: DRAFT → PUBLISHED)
  2. NestJS retrieves all active experts + their seam_claims and domain_depths
  3. NestJS calls this endpoint with project requirements and expert profiles
  4. ai-service returns experts sorted by composite_score descending
  5. NestJS displays the shortlist in the CEO's project dashboard

IMPORTANT: This endpoint is PURE ARITHMETIC — no LLM calls.
All scores are deterministically computed from the formula:
  composite = 0.40 × seam_score
            + 0.25 × domain_score
            + 0.20 × portfolio_score
            + 0.10 × archetype_score
            + 0.05 × engagement_score (always 1.0 — NestJS pre-filters)

Seam scoring:
  seam_score = Σ(tier_mult × criticality_mult) / Σ(criticality_mult)
  EVIDENCE_BACKED → tier_mult = 1.0
  CLAIMED         → tier_mult = 0.5
  Missing         → tier_mult = 0.0
  Criticality weights: load_bearing=3.0, significant=2.0, contributing=1.0

Gap map:
  EVIDENCE_BACKED → green
  CLAIMED         → amber
  Missing         → red

Strength labels:
  composite >= 0.85 → STRONG_MATCH
  composite >= 0.70 → GOOD_MATCH
  composite >= 0.55 → POSSIBLE_MATCH
  composite <  0.55 → WEAK_MATCH

All expected composite scores in these scenarios are pre-computed and verified
against the matching_engine.py formula before writing.
"""

from simulations.framework.grader import (
    Check, Scenario,
    shape_status_ok,
    rule_list_sorted_desc,
    quality_top_expert_is, quality_gap_map_colors_valid, quality_list_min_count,
)

VALID_STRENGTH_LABELS = {"STRONG_MATCH", "GOOD_MATCH", "POSSIBLE_MATCH", "WEAK_MATCH"}


# Shared checks — applied to every scenario 

def _shape_checks(expected_count: int) -> list[Check]:
    """Response-level structural checks for the matching list output."""
    return [
        shape_status_ok(),
        _shape_is_list(),
        _shape_result_count(expected_count),
        _shape_results_have_required_fields(),
        _shape_scores_in_range(),
        _shape_strength_labels_valid(),
    ]


def _rule_checks(required_seam_count: int) -> list[Check]:
    return [
        rule_list_sorted_desc("composite_score"),
        _gap_map_size_matches(required_seam_count),
    ]


# Custom SHAPE checks for list responses 

def _shape_is_list() -> Check:
    def fn(s, b):
        ok = isinstance(b, list)
        return ok, f"response is list with {len(b)} items" if ok else f"response is {type(b).__name__}"
    return Check("SHAPE", "response body is a list", fn)


def _shape_result_count(expected: int) -> Check:
    def fn(s, b):
        if not isinstance(b, list): return False, "not a list"
        ok = len(b) == expected
        return ok, f"{len(b)} result(s) (expected {expected})"
    return Check("SHAPE", f"response has {expected} result(s)", fn)


def _shape_results_have_required_fields() -> Check:
    required = {"expert_id", "composite_score", "strength_label", "gap_map"}
    def fn(s, b):
        if not isinstance(b, list): return False, "not a list"
        bad = []
        for i, r in enumerate(b):
            if not isinstance(r, dict):
                bad.append(f"[{i}] is not a dict")
                continue
            missing = required - set(r.keys())
            if missing:
                bad.append(f"[{i}] missing: {missing}")
        ok = len(bad) == 0
        return ok, f"all {len(b)} results have required fields" if ok else str(bad[:3])
    return Check("SHAPE", "all results have {expert_id, composite_score, strength_label, gap_map}", fn)


def _shape_scores_in_range() -> Check:
    def fn(s, b):
        if not isinstance(b, list): return False, "not a list"
        scores = []
        bad = []
        for r in b:
            if isinstance(r, dict):
                sc = r.get("composite_score", None)
                scores.append(round(sc, 3) if sc is not None else None)
                if sc is None or not (0.0 <= float(sc) <= 1.0):
                    bad.append(f"{r.get('expert_id')}={sc}")
        ok = len(bad) == 0
        return ok, f"scores={scores}" if ok else f"out of range: {bad}"
    return Check("SHAPE", "all composite_scores ∈ [0.0, 1.0]", fn)


def _shape_strength_labels_valid() -> Check:
    def fn(s, b):
        if not isinstance(b, list): return False, "not a list"
        bad = [r.get("strength_label") for r in b
               if isinstance(r, dict) and r.get("strength_label") not in VALID_STRENGTH_LABELS]
        ok = len(bad) == 0
        return ok, "all labels valid" if ok else f"invalid labels: {bad}"
    return Check("SHAPE", f"all strength_labels ∈ {sorted(VALID_STRENGTH_LABELS)}", fn)


# Custom RULE / QUALITY checks 

def _gap_map_size_matches(expected_count: int) -> Check:
    """Each expert's gap_map must have exactly one entry per required seam."""
    def fn(s, b):
        if not isinstance(b, list): return False, "not a list"
        bad = []
        for r in b:
            if not isinstance(r, dict): continue
            gm = r.get("gap_map", [])
            if len(gm) != expected_count:
                bad.append(f"{r.get('expert_id')}: {len(gm)} entries (expected {expected_count})")
        ok = len(bad) == 0
        return ok, f"all gap_maps have {expected_count} entries" if ok else str(bad[:3])
    return Check("RULE", f"all gap_maps have exactly {expected_count} seam entries", fn)


def _expert_ranked_above(expert_a: str, expert_b: str) -> Check:
    """Quality: expert_a must appear before expert_b in the sorted results."""
    def fn(s, b):
        if not isinstance(b, list): return False, "not a list"
        ids = [r.get("expert_id") for r in b if isinstance(r, dict)]
        if expert_a not in ids: return False, f"'{expert_a}' not in results: {ids}"
        if expert_b not in ids: return False, f"'{expert_b}' not in results: {ids}"
        rank_a, rank_b = ids.index(expert_a), ids.index(expert_b)
        ok = rank_a < rank_b
        sa = b[rank_a].get("composite_score", 0) if rank_a < len(b) else 0
        sb = b[rank_b].get("composite_score", 0) if rank_b < len(b) else 0
        return ok, (
            f"{expert_a}(rank={rank_a+1}, score={sa:.4f}) "
            f"vs {expert_b}(rank={rank_b+1}, score={sb:.4f})"
        )
    return Check("QUALITY", f"'{expert_a}' ranks above '{expert_b}'", fn)


def _expert_gap_color(expert_id: str, seam_code: str, expected_color: str) -> Check:
    """Quality: verify a specific expert's gap_map color for a specific seam."""
    def fn(s, b):
        if not isinstance(b, list): return False, "not a list"
        for r in b:
            if not isinstance(r, dict) or r.get("expert_id") != expert_id: continue
            for g in r.get("gap_map", []):
                if not isinstance(g, dict): continue
                if g.get("seam_code") == seam_code:
                    color = g.get("color")
                    ok = color == expected_color
                    return ok, f"{expert_id}.{seam_code}={color!r} (expected {expected_color!r})"
            return False, f"'{expert_id}' has no gap entry for '{seam_code}'"
        return False, f"expert '{expert_id}' not found in results"
    return Check("QUALITY", f"'{expert_id}'.gap_map['{seam_code}'] == '{expected_color}'", fn)


def _expert_score_approx(expert_id: str, expected: float, tolerance: float = 0.001) -> Check:
    """Quality: verify a specific expert's composite_score equals expected value."""
    def fn(s, b):
        if not isinstance(b, list): return False, "not a list"
        for r in b:
            if isinstance(r, dict) and r.get("expert_id") == expert_id:
                actual = r.get("composite_score", None)
                if actual is None: return False, f"{expert_id} has no composite_score"
                ok = abs(float(actual) - expected) <= tolerance
                return ok, f"{expert_id}.composite_score={actual:.4f} (expected={expected:.4f}±{tolerance})"
        return False, f"expert '{expert_id}' not found"
    return Check("QUALITY", f"'{expert_id}'.composite_score ≈ {expected:.4f}", fn)


def _expert_strength_label(expert_id: str, expected_label: str) -> Check:
    """Quality: verify a specific expert's strength_label."""
    def fn(s, b):
        if not isinstance(b, list): return False, "not a list"
        for r in b:
            if isinstance(r, dict) and r.get("expert_id") == expert_id:
                label = r.get("strength_label")
                ok = label == expected_label
                return ok, f"{expert_id}.strength_label={label!r} (expected {expected_label!r})"
        return False, f"expert '{expert_id}' not found"
    return Check("QUALITY", f"'{expert_id}'.strength_label == '{expected_label}'", fn)


# SCENARIOS  — scores pre-computed and verified against matching_engine.py

SCENARIOS: list[Scenario] = [

    # 1. STANDARD_RANKING — 3 experts, 3 seams, known ordering 
    # Pre-computed scores:
    #   expert-alpha: 0.9173  STRONG_MATCH
    #   expert-beta:  0.6643  POSSIBLE_MATCH
    #   expert-gamma: 0.4900  WEAK_MATCH
    Scenario(
        name="STANDARD_RANKING",
        nestjs_context="ProjectsService.publishProject() "
                       "— CEO publishes RAG project. NestJS calls matching with 3 experts "
                       "to build the shortlist for the CEO dashboard.",
        method="POST",
        path="/llm/matching",
        payload={
            "project_archetype": "1",
            "required_seams_json": [
                {"seam_code": "A↔D", "criticality": "load_bearing"},
                {"seam_code": "D↔E", "criticality": "significant"},
                {"seam_code": "C↔E", "criticality": "contributing"},
            ],
            "required_domains_json": [
                {"domain_code": "A", "required_depth": "OPERATIONAL"},
                {"domain_code": "D", "required_depth": "DEEP"},
                {"domain_code": "E", "required_depth": "OPERATIONAL"},
            ],
            "expert_profiles": [
                {
                    "expert_id": "expert-alpha",
                    "seam_claims": [
                        {"seam_code": "A↔D", "verification_tier": "EVIDENCE_BACKED"},
                        {"seam_code": "D↔E", "verification_tier": "EVIDENCE_BACKED"},
                    ],
                    "domain_depths": [
                        {"domain_code": "A", "depth_level": "DEEP"},
                        {"domain_code": "D", "depth_level": "DEEP"},
                        {"domain_code": "E", "depth_level": "OPERATIONAL"},
                    ],
                    "portfolio_score":   0.92,
                    "archetype_history": ["1", "4"],
                },
                {
                    "expert_id": "expert-beta",
                    "seam_claims": [
                        {"seam_code": "A↔D", "verification_tier": "CLAIMED"},
                        {"seam_code": "D↔E", "verification_tier": "CLAIMED"},
                        {"seam_code": "C↔E", "verification_tier": "EVIDENCE_BACKED"},
                    ],
                    "domain_depths": [
                        {"domain_code": "A", "depth_level": "OPERATIONAL"},
                        {"domain_code": "D", "depth_level": "OPERATIONAL"},
                    ],
                    "portfolio_score":   0.78,
                    "archetype_history": ["1"],
                },
                {
                    "expert_id": "expert-gamma",
                    "seam_claims": [],
                    "domain_depths": [
                        {"domain_code": "A", "depth_level": "DEEP"},
                        {"domain_code": "D", "depth_level": "DEEP"},
                        {"domain_code": "E", "depth_level": "DEEP"},
                    ],
                    "portfolio_score":   0.95,
                    "archetype_history": ["3"],
                },
            ],
        },
        checks=[
            *_shape_checks(3),
            *_rule_checks(3),
            quality_gap_map_colors_valid(),
            # Pre-computed ordering: alpha > beta > gamma
            quality_top_expert_is("expert-alpha"),
            _expert_ranked_above("expert-alpha", "expert-beta"),
            _expert_ranked_above("expert-beta",  "expert-gamma"),
            # Pre-computed scores
            _expert_score_approx("expert-alpha", 0.9173),
            _expert_score_approx("expert-beta",  0.6643),
            _expert_score_approx("expert-gamma", 0.4900),
            # Strength labels derived from scores
            _expert_strength_label("expert-alpha", "STRONG_MATCH"),
            _expert_strength_label("expert-beta",  "POSSIBLE_MATCH"),
            _expert_strength_label("expert-gamma", "WEAK_MATCH"),
            # Gap map colors: EVIDENCE_BACKED=green, CLAIMED=amber, missing=red
            _expert_gap_color("expert-alpha", "A↔D", "green"),
            _expert_gap_color("expert-alpha", "D↔E", "green"),
            _expert_gap_color("expert-alpha", "C↔E", "red"),
            _expert_gap_color("expert-beta",  "A↔D", "amber"),
            _expert_gap_color("expert-gamma", "A↔D", "red"),
        ],
        manual_review=[
            "expert-alpha (0.9173) leads because EVIDENCE_BACKED on the two heaviest "
            "seams (load_bearing + significant). The missing C↔E is only contributing weight.",
            "expert-gamma (0.4900) ranked last despite 0.95 portfolio + all domains "
            "DEEP — zero seam coverage at 40% weight is fatal. Demonstrates why seam "
            "verification is the primary trust signal on this platform.",
        ],
    ),

    # 2. LOAD_BEARING_DOMINANCE — seam criticality determines ranking
    # Pre-computed scores (no required domains → domain_score=1.0 for both):
    #   expert-lb (EVIDENCE_BACKED on load_bearing A↔D): 0.8500  STRONG_MATCH
    #   expert-ce (EVIDENCE_BACKED on contributing C↔E): 0.6500  POSSIBLE_MATCH
    # Score diff = 0.2000 entirely from seam criticality weights (3.0 vs 1.0)
    Scenario(
        name="LOAD_BEARING_DOMINANCE",
        nestjs_context="ProjectsService.publishProject() "
                       "— Two experts with identical profiles except which seam they cover. "
                       "Demonstrates that load_bearing seam coverage outweighs contributing.",
        method="POST",
        path="/llm/matching",
        payload={
            "project_archetype": "1",
            "required_seams_json": [
                {"seam_code": "A↔D", "criticality": "load_bearing"},
                {"seam_code": "C↔E", "criticality": "contributing"},
            ],
            "required_domains_json": [],   # no domain requirements — isolates seam weight
            "expert_profiles": [
                {
                    "expert_id": "expert-lb",
                    "seam_claims": [
                        {"seam_code": "A↔D", "verification_tier": "EVIDENCE_BACKED"},
                    ],
                    "domain_depths": [],
                    "portfolio_score":   0.75,
                    "archetype_history": ["1"],
                },
                {
                    "expert_id": "expert-ce",
                    "seam_claims": [
                        {"seam_code": "C↔E", "verification_tier": "EVIDENCE_BACKED"},
                    ],
                    "domain_depths": [],
                    "portfolio_score":   0.75,
                    "archetype_history": ["1"],
                },
            ],
        },
        checks=[
            *_shape_checks(2),
            *_rule_checks(2),
            quality_gap_map_colors_valid(),
            quality_top_expert_is("expert-lb"),
            _expert_ranked_above("expert-lb", "expert-ce"),
            # Pre-computed: 0.40*(3/4) vs 0.40*(1/4), rest identical
            _expert_score_approx("expert-lb", 0.8500),
            _expert_score_approx("expert-ce", 0.6500),
            _expert_strength_label("expert-lb", "STRONG_MATCH"),
            _expert_strength_label("expert-ce", "POSSIBLE_MATCH"),
            # Gap map colors
            _expert_gap_color("expert-lb", "A↔D", "green"),
            _expert_gap_color("expert-lb", "C↔E", "red"),
            _expert_gap_color("expert-ce", "A↔D", "red"),
            _expert_gap_color("expert-ce", "C↔E", "green"),
        ],
        manual_review=[
            "expert-lb scores 0.8500 vs expert-ce's 0.6500 despite identical portfolios. "
            "The entire 0.20 score difference comes from seam criticality: "
            "load_bearing(3.0) vs contributing(1.0) in a 2-seam set with max_weight=4.",
            "If the scores are NOT 0.8500 and 0.6500, check that matching_engine.py "
            "is using the correct criticality multipliers (3.0/2.0/1.0).",
        ],
    ),

    # 3. PORTFOLIO_VS_COVERAGE — 40% seam weight beats 20% portfolio 
    # Pre-computed scores:
    #   expert-portfolio (0.98 port, 0 seams, 0 domains): 0.3460  WEAK_MATCH
    #   expert-coverage  (0.50 port, full seams+domain):  0.8000  GOOD_MATCH
    Scenario(
        name="PORTFOLIO_VS_COVERAGE",
        nestjs_context="ProjectsService.publishProject() "
                       "— Expert with perfect portfolio but no seam coverage vs expert "
                       "with average portfolio but full seam evidence.",
        method="POST",
        path="/llm/matching",
        payload={
            "project_archetype": "1",
            "required_seams_json": [
                {"seam_code": "A↔D", "criticality": "load_bearing"},
                {"seam_code": "D↔E", "criticality": "significant"},
            ],
            "required_domains_json": [
                {"domain_code": "D", "required_depth": "DEEP"},
            ],
            "expert_profiles": [
                {
                    "expert_id": "expert-portfolio",
                    "seam_claims":       [],   # no seam coverage
                    "domain_depths":     [],   # no domain coverage
                    "portfolio_score":   0.98,
                    "archetype_history": ["1"],
                },
                {
                    "expert_id": "expert-coverage",
                    "seam_claims": [
                        {"seam_code": "A↔D", "verification_tier": "EVIDENCE_BACKED"},
                        {"seam_code": "D↔E", "verification_tier": "EVIDENCE_BACKED"},
                    ],
                    "domain_depths": [
                        {"domain_code": "D", "depth_level": "DEEP"},
                    ],
                    "portfolio_score":   0.50,
                    "archetype_history": [],
                },
            ],
        },
        checks=[
            *_shape_checks(2),
            *_rule_checks(2),
            quality_gap_map_colors_valid(),
            quality_top_expert_is("expert-coverage"),
            _expert_ranked_above("expert-coverage", "expert-portfolio"),
            _expert_score_approx("expert-portfolio", 0.3460),
            _expert_score_approx("expert-coverage",  0.8000),
            _expert_strength_label("expert-portfolio", "WEAK_MATCH"),
            _expert_strength_label("expert-coverage",  "GOOD_MATCH"),
            # expert-portfolio has all red gap map
            _expert_gap_color("expert-portfolio", "A↔D", "red"),
            _expert_gap_color("expert-portfolio", "D↔E", "red"),
            # expert-coverage has all green
            _expert_gap_color("expert-coverage",  "A↔D", "green"),
            _expert_gap_color("expert-coverage",  "D↔E", "green"),
        ],
        manual_review=[
            "expert-coverage (0.8000) beats expert-portfolio (0.3460) despite "
            "having portfolio=0.50 vs 0.98. Seam coverage (40%) + domain (25%) "
            "outweigh portfolio (20%). This is the intended platform behaviour: "
            "verified seam evidence is the primary trust signal, not general reputation.",
            "If expert-portfolio ranked higher, the weight formula in matching_engine.py "
            "is incorrect — seam weight MUST be 0.40.",
        ],
    ),

    # 4. CLAIMED_VS_EVIDENCE_BACKED — tier × criticality interaction 
    # Pre-computed scores:
    #   expert-claimed (CLAIMED on load_bearing A↔D):      0.6900  POSSIBLE_MATCH
    #   expert-eb      (EVIDENCE_BACKED on contributing C↔E): 0.6400  POSSIBLE_MATCH
    # CLAIMED × load_bearing(3.0) > EVIDENCE_BACKED × contributing(1.0)
    # Gap map: expert-claimed = amber, expert-eb = green
    Scenario(
        name="CLAIMED_VS_EVIDENCE_BACKED",
        nestjs_context="ProjectsService.publishProject() "
                       "— Expert with CLAIMED coverage on a critical seam vs expert with "
                       "EVIDENCE_BACKED coverage on a non-critical seam.",
        method="POST",
        path="/llm/matching",
        payload={
            "project_archetype": "1",
            "required_seams_json": [
                {"seam_code": "A↔D", "criticality": "load_bearing"},
                {"seam_code": "C↔E", "criticality": "contributing"},
            ],
            "required_domains_json": [],
            "expert_profiles": [
                {
                    "expert_id": "expert-claimed",
                    "seam_claims": [
                        {"seam_code": "A↔D", "verification_tier": "CLAIMED"},
                    ],
                    "domain_depths": [],
                    "portfolio_score":   0.70,
                    "archetype_history": ["1"],
                },
                {
                    "expert_id": "expert-eb",
                    "seam_claims": [
                        {"seam_code": "C↔E", "verification_tier": "EVIDENCE_BACKED"},
                    ],
                    "domain_depths": [],
                    "portfolio_score":   0.70,
                    "archetype_history": ["1"],
                },
            ],
        },
        checks=[
            *_shape_checks(2),
            *_rule_checks(2),
            quality_gap_map_colors_valid(),
            quality_top_expert_is("expert-claimed"),
            _expert_ranked_above("expert-claimed", "expert-eb"),
            # Pre-computed: CLAIMED(0.5) × LB(3)/4 vs EB(1.0) × CONTRIB(1)/4
            # expert-claimed seam = 0.5*3/4 = 0.375;  expert-eb seam = 1.0*1/4 = 0.25
            _expert_score_approx("expert-claimed", 0.6900),
            _expert_score_approx("expert-eb",      0.6400),
            # Tier → gap map color
            _expert_gap_color("expert-claimed", "A↔D", "amber"),  # CLAIMED → amber
            _expert_gap_color("expert-claimed", "C↔E", "red"),    # missing → red
            _expert_gap_color("expert-eb",      "A↔D", "red"),    # missing → red
            _expert_gap_color("expert-eb",      "C↔E", "green"),  # EVIDENCE_BACKED → green
        ],
        manual_review=[
            "expert-claimed (0.6900) ranks above expert-eb (0.6400) despite having "
            "only CLAIMED (unverified) coverage, because CLAIMED × load_bearing(3.0) "
            "= 0.375 > EVIDENCE_BACKED × contributing(1.0) = 0.25.",
            "This scenario tests the tier × criticality interaction. "
            "CEO sees expert-claimed with an amber (unverified) gap indicator on A↔D, "
            "which correctly signals that the claim is unverified even though this "
            "expert ranks higher overall.",
        ],
    ),

    # 5. SINGLE_EXPERT — minimum case, gap_map completeness
    # Pre-computed score:
    #   expert-solo (CLAIMED on A↔D only, partial domain): 0.3950  WEAK_MATCH
    Scenario(
        name="SINGLE_EXPERT",
        nestjs_context="ProjectsService.publishProject() "
                       "— Only one expert is available to match against the project. "
                       "Verifies that a single result is returned (not empty or error), "
                       "and that gap_map covers all 3 required seams.",
        method="POST",
        path="/llm/matching",
        payload={
            "project_archetype": "1",
            "required_seams_json": [
                {"seam_code": "A↔D", "criticality": "load_bearing"},
                {"seam_code": "D↔E", "criticality": "significant"},
                {"seam_code": "C↔E", "criticality": "contributing"},
            ],
            "required_domains_json": [
                {"domain_code": "A", "required_depth": "OPERATIONAL"},
                {"domain_code": "D", "required_depth": "DEEP"},
            ],
            "expert_profiles": [
                {
                    "expert_id": "expert-solo",
                    "seam_claims": [
                        {"seam_code": "A↔D", "verification_tier": "CLAIMED"},
                    ],
                    "domain_depths": [
                        {"domain_code": "A", "depth_level": "OPERATIONAL"},
                    ],
                    "portfolio_score":   0.60,
                    "archetype_history": [],
                },
            ],
        },
        checks=[
            *_shape_checks(1),
            *_rule_checks(3),   # 3 required seams → each result gap_map has 3 entries
            quality_gap_map_colors_valid(),
            quality_top_expert_is("expert-solo"),
            _expert_score_approx("expert-solo", 0.3950),
            _expert_strength_label("expert-solo", "WEAK_MATCH"),
            # Gap map must cover all 3 required seams
            _expert_gap_color("expert-solo", "A↔D", "amber"),  # CLAIMED
            _expert_gap_color("expert-solo", "D↔E", "red"),    # missing
            _expert_gap_color("expert-solo", "C↔E", "red"),    # missing
        ],
        manual_review=[
            "Was exactly 1 result returned? The endpoint must not error or return "
            "empty list when only 1 expert is provided.",
            "Does expert-solo's gap_map have exactly 3 entries (one per required seam), "
            "not just 1 entry for the seam they cover?",
            "Is expert-solo correctly classified as WEAK_MATCH (0.3950 < 0.55)? "
            "The CEO should see this as a poor match and consider waiting for more experts.",
        ],
    ),

]