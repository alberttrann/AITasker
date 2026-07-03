"""
Simulation scenarios — POST /llm/dispute-eval

NestJS trigger: DisputeService.fileDispute(engagement_id, milestone_id)

NestJS flow:
  1. CEO or Expert files dispute on a milestone
  2. NestJS creates dispute row (state=LAYER_1_EVAL)
  3. NestJS calls this endpoint
  4. ai-service returns { confidence_score, finding }
  5. NestJS decision:
       confidence_score >= 0.80 → AUTO_RESOLVED (finding determines payment)
       confidence_score <  0.80 → MANUAL_REVIEW (admin queue)
  6. NestJS writes llm_confidence to dispute row

Business rules enforced IN CODE (not LLM):
  - finding must be "expert_wins" | "client_wins" — code validated
  - Conservative default: "client_wins" on unexpected values
  - Temperature = 0.0 in the router — responses must be deterministic

Threshold logic lives in NestJS (DisputeService), NOT in ai-service.
The ai-service returns raw (confidence_score, finding) — NestJS applies threshold.
"""

import httpx
from simulations.framework.grader import (
    Check, Scenario,
    shape_status_ok, shape_field_present, shape_score_in_range, shape_enum_value,
    rule_finding_valid,
    quality_equals, quality_score_meets, quality_score_below,
)

AUTO_RESOLVE_THRESHOLD = 0.80   # NestJS threshold — used in quality checks only


# Shared check sets 

def _shape_checks() -> list[Check]:
    """Structural checks NestJS depends on — applied to every scenario."""
    return [
        shape_status_ok(),
        shape_field_present("confidence_score"),
        shape_score_in_range("confidence_score", 0.0, 1.0),
        shape_field_present("finding"),
        shape_enum_value("finding", {"expert_wins", "client_wins"}),
    ]


def _rule_checks() -> list[Check]:
    """
    Business rule: finding must be in the valid set.
    Conservative default: invalid values → client_wins (protects client payment).
    """
    return [
        rule_finding_valid("finding"),
    ]


# Custom quality checks 

def _auto_resolve_confidence() -> Check:
    """
    Quality: confidence should be >= 0.80 for clear-cut cases that
    NestJS would auto-resolve. Below this, NestJS escalates to manual review.
    """
    return quality_score_meets("confidence_score", AUTO_RESOLVE_THRESHOLD)


def _manual_review_confidence() -> Check:
    """
    Quality: for ambiguous cases, confidence should be < 0.80 so NestJS
    correctly routes to manual admin review rather than auto-resolving.
    """
    return quality_score_below("confidence_score", AUTO_RESOLVE_THRESHOLD)


def _idempotency_finding_check(payload: dict) -> Check:
    """
    Special check: makes a SECOND identical HTTP call using sync httpx and
    compares finding + confidence_score to the first call result.

    Temperature=0.0 guarantees identical output on repeated calls.
    This is the only check that makes a network call internally.
    Sync httpx is safe to use here since check functions are called from
    async context but are themselves synchronous.
    """
    def fn(s: int, b: dict) -> tuple[bool, str]:
        first_finding = b.get("finding")
        first_score   = b.get("confidence_score")

        try:
            resp = httpx.post(
                "http://localhost:8000/llm/dispute-eval",
                json=payload,
                timeout=60.0,
            )
            if resp.status_code != 200:
                return False, f"Second call returned {resp.status_code}"
            second        = resp.json()
            second_finding = second.get("finding")
            second_score   = second.get("confidence_score")

            score_match   = (first_score == second_score)
            finding_match = (first_finding == second_finding)
            ok = score_match and finding_match

            return ok, (
                f"call1: finding={first_finding!r} score={first_score} | "
                f"call2: finding={second_finding!r} score={second_score} | "
                f"{'IDENTICAL ✓' if ok else 'MISMATCH ✗'}"
            )
        except Exception as exc:
            return False, f"Second call error: {exc}"

    return Check(
        "RULE",
        "temperature=0.0 → identical finding + score on repeated call",
        fn,
    )


# SCENARIOS

SCENARIOS: list[Scenario] = [

    # 1. CLEAR EXPERT WIN — all criteria met, text-only evidence 
    Scenario(
        name="CLEAR_EXPERT_WIN",
        nestjs_context="DisputeService.fileDispute() "
                       "— CEO disputes milestone claiming deliverable doesn't meet criterion. "
                       "Expert counter-claims it clearly does. Evidence is text-only (no URLs).",
        method="POST",
        path="/llm/dispute-eval",
        payload={
            "criterion_text": (
                "The /api/recommendations endpoint must return HTTP 200 with a JSON array "
                "of at least 5 product IDs within 300ms for 95% of requests "
                "under 500 RPS sustained load."
            ),
            "deliverable_description": (
                "The /api/recommendations endpoint has been deployed to production. "
                "Load testing was performed with k6 at 500 RPS sustained for 10 minutes. "
                "Results: p95 latency = 187ms, p99 = 241ms, p50 = 94ms. "
                "All 5,000 test requests returned HTTP 200 with no errors or timeouts. "
                "Response body: JSON array with minimum 6 and maximum 12 product IDs "
                "across all requests (average 8.4). "
                "No failures observed during the 10-minute test window."
            ),
            "files": [],
        },
        checks=[
            *_shape_checks(),
            *_rule_checks(),
            quality_equals("finding", "expert_wins"),
            _auto_resolve_confidence(),
        ],
        manual_review=[
            "All three criterion conditions are explicitly met in the description: "
            "HTTP 200 ✓, >=5 items ✓, p95<300ms ✓ under 500 RPS ✓. "
            "Was confidence >= 0.80 (auto-resolve territory)?",
            "Was finding=expert_wins with high confidence? If client_wins was returned, "
            "identify which clause the model found ambiguous.",
        ],
    ),

    # 2. CLEAR CLIENT WIN — deliverable missing required evaluation
    Scenario(
        name="CLEAR_CLIENT_WIN",
        nestjs_context="DisputeService.fileDispute() "
                       "— Expert claims milestone is complete. "
                       "CEO disputes: no evaluation was performed against the criterion.",
        method="POST",
        path="/llm/dispute-eval",
        payload={
            "criterion_text": (
                "The fine-tuned classification model must achieve F1-score >= 0.85 "
                "on the client-provided 500-item holdout test set, with precision >= 0.80 "
                "and recall >= 0.80, measured before deployment to production."
            ),
            "deliverable_description": (
                "The model has been fine-tuned using LoRA on Llama-3-8B for 3 epochs "
                "on the provided training dataset. The model has been deployed to the "
                "staging environment and is responding to classification requests. "
                "Training loss converged to 0.18. The model is ready for production use."
            ),
            "files": [],
        },
        checks=[
            *_shape_checks(),
            *_rule_checks(),
            quality_equals("finding", "client_wins"),
            _auto_resolve_confidence(),
        ],
        manual_review=[
            "The criterion requires F1 >= 0.85 on the 500-item holdout set. "
            "The deliverable has NO evaluation results — only training loss. "
            "Was finding=client_wins with high confidence?",
            "Training loss (0.18) is NOT equivalent to holdout F1. "
            "Did the model correctly distinguish these?",
        ],
    ),

    # 3. PARTIAL CRITERIA MET — one clause met, one clause failed 
    Scenario(
        name="PARTIAL_CRITERIA_MET",
        nestjs_context="DisputeService.fileDispute() "
                       "— Expert claims milestone complete. Latency criterion met but "
                       "error rate criterion not met. CEO disputes.",
        method="POST",
        path="/llm/dispute-eval",
        payload={
            "criterion_text": (
                "The API must achieve p95 response time below 200ms AND an error rate "
                "below 0.1% under 1,000 RPS sustained load for a minimum of 30 minutes."
            ),
            "deliverable_description": (
                "Load testing completed with k6 at 1,000 RPS for 35 minutes. "
                "p95 latency: 185ms — below the 200ms threshold. "
                "p99 latency: 312ms. "
                "Error rate: 0.31% — this was caused by database connection pool "
                "exhaustion under peak load. "
                "The team is aware of the error rate issue and has a fix planned. "
                "Latency performance is excellent and exceeds requirements."
            ),
            "files": [],
        },
        checks=[
            *_shape_checks(),
            *_rule_checks(),
            # Both conditions must be met — error rate 0.31% > 0.1% target
            quality_equals("finding", "client_wins"),
        ],
        manual_review=[
            "The criterion is a compound AND — both conditions must be met. "
            "Latency: 185ms < 200ms ✓. Error rate: 0.31% > 0.1% ✗. "
            "Was finding=client_wins? An 'I'll fix it later' note doesn't meet the criterion.",
            "Did the model correctly identify WHICH clause failed (error rate, not latency)?",
            "Was confidence high or low? This should be a high-confidence client_wins "
            "since the error rate failure is explicitly stated.",
        ],
    ),

    # 4. AMBIGUOUS SUBJECTIVE CRITERION — low confidence expected
    Scenario(
        name="AMBIGUOUS_SUBJECTIVE_CRITERION",
        nestjs_context="DisputeService.fileDispute() "
                       "— CEO disputes deliverable. But the criterion itself is vague "
                       "and unmeasurable — dispute should go to MANUAL_REVIEW.",
        method="POST",
        path="/llm/dispute-eval",
        payload={
            "criterion_text": (
                "The dashboard UI should be easy to use, modern-looking, "
                "and should feel intuitive to non-technical stakeholders."
            ),
            "deliverable_description": (
                "Delivered a React dashboard built with Material UI components. "
                "The layout uses a dark sidebar with a white content area. "
                "Navigation follows standard patterns with a top bar and side menu. "
                "The colour scheme uses blue as the primary colour."
            ),
            "files": [],
        },
        checks=[
            *_shape_checks(),
            *_rule_checks(),
            # Subjective criterion → model should be uncertain → low confidence
            # → NestJS routes to MANUAL_REVIEW (confidence < 0.80)
            _manual_review_confidence(),
        ],
        manual_review=[
            "Was confidence_score < 0.80? The criterion ('easy to use', 'intuitive', "
            "'modern-looking') is entirely subjective and the deliverable provides ZERO "
            "objective evidence — no user testing, no task completion metrics, no "
            "stakeholder sign-off. The model should express uncertainty (< 0.80).",
            "What was the finding? Either is defensible — the key result is LOW confidence.",
            "If confidence >= 0.80: the model over-committed on a subjective criterion "
            "with no empirical evidence. Consider strengthening dispute_eval.txt prompt "
            "to instruct low confidence on unmeasurable-criterion + assertion-only delivery.",
        ],
    ),

    # 5. VAGUE DELIVERABLE — criterion clear, evidence description vague 
    Scenario(
        name="VAGUE_DELIVERABLE_DESCRIPTION",
        nestjs_context="DisputeService.fileDispute() "
                       "— Criterion is objective and measurable. Expert's deliverable "
                       "description is vague. CEO disputes, claiming burden of proof not met.",
        method="POST",
        path="/llm/dispute-eval",
        payload={
            "criterion_text": (
                "The system must handle 10,000 concurrent users with response times "
                "below 500ms for 99% of requests and zero data loss during peak load."
            ),
            "deliverable_description": (
                "The system has been deployed and load testing was performed. "
                "Results were satisfactory and the system performed well under load. "
                "The infrastructure team confirmed the system is production-ready."
            ),
            "files": [],
        },
        checks=[
            *_shape_checks(),
            *_rule_checks(),
            # Vague delivery description cannot prove a specific measurable criterion
            # Conservative default: unclear evidence = client_wins
            quality_equals("finding", "client_wins"),
        ],
        manual_review=[
            "The criterion is specific (10k concurrent users, <500ms p99, zero data loss). "
            "The delivery description says 'satisfactory' with no numbers. "
            "Was finding=client_wins? 'Satisfactory' does not prove <500ms p99.",
            "Was confidence high (clear client_wins) or low (ambiguous)? "
            "The prompt instructs: 'Do not give benefit of the doubt beyond what is "
            "explicitly stated.' Vague delivery without numbers should be high-confidence "
            "client_wins.",
        ],
    ),

    # 6. IDEMPOTENCY — identical payload sent twice, results must match
    Scenario(
        name="IDEMPOTENCY_CHECK",
        nestjs_context="DisputeService.fileDispute() "
                       "— Verifies temperature=0.0 guarantee: identical payloads must "
                       "return identical finding AND identical confidence_score.",
        method="POST",
        path="/llm/dispute-eval",
        payload={
            "criterion_text": (
                "The data migration must complete within 4 hours with zero records lost, "
                "verified by comparing source row count to destination row count "
                "after migration completes."
            ),
            "deliverable_description": (
                "Migration completed in 3h 42m. "
                "Source database row count: 4,721,338 records across 12 tables. "
                "Destination database row count: 4,721,338 records across 12 tables. "
                "Row counts match exactly. Migration log shows zero errors or skipped records. "
                "Spot-checked 500 random records manually — all data integrity confirmed."
            ),
            "files": [],
        },
        checks=[
            *_shape_checks(),
            *_rule_checks(),
            # Primary purpose: verify determinism
            # The second call is made INSIDE this check using sync httpx
            _idempotency_finding_check({
                "criterion_text": (
                    "The data migration must complete within 4 hours with zero records lost, "
                    "verified by comparing source row count to destination row count "
                    "after migration completes."
                ),
                "deliverable_description": (
                    "Migration completed in 3h 42m. "
                    "Source database row count: 4,721,338 records across 12 tables. "
                    "Destination database row count: 4,721,338 records across 12 tables. "
                    "Row counts match exactly. Migration log shows zero errors or skipped records. "
                    "Spot-checked 500 random records manually — all data integrity confirmed."
                ),
                "files": [],
            }),
            # Secondary: this scenario should clearly be expert_wins
            quality_equals("finding", "expert_wins"),
            _auto_resolve_confidence(),
        ],
        manual_review=[
            "Did both calls return identical finding AND identical confidence_score? "
            "Any mismatch means temperature=0.0 is not working as expected.",
            "The criterion is objectively met: time 3h42m < 4h, row counts match exactly. "
            "Was finding=expert_wins with confidence >= 0.80?",
            "Note: this scenario makes 2 API calls and takes ~2x the usual time.",
        ],
    ),

]