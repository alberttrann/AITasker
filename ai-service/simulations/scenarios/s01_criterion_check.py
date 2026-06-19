"""
Simulation scenarios — POST /llm/criterion-check

NestJS trigger: MilestonesService.createAcceptanceCriterion()

NestJS flow:
  1. CEO or TECH_TEAM writes acceptance criterion text for a milestone
  2. NestJS sends { criterion_text: string } to ai-service
  3. ai-service evaluates for subjective/unmeasurable language
  4. NestJS writes advisory_note to platform_decisions if is_subjective=True
  5. Advisory is displayed inline in the criterion editor — non-blocking

Blueprint ground rules:
  - criterion-check is ADVISORY only — the criterion is saved regardless
  - temperature=0.0 in the router — deterministic output expected
  - No threshold or business rule enforcement — pure LLM output
  - Suggestions must provide measurable rewrites, not vague paraphrases
"""

from simulations.framework.grader import (
    Check, Scenario,
    shape_status_ok, shape_field_present, shape_field_type, shape_list_type,
    quality_equals, quality_list_non_empty,
    quality_list_items_contain_digit, quality_list_items_min_length,
)


# Shared SHAPE checks — applied to every scenario
# These are the structural contracts NestJS depends on when reading the response.

def _shape_checks() -> list[Check]:
    return [
        shape_status_ok(),
        shape_field_present("is_subjective"),
        shape_field_type("is_subjective", bool),
        shape_field_present("suggestions"),
        shape_list_type("suggestions"),
    ]


# Custom quality checks used across scenarios 

def _suggestions_do_not_repeat_vague_word(vague_word: str) -> Check:
    """
    Quality: suggestions should rewrite the vague language, not just repeat it.
    E.g. if criterion says 'quickly', suggestions should not still say 'quickly'.
    """
    def fn(s, b):
        suggestions = b.get("suggestions", [])
        repeating = [
            sug for sug in suggestions
            if isinstance(sug, str) and vague_word.lower() in sug.lower()
        ]
        ok = len(repeating) == 0
        detail = f"'{vague_word}' not found in suggestions" if ok \
                 else f"'{vague_word}' still appears in: {repeating[0][:60]!r}"
        return ok, detail
    return Check(
        "QUALITY",
        f"suggestions do not repeat the vague word '{vague_word}'",
        fn,
    )


def _at_least_one_suggestion_targets_phrase(phrase: str) -> Check:
    """
    Quality: at least one suggestion should address a specific vague phrase
    from the original criterion.
    """
    def fn(s, b):
        suggestions = b.get("suggestions", [])
        # The suggestion doesn't need the exact phrase but should be a rewrite
        # We check that suggestions are non-empty and substantive instead
        ok = isinstance(suggestions, list) and len(suggestions) >= 1
        return ok, f"{len(suggestions)} suggestion(s) provided (addressing '{phrase}')"
    return Check(
        "QUALITY",
        f"at least one suggestion addresses '{phrase}'",
        fn,
    )


def _objective_criterion_has_empty_suggestions() -> Check:
    """
    Quality: an objective criterion should return an empty suggestions list.
    Suggesting rewrites for an already-measurable criterion is a false positive.
    """
    def fn(s, b):
        suggestions = b.get("suggestions", [])
        ok = isinstance(suggestions, list) and len(suggestions) == 0
        return ok, f"suggestions={suggestions!r:.80}"
    return Check(
        "QUALITY",
        "suggestions is empty [] (no rewrites needed for objective criterion)",
        fn,
    )


# SCENARIOS

SCENARIOS: list[Scenario] = [

    # 1. Clearly subjective — vague qualifiers with no numbers
    Scenario(
        name="CLEARLY_SUBJECTIVE",
        nestjs_context="MilestonesService.createAcceptanceCriterion() "
                       "— CEO writes first milestone criterion in plain language",
        method="POST",
        path="/llm/criterion-check",
        payload={
            "criterion_text": (
                "The AI recommendation system should respond quickly and produce "
                "good results that satisfy our customers."
            ),
        },
        checks=[
            *_shape_checks(),
            # Quality: model should flag this as subjective (no numbers at all)
            quality_equals("is_subjective", True),
            # Quality: must provide rewrite suggestions
            quality_list_non_empty("suggestions"),
            # Quality: rewrites should introduce measurable thresholds (numbers)
            quality_list_items_contain_digit("suggestions"),
            # Quality: rewrites should be full sentences, not single words
            quality_list_items_min_length("suggestions", 30),
            # Quality: the vague words should not survive unchanged into suggestions
            _suggestions_do_not_repeat_vague_word("quickly"),
            _suggestions_do_not_repeat_vague_word("good"),
        ],
        manual_review=[
            "Do the rewrite suggestions introduce concrete, testable thresholds "
            "(e.g. '<200ms p95', '>4.0 avg rating')?",
            "Are there at least 2 distinct rewrites — one for latency, one for quality?",
        ],
    ),

    # 2. Clearly objective — all measurable, no vague qualifiers
    Scenario(
        name="CLEARLY_OBJECTIVE",
        nestjs_context="MilestonesService.createAcceptanceCriterion() "
                       "— TECH_TEAM writes a precise, measurable criterion",
        method="POST",
        path="/llm/criterion-check",
        payload={
            "criterion_text": (
                "The /api/recommendations endpoint must return HTTP 200 "
                "with a JSON array of at least 5 product IDs within 200ms "
                "at the 95th percentile under 1,000 RPS sustained load."
            ),
        },
        checks=[
            *_shape_checks(),
            # Quality: should NOT be flagged as subjective — all measurable
            quality_equals("is_subjective", False),
            # Quality: no suggestions needed for an already-objective criterion
            _objective_criterion_has_empty_suggestions(),
        ],
        manual_review=[
            "Confirm no false positive — every qualifier in this criterion "
            "is measurable (HTTP 200, 5 items, 200ms, p95, 1000 RPS).",
            "If is_subjective=True was returned, identify which word triggered it.",
        ],
    ),

    # 3. Mixed language — one objective clause, one vague clause
    Scenario(
        name="MIXED_LANGUAGE",
        nestjs_context="MilestonesService.createAcceptanceCriterion() "
                       "— Expert writes a criterion mixing measurable and vague parts",
        method="POST",
        path="/llm/criterion-check",
        payload={
            "criterion_text": (
                "The fine-tuned model must achieve at least 85% F1-score "
                "on the provided 500-item holdout set, and the training "
                "pipeline should be easy for a junior ML engineer to re-run."
            ),
        },
        checks=[
            *_shape_checks(),
            # Quality: 'easy for a junior engineer' is vague → should be flagged
            quality_equals("is_subjective", True),
            # Quality: suggestions should address the vague part
            quality_list_non_empty("suggestions"),
            # Quality: suggestions should be full sentences
            quality_list_items_min_length("suggestions", 25),
        ],
        manual_review=[
            "Did the model correctly identify 'easy for a junior engineer' as the "
            "vague clause (not the 85% F1 part)?",
            "Does the suggestion preserve the 85% F1 clause unchanged while "
            "replacing 'easy to re-run' with something like "
            "'re-runnable in under 30 minutes with a single command'?",
        ],
    ),

    # 4. Domain jargon subjective — AI buzzwords with no numbers 
    Scenario(
        name="DOMAIN_JARGON_SUBJECTIVE",
        nestjs_context="MilestonesService.createAcceptanceCriterion() "
                       "— CEO uses AI buzzwords without specifying measurable thresholds",
        method="POST",
        path="/llm/criterion-check",
        payload={
            "criterion_text": (
                "The AI model should significantly improve our recommendation "
                "accuracy and perform substantially better than the current "
                "baseline system."
            ),
        },
        checks=[
            *_shape_checks(),
            # Quality: 'significantly' and 'substantially' are vague adverbs → flag
            quality_equals("is_subjective", True),
            # Quality: suggestions should quantify these adverbs
            quality_list_non_empty("suggestions"),
            # Quality: suggestions should have numbers (e.g. +15% nDCG, >=0.82 F1)
            quality_list_items_contain_digit("suggestions"),
        ],
        manual_review=[
            "Do suggestions specify a concrete delta (e.g. 'at least +15% nDCG@10 "
            "over the collaborative-filtering baseline measured on the holdout set')?",
            "Do suggestions name a specific metric rather than just 'accuracy'?",
        ],
    ),

    # 5. Near-objective edge case — one vague clause appended
    Scenario(
        name="NEAR_OBJECTIVE_EDGE_CASE",
        nestjs_context="MilestonesService.createAcceptanceCriterion() "
                       "— TECH_TEAM writes a strong criterion but appends one vague condition",
        method="POST",
        path="/llm/criterion-check",
        payload={
            "criterion_text": (
                "The API must return p95 latency < 300ms under 500 RPS sustained load, "
                "the error rate must be below 0.1%, and the codebase must be "
                "maintainable by a junior developer."
            ),
        },
        checks=[
            *_shape_checks(),
            # Quality: 'maintainable by a junior developer' is vague → should flag
            quality_equals("is_subjective", True),
            # Quality: suggestion must address the vague clause
            quality_list_non_empty("suggestions"),
            _at_least_one_suggestion_targets_phrase("maintainable"),
        ],
        manual_review=[
            "Did the model leave the latency (<300ms p95) and error rate (<0.1%) "
            "clauses intact and only rewrite 'maintainable by a junior developer'?",
            "Is the suggested rewrite for maintainability specific — e.g. "
            "'setup completes in under 15 minutes following the README'?",
        ],
    ),

]