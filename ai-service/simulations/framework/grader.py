"""
Grader — check definitions, scenario execution, result dataclasses.

ARCHITECTURE
------------
Check: a labelled callable that evaluates (status_code, body) → (passed, detail).
  Three tiers:
    SHAPE   — automated, binary, always blocking. Validates structure.
    RULE    — automated, binary, always blocking. Validates business rules.
    QUALITY — automated heuristic, non-blocking. Grades output quality.

Scenario: a typed description of one simulation run.
  Contains: HTTP method + path + payload, list of checks, manual review notes.

ScenarioResult: the outcome of running one Scenario against a live server.
  Computes: shape_pass, rule_pass, quality_stars, verdict automatically.

Check factories (bottom of file): named constructors for every check type
  used across scenario files. Import only what you need in each scenario.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Callable, Literal


# Type aliases

CheckFn  = Callable[[int, dict], tuple[bool, str]]
Verdict  = Literal["PASS", "WARN", "FAIL"]
Tier     = Literal["SHAPE", "RULE", "QUALITY"]


# Core dataclasses

@dataclass
class Check:
    """A single verifiable assertion about a response."""
    tier:   Tier
    label:  str
    fn:     CheckFn


@dataclass
class CheckResult:
    """The evaluated result of one Check."""
    tier:   Tier
    label:  str
    passed: bool
    detail: str


@dataclass
class Scenario:
    """
    One simulation scenario — maps directly to one NestJS service call.

    Fields:
        name:            short SCREAMING_SNAKE identifier
        nestjs_context:  which NestJS service + method triggers this call
        method:          HTTP method ("GET" | "POST")
        path:            endpoint path e.g. "/llm/criterion-check"
        payload:         JSON body for POST requests
        params:          query string params for GET requests
        checks:          ordered list of Check objects to evaluate
        manual_review:   questions printed for the human reviewer
    """
    name:           str
    nestjs_context: str
    method:         Literal["GET", "POST"]
    path:           str
    payload:        dict | None = None
    params:         dict | None = None
    checks:         list[Check] = field(default_factory=list)
    manual_review:  list[str]   = field(default_factory=list)


@dataclass
class ScenarioResult:
    """Outcome of running one Scenario against the live server."""
    name:           str
    nestjs_context: str
    method:         str
    path:           str
    status_code:    int
    elapsed:        float
    response_body:  dict
    check_results:  list[CheckResult]
    manual_review:  list[str]

    # Derived properties 

    @property
    def shape_pass(self) -> bool:
        return all(r.passed for r in self.check_results if r.tier == "SHAPE")

    @property
    def rule_pass(self) -> bool:
        return all(r.passed for r in self.check_results if r.tier == "RULE")

    @property
    def _quality_checks(self) -> list[CheckResult]:
        return [r for r in self.check_results if r.tier == "QUALITY"]

    @property
    def quality_fraction(self) -> float:
        q = self._quality_checks
        if not q:
            return 1.0
        return sum(1 for r in q if r.passed) / len(q)

    @property
    def quality_stars(self) -> int:
        f = self.quality_fraction
        if f >= 0.80: return 3
        if f >= 0.60: return 2
        if f >= 0.40: return 1
        return 0

    @property
    def verdict(self) -> Verdict:
        if self.status_code == 0:
            return "FAIL"   # connection error
        if not self.shape_pass or not self.rule_pass:
            return "FAIL"
        if self.quality_stars >= 2:
            return "PASS"
        return "WARN"


# Grading engine

def grade_scenario(
    scenario:    Scenario,
    status_code: int,
    body:        dict,
    elapsed:     float,
) -> ScenarioResult:
    """Evaluate all checks and return a ScenarioResult."""
    results: list[CheckResult] = []
    for check in scenario.checks:
        try:
            passed, detail = check.fn(status_code, body)
        except Exception as exc:
            passed, detail = False, f"Check raised: {exc}"
        results.append(CheckResult(
            tier=check.tier, label=check.label, passed=passed, detail=detail
        ))

    return ScenarioResult(
        name=scenario.name,
        nestjs_context=scenario.nestjs_context,
        method=scenario.method,
        path=scenario.path,
        status_code=status_code,
        elapsed=elapsed,
        response_body=body,
        check_results=results,
        manual_review=scenario.manual_review,
    )


# SHAPE check factories — structural validation, always blocking

def shape_status_ok() -> Check:
    """HTTP response must be 200 OK."""
    return Check(
        "SHAPE", "HTTP status is 200",
        lambda s, b: (s == 200, f"status={s}"),
    )


def shape_field_present(f: str) -> Check:
    """Top-level field must exist in response body."""
    return Check(
        "SHAPE", f"'{f}' field present",
        lambda s, b: (f in b, f"found keys: {sorted(b.keys())}" if s == 200 else "no body"),
    )


def shape_field_type(f: str, expected: type, label: str | None = None) -> Check:
    """Top-level field must be of expected Python type."""
    type_name = label or expected.__name__

    def fn(s, b):
        val = b.get(f)
        ok  = isinstance(val, expected)
        return ok, f"{f}={repr(val)!s:.60} (type={type(val).__name__}, expected={type_name})"

    return Check("SHAPE", f"'{f}' is {type_name}", fn)


def shape_score_in_range(f: str, lo: float = 0.0, hi: float = 1.0) -> Check:
    """Numeric score field must lie within [lo, hi]."""
    def fn(s, b):
        val = b.get(f)
        try:
            v  = float(val)
            ok = lo <= v <= hi
            return ok, f"{f}={v:.4f}"
        except (TypeError, ValueError):
            return False, f"{f}={repr(val)} (not numeric)"

    return Check("SHAPE", f"'{f}' ∈ [{lo}, {hi}]", fn)


def shape_list_type(f: str) -> Check:
    """Field must be a list (may be empty)."""
    def fn(s, b):
        val = b.get(f)
        ok  = isinstance(val, list)
        return ok, f"{f} has {len(val)} items" if ok else f"{f} is {type(val).__name__}"

    return Check("SHAPE", f"'{f}' is list", fn)


def shape_dict_type(f: str) -> Check:
    """Field must be a dict/object."""
    def fn(s, b):
        val = b.get(f)
        ok  = isinstance(val, dict)
        return ok, f"{f} is {type(val).__name__}"

    return Check("SHAPE", f"'{f}' is dict", fn)


def shape_enum_value(f: str, valid: set) -> Check:
    """Field value must be in the allowed enum set."""
    def fn(s, b):
        val = b.get(f)
        ok  = val in valid
        return ok, f"{f}={repr(val)}"

    return Check("SHAPE", f"'{f}' ∈ {sorted(valid)}", fn)


def shape_list_items_have_keys(list_f: str, *keys: str) -> Check:
    """Every item in a list field must contain all specified keys."""
    def fn(s, b):
        items   = b.get(list_f, [])
        if not isinstance(items, list):
            return False, f"{list_f} is not a list"
        missing = []
        for i, item in enumerate(items):
            if isinstance(item, dict):
                for k in keys:
                    if k not in item:
                        missing.append(f"[{i}].{k}")
            else:
                missing.append(f"[{i}] is not a dict")
        ok = len(missing) == 0
        info = f"{len(items)} items OK" if ok else f"missing: {missing[:5]}"
        return ok, info

    return Check("SHAPE", f"'{list_f}' items have keys {list(keys)}", fn)


def shape_int_field(f: str) -> Check:
    """Field must be an integer (not float)."""
    def fn(s, b):
        val = b.get(f)
        ok  = isinstance(val, int) and not isinstance(val, bool)
        return ok, f"{f}={repr(val)} (type={type(val).__name__})"

    return Check("SHAPE", f"'{f}' is int", fn)


# RULE check factories — business rules enforced in code, always blocking

def rule_threshold_equals_bool(
    score_f: str, bool_f: str, threshold: float
) -> Check:
    """
    Business rule: bool_field must equal (score_field >= threshold).
    The ai-service computes passed_boolean in code, not from LLM output.
    """
    def fn(s, b):
        score = b.get(score_f)
        flag  = b.get(bool_f)
        try:
            expected = float(score) >= threshold
            ok = flag == expected
            verdict = "✓" if ok else f"got {flag}, expected {expected}"
            return ok, f"{score_f}={score:.4f} >= {threshold} → {bool_f} must be {expected} ({verdict})"
        except (TypeError, ValueError):
            return False, f"Cannot compute: {score_f}={repr(score)}"

    return Check(
        "RULE",
        f"code rule: {bool_f} == ({score_f} >= {threshold})",
        fn,
    )


def rule_advisory_null_on_pass(pass_f: str, advisory_f: str) -> Check:
    """
    Business rule: gap_advisory must be None when passed=True, non-None when passed=False.
    """
    def fn(s, b):
        passed   = b.get(pass_f)
        advisory = b.get(advisory_f)
        if passed is True and advisory is not None:
            return False, f"{pass_f}=True but {advisory_f}={repr(str(advisory)[:60])!r} — must be null"
        if passed is False and advisory is None:
            return False, f"{pass_f}=False but {advisory_f} is null — must have advisory"
        preview = "null" if advisory is None else repr(str(advisory)[:60])
        return True, f"{pass_f}={passed} → {advisory_f}={preview}"

    return Check(
        "RULE",
        f"code rule: '{advisory_f}' null iff '{pass_f}' is True",
        fn,
    )


def rule_all_payments_zero(milestone_f: str) -> Check:
    """
    Business rule: payment_amount_vnd must be 0 on every milestone.
    CEO sets actual amounts after reviewing the framework — ai-service never sets them.
    """
    def fn(s, b):
        milestones = b.get(milestone_f, [])
        bad = [
            m.get("milestone_number", "?")
            for m in milestones
            if isinstance(m, dict) and m.get("payment_amount_vnd", 0) != 0
        ]
        ok = len(bad) == 0
        info = f"{len(milestones)} milestones checked" + (f"; non-zero payments on #{bad}" if not ok else "")
        return ok, info

    return Check(
        "RULE",
        f"code rule: all '{milestone_f}' payment_amount_vnd == 0",
        fn,
    )


def rule_finding_valid(f: str = "finding") -> Check:
    """Business rule: finding must be 'expert_wins' or 'client_wins' — no other values."""
    valid = {"expert_wins", "client_wins"}

    def fn(s, b):
        val = b.get(f)
        ok  = val in valid
        return ok, f"{f}={repr(val)}"

    return Check("RULE", f"code rule: '{f}' ∈ {sorted(valid)}", fn)


def rule_idempotent(f: str, expected_val: Any) -> Check:
    """
    Rule for the idempotency scenario: the response field must equal
    the expected value recorded from a previous identical call.
    """
    def fn(s, b):
        val = b.get(f)
        ok  = val == expected_val
        return ok, f"{f}={repr(val)} (expected={repr(expected_val)})"

    return Check(
        "RULE",
        f"idempotency: '{f}' == {repr(expected_val)}",
        fn,
    )


def rule_list_sorted_desc(score_key: str = "composite_score") -> Check:
    """Rule for matching: results must be sorted by composite_score descending."""
    def fn(s, b):
        results = b if isinstance(b, list) else []
        scores  = [r.get(score_key, 0) for r in results if isinstance(r, dict)]
        ok      = scores == sorted(scores, reverse=True)
        return ok, f"scores={[round(x, 3) for x in scores]}"

    return Check("RULE", f"code rule: results sorted by '{score_key}' descending", fn)


# QUALITY check factories — output quality heuristics, non-blocking

def quality_equals(f: str, expected: Any) -> Check:
    """LLM output field should equal a specific expected value."""
    def fn(s, b):
        val = b.get(f)
        ok  = val == expected
        return ok, f"{f}={repr(val)} (expected={repr(expected)})"

    return Check("QUALITY", f"'{f}' == {repr(expected)}", fn)


def quality_not_equals(f: str, unexpected: Any, description: str) -> Check:
    """LLM output field should NOT equal the given value (e.g. should not be empty default)."""
    def fn(s, b):
        val = b.get(f)
        ok  = val != unexpected
        return ok, f"{f}={repr(val)}"

    return Check("QUALITY", description, fn)


def quality_list_non_empty(f: str) -> Check:
    """Quality: list field should have at least one item."""
    def fn(s, b):
        val = b.get(f, [])
        ok  = isinstance(val, list) and len(val) > 0
        return ok, f"{f} has {len(val) if isinstance(val, list) else '?'} items"

    return Check("QUALITY", f"'{f}' is non-empty list", fn)


def quality_list_min_count(f: str, minimum: int) -> Check:
    """Quality: list must have at least N items."""
    def fn(s, b):
        val   = b.get(f, [])
        count = len(val) if isinstance(val, list) else 0
        ok    = count >= minimum
        return ok, f"{f} has {count} items (min={minimum})"

    return Check("QUALITY", f"'{f}' has >= {minimum} items", fn)


def quality_string_min_length(f: str, minimum: int, parent: str | None = None) -> Check:
    """Quality: string field must be substantive (length >= minimum)."""
    def fn(s, b):
        container = b.get(parent, {}) if parent else b
        val = container.get(f, "") if isinstance(container, dict) else ""
        ok  = isinstance(val, str) and len(val) >= minimum
        return ok, f"len({f})={len(val) if isinstance(val, str) else '?'} (min={minimum})"

    field_label = f"{parent}.{f}" if parent else f
    return Check("QUALITY", f"'{field_label}' is substantive (>= {minimum} chars)", fn)


def quality_score_meets(f: str, threshold: float) -> Check:
    """Quality: numeric score should be at or above threshold."""
    def fn(s, b):
        val = b.get(f)
        try:
            v  = float(val)
            ok = v >= threshold
            return ok, f"{f}={v:.4f} ({'≥' if ok else '<'} {threshold})"
        except (TypeError, ValueError):
            return False, f"{f}={repr(val)}"

    return Check("QUALITY", f"'{f}' >= {threshold}", fn)


def quality_score_below(f: str, threshold: float) -> Check:
    """Quality: numeric score should be strictly below threshold."""
    def fn(s, b):
        val = b.get(f)
        try:
            v  = float(val)
            ok = v < threshold
            return ok, f"{f}={v:.4f} ({'<' if ok else '≥'} {threshold})"
        except (TypeError, ValueError):
            return False, f"{f}={repr(val)}"

    return Check("QUALITY", f"'{f}' < {threshold}", fn)


def quality_list_items_contain_digit(f: str) -> Check:
    """Quality: every item in a list should contain at least one digit (measurable)."""
    def fn(s, b):
        items = b.get(f, [])
        if not isinstance(items, list) or not items:
            return False, f"{f} is empty or not a list"
        with_digit = [i for i in items if isinstance(i, str) and re.search(r'\d', i)]
        ok = len(with_digit) == len(items)
        return ok, f"{len(with_digit)}/{len(items)} items contain a digit/number"

    return Check("QUALITY", f"'{f}' items contain measurable numbers", fn)


def quality_list_items_min_length(f: str, minimum: int = 25) -> Check:
    """Quality: every item in a string list should be substantive (not a fragment)."""
    def fn(s, b):
        items = b.get(f, [])
        if not isinstance(items, list) or not items:
            return False, f"{f} is empty"
        long_enough = [i for i in items if isinstance(i, str) and len(i) >= minimum]
        ok = len(long_enough) == len(items)
        return ok, f"{len(long_enough)}/{len(items)} items >= {minimum} chars"

    return Check("QUALITY", f"'{f}' items are substantive (>= {minimum} chars)", fn)


def quality_nested_enum(parent: str, child: str, valid: set) -> Check:
    """Quality: a field inside a nested dict should be a valid enum value."""
    def fn(s, b):
        container = b.get(parent, {})
        val = container.get(child) if isinstance(container, dict) else None
        ok  = val in valid
        return ok, f"{parent}.{child}={repr(val)}"

    return Check("QUALITY", f"'{parent}.{child}' ∈ {sorted(valid)}", fn)


def quality_nested_string_min_length(parent: str, child: str, minimum: int) -> Check:
    """Quality: a string inside a nested dict should be substantive."""
    def fn(s, b):
        container = b.get(parent, {})
        val = container.get(child, "") if isinstance(container, dict) else ""
        ok  = isinstance(val, str) and len(val) >= minimum
        return ok, f"len({parent}.{child})={len(val) if isinstance(val, str) else '?'} (min={minimum})"

    return Check("QUALITY", f"'{parent}.{child}' >= {minimum} chars", fn)


def quality_milestone_deliverables_substantive(f: str, minimum: int = 30) -> Check:
    """Quality: every milestone's deliverable_statement should be specific."""
    def fn(s, b):
        milestones = b.get(f, [])
        short = [
            m.get("milestone_number", "?")
            for m in milestones
            if isinstance(m, dict) and len(m.get("deliverable_statement", "")) < minimum
        ]
        ok = len(short) == 0
        info = f"{len(milestones)} milestones OK" if ok else f"short deliverables at milestone(s): {short}"
        return ok, info

    return Check("QUALITY", f"'{f}' deliverable_statements >= {minimum} chars", fn)


def quality_top_expert_is(expected_id: str) -> Check:
    """Quality: the top-ranked expert in matching results should be the expected expert."""
    def fn(s, b):
        if not isinstance(b, list) or not b:
            return False, "empty or non-list result"
        top = b[0].get("expert_id")
        ok  = top == expected_id
        return ok, f"top={repr(top)} (expected={repr(expected_id)})"

    return Check("QUALITY", f"top-ranked expert is '{expected_id}'", fn)


def quality_gap_map_colors_valid() -> Check:
    """Quality: all gap_map color values across all results should be in {green, amber, red}."""
    valid = {"green", "amber", "red"}

    def fn(s, b):
        results = b if isinstance(b, list) else []
        bad = []
        for i, r in enumerate(results):
            for g in r.get("gap_map", []):
                if g.get("color") not in valid:
                    bad.append(f"result[{i}].{g.get('seam_code')}={g.get('color')!r}")
        ok = len(bad) == 0
        return ok, "all colors valid" if ok else f"invalid: {bad[:3]}"

    return Check("QUALITY", "all gap_map colors ∈ {green, amber, red}", fn)


def quality_expected_seam_present(seam_code: str) -> Check:
    """Quality: a specific seam should appear in required_seams_json."""
    def fn(s, b):
        seams = [x.get("seam_code") for x in b.get("required_seams_json", []) if isinstance(x, dict)]
        ok    = seam_code in seams
        return ok, f"seams found: {seams}"

    return Check("QUALITY", f"'{seam_code}' seam present in required_seams_json", fn)


def quality_list_items_have_field_value(list_f: str, item_f: str, expected: Any) -> Check:
    """Quality: every item in a list should have a specific field set to expected value."""
    def fn(s, b):
        items = b.get(list_f, [])
        bad = [
            i for i, item in enumerate(items)
            if isinstance(item, dict) and item.get(item_f) != expected
        ]
        ok = len(bad) == 0
        return ok, f"all {len(items)} items OK" if ok else f"wrong value at indices: {bad[:5]}"

    return Check("QUALITY", f"all '{list_f}[].{item_f}' == {repr(expected)}", fn)


def quality_seams_list_non_empty() -> Check:
    """Quality: at least one seam should be identified."""
    return quality_list_non_empty("required_seams_json")


def quality_domains_list_non_empty() -> Check:
    """Quality: at least one domain should be identified."""
    return quality_list_non_empty("required_domains_json")


def quality_milestones_list_non_empty() -> Check:
    """Quality: at least one milestone should be defined."""
    return quality_list_non_empty("milestone_framework_json")