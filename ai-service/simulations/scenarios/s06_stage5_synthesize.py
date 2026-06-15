"""
Simulation scenarios — POST /llm/elicitation/stage5-synthesize

NestJS trigger: ElicitationService.submitStage4() → triggers final synthesis

NestJS flow:
  1. CEO completes all 4 elicitation stages
  2. NestJS assembles full session and calls this endpoint
  3. ai-service returns 5 structured JSON objects + completeness_score
  4. NestJS decision:
       completeness_score >= 0.70 → project.state = PUBLISHED
       completeness_score <  0.70 → project.state = RETURNED_TO_CLIENT (with feedback)
  5. NestJS writes all 5 outputs to the project row

Business rules enforced IN CODE:
  payment_amount_vnd = 0 on every milestone (CEO sets real amounts later)
  All enum fields validated against allowed sets before persisting

Output contracts:
  required_seams_json:    [{seam_code, criticality}]
  required_domains_json:  [{domain_code, required_depth}]
  milestone_framework_json: [{milestone_number, title, deliverable_statement,
                              sign_off_authority, payment_amount_vnd}]
  artifact_a_json:        {archetype, volume_tier, business_intent}
  artifact_b_json:        {project_brief, integration_method, tech_constraints}
  completeness_score:     float [0.0, 1.0]
"""

from simulations.framework.grader import (
    Check, Scenario,
    shape_status_ok, shape_field_present, shape_score_in_range,
    shape_list_type, shape_dict_type, shape_list_items_have_keys,
    rule_all_payments_zero,
    quality_score_meets, quality_score_below,
    quality_seams_list_non_empty, quality_domains_list_non_empty,
    quality_milestones_list_non_empty, quality_milestone_deliverables_substantive,
    quality_nested_enum, quality_nested_string_min_length,
    quality_list_min_count, quality_expected_seam_present,
)

VALID_CRITICALITIES  = {"load_bearing", "significant", "contributing"}
VALID_DOMAIN_CODES   = {"A", "B", "C", "D", "E", "F"}
VALID_DEPTHS         = {"SURFACE", "OPERATIONAL", "DEEP"}
VALID_AUTHORITIES    = {"CEO", "TECH_TEAM", "JOINT"}
VALID_ARCHETYPES     = {"1", "2", "3", "4", "5", "6"}
VALID_VOLUME_TIERS   = {"TIER_1", "TIER_2", "TIER_3"}


# Shared SHAPE checks — applied to every scenario 

def _shape_checks() -> list[Check]:
    return [
        shape_status_ok(),
        # All 6 top-level output fields must be present
        shape_field_present("required_seams_json"),
        shape_field_present("required_domains_json"),
        shape_field_present("milestone_framework_json"),
        shape_field_present("artifact_a_json"),
        shape_field_present("artifact_b_json"),
        shape_field_present("completeness_score"),
        # Type contracts
        shape_list_type("required_seams_json"),
        shape_list_type("required_domains_json"),
        shape_list_type("milestone_framework_json"),
        shape_dict_type("artifact_a_json"),
        shape_dict_type("artifact_b_json"),
        shape_score_in_range("completeness_score", 0.0, 1.0),
        # Item-level structure — NestJS reads these fields by name
        shape_list_items_have_keys("required_seams_json", "seam_code", "criticality"),
        shape_list_items_have_keys("required_domains_json", "domain_code", "required_depth"),
        shape_list_items_have_keys(
            "milestone_framework_json",
            "milestone_number", "deliverable_statement",
            "sign_off_authority", "payment_amount_vnd",
        ),
    ]


def _rule_checks() -> list[Check]:
    return [
        # BR: payment_amount_vnd is always 0 — CEO sets amounts after reviewing framework
        rule_all_payments_zero("milestone_framework_json"),
    ]


# Custom quality checks

def _seam_criticalities_valid() -> Check:
    """All seam criticality values must be from the allowed set."""
    def fn(s, b):
        seams = b.get("required_seams_json", [])
        bad = [x.get("criticality") for x in seams
               if isinstance(x, dict) and x.get("criticality") not in VALID_CRITICALITIES]
        ok = len(bad) == 0
        return ok, "all criticalities valid" if ok else f"invalid: {bad}"
    return Check("QUALITY", f"seam criticalities ∈ {sorted(VALID_CRITICALITIES)}", fn)


def _domain_codes_valid() -> Check:
    """All domain_code values must be A-F."""
    def fn(s, b):
        domains = b.get("required_domains_json", [])
        bad = [x.get("domain_code") for x in domains
               if isinstance(x, dict) and x.get("domain_code") not in VALID_DOMAIN_CODES]
        ok = len(bad) == 0
        return ok, "all domain codes valid" if ok else f"invalid: {bad}"
    return Check("QUALITY", f"domain_codes ∈ {sorted(VALID_DOMAIN_CODES)}", fn)


def _depth_values_valid() -> Check:
    """All required_depth values must be SURFACE / OPERATIONAL / DEEP."""
    def fn(s, b):
        domains = b.get("required_domains_json", [])
        bad = [x.get("required_depth") for x in domains
               if isinstance(x, dict) and x.get("required_depth") not in VALID_DEPTHS]
        ok = len(bad) == 0
        return ok, "all depth values valid" if ok else f"invalid: {bad}"
    return Check("QUALITY", f"required_depths ∈ {sorted(VALID_DEPTHS)}", fn)


def _sign_off_authorities_valid() -> Check:
    """All sign_off_authority values must be CEO / TECH_TEAM / JOINT."""
    def fn(s, b):
        milestones = b.get("milestone_framework_json", [])
        bad = [(m.get("milestone_number"), m.get("sign_off_authority")) for m in milestones
               if isinstance(m, dict) and m.get("sign_off_authority") not in VALID_AUTHORITIES]
        ok = len(bad) == 0
        return ok, f"all authorities valid" if ok else f"invalid: {bad}"
    return Check("QUALITY", f"sign_off_authorities ∈ {sorted(VALID_AUTHORITIES)}", fn)


def _artifact_a_archetype_valid() -> Check:
    """artifact_a_json.archetype must be 1-6."""
    def fn(s, b):
        a = b.get("artifact_a_json", {})
        val = a.get("archetype") if isinstance(a, dict) else None
        ok = str(val) in VALID_ARCHETYPES
        return ok, f"artifact_a_json.archetype={repr(val)}"
    return Check("QUALITY", f"artifact_a_json.archetype ∈ {sorted(VALID_ARCHETYPES)}", fn)


def _artifact_a_archetype_equals(expected: str) -> Check:
    """Quality: archetype should match the expected project type."""
    def fn(s, b):
        a = b.get("artifact_a_json", {})
        val = str(a.get("archetype", "")) if isinstance(a, dict) else ""
        ok = val == str(expected)
        return ok, f"artifact_a_json.archetype={repr(val)} (expected={repr(str(expected))})"
    return Check("QUALITY", f"artifact_a_json.archetype == '{expected}'", fn)


def _artifact_a_volume_tier_valid() -> Check:
    """artifact_a_json.volume_tier must be TIER_1/2/3."""
    def fn(s, b):
        a = b.get("artifact_a_json", {})
        val = a.get("volume_tier") if isinstance(a, dict) else None
        ok = val in VALID_VOLUME_TIERS
        return ok, f"artifact_a_json.volume_tier={repr(val)}"
    return Check("QUALITY", f"artifact_a_json.volume_tier ∈ {sorted(VALID_VOLUME_TIERS)}", fn)


def _no_rag_seams_present() -> Check:
    """
    Quality: for non-RAG archetypes, A↔C and A↔D seams should NOT be required.
    These seams are RAG-specific — their presence on a predictive analytics project
    would indicate the LLM has confused the project type.
    """
    rag_seams = {"A↔C", "A↔D"}
    def fn(s, b):
        seams = {x.get("seam_code") for x in b.get("required_seams_json", [])
                 if isinstance(x, dict)}
        wrong = seams & rag_seams
        ok = len(wrong) == 0
        return ok, f"no RAG seams present" if ok else f"RAG seams incorrectly included: {wrong}"
    return Check("QUALITY", "no A↔C or A↔D seams (wrong for non-RAG archetype)", fn)


def _artifact_b_has_content() -> Check:
    """
    Quality: artifact_b_json.integration_method should be substantive.

    The actual artifact_b schema from stage5_synthesize.txt:
      stack_tags, integration_method, legacy_volume, schemas, contracts
    Note: 'project_brief' is NOT a field — check integration_method instead.
    """
    def fn(s, b):
        ab = b.get("artifact_b_json", {})
        if not isinstance(ab, dict):
            return False, "artifact_b_json is not a dict"
        method = ab.get("integration_method", "")
        ok = isinstance(method, str) and len(method) >= 20
        return ok, f"len(artifact_b_json.integration_method)={len(method) if isinstance(method, str) else '?'}: {repr(method[:60])}"
    return Check("QUALITY", "artifact_b_json.integration_method is substantive (>= 20 chars)", fn)


# SCENARIOS

SCENARIOS: list[Scenario] = [

    # 1. RAG_CHATBOT_COMPLETE — Archetype 1, full 4-stage session
    Scenario(
        name="RAG_CHATBOT_COMPLETE",
        nestjs_context="ElicitationService.submitStage4() "
                       "— CEO completes all 4 stages for a customer service RAG chatbot project",
        method="POST",
        path="/llm/elicitation/stage5-synthesize",
        payload={
            "session_id": "sim-s06-rag-001",
            "stage1_symptoms": [
                "Customer service chatbot answers questions with outdated product information",
                "No measurement system to evaluate whether chatbot answers are accurate",
                "Training data is 18 months stale — product catalogue has changed significantly",
                "Customers escalate to human agents 40% of the time due to wrong chatbot answers",
            ],
            "stage2_archetype": "1",
            "stage3_probes": {
                "What does success look like in 90 days?": (
                    "Chatbot correctly answers product questions for at least 90% of queries, "
                    "measured by weekly QA spot-checks on 100 random conversations. "
                    "Human escalation rate drops from 40% to under 15%."
                ),
                "Existing systems to integrate with?": (
                    "Zendesk ticketing system via REST API. "
                    "Internal product catalogue updated daily via PostgreSQL — "
                    "we need the chatbot to stay current with these daily updates."
                ),
                "What data do you have available?": (
                    "18 months of Zendesk conversation logs (200k conversations) "
                    "and the current product catalogue (50k SKUs with descriptions)."
                ),
            },
            "stage4_tech_inputs": {
                "current_stack": "Python FastAPI backend, PostgreSQL, AWS ECS, existing Zendesk integration",
                "data_available": "200k Zendesk conversations, 50k SKU product catalogue in PostgreSQL",
                "latency_requirement": "Under 3 seconds end-to-end chatbot response time",
            },
            "void_list_json": [
                {"void_code": "NO_GROUND_TRUTH",       "severity": "HIGH"},
                {"void_code": "UNCLEAR_SUCCESS_METRIC", "severity": "MEDIUM"},
            ],
        },
        checks=[
            *_shape_checks(),
            *_rule_checks(),
            # Completeness: well-filled session should clear the 0.70 publication gate
            quality_score_meets("completeness_score", 0.70),
            # Output structure quality
            quality_seams_list_non_empty(),
            quality_domains_list_non_empty(),
            quality_milestones_list_non_empty(),
            quality_list_min_count("milestone_framework_json", 2),
            quality_milestone_deliverables_substantive("milestone_framework_json", 30),
            # Enum validity
            _seam_criticalities_valid(),
            _domain_codes_valid(),
            _depth_values_valid(),
            _sign_off_authorities_valid(),
            # Archetype: CEO described RAG chatbot → should be archetype 1
            _artifact_a_archetype_valid(),
            _artifact_a_archetype_equals("1"),
            _artifact_a_volume_tier_valid(),
            quality_nested_string_min_length("artifact_a_json", "business_intent", 20),
            _artifact_b_has_content(),
            # RAG chatbot must require A↔D (retrieval-generation) or A↔C (eval quality)
            quality_expected_seam_present("A↔D"),
        ],
        manual_review=[
            "Are the required_seams appropriate for a RAG chatbot? "
            "Expect: A↔D (load_bearing), possibly A↔C (significant). "
            "B↔E or E↔F would suggest the model confused the archetype.",
            "Is the milestone framework phased logically? "
            "Expect: evaluation setup → retrieval pipeline → integration → monitoring.",
            "Is the completeness_score >= 0.70 (publication gate)? "
            "Both voids were present but the session was well-filled — should publish.",
            "Does artifact_b_json.project_brief accurately describe the RAG chatbot project?",
        ],
    ),

    # 2. RECOMMENDATION_SYSTEM — Archetype 2
    Scenario(
        name="RECOMMENDATION_SYSTEM",
        nestjs_context="ElicitationService.submitStage4() "
                       "— CEO completes all 4 stages for an e-commerce recommendation engine",
        method="POST",
        path="/llm/elicitation/stage5-synthesize",
        payload={
            "session_id": "sim-s06-rec-001",
            "stage1_symptoms": [
                "Product recommendation engine suggests items customers already purchased last month",
                "New users receive completely random suggestions with no personalisation",
                "Recommendation click-through rate is 1.2% vs industry benchmark of 8%",
            ],
            "stage2_archetype": "2",
            "stage3_probes": {
                "What does success look like?": (
                    "Increase recommendation CTR from 1.2% to at least 5% within 6 months. "
                    "Cold-start problem solved: new users should see relevant suggestions "
                    "within their first session based on browsing behaviour."
                ),
                "Data available?": (
                    "3 years of purchase history for 80,000 registered customers, "
                    "product catalogue with 15,000 SKUs and category hierarchy, "
                    "session clickstream data for the past 6 months."
                ),
                "Integration requirements?": (
                    "Recommendations must appear on the homepage, product detail pages, "
                    "and cart page via our existing Node.js API. Response time under 500ms."
                ),
            },
            "stage4_tech_inputs": {
                "current_stack": "Node.js backend, MongoDB, Google Cloud Platform, BigQuery for analytics",
                "data_available": "3yr purchase history, 80k customers, 15k SKUs, 6mo clickstream",
                "latency_requirement": "Recommendations API must respond within 500ms",
            },
            "void_list_json": [],
        },
        checks=[
            *_shape_checks(),
            *_rule_checks(),
            quality_score_meets("completeness_score", 0.70),
            quality_seams_list_non_empty(),
            quality_domains_list_non_empty(),
            quality_milestones_list_non_empty(),
            quality_milestone_deliverables_substantive("milestone_framework_json", 25),
            _seam_criticalities_valid(),
            _domain_codes_valid(),
            _depth_values_valid(),
            _sign_off_authorities_valid(),
            # Archetype 2: collaborative/content filtering recommendation
            _artifact_a_archetype_valid(),
            _artifact_a_archetype_equals("2"),
            _artifact_a_volume_tier_valid(),
            _artifact_b_has_content(),
        ],
        manual_review=[
            "Are the seams appropriate for a recommendation system? "
            "Expect: D↔E (data pipeline → vector store) as load_bearing. "
            "A↔D would be unusual — this is not primarily a RAG system.",
            "Is archetype='2' in artifact_a_json? If archetype='1', the model "
            "confused recommendation with RAG — they are different AI patterns.",
            "Does the milestone framework address the cold-start problem explicitly "
            "(mentioned in stage3 as a requirement)?",
        ],
    ),

    # 3. PREDICTIVE_ANALYTICS_FINTECH — Archetype 5
    Scenario(
        name="PREDICTIVE_ANALYTICS_FINTECH",
        nestjs_context="ElicitationService.submitStage4() "
                       "— CEO completes all 4 stages for a churn prediction model",
        method="POST",
        path="/llm/elicitation/stage5-synthesize",
        payload={
            "session_id": "sim-s06-fin-001",
            "stage1_symptoms": [
                "Monthly customer churn rate is 4.2% with no early warning system",
                "Retention team contacts customers only after they have already cancelled",
                "Current rule-based flagging system identifies only 30% of customers who actually churn",
            ],
            "stage2_archetype": "5",
            "stage3_probes": {
                "What does success look like in 6 months?": (
                    "Predict churn 30 days before it happens. "
                    "Target metrics: recall >= 0.75 and precision >= 0.65 on monthly holdout. "
                    "Retention team should be able to action a prioritised list of at-risk customers weekly."
                ),
                "Data available?": (
                    "5 years of customer transaction data (2 million rows), "
                    "CRM attributes (demographics, tenure, plan type), "
                    "support ticket history — all accessible in Snowflake."
                ),
                "Any latency requirements?": (
                    "No real-time requirement. Batch predictions are fine — "
                    "weekly scoring run is sufficient for the retention team."
                ),
            },
            "stage4_tech_inputs": {
                "current_stack": "Python data science stack, Snowflake, existing Airflow pipelines for ETL",
                "data_available": "5yr customer data, 2M rows in Snowflake, support tickets, CRM",
                "latency_requirement": "Batch predictions acceptable — weekly scoring run is fine",
            },
            "void_list_json": [],
        },
        checks=[
            *_shape_checks(),
            *_rule_checks(),
            quality_score_meets("completeness_score", 0.70),
            quality_seams_list_non_empty(),
            quality_domains_list_non_empty(),
            quality_milestones_list_non_empty(),
            quality_milestone_deliverables_substantive("milestone_framework_json", 25),
            _seam_criticalities_valid(),
            _domain_codes_valid(),
            _depth_values_valid(),
            _sign_off_authorities_valid(),
            # Archetype 5: predictive analytics / classification
            _artifact_a_archetype_valid(),
            _artifact_a_archetype_equals("5"),
            _artifact_a_volume_tier_valid(),
            _artifact_b_has_content(),
            # This is NOT a RAG system — A↔C and A↔D seams should not appear
            _no_rag_seams_present(),
        ],
        manual_review=[
            "Is archetype='5' in artifact_a_json? "
            "If archetype='1', the model incorrectly classified this as RAG.",
            "Are A↔C and A↔D seams absent? They are RAG seams — inappropriate here. "
            "Expected seams: E↔F (training data → model) as load_bearing, "
            "B↔E (monitoring → pipeline) as significant.",
            "Does the milestone framework include a feature engineering milestone? "
            "5 years of Snowflake data requires significant data preparation.",
            "Does artifact_b_json mention the Snowflake + Airflow integration?",
        ],
    ),

    # 4. SPARSE_SESSION — Low completeness, below publication gate
    Scenario(
        name="SPARSE_SESSION",
        nestjs_context="ElicitationService.submitStage4() "
                       "— CEO provided minimal information across all 4 stages",
        method="POST",
        path="/llm/elicitation/stage5-synthesize",
        payload={
            "session_id": "sim-s06-sparse-001",
            "stage1_symptoms": [
                "We want AI to help our business",
            ],
            "stage2_archetype": "1",
            "stage3_probes": {
                "What does success look like?": "Not sure yet, we just want it to work better",
                "Existing systems to integrate with?": "We have some existing systems",
            },
            "stage4_tech_inputs": {
                "current_stack": "",
                "data_available": "",
                "latency_requirement": "",
            },
            "void_list_json": [
                {"void_code": "UNCLEAR_SUCCESS_METRIC", "severity": "HIGH"},
                {"void_code": "NO_GROUND_TRUTH",        "severity": "HIGH"},
                {"void_code": "INTEGRATION_UNCLEAR",    "severity": "HIGH"},
                {"void_code": "NO_BASELINE",            "severity": "HIGH"},
            ],
        },
        checks=[
            *_shape_checks(),
            *_rule_checks(),
            # Critical: 4 HIGH voids + empty stage4 → must NOT publish (< 0.70)
            quality_score_below("completeness_score", 0.70),
            # Enum validity must hold even for sparse output
            _seam_criticalities_valid(),
            _domain_codes_valid(),
            _depth_values_valid(),
            _sign_off_authorities_valid(),
            _artifact_a_archetype_valid(),
            _artifact_a_volume_tier_valid(),
        ],
        manual_review=[
            "Was completeness_score < 0.70? Four HIGH-severity voids plus completely "
            "empty stage4 must force the project back to the CEO.",
            "Did the model still produce structurally valid output (valid enum values, "
            "payment_amount_vnd=0) even for a sparse session?",
            "Were the seams and milestones minimal or empty? "
            "The model should not hallucinate detailed requirements from vague input.",
        ],
    ),

]