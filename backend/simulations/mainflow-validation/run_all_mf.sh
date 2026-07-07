#!/usr/bin/env bash
#
# run_all_mf.sh — AITasker Mainflow Validation Bundle
#
# Automatically:
#   1. Locates and loads SEPAY_WEBHOOK_SECRET from backend/.env
#   2. Loads SEED_ADMIN_PASSWORD from .env or .env.example as ADMIN_PASSWORD
#   3. Derives ADMIN_EMAIL from the seeded platform admin (platform-admin@aitasker.internal)
#   4. Runs all 20 MF validation scripts in sequence
#   5. Streams output to terminal AND a timestamped .log file
#   6. Prints a final pass/fail rollup table at the end
#
# Usage:
#   cd backend/simulations/mainflow-validation
#   bash run_all_mf.sh
#
# Overrides (all optional — auto-detected if not set):
#   BASE_URL=http://localhost:3001         (default)
#   SEPAY_WEBHOOK_SECRET=whsec_xxx         (auto-read from backend/.env)
#   ADMIN_EMAIL=platform-admin@aitasker.internal
#   ADMIN_PASSWORD=Admin@AITasker2024!
#   LOG_DIR=/path/to/logs                  (default: ./logs)
#   SKIP_MF="mf5 mf17"                    (space-separated, skips named scripts)
#   FAIL_FAST=1                            (stop on first MF failure)

set -uo pipefail

# ─────────────────────────────────────────────────────────────
# 0. Resolve paths
# ─────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
PROJECT_ROOT="$(cd "${BACKEND_DIR}/.." && pwd)"

# ─────────────────────────────────────────────────────────────
# 1. Colours
# ─────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ─────────────────────────────────────────────────────────────
# 2. Parse a key from a .env-style file (handles quotes, no spaces)
# ─────────────────────────────────────────────────────────────
parse_env_key() {
  local file="$1" key="$2"
  # Match KEY=value or KEY="value" or KEY='value', strip quotes, skip comments
  grep -E "^${key}=" "$file" 2>/dev/null \
    | head -1 \
    | sed -E "s/^${key}=['\"]?([^'\"]*)['\"]?$/\1/"
}

# ─────────────────────────────────────────────────────────────
# 3. Auto-detect SEPAY_WEBHOOK_SECRET
#    The backend reads it as SEPAY_SECRET_KEY in .env but the
#    simulation scripts expose it as SEPAY_WEBHOOK_SECRET.
#    Search order:
#      a) already exported in env  → use as-is
#      b) backend/.env             → SEPAY_SECRET_KEY
#      c) backend/.env.example     → SEPAY_SECRET_KEY (usually a placeholder)
#      d) project root .env        → SEPAY_SECRET_KEY
#      e) hard fallback            → whsec_test_secret_for_simulation
# ─────────────────────────────────────────────────────────────
resolve_sepay_secret() {
  if [ -n "${SEPAY_WEBHOOK_SECRET:-}" ]; then
    echo "${SEPAY_WEBHOOK_SECRET}"
    return
  fi

  local candidates=(
    "${BACKEND_DIR}/.env"
    "${PROJECT_ROOT}/.env"
    "${BACKEND_DIR}/.env.local"
    "${BACKEND_DIR}/.env.example"
  )

  for f in "${candidates[@]}"; do
    if [ -f "$f" ]; then
      local val
      val=$(parse_env_key "$f" "SEPAY_SECRET_KEY")
      if [ -n "$val" ] && [ "$val" != "REPLACE_WITH_SEPAY_HMAC_SECRET" ] && [ "$val" != "REPLACE_LATER" ]; then
        echo "$val"
        return
      fi
      # Also try SEPAY_WEBHOOK_SECRET key directly (in case it's been added)
      val=$(parse_env_key "$f" "SEPAY_WEBHOOK_SECRET")
      if [ -n "$val" ] && [ "$val" != "REPLACE_WITH_SEPAY_HMAC_SECRET" ]; then
        echo "$val"
        return
      fi
    fi
  done

  # Hard fallback matching the test environment default in the codebase
  echo "whsec_test_secret_for_simulation"
}

# ─────────────────────────────────────────────────────────────
# 4. Auto-detect ADMIN_EMAIL + ADMIN_PASSWORD
#    Admin email is the seeded platform admin in seed.ts.
#    Admin password comes from SEED_ADMIN_PASSWORD in .env.
#    Search order:
#      a) already exported → use as-is
#      b) backend/.env SEED_ADMIN_PASSWORD
#      c) root .env SEED_ADMIN_PASSWORD
#      d) hard fallback from .env.example defaults
# ─────────────────────────────────────────────────────────────
resolve_admin_credentials() {
  # Email: seeded platform admin (hardcoded in seed.ts)
  if [ -z "${ADMIN_EMAIL:-}" ]; then
    export ADMIN_EMAIL="admin@aitasker.dev"
  fi

  if [ -n "${ADMIN_PASSWORD:-}" ]; then
    return
  fi

  local candidates=(
    "${BACKEND_DIR}/.env"
    "${PROJECT_ROOT}/.env"
    "${BACKEND_DIR}/.env.local"
    "${PROJECT_ROOT}/.env.example"
    "${BACKEND_DIR}/.env.example"
  )

  for f in "${candidates[@]}"; do
    if [ -f "$f" ]; then
      local val
      val=$(parse_env_key "$f" "SEED_ADMIN_PASSWORD")
      if [ -n "$val" ]; then
        export ADMIN_PASSWORD="$val"
        return
      fi
      val=$(parse_env_key "$f" "ADMIN_PASSWORD")
      if [ -n "$val" ]; then
        export ADMIN_PASSWORD="$val"
        return
      fi
    fi
  done

  # Hard fallback matching .env.example default
  export ADMIN_PASSWORD="Admin@AITasker2024!"
}

# ─────────────────────────────────────────────────────────────
# 5. Setup logging
# ─────────────────────────────────────────────────────────────
LOG_DIR="${LOG_DIR:-${SCRIPT_DIR}/logs}"
mkdir -p "${LOG_DIR}"
RUN_TS=$(date +"%Y%m%d_%H%M%S")
BUNDLE_LOG="${LOG_DIR}/run_all_${RUN_TS}.log"
SUMMARY_LOG="${LOG_DIR}/run_all_${RUN_TS}_summary.txt"

# tee_both: write to terminal (with colour) and log file (colour stripped)
# We use a named pipe so both destinations receive the same stream
log_line() {
  # Print with colour to terminal
  echo -e "$1"
  # Strip ANSI codes for the log file
  echo -e "$1" | sed 's/\x1b\[[0-9;]*m//g' >> "${BUNDLE_LOG}"
}

# ─────────────────────────────────────────────────────────────
# 6. Prerequisites check
# ─────────────────────────────────────────────────────────────
check_prerequisites() {
  if ! command -v jq >/dev/null 2>&1; then
    log_line "${RED}✗ jq is required but not installed.${NC}"
    log_line "  Install: apt-get install jq  /  brew install jq"
    exit 1
  fi

  if ! command -v curl >/dev/null 2>&1; then
    log_line "${RED}✗ curl is required but not installed.${NC}"
    exit 1
  fi

  if ! command -v openssl >/dev/null 2>&1; then
    log_line "${RED}✗ openssl is required for HMAC signature generation.${NC}"
    exit 1
  fi

  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/health" 2>/dev/null || echo "000")
  if [ "$code" != "200" ]; then
    log_line "${RED}✗ Backend not reachable at ${BASE_URL} (HTTP ${code}).${NC}"
    log_line "  Start it first: cd backend && npm run start:dev"
    exit 1
  fi
  log_line "${GREEN}✓ Backend is up at ${BASE_URL}${NC}"
}

# ─────────────────────────────────────────────────────────────
# 7. Run one MF script, capture exit code, stream output
#    Returns: 0 = passed, non-zero = failed
# ─────────────────────────────────────────────────────────────
run_script() {
  local name="$1"     # e.g. "MF-1"
  local script="$2"   # full path to the .sh file
  local script_log="${LOG_DIR}/${name// /-}_${RUN_TS}.log"

  log_line ""
  log_line "${CYAN}${BOLD}╔══════════════════════════════════════════════════════╗${NC}"
  log_line "${CYAN}${BOLD}║  Running ${name}${NC}"
  log_line "${CYAN}${BOLD}╚══════════════════════════════════════════════════════╝${NC}"
  log_line "  Script : ${script}"
  log_line "  Log    : ${script_log}"
  log_line "  Started: $(date '+%Y-%m-%d %H:%M:%S')"

  local start_ts
  start_ts=$(date +%s)

  # Stream script output to terminal AND both log files simultaneously
  # Script output goes to terminal (raw, with colour) + stripped to bundle log + stripped to per-script log
  {
    bash "${script}" 2>&1
  } | tee >(sed 's/\x1b\[[0-9;]*m//g' >> "${BUNDLE_LOG}") \
         >(sed 's/\x1b\[[0-9;]*m//g' > "${script_log}")

  local exit_code="${PIPESTATUS[0]}"
  local end_ts
  end_ts=$(date +%s)
  local elapsed=$(( end_ts - start_ts ))

  if [ "${exit_code}" -eq 0 ]; then
    log_line "${GREEN}✓ ${name} PASSED${NC} (${elapsed}s)"
  else
    log_line "${RED}✗ ${name} FAILED${NC} (exit ${exit_code}, ${elapsed}s)"
  fi

  return "${exit_code}"
}

# ─────────────────────────────────────────────────────────────
# 8. Ordered list of all 20 MF scripts
# ─────────────────────────────────────────────────────────────
declare -a MF_NAMES=(
  "MF-1"  "MF-2"  "MF-3"  "MF-4"  "MF-5"
  "MF-6"  "MF-7"  "MF-8"  "MF-9"  "MF-10"
  "MF-11" "MF-12" "MF-13" "MF-14" "MF-15"
  "MF-16" "MF-17" "MF-18" "MF-19" "MF-20"
)
declare -a MF_SCRIPTS=(
  "${SCRIPT_DIR}/mf1_validate.sh"
  "${SCRIPT_DIR}/mf2_validate.sh"
  "${SCRIPT_DIR}/mf3_validate.sh"
  "${SCRIPT_DIR}/mf4_validate.sh"
  "${SCRIPT_DIR}/mf5_validate.sh"
  "${SCRIPT_DIR}/mf6_validate.sh"
  "${SCRIPT_DIR}/mf7_validate.sh"
  "${SCRIPT_DIR}/mf8_validate.sh"
  "${SCRIPT_DIR}/mf9_validate.sh"
  "${SCRIPT_DIR}/mf10_validate.sh"
  "${SCRIPT_DIR}/mf11_validate.sh"
  "${SCRIPT_DIR}/mf12_validate.sh"
  "${SCRIPT_DIR}/mf13_validate.sh"
  "${SCRIPT_DIR}/mf14_validate.sh"
  "${SCRIPT_DIR}/mf15_validate.sh"
  "${SCRIPT_DIR}/mf16_validate.sh"
  "${SCRIPT_DIR}/mf17_validate.sh"
  "${SCRIPT_DIR}/mf18_validate.sh"
  "${SCRIPT_DIR}/mf19_validate.sh"
  "${SCRIPT_DIR}/mf20_validate.sh"
)

# ─────────────────────────────────────────────────────────────
# 9. Main
# ─────────────────────────────────────────────────────────────

# Resolve runtime config
export BASE_URL="${BASE_URL:-http://localhost:3001}"
export SEPAY_WEBHOOK_SECRET
SEPAY_WEBHOOK_SECRET="$(resolve_sepay_secret)"
resolve_admin_credentials
export FAIL_FAST="${FAIL_FAST:-0}"
SKIP_MF="${SKIP_MF:-}"

# Print banner to terminal + log
{
  echo ""
  echo "════════════════════════════════════════════════════════════════"
  echo "  AITasker — Mainflow Validation Suite"
  echo "  Run timestamp : ${RUN_TS}"
  echo "  Bundle log    : ${BUNDLE_LOG}"
  echo "  BASE_URL      : ${BASE_URL}"
  echo "  ADMIN_EMAIL   : ${ADMIN_EMAIL}"
  echo "  SEPAY secret  : ${SEPAY_WEBHOOK_SECRET:0:12}... (truncated)"
  echo "  FAIL_FAST     : ${FAIL_FAST}"
  echo "  SKIP_MF       : ${SKIP_MF:-<none>}"
  echo "════════════════════════════════════════════════════════════════"
  echo ""
} | tee -a "${BUNDLE_LOG}"

# Prerequisites
check_prerequisites

# Track results
declare -a RESULT_NAMES=()
declare -a RESULT_STATUS=()   # PASSED / FAILED / SKIPPED / MISSING
declare -a RESULT_TIMES=()

TOTAL_PASS=0
TOTAL_FAIL=0
TOTAL_SKIP=0

for i in "${!MF_NAMES[@]}"; do
  name="${MF_NAMES[$i]}"
  script="${MF_SCRIPTS[$i]}"
  short="${name,,}"      # lowercase: "mf-1" → used for SKIP_MF matching
  short_nodash="${short//-/}"  # "mf1"

  # Check SKIP_MF
  SKIP=0
  for skip_token in ${SKIP_MF}; do
    skip_lower="${skip_token,,}"
    if [ "$skip_lower" = "$short" ] || [ "$skip_lower" = "$short_nodash" ]; then
      SKIP=1
      break
    fi
  done

  if [ "$SKIP" -eq 1 ]; then
    log_line ""
    log_line "${YELLOW}⊘ ${name} SKIPPED (in SKIP_MF)${NC}"
    RESULT_NAMES+=("${name}")
    RESULT_STATUS+=("SKIPPED")
    RESULT_TIMES+=("—")
    TOTAL_SKIP=$(( TOTAL_SKIP + 1 ))
    continue
  fi

  # Check script exists
  if [ ! -f "${script}" ]; then
    log_line ""
    log_line "${RED}✗ ${name} script not found: ${script}${NC}"
    RESULT_NAMES+=("${name}")
    RESULT_STATUS+=("MISSING")
    RESULT_TIMES+=("—")
    TOTAL_FAIL=$(( TOTAL_FAIL + 1 ))
    if [ "${FAIL_FAST}" = "1" ]; then
      log_line "${RED}FAIL_FAST=1 — aborting.${NC}"
      break
    fi
    continue
  fi

  start_ts=$(date +%s)
  run_script "${name}" "${script}"
  exit_code=$?
  end_ts=$(date +%s)
  elapsed=$(( end_ts - start_ts ))

  RESULT_NAMES+=("${name}")
  RESULT_TIMES+=("${elapsed}s")

  if [ "${exit_code}" -eq 0 ]; then
    RESULT_STATUS+=("PASSED")
    TOTAL_PASS=$(( TOTAL_PASS + 1 ))
  else
    RESULT_STATUS+=("FAILED")
    TOTAL_FAIL=$(( TOTAL_FAIL + 1 ))
    if [ "${FAIL_FAST}" = "1" ]; then
      log_line "${RED}FAIL_FAST=1 — aborting after ${name} failure.${NC}"
      break
    fi
  fi
done

# ─────────────────────────────────────────────────────────────
# 10. Final summary table
# ─────────────────────────────────────────────────────────────
SUMMARY_TEXT=""
SUMMARY_TEXT+="
════════════════════════════════════════════════════════════════
  AITasker — Mainflow Validation Suite — FINAL SUMMARY
  Completed : $(date '+%Y-%m-%d %H:%M:%S')
  Bundle log : ${BUNDLE_LOG}
════════════════════════════════════════════════════════════════

  Script      Status     Duration
  ─────────── ────────── ────────
"

for i in "${!RESULT_NAMES[@]}"; do
  n="${RESULT_NAMES[$i]}"
  s="${RESULT_STATUS[$i]}"
  t="${RESULT_TIMES[$i]}"
  # Pad name to 11 chars, status to 10 chars
  printf -v row "  %-11s %-10s %s\n" "$n" "$s" "$t"
  SUMMARY_TEXT+="$row"
done

SUMMARY_TEXT+="
  ─────────── ────────── ────────
  Total: ${#RESULT_NAMES[@]}  |  Passed: ${TOTAL_PASS}  |  Failed: ${TOTAL_FAIL}  |  Skipped: ${TOTAL_SKIP}

"

# Print to terminal with colour
echo ""
echo -e "${BOLD}${SUMMARY_TEXT}${NC}" | while IFS= read -r line; do
  if echo "$line" | grep -q "PASSED"; then
    echo -e "${GREEN}${line}${NC}"
  elif echo "$line" | grep -q "FAILED"; then
    echo -e "${RED}${line}${NC}"
  elif echo "$line" | grep -q "SKIPPED\|MISSING"; then
    echo -e "${YELLOW}${line}${NC}"
  else
    echo "$line"
  fi
done

# Write plain summary to bundle log and dedicated summary file
echo "${SUMMARY_TEXT}" >> "${BUNDLE_LOG}"
echo "${SUMMARY_TEXT}" > "${SUMMARY_LOG}"

echo "" | tee -a "${BUNDLE_LOG}"
echo "  Bundle log  → ${BUNDLE_LOG}" | tee -a "${BUNDLE_LOG}"
echo "  Summary     → ${SUMMARY_LOG}" | tee -a "${BUNDLE_LOG}"
echo "" | tee -a "${BUNDLE_LOG}"

# Exit code: 0 if all passed/skipped, 1 if any failed
if [ "${TOTAL_FAIL}" -gt 0 ]; then
  exit 1
fi
exit 0