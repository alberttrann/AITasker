"""
Artifact B access guard — 4-condition check.

Artifact B is the technical deep-dive spec (stack, integration method, data schemas).
It is only accessible to an expert once all 4 conditions are met:

  Condition 1 — Engagement lifecycle:
    engagement_state must be CONNECTED or ACTIVE
    (not PENDING = bid not yet selected, not CLOSED/DISPUTED = engagement ended)

  Condition 2 — Bid lifecycle:
    bid_state must be TECH_APPROVED, CEO_REVIEW, or SELECTED
    (TECH_APPROVED = expert capabilities verified by TECH_TEAM)

  Condition 3 — Expert NDA:
    expert must have accepted the platform NDA
    (expert_nda_accepted = True)

  Condition 4 — CEO NDA:
    CEO must have accepted the platform NDA
    (ceo_nda_accepted = True)

Both parties must have signed — Artifact B contains sensitive business context
that must not leak before mutual NDA acceptance.
"""

from dataclasses import dataclass

_ALLOWED_ENGAGEMENT_STATES = {"CONNECTED", "ACTIVE"}
_ALLOWED_BID_STATES        = {"TECH_APPROVED", "CEO_REVIEW", "SELECTED"}


@dataclass(frozen=True)
class GuardResult:
    allowed: bool
    reason:  str | None   # set only on denied


def check(
    engagement_state:   str,
    bid_state:          str,
    expert_nda_accepted: bool,
    ceo_nda_accepted:   bool,
) -> GuardResult:
    """
    Evaluate all 4 conditions and return a GuardResult.

    Conditions are checked in order — the first failure is returned
    so NestJS can surface a specific denial reason to the client.
    """
    if engagement_state not in _ALLOWED_ENGAGEMENT_STATES:
        return GuardResult(
            allowed=False,
            reason=(
                f"Engagement is '{engagement_state}' — "
                f"must be CONNECTED or ACTIVE to access technical specification"
            ),
        )

    if bid_state not in _ALLOWED_BID_STATES:
        return GuardResult(
            allowed=False,
            reason=(
                f"Bid is '{bid_state}' — "
                f"technical capabilities must be verified (TECH_APPROVED or beyond)"
            ),
        )

    if not expert_nda_accepted:
        return GuardResult(
            allowed=False,
            reason="Expert has not accepted the platform NDA",
        )

    if not ceo_nda_accepted:
        return GuardResult(
            allowed=False,
            reason="Client has not accepted the platform NDA",
        )

    return GuardResult(allowed=True, reason=None)