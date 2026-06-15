"""
Reporter — coloured console output + JSON report file.

Colours work on macOS, Linux, and Windows 10+ (PowerShell / Windows Terminal).
Use --no-color to disable for CI or file redirection.

Report files are written to simulations/reports/<endpoint>_<timestamp>.json.
The reports/ directory is .gitignored — reports are local artefacts only.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from simulations.framework.grader import ScenarioResult, Verdict


# ── ANSI colour support ───────────────────────────────────────────────────────

_COLOUR_ENABLED = True   # set to False by runner when --no-color is passed


def _ansi(code: str, text: str) -> str:
    if not _COLOUR_ENABLED:
        return text
    return f"\033[{code}m{text}\033[0m"


def green(t: str)  -> str: return _ansi("92", t)
def red(t: str)    -> str: return _ansi("91", t)
def yellow(t: str) -> str: return _ansi("93", t)
def cyan(t: str)   -> str: return _ansi("96", t)
def bold(t: str)   -> str: return _ansi("1",  t)
def dim(t: str)    -> str: return _ansi("2",  t)


def disable_colour() -> None:
    global _COLOUR_ENABLED
    _COLOUR_ENABLED = False


def _enable_windows_ansi() -> None:
    """Enable ANSI escape codes on Windows 10+ consoles."""
    if sys.platform == "win32":
        try:
            import ctypes
            kernel32 = ctypes.windll.kernel32
            kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
        except Exception:
            pass   # not critical — worst case: raw escape codes visible


_enable_windows_ansi()


# Symbol helpers 

def _check_symbol(passed: bool) -> str:
    return green("✓") if passed else red("✗")


def _verdict_badge(verdict: Verdict) -> str:
    if verdict == "PASS": return green(bold(" PASS "))
    if verdict == "WARN": return yellow(bold(" WARN "))
    return red(bold(" FAIL "))


def _stars(n: int) -> str:
    filled = "★" * n
    empty  = "☆" * (3 - n)
    if n == 3: return green(filled)
    if n == 2: return cyan(filled) + dim(empty)
    if n == 1: return yellow(filled) + dim(empty * 2)
    return red("☆☆☆")


# Scenario printer

def print_scenario_result(
    index:    int,
    total:    int,
    result:   ScenarioResult,
) -> None:
    """Print a full scenario block to stdout."""
    W = 66   

    # Header
    print()
    print(dim("─" * W))
    status_colour = green if result.status_code == 200 else red
    status_line   = status_colour(f"{result.method} {result.path} → {result.status_code or 'ERR'}")
    print(bold(f"[{index}/{total}] {result.name}"))
    print(dim(f"  NestJS: {result.nestjs_context}"))
    print(f"  {status_line}  {dim(f'({result.elapsed:.2f}s)')}")

    # Connection / server error
    if result.status_code == 0:
        print(red(f"  ERROR: {result.response_body.get('_error', 'unknown error')}"))
        print(f"  Verdict: {_verdict_badge('FAIL')}")
        return

    # Response body preview (first 3 top-level fields)
    if isinstance(result.response_body, dict):
        preview_keys = list(result.response_body.keys())[:4]
        print(dim("  Response:"))
        for k in preview_keys:
            v   = result.response_body[k]
            val = _format_value(v)
            print(dim(f"    {k}: {val}"))
        if len(result.response_body) > 4:
            print(dim(f"    … (+{len(result.response_body) - 4} more fields)"))
    elif isinstance(result.response_body, list):
        print(dim(f"  Response: [{len(result.response_body)} items]"))

    # Checks grouped by tier
    print()
    _print_checks(result, "SHAPE")
    _print_checks(result, "RULE")
    _print_checks(result, "QUALITY")

    # Quality grade
    q_checks = [r for r in result.check_results if r.tier == "QUALITY"]
    if q_checks:
        q_pass = sum(1 for r in q_checks if r.passed)
        print(f"  Quality: {_stars(result.quality_stars)}  ({q_pass}/{len(q_checks)} checks pass)")

    # Verdict
    print(f"  Verdict: {_verdict_badge(result.verdict)}")

    # Manual review
    if result.manual_review:
        print()
        print(cyan("  Manual review:"))
        for note in result.manual_review:
            print(cyan(f"  →  {note}"))


def _print_checks(result: ScenarioResult, tier: str) -> None:
    """Print checks for one tier (SHAPE / RULE / QUALITY)."""
    checks = [r for r in result.check_results if r.tier == tier]
    if not checks:
        return
    for r in checks:
        symbol  = _check_symbol(r.passed)
        tier_lbl = dim(f"{r.tier:<7}")
        detail   = dim(f"  [{r.detail}]") if r.detail else ""
        print(f"  {tier_lbl} {symbol}  {r.label}{detail}")


def _format_value(v: object) -> str:
    """Short display of a response field value."""
    if isinstance(v, list):
        return f"[{len(v)} items]"
    if isinstance(v, dict):
        return f"{{…{len(v)} keys}}"
    if isinstance(v, str) and len(v) > 70:
        return repr(v[:67] + "…")
    if isinstance(v, float):
        return f"{v:.4f}"
    return repr(v)


# Summary printer

def print_summary(
    endpoint_label: str,
    results:        list[ScenarioResult],
    report_path:    Path,
    total_elapsed:  float,
) -> None:
    """Print the final summary block after all scenarios have run."""
    W = 66
    n_pass = sum(1 for r in results if r.verdict == "PASS")
    n_warn = sum(1 for r in results if r.verdict == "WARN")
    n_fail = sum(1 for r in results if r.verdict == "FAIL")

    print()
    print(bold("═" * W))
    print(bold(f" SUMMARY — {endpoint_label}"))
    print(f" {len(results)} scenarios in {total_elapsed:.1f}s")
    parts = []
    if n_pass: parts.append(green(f"{n_pass} PASS"))
    if n_warn: parts.append(yellow(f"{n_warn} WARN"))
    if n_fail: parts.append(red(f"{n_fail} FAIL"))
    print(f" {' | '.join(parts)}")
    print(f" Report: {dim(str(report_path))}")
    print(bold("═" * W))


# Report header 

def print_header(endpoint_label: str, server_url: str) -> None:
    """Print the report header before scenarios run."""
    W = 66
    now = datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print()
    print(bold("═" * W))
    print(bold(f" AITasker ai-service — Simulation Report"))
    print(f" Endpoint:  {cyan(endpoint_label)}")
    print(f" Server:    {server_url}")
    print(f" Time:      {now}")
    print(bold("═" * W))


# JSON report serialiser

def save_report(
    endpoint_label: str,
    results:        list[ScenarioResult],
    server_url:     str,
) -> Path:
    """
    Write a JSON report to simulations/reports/<endpoint>_<timestamp>.json.

    Returns the path written to.
    """
    reports_dir = Path(__file__).parent.parent / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)

    timestamp   = datetime.now().strftime("%Y%m%d_%H%M%S")
    slug        = endpoint_label.lower().replace(" ", "_").replace("/", "_")
    report_path = reports_dir / f"{slug}_{timestamp}.json"

    def _serialise_result(r: ScenarioResult) -> dict:
        return {
            "name":           r.name,
            "nestjs_context": r.nestjs_context,
            "method":         r.method,
            "path":           r.path,
            "status_code":    r.status_code,
            "elapsed_s":      round(r.elapsed, 3),
            "verdict":        r.verdict,
            "quality_stars":  r.quality_stars,
            "checks": [
                {
                    "tier":   c.tier,
                    "label":  c.label,
                    "passed": c.passed,
                    "detail": c.detail,
                }
                for c in r.check_results
            ],
            "manual_review": r.manual_review,
            "response_body": _safe_json(r.response_body),
        }

    report = {
        "meta": {
            "endpoint":   endpoint_label,
            "server":     server_url,
            "run_at":     datetime.now(tz=timezone.utc).isoformat(),
            "total":      len(results),
            "pass":       sum(1 for r in results if r.verdict == "PASS"),
            "warn":       sum(1 for r in results if r.verdict == "WARN"),
            "fail":       sum(1 for r in results if r.verdict == "FAIL"),
        },
        "results": [_serialise_result(r) for r in results],
    }

    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    return report_path


def _safe_json(obj: object) -> object:
    """Make an object JSON-serialisable (truncate bytes, handle non-serialisable types)."""
    if isinstance(obj, dict):
        return {k: _safe_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_safe_json(i) for i in obj]
    if isinstance(obj, (str, int, float, bool, type(None))):
        return obj
    return str(obj)