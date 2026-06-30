"""
AITasker ai-service simulation runner.

Hits the REAL running uvicorn server — uvicorn console will show request logs.

Usage:
    # Start the server first
    cd ai-service
    uvicorn app.main:app --reload --port 8000

    # Run all simulations
    python simulations/runner.py

    # Run one endpoint
    python simulations/runner.py criterion_check
    python simulations/runner.py stage1_extract
    python simulations/runner.py portfolio_eval
    python simulations/runner.py dispute_eval
    python simulations/runner.py service_generate
    python simulations/runner.py stage5_synthesize
    python simulations/runner.py matching

    # Override server URL
    python simulations/runner.py --url http://localhost:9000

    # Disable colours (for file redirection)
    python simulations/runner.py --no-color > report.txt
"""

from __future__ import annotations

import asyncio
import importlib
import sys
import time
import argparse
from pathlib import Path

# Allow running from any working directory
sys.path.insert(0, str(Path(__file__).parent.parent))

from simulations.framework.http_client import call, health_check
from simulations.framework.grader      import Scenario, ScenarioResult, grade_scenario
from simulations.framework.reporter    import (
    disable_colour,
    print_header,
    print_scenario_result,
    print_summary,
    save_report,
)


# ── Scenario module registry ──────────────────────────────────────────────────

ENDPOINTS: dict[str, tuple[str, str]] = {
    # key             → (display_label,              module_path)
    "criterion_check":   ("POST /llm/criterion-check",            "simulations.scenarios.s01_criterion_check"),
    "stage1_extract":    ("POST /llm/elicitation/stage1-extract", "simulations.scenarios.s02_stage1_extract"),
    "portfolio_eval":    ("POST /llm/portfolio-eval",             "simulations.scenarios.s03_portfolio_eval"),
    "dispute_eval":      ("POST /llm/dispute-eval",               "simulations.scenarios.s04_dispute_eval"),
    "service_generate":  ("POST /llm/service-generate",          "simulations.scenarios.s05_service_generate"),
    "stage5_synthesize": ("POST /llm/elicitation/stage5-synthesize", "simulations.scenarios.s06_stage5_synthesize"),
    "matching":          ("POST /llm/matching",                   "simulations.scenarios.s07_matching"),
}


# ── Scenario executor ─────────────────────────────────────────────────────────

async def run_scenario(
    scenario:   Scenario,
    server_url: str,
) -> ScenarioResult:
    """Execute one scenario against the live server."""
    status, body, elapsed = await call(
        method=scenario.method,
        path=scenario.path,
        payload=scenario.payload,
        params=scenario.params,
        base_url=server_url,
        timeout=90.0,   # stage5 can take up to 60s
    )
    return grade_scenario(scenario, status, body, elapsed)


async def run_endpoint(
    endpoint_key: str,
    server_url:   str,
) -> list[ScenarioResult]:
    """Load scenarios for one endpoint and run them all sequentially."""
    label, module_path = ENDPOINTS[endpoint_key]

    # Import scenario module — may not exist yet in Parts 2-4
    try:
        module = importlib.import_module(module_path)
    except ModuleNotFoundError:
        print(f"\n  [SKIP] {label} — scenario file not yet written ({module_path})")
        return []

    scenarios: list[Scenario] = getattr(module, "SCENARIOS", [])
    if not scenarios:
        print(f"\n  [SKIP] {label} — no SCENARIOS defined in {module_path}")
        return []

    print_header(label, server_url)

    results: list[ScenarioResult] = []
    t0 = time.perf_counter()

    for i, scenario in enumerate(scenarios, start=1):
        result = await run_scenario(scenario, server_url)
        results.append(result)
        print_scenario_result(i, len(scenarios), result)

    total_elapsed = time.perf_counter() - t0
    report_path   = save_report(label, results, server_url)
    print_summary(label, results, report_path, total_elapsed)

    return results


# ── Main ──────────────────────────────────────────────────────────────────────

async def main() -> int:
    """Entry point. Returns exit code: 0=all pass/warn, 1=any fail."""
    parser = argparse.ArgumentParser(
        description="AITasker ai-service simulation runner",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "endpoint",
        nargs="?",
        choices=list(ENDPOINTS.keys()) + ["all"],
        default="all",
        help="Which endpoint to simulate (default: all)",
    )
    parser.add_argument(
        "--url",
        default="http://localhost:8000",
        help="ai-service base URL (default: http://localhost:8000)",
    )
    parser.add_argument(
        "--no-color",
        action="store_true",
        help="Disable ANSI colours (useful for file redirection)",
    )
    args = parser.parse_args()

    if args.no_color:
        disable_colour()

    # Health check before running anything
    print(f"\nChecking server at {args.url} ...")
    reachable, message = await health_check(args.url)
    if not reachable:
        print(f"✗  {message}")
        return 1
    print(f"✓  {message}\n")

    # Determine which endpoints to run
    if args.endpoint == "all":
        endpoints_to_run = list(ENDPOINTS.keys())
    else:
        endpoints_to_run = [args.endpoint]

    # Run them
    all_results: list[ScenarioResult] = []
    for key in endpoints_to_run:
        results = await run_endpoint(key, args.url)
        all_results.extend(results)

    # Final exit code
    any_fail = any(r.verdict == "FAIL" for r in all_results)
    return 1 if any_fail else 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)