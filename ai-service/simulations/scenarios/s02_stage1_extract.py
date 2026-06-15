"""
Simulation scenarios — POST /llm/elicitation/stage1-extract

NestJS trigger: ElicitationService.submitStage1(session_id, symptom_text)

NestJS flow:
  1. CEO completes Stage 1 — free-text description of their AI problem
  2. NestJS sends { symptom_text: string } to ai-service
  3. ai-service extracts:
       symptoms[]            — distinct technical/business pain points
       scale_signals{}       — user_count, data_volume, transaction_rate, latency_requirement
       voids[]               — missing information that blocks quality synthesis
  4. NestJS stores all three in the elicitation_sessions table
  5. Detected voids are carried into Stage 5 and penalise completeness_score
  6. If completeness_score < 0.70, the project is returned to CEO for more detail

Blueprint void taxonomy (from stage1_extract.txt prompt):
  NO_GROUND_TRUTH          — no labelled data or evaluation benchmark
  NO_BASELINE              — no current system to compare against
  UNCLEAR_SUCCESS_METRIC   — vague or unmeasurable success criteria
  DATA_PRIVACY_CONSTRAINT  — sensitive data, compliance risk
  INTEGRATION_UNCLEAR      — how AI connects to existing systems unclear
  TIMELINE_UNREALISTIC     — requested timeline too aggressive
  SCOPE_CREEP_RISK         — too many objectives for a single engagement
"""

from simulations.framework.grader import (
    Check, Scenario,
    shape_status_ok, shape_field_present, shape_field_type,
    shape_list_type, shape_dict_type, shape_list_items_have_keys,
    quality_list_non_empty, quality_list_min_count,
    quality_list_items_min_length, quality_list_items_min_length,
    quality_string_min_length,
)

VALID_VOID_CODES = {
    "NO_GROUND_TRUTH", "NO_BASELINE", "UNCLEAR_SUCCESS_METRIC",
    "DATA_PRIVACY_CONSTRAINT", "INTEGRATION_UNCLEAR",
    "TIMELINE_UNREALISTIC", "SCOPE_CREEP_RISK",
}
VALID_SEVERITIES = {"HIGH", "MEDIUM", "LOW"}


# Shared SHAPE checks 

def _shape_checks() -> list[Check]:
    return [
        shape_status_ok(),
        shape_field_present("symptoms"),
        shape_field_present("scale_signals"),
        shape_field_present("voids"),
        shape_list_type("symptoms"),
        shape_dict_type("scale_signals"),
        shape_list_type("voids"),
        # Each void must have void_code and severity — NestJS reads both
        shape_list_items_have_keys("voids", "void_code", "severity"),
    ]


# Custom quality checks

def _voids_have_valid_codes() -> Check:
    """All void_codes must come from the taxonomy defined in the prompt."""
    def fn(s, b):
        voids = b.get("voids", [])
        if not voids:
            return True, "no voids to check"   # empty is valid
        bad = [
            v.get("void_code") for v in voids
            if isinstance(v, dict) and v.get("void_code") not in VALID_VOID_CODES
        ]
        ok = len(bad) == 0
        return ok, f"all void codes valid" if ok else f"invalid codes: {bad}"
    return Check("QUALITY", "all void_codes from defined taxonomy", fn)


def _voids_have_valid_severities() -> Check:
    """All severity values must be HIGH, MEDIUM, or LOW."""
    def fn(s, b):
        voids = b.get("voids", [])
        if not voids:
            return True, "no voids to check"
        bad = [
            (v.get("void_code"), v.get("severity")) for v in voids
            if isinstance(v, dict) and v.get("severity") not in VALID_SEVERITIES
        ]
        ok = len(bad) == 0
        return ok, "all severities valid" if ok else f"invalid: {bad}"
    return Check("QUALITY", "all void severities in {HIGH, MEDIUM, LOW}", fn)


def _void_detected(void_code: str, severity: str | None = None) -> Check:
    """Quality: a specific void code should appear in the response."""
    label = f"void '{void_code}' detected"
    if severity:
        label += f" with severity={severity}"

    def fn(s, b):
        voids = b.get("voids", [])
        for v in voids:
            if isinstance(v, dict) and v.get("void_code") == void_code:
                found_severity = v.get("severity")
                if severity and found_severity != severity:
                    return (
                        False,
                        f"Found '{void_code}' but severity={found_severity} "
                        f"(expected {severity})",
                    )
                return True, f"Found '{void_code}' severity={found_severity}"
        all_codes = [v.get("void_code") for v in voids if isinstance(v, dict)]
        return False, f"'{void_code}' not found; voids detected: {all_codes}"

    return Check("QUALITY", label, fn)


def _scale_signal_populated(signal_key: str) -> Check:
    """Quality: a specific scale_signals key should be non-null."""
    def fn(s, b):
        signals = b.get("scale_signals", {})
        val = signals.get(signal_key) if isinstance(signals, dict) else None
        ok  = val is not None
        return ok, f"scale_signals.{signal_key}={repr(val)}"
    return Check(
        "QUALITY",
        f"scale_signals.{signal_key} is populated (not null)",
        fn,
    )


def _scale_signals_has_any_value() -> Check:
    """Quality: at least one scale_signals field must be non-null."""
    def fn(s, b):
        signals = b.get("scale_signals", {})
        if not isinstance(signals, dict):
            return False, "scale_signals is not a dict"
        non_null = {k: v for k, v in signals.items() if v is not None}
        ok = len(non_null) > 0
        return ok, (
            f"{len(non_null)}/{len(signals)} signals populated: "
            f"{list(non_null.keys())[:4]}"
        )
    return Check(
        "QUALITY",
        "at least one scale_signals field is populated",
        fn,
    )


def _symptoms_are_full_sentences(min_len: int = 25) -> Check:
    """Quality: symptoms should be descriptive phrases, not single words."""
    return quality_list_items_min_length("symptoms", min_len)


def _response_is_sparse_but_valid() -> Check:
    """
    Quality: for sparse input, an empty symptoms list is ACCEPTABLE.
    This check always passes — it exists to document the expected behaviour.
    """
    def fn(s, b):
        symptoms = b.get("symptoms", [])
        voids    = b.get("voids",    [])
        signals  = b.get("scale_signals", {})
        # All fields must be present and correctly typed (checked by SHAPE),
        # but contents can be empty for sparse input.
        all_typed = (
            isinstance(symptoms, list)
            and isinstance(voids, list)
            and isinstance(signals, dict)
        )
        return all_typed, (
            f"symptoms={len(symptoms)}, voids={len(voids)}, "
            f"signals={len(signals)} fields"
        )
    return Check(
        "QUALITY",
        "sparse input → valid empty/minimal structure returned (not a crash)",
        fn,
    )


# SCENARIOS

SCENARIOS: list[Scenario] = [

    # 1. E-commerce recommendation — rich input with explicit scale
    Scenario(
        name="ECOMMERCE_RECOMMENDATION_RICH",
        nestjs_context="ElicitationService.submitStage1() "
                       "— CEO of e-commerce company describes recommendation problem",
        method="POST",
        path="/llm/elicitation/stage1-extract",
        payload={
            "symptom_text": (
                "Our product recommendation engine keeps suggesting items that customers "
                "already bought last month. We have around 50,000 monthly active users "
                "and about 3 years of purchase history data — roughly 2TB in our warehouse. "
                "We need recommendations to appear in under 500ms or customers leave the page. "
                "New users with no purchase history get completely random suggestions, which is "
                "embarrassing. The worst part is we have no way to measure whether our "
                "recommendations are actually good — we only find out when sales drop or "
                "customers complain. Our current collaborative filtering model was trained "
                "18 months ago and hasn't been updated since."
            ),
        },
        checks=[
            *_shape_checks(),
            # Symptoms should be present and substantive
            quality_list_non_empty("symptoms"),
            _symptoms_are_full_sentences(25),
            # Scale signals should be extracted from the rich input
            _scale_signals_has_any_value(),
            _scale_signal_populated("user_count"),          # "50,000 monthly active users"
            _scale_signal_populated("latency_requirement"), # "under 500ms"
            # Critical void: no evaluation/ground truth system exists
            _void_detected("NO_GROUND_TRUTH"),
            _voids_have_valid_codes(),
            _voids_have_valid_severities(),
        ],
        manual_review=[
            "Are the symptoms specific to THIS problem (recommendation staleness, "
            "cold-start, no eval) — not generic AI problems?",
            "Is NO_GROUND_TRUTH detected with severity=HIGH (not MEDIUM/LOW)? "
            "The absence of evaluation is the most critical gap.",
            "Is the 50k user count and 500ms latency requirement captured in "
            "scale_signals (not just in symptoms)?",
            "Is the 18-month model staleness surfaced as a symptom "
            "(e.g. 'stale model trained 18 months ago')?",
        ],
    ),

    # 2. Healthcare AI — compliance void expected
    Scenario(
        name="HEALTHCARE_COMPLIANCE_AWARE",
        nestjs_context="ElicitationService.submitStage1() "
                       "— Hospital CIO describing AI diagnostic assistant project",
        method="POST",
        path="/llm/elicitation/stage1-extract",
        payload={
            "symptom_text": (
                "We are a 400-bed hospital and we want to build an AI assistant that "
                "helps our radiologists prioritise which X-rays and CT scans to review "
                "first. Right now a radiologist manually reviews everything in queue order "
                "regardless of urgency, so critical cases sometimes wait hours. "
                "We have 8 years of scan data — about 2 million labelled images — "
                "all stored on-premise due to HIPAA requirements. We cannot use any "
                "cloud APIs that send patient data externally. We don't have a clear "
                "definition of what 'better prioritisation' means in measurable terms yet. "
                "We need this deployed within 3 months."
            ),
        },
        checks=[
            *_shape_checks(),
            quality_list_non_empty("symptoms"),
            _voids_have_valid_codes(),
            _voids_have_valid_severities(),
            # Critical: patient data + HIPAA must trigger privacy constraint void
            _void_detected("DATA_PRIVACY_CONSTRAINT"),
            # 'better prioritisation' with no definition = unclear success metric
            _void_detected("UNCLEAR_SUCCESS_METRIC"),
        ],
        manual_review=[
            "Is DATA_PRIVACY_CONSTRAINT detected with severity=HIGH? "
            "HIPAA violations carry serious consequences — this must be HIGH.",
            "Is the 3-month timeline flagged? For a medical AI system with "
            "regulatory constraints, TIMELINE_UNREALISTIC may also apply.",
            "Are the symptoms medically specific (prioritisation delay, "
            "critical case wait times) rather than generic?",
            "Is UNCLEAR_SUCCESS_METRIC present? 'Better prioritisation' has no "
            "numbers — what does success look like (sensitivity, time-to-review)?",
        ],
    ),

    # 3. Fintech fraud detection — scale signals prominent
    Scenario(
        name="FINTECH_HIGH_SCALE",
        nestjs_context="ElicitationService.submitStage1() "
                       "— Payments company describing fraud detection replacement",
        method="POST",
        path="/llm/elicitation/stage1-extract",
        payload={
            "symptom_text": (
                "We process roughly 500,000 payment transactions per day and our "
                "current rule-based fraud detection system blocks about 30% of "
                "legitimate transactions as false positives — costing us both customer "
                "trust and chargeback fees. Real fraud slips through at a rate of "
                "about 0.8% which is 3x higher than our target of 0.25%. "
                "We have 4 years of transaction history with fraud labels from our "
                "fraud team. We have no machine learning model in production yet — "
                "everything is hard-coded business rules. Fraud patterns change fast "
                "and we manually update rules every 2-3 weeks which is unsustainable. "
                "Integration must go through our existing Kafka event stream."
            ),
        },
        checks=[
            *_shape_checks(),
            quality_list_non_empty("symptoms"),
            _scale_signals_has_any_value(),
            _scale_signal_populated("transaction_rate"),  # "500,000 transactions per day"
            # NO_BASELINE deliberately NOT checked.
            # This company HAS a baseline (rule-based system with measured
            # 30% FP rate and 0.8% fraud rate). Correct model behaviour
            # is 0 voids for this well-specified input.
            _voids_have_valid_codes(),
            _voids_have_valid_severities(),
        ],
        manual_review=[
            "Are BOTH thresholds captured as symptoms: 30% FP rate AND "
            "0.8% actual vs 0.25% target fraud rate?",
            "NO_BASELINE should NOT appear — the rule-based system IS the baseline. "
            "If flagged, that is a false positive from the prompt.",
            "INTEGRATION_UNCLEAR should NOT fire — Kafka is explicitly specified.",
            "Voids list may legitimately be empty for this well-specified input.",
        ],
    ),

    # 4. Sparse startup — minimal input, output may be sparse 
    Scenario(
        name="SPARSE_STARTUP",
        nestjs_context="ElicitationService.submitStage1() "
                       "— Early-stage startup CEO writes a very vague problem description",
        method="POST",
        path="/llm/elicitation/stage1-extract",
        payload={
            "symptom_text": (
                "We are a B2B SaaS startup and we need AI to help our sales team "
                "close more deals. We think AI can help somehow."
            ),
        },
        checks=[
            *_shape_checks(),
            # Sparse input → valid empty/minimal structure, not a crash or error
            _response_is_sparse_but_valid(),
            # Voids: at least one should fire (UNCLEAR_SUCCESS_METRIC or SCOPE_CREEP_RISK)
            quality_list_non_empty("voids"),
            _voids_have_valid_codes(),
        ],
        manual_review=[
            "Did the model return a valid (possibly empty) symptoms list WITHOUT "
            "hallucinating specifics that were not in the input?",
            "Were voids detected? UNCLEAR_SUCCESS_METRIC and SCOPE_CREEP_RISK are "
            "both appropriate for 'help sales team close more deals' with no metrics.",
            "Are scale_signals all null? (they should be — no scale info was given)",
            "This scenario grades QUALITY loosely — the key check is that the "
            "model didn't invent symptoms.",
        ],
    ),

    # 5. Contradictory requirements — technical impossibility 
    Scenario(
        name="CONTRADICTORY_REQUIREMENTS",
        nestjs_context="ElicitationService.submitStage1() "
                       "— CEO describes requirements that are technically incompatible",
        method="POST",
        path="/llm/elicitation/stage1-extract",
        payload={
            "symptom_text": (
                "We have a customer support chatbot that gives outdated answers. "
                "We want it to learn from every conversation in real-time — "
                "so it updates its model weights after each customer interaction "
                "and responds with the latest knowledge within 100 milliseconds. "
                "We also want full explainability for every answer so our compliance "
                "team can audit why the AI said what it said. "
                "We need this live in production within 6 weeks."
            ),
        },
        checks=[
            *_shape_checks(),
            quality_list_non_empty("symptoms"),
            # At least one void should be detected — timeline or scope
            quality_list_non_empty("voids"),
            _voids_have_valid_codes(),
            _voids_have_valid_severities(),
        ],
        manual_review=[
            "Did the model detect TIMELINE_UNREALISTIC? 'Full LLM fine-tuning per "
            "request at <100ms' is technically infeasible — this is a HIGH severity gap.",
            "Did the model detect the contradiction between 'real-time weight updates "
            "per conversation' and '100ms response time'? This should appear as a "
            "symptom (not just a void).",
            "Was SCOPE_CREEP_RISK detected? Real-time learning + explainability + "
            "6-week timeline is 3 major requirements bundled together.",
            "Did the model flag UNCLEAR_SUCCESS_METRIC? 'Latest knowledge' and "
            "'full explainability' are vague without measurable definitions.",
        ],
    ),

]