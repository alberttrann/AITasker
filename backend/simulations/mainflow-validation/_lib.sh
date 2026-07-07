# Shared helpers for the mainflow-validation scripts — sourced,
set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:3001}"
PASS=0
FAIL=0
STEP_NUM=0

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

step_header() {
  STEP_NUM=$((STEP_NUM + 1))
  echo ""
  echo -e "${CYAN}── [Step ${STEP_NUM}] $1 ──${NC}"
}

# check_status EXPECTED_CODE ACTUAL_CODE LABEL
check_status() {
  local expected="$1" actual="$2" label="$3"
  if [ "$actual" = "$expected" ]; then
    echo -e "  ${GREEN}✓${NC} ${label} — HTTP ${actual} (expected ${expected})"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} ${label} — HTTP ${actual} (expected ${expected})"
    FAIL=$((FAIL + 1))
  fi
}

# check_field BODY_JSON JQ_PATH EXPECTED_DESCRIPTION_FOR_HUMANS
check_field_present() {
  local body="$1" path="$2" label="$3"
  local val
  val=$(echo "$body" | jq -r "$path" 2>/dev/null)
  if [ -n "$val" ] && [ "$val" != "null" ]; then
    echo -e "  ${GREEN}✓${NC} ${label} present: ${val}"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} ${label} missing or null"
    FAIL=$((FAIL + 1))
  fi
}

check_field_equals() {
  local body="$1" path="$2" expected="$3" label="$4"
  local val
  val=$(echo "$body" | jq -r "$path" 2>/dev/null)
  if [ "$val" = "$expected" ]; then
    echo -e "  ${GREEN}✓${NC} ${label} — got '${val}' (expected '${expected}')"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} ${label} — got '${val}' (expected '${expected}')"
    FAIL=$((FAIL + 1))
  fi
}

print_body() {
  echo "$1" | jq . 2>/dev/null || echo "$1"
}

health_check() {
  echo "Checking backend at ${BASE_URL}/health ..."
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/health" || echo "000")
  if [ "$code" != "200" ]; then
    echo -e "${RED}✗ Backend not reachable at ${BASE_URL} (HTTP ${code}).${NC}"
    echo "  Start it first: cd backend && npm run start:dev"
    exit 1
  fi
  echo -e "${GREEN}✓ Backend is up.${NC}"
}

require_jq() {
  if ! command -v jq >/dev/null 2>&1; then
    echo -e "${RED}✗ jq is required but not installed.${NC}"
    echo "  Install: apt-get install jq  /  brew install jq"
    exit 1
  fi
}

print_summary() {
  local flow_name="$1"
  echo ""
  echo "════════════════════════════════════════════════════════"
  echo " ${flow_name} — SUMMARY"
  echo -e " ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC} (of $((PASS + FAIL)) checks)"
  echo "════════════════════════════════════════════════════════"
  if [ "$FAIL" -gt 0 ]; then
    exit 1
  fi
  exit 0
}

update_token_if_success() {
  local expected="$1" actual="$2" body="$3"
  if [ "$actual" = "$expected" ]; then
    local new_token
    new_token=$(echo "$body" | jq -r '.access_token // empty' 2>/dev/null)
    if [ -n "$new_token" ] && [ "$new_token" != "null" ]; then
      TOKEN="$new_token"
      AUTH=(-H "Authorization: Bearer ${TOKEN}")
    fi
  fi
}
