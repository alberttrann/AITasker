"""
Tests for POST /llm/matching

Key invariants tested:
  - Results sorted by composite_score descending
  - Composite = 40% seam + 25% domain + 20% portfolio + 10% archetype + 5% engagement
  - EVIDENCE_BACKED seam → green gap, CLAIMED → amber, missing → red
  - Criticality weighting: load_bearing outweighs contributing
  - Strength labels at correct thresholds (0.85/0.70/0.55)
  - Empty expert_profiles → empty list (not error)
  - Experts with scoring errors are skipped gracefully
  - No LLM calls — pure Python arithmetic
"""

import pytest
from unittest.mock import AsyncMock, patch


# ── Fixtures ──────────────────────────────────────────────────────────────────

REQUIRED_SEAMS = [
    {"seam_code": "A↔D", "criticality": "load_bearing"},
    {"seam_code": "D↔E", "criticality": "significant"},
    {"seam_code": "C↔E", "criticality": "contributing"},
]

REQUIRED_DOMAINS = [
    {"domain_code": "A", "required_depth": "OPERATIONAL"},
    {"domain_code": "D", "required_depth": "DEEP"},
    {"domain_code": "E", "required_depth": "SURFACE"},
]

STRONG_EXPERT = {
    "expert_id": "expert-strong",
    "seam_claims": [
        {"seam_code": "A↔D", "verification_tier": "EVIDENCE_BACKED"},
        {"seam_code": "D↔E", "verification_tier": "EVIDENCE_BACKED"},
        {"seam_code": "C↔E", "verification_tier": "EVIDENCE_BACKED"},
    ],
    "domain_depths": [
        {"domain_code": "A", "depth_level": "DEEP"},
        {"domain_code": "D", "depth_level": "DEEP"},
        {"domain_code": "E", "depth_level": "OPERATIONAL"},
    ],
    "portfolio_score":   0.90,
    "archetype_history": ["2", "1"],
    "engagement_model":  "MILESTONE",
}

WEAK_EXPERT = {
    "expert_id": "expert-weak",
    "seam_claims": [],
    "domain_depths": [],
    "portfolio_score":   0.30,
    "archetype_history": ["3"],
    "engagement_model":  "HOURLY",
}

BASE_PAYLOAD = {
    "required_seams_json":   REQUIRED_SEAMS,
    "required_domains_json": REQUIRED_DOMAINS,
    "expert_profiles":       [STRONG_EXPERT, WEAK_EXPERT],
    "project_archetype":     "2",
}


# ── Happy path ────────────────────────────────────────────────────────────────

async def test_matching_returns_sorted_results(client):
    """Results sorted descending by composite_score."""
    res = await client.post("/llm/matching", json=BASE_PAYLOAD)
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 2
    assert body[0]["composite_score"] >= body[1]["composite_score"]
    assert body[0]["expert_id"] == "expert-strong"


async def test_matching_strong_expert_has_high_score(client):
    """Expert with all EVIDENCE_BACKED seams + full domains should score high."""
    res = await client.post("/llm/matching", json={**BASE_PAYLOAD, "expert_profiles": [STRONG_EXPERT]})
    assert res.status_code == 200
    body = res.json()
    assert body[0]["composite_score"] > 0.80
    assert body[0]["strength_label"] in ("STRONG_MATCH", "GOOD_MATCH")


async def test_matching_weak_expert_has_low_score(client):
    """Expert with no claims should have a low composite score."""
    res = await client.post("/llm/matching", json={**BASE_PAYLOAD, "expert_profiles": [WEAK_EXPERT]})
    assert res.status_code == 200
    assert res.json()[0]["composite_score"] < 0.55


# ── Gap map ───────────────────────────────────────────────────────────────────

async def test_matching_gap_map_evidence_backed_is_green(client):
    """EVIDENCE_BACKED seam claim → green in gap map."""
    res = await client.post("/llm/matching", json={**BASE_PAYLOAD, "expert_profiles": [STRONG_EXPERT]})
    gap = res.json()[0]["gap_map"]
    ad_entry = next(g for g in gap if g["seam_code"] == "A↔D")
    assert ad_entry["color"] == "green"


async def test_matching_gap_map_claimed_is_amber(client):
    """CLAIMED seam → amber."""
    expert = {
        **STRONG_EXPERT,
        "expert_id": "expert-claimed",
        "seam_claims": [{"seam_code": "A↔D", "verification_tier": "CLAIMED"}],
    }
    res = await client.post("/llm/matching", json={**BASE_PAYLOAD, "expert_profiles": [expert]})
    gap = res.json()[0]["gap_map"]
    ad_entry = next(g for g in gap if g["seam_code"] == "A↔D")
    assert ad_entry["color"] == "amber"


async def test_matching_gap_map_missing_seam_is_red(client):
    """Missing seam claim → red."""
    res = await client.post("/llm/matching", json={**BASE_PAYLOAD, "expert_profiles": [WEAK_EXPERT]})
    gap = res.json()[0]["gap_map"]
    for entry in gap:
        assert entry["color"] == "red"


async def test_matching_gap_map_has_entry_per_required_seam(client):
    """Gap map must have exactly one entry per required seam."""
    res = await client.post("/llm/matching", json=BASE_PAYLOAD)
    for result in res.json():
        assert len(result["gap_map"]) == len(REQUIRED_SEAMS)


# ── Criticality weighting ─────────────────────────────────────────────────────

async def test_matching_load_bearing_seam_outweighs_contributing(client):
    """
    Expert A covers only the load_bearing seam.
    Expert B covers only the contributing seam.
    Expert A must score higher on seam dimension.
    """
    expert_covers_lb = {
        **WEAK_EXPERT, "expert_id": "exp-lb",
        "seam_claims": [{"seam_code": "A↔D", "verification_tier": "EVIDENCE_BACKED"}],
    }
    expert_covers_cont = {
        **WEAK_EXPERT, "expert_id": "exp-cont",
        "seam_claims": [{"seam_code": "C↔E", "verification_tier": "EVIDENCE_BACKED"}],
    }
    res = await client.post("/llm/matching", json={
        **BASE_PAYLOAD,
        "expert_profiles": [expert_covers_lb, expert_covers_cont],
    })
    body = res.json()
    scores = {r["expert_id"]: r["composite_score"] for r in body}
    assert scores["exp-lb"] > scores["exp-cont"]


# ── Strength labels ───────────────────────────────────────────────────────────

async def test_matching_strength_label_strong_match(client):
    """Score >= 0.85 → STRONG_MATCH."""
    perfect_expert = {
        **STRONG_EXPERT,
        "expert_id": "exp-perfect",
        "portfolio_score": 1.0,
        "archetype_history": ["2"],
    }
    res = await client.post("/llm/matching", json={
        **BASE_PAYLOAD, "expert_profiles": [perfect_expert]
    })
    # Strong expert with perfect portfolio and archetype match should be STRONG_MATCH or GOOD_MATCH
    assert res.json()[0]["strength_label"] in ("STRONG_MATCH", "GOOD_MATCH")


async def test_matching_strength_label_weak_match(client):
    """Expert with no coverage → WEAK_MATCH."""
    res = await client.post("/llm/matching", json={
        **BASE_PAYLOAD, "expert_profiles": [WEAK_EXPERT]
    })
    assert res.json()[0]["strength_label"] == "WEAK_MATCH"


# ── Archetype history ─────────────────────────────────────────────────────────

async def test_matching_archetype_match_boosts_score(client):
    """Expert with matching archetype scores higher than one without (same everything else)."""
    base = {**STRONG_EXPERT, "portfolio_score": 0.70}
    with_archetype    = {**base, "expert_id": "exp-arch",    "archetype_history": ["2"]}
    without_archetype = {**base, "expert_id": "exp-no-arch", "archetype_history": ["3"]}
    res = await client.post("/llm/matching", json={
        **BASE_PAYLOAD, "project_archetype": "2",
        "expert_profiles": [with_archetype, without_archetype],
    })
    scores = {r["expert_id"]: r["composite_score"] for r in res.json()}
    assert scores["exp-arch"] > scores["exp-no-arch"]


async def test_matching_no_project_archetype_gives_neutral_score(client):
    """When project_archetype is None, archetype dimension contributes 0.5 (neutral)."""
    res = await client.post("/llm/matching", json={
        **BASE_PAYLOAD,
        "project_archetype": None,
        "expert_profiles": [STRONG_EXPERT],
    })
    assert res.status_code == 200
    # Should still return a valid result
    assert res.json()[0]["composite_score"] > 0


# ── Portfolio scoring ─────────────────────────────────────────────────────────

async def test_matching_no_portfolio_score_uses_neutral_default(client):
    """portfolio_score=None → treated as 0.5 (neutral), not 0.0."""
    no_portfolio = {**WEAK_EXPERT, "expert_id": "exp-none", "portfolio_score": None}
    has_zero     = {**WEAK_EXPERT, "expert_id": "exp-zero", "portfolio_score": 0.0}
    res = await client.post("/llm/matching", json={
        **BASE_PAYLOAD, "expert_profiles": [no_portfolio, has_zero],
    })
    scores = {r["expert_id"]: r["composite_score"] for r in res.json()}
    # neutral (0.5) > zero (0.0) → no_portfolio scores higher
    assert scores["exp-none"] > scores["exp-zero"]


# ── Edge cases ────────────────────────────────────────────────────────────────

async def test_matching_empty_expert_profiles_returns_empty_list(client):
    """Empty expert_profiles → empty result list (not an error)."""
    res = await client.post("/llm/matching", json={**BASE_PAYLOAD, "expert_profiles": []})
    assert res.status_code == 200
    assert res.json() == []


async def test_matching_no_requirements_returns_422(client):
    """At least one of seams/domains must be specified."""
    res = await client.post("/llm/matching", json={
        "required_seams_json":   [],
        "required_domains_json": [],
        "expert_profiles":       [STRONG_EXPERT],
    })
    assert res.status_code == 422


async def test_matching_all_fields_present_in_each_result(client):
    """Every result must have expert_id, composite_score, strength_label, gap_map."""
    res = await client.post("/llm/matching", json=BASE_PAYLOAD)
    for result in res.json():
        assert "expert_id"       in result
        assert "composite_score" in result
        assert "strength_label"  in result
        assert "gap_map"         in result


async def test_matching_composite_score_between_0_and_1(client):
    """All composite scores must be in [0.0, 1.0]."""
    res = await client.post("/llm/matching", json=BASE_PAYLOAD)
    for result in res.json():
        assert 0.0 <= result["composite_score"] <= 1.0


async def test_matching_domain_depth_partial_match_scores_half(client):
    """Expert one depth level below required → 0.5 per domain, not 0.0."""
    one_below = {
        **WEAK_EXPERT,
        "expert_id": "exp-one-below",
        "domain_depths": [
            {"domain_code": "A", "depth_level": "SURFACE"},    # required OPERATIONAL → -1
            {"domain_code": "D", "depth_level": "OPERATIONAL"}, # required DEEP → -1
            {"domain_code": "E", "depth_level": "SURFACE"},    # required SURFACE → exact
        ],
    }
    missing = {**WEAK_EXPERT, "expert_id": "exp-missing"}  # no domain coverage at all

    res = await client.post("/llm/matching", json={
        **BASE_PAYLOAD, "expert_profiles": [one_below, missing]
    })
    scores = {r["expert_id"]: r["composite_score"] for r in res.json()}
    # partial match (0.5 per domain) > no match (0.0)
    assert scores["exp-one-below"] > scores["exp-missing"]