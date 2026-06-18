"""
Tests for GET /projects/{project_id}/artifact-b

Key invariants tested:
  - All 4 conditions must be true simultaneously
  - Each condition failure produces a 403 with a specific reason
  - Order of condition checking is deterministic (engagement → bid → expert NDA → CEO NDA)
  - Valid combinations return 200 with project_id and artifact_b_accessible=True
  - Both CONNECTED and ACTIVE engagement states are accepted
  - TECH_APPROVED, CEO_REVIEW, and SELECTED bid states are accepted
  - No LLM calls — pure conditional logic
"""

import pytest

BASE_PARAMS = {
    "engagement_state":    "CONNECTED",
    "bid_state":           "TECH_APPROVED",
    "expert_nda_accepted": "true",
    "ceo_nda_accepted":    "true",
}


def build_url(project_id: str = "proj-123", **overrides) -> str:
    params = {**BASE_PARAMS, **overrides}
    qs = "&".join(f"{k}={v}" for k, v in params.items())
    return f"/projects/{project_id}/artifact-b?{qs}"


# ── Happy path — all conditions met ──────────────────────────────────────────

async def test_artifact_b_all_conditions_met_returns_200(client):
    res = await client.get(build_url())
    assert res.status_code == 200
    body = res.json()
    assert body["project_id"]            == "proj-123"
    assert body["artifact_b_accessible"] is True


async def test_artifact_b_active_engagement_allowed(client):
    """ACTIVE engagement state (not just CONNECTED) also grants access."""
    res = await client.get(build_url(engagement_state="ACTIVE"))
    assert res.status_code == 200


async def test_artifact_b_ceo_review_bid_allowed(client):
    """CEO_REVIEW bid state is beyond TECH_APPROVED — should be allowed."""
    res = await client.get(build_url(bid_state="CEO_REVIEW"))
    assert res.status_code == 200


async def test_artifact_b_selected_bid_allowed(client):
    """SELECTED bid (engagement active) — should be allowed."""
    res = await client.get(build_url(bid_state="SELECTED", engagement_state="ACTIVE"))
    assert res.status_code == 200


async def test_artifact_b_response_includes_project_id(client):
    """Response must echo back the project_id from the path."""
    res = await client.get(build_url("proj-xyz-789"))
    assert res.status_code == 200
    assert res.json()["project_id"] == "proj-xyz-789"


# ── Condition 1 — Engagement state ───────────────────────────────────────────

async def test_artifact_b_pending_engagement_denied(client):
    res = await client.get(build_url(engagement_state="PENDING"))
    assert res.status_code == 403
    assert "PENDING" in res.json()["detail"]


async def test_artifact_b_closed_engagement_denied(client):
    res = await client.get(build_url(engagement_state="CLOSED"))
    assert res.status_code == 403


async def test_artifact_b_disputed_engagement_denied(client):
    res = await client.get(build_url(engagement_state="DISPUTED"))
    assert res.status_code == 403


# ── Condition 2 — Bid state ───────────────────────────────────────────────────

async def test_artifact_b_submitted_bid_denied(client):
    """SUBMITTED bid — tech team hasn't reviewed yet."""
    res = await client.get(build_url(bid_state="SUBMITTED"))
    assert res.status_code == 403
    assert "SUBMITTED" in res.json()["detail"]


async def test_artifact_b_tech_review_bid_denied(client):
    """TECH_REVIEW bid — still in review, not approved."""
    res = await client.get(build_url(bid_state="TECH_REVIEW"))
    assert res.status_code == 403


async def test_artifact_b_revision_requested_bid_denied(client):
    """REVISION_REQUESTED — expert must revise before access."""
    res = await client.get(build_url(bid_state="REVISION_REQUESTED"))
    assert res.status_code == 403


async def test_artifact_b_declined_bid_denied(client):
    """DECLINED bid — explicitly rejected."""
    res = await client.get(build_url(bid_state="DECLINED"))
    assert res.status_code == 403


async def test_artifact_b_draft_bid_denied(client):
    """DRAFT bid — hasn't even been submitted."""
    res = await client.get(build_url(bid_state="DRAFT"))
    assert res.status_code == 403


# ── Condition 3 — Expert NDA ──────────────────────────────────────────────────

async def test_artifact_b_expert_nda_not_accepted_denied(client):
    res = await client.get(build_url(expert_nda_accepted="false"))
    assert res.status_code == 403
    assert "Expert" in res.json()["detail"] or "NDA" in res.json()["detail"]


# ── Condition 4 — CEO NDA ─────────────────────────────────────────────────────

async def test_artifact_b_ceo_nda_not_accepted_denied(client):
    res = await client.get(build_url(ceo_nda_accepted="false"))
    assert res.status_code == 403
    assert "NDA" in res.json()["detail"]


# ── Condition ordering ────────────────────────────────────────────────────────

async def test_artifact_b_engagement_checked_before_bid(client):
    """Engagement state checked first — its error appears even when bid is also wrong."""
    res = await client.get(build_url(engagement_state="PENDING", bid_state="SUBMITTED"))
    assert res.status_code == 403
    assert "PENDING" in res.json()["detail"]


async def test_artifact_b_bid_checked_before_expert_nda(client):
    """Bid state checked second — its error appears even when NDA is also missing."""
    res = await client.get(build_url(bid_state="SUBMITTED", expert_nda_accepted="false"))
    assert res.status_code == 403
    assert "SUBMITTED" in res.json()["detail"]


async def test_artifact_b_expert_nda_checked_before_ceo_nda(client):
    """Expert NDA checked third — its error appears when CEO NDA is also missing."""
    res = await client.get(build_url(expert_nda_accepted="false", ceo_nda_accepted="false"))
    assert res.status_code == 403
    detail = res.json()["detail"]
    assert "Expert" in detail or "expert" in detail


# ── Guard unit tests (direct, no HTTP) ───────────────────────────────────────

def test_guard_all_pass():
    from app.guards.artifact_b_guard import check
    result = check("CONNECTED", "TECH_APPROVED", True, True)
    assert result.allowed is True
    assert result.reason is None


def test_guard_bad_engagement_state():
    from app.guards.artifact_b_guard import check
    result = check("PENDING", "TECH_APPROVED", True, True)
    assert result.allowed is False
    assert "PENDING" in result.reason


def test_guard_bad_bid_state():
    from app.guards.artifact_b_guard import check
    result = check("CONNECTED", "DRAFT", True, True)
    assert result.allowed is False
    assert "DRAFT" in result.reason


def test_guard_expert_nda_false():
    from app.guards.artifact_b_guard import check
    result = check("CONNECTED", "TECH_APPROVED", False, True)
    assert result.allowed is False
    assert "Expert" in result.reason or "expert" in result.reason.lower()


def test_guard_ceo_nda_false():
    from app.guards.artifact_b_guard import check
    result = check("CONNECTED", "TECH_APPROVED", True, False)
    assert result.allowed is False
    assert "NDA" in result.reason


def test_guard_active_selected_is_valid():
    from app.guards.artifact_b_guard import check
    result = check("ACTIVE", "SELECTED", True, True)
    assert result.allowed is True