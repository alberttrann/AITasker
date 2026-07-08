#!/usr/bin/env bash
#
# Group B — Auth & Security Validation Suite

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

require_jq
health_check

# ─── Load .env if DATABASE_URL not already in environment ─────────
if [ -z "${DATABASE_URL:-}" ] && [ -f "${SCRIPT_DIR}/../../.env" ]; then
  set -a
  source "${SCRIPT_DIR}/../../.env"
  set +a
fi

TS=$(date +%s)

# B-1 user
B1_EMAIL="b1-reset-${TS}@gmail.com"
B1_PASS="InitPass123!"
B1_NEW_PASS="ResetNewPass456@"

# B-3 normalization
B3_EMAIL_UPPER="  B3.TEST.${TS}@GMAIL.COM  "        
B3_EMAIL_LOWER="b3.test.${TS}@gmail.com"             
B3_EMAIL_MIXED="MiXeD.${TS}@GMAIL.COM"              
B3_EMAIL_MIXED_LOWER="mixed.${TS}@gmail.com"         
B3_PASS="ValidPass123!"

# Shared valid password used in B-2 tests
VALID_PASS="ValidPass123!"

# ─── Extra helper functions not in _lib.sh ────────────────────────

check_errors_contain() {
  local body="$1" substring="$2" label="$3"
  local found
  found=$(echo "$body" | jq -e \
    --arg s "$substring" \
    '(.message | type == "array") and
     ([.message[] | ascii_downcase | contains($s | ascii_downcase)] | any)' \
    2>/dev/null || echo "false")
  if [ "$found" = "true" ]; then
    echo -e "  ${GREEN}✓${NC} ${label}"
    PASS=$((PASS + 1))
  else
    local actual
    actual=$(echo "$body" | jq -c '.message // "«no .message field»"' 2>/dev/null)
    echo -e "  ${RED}✗${NC} ${label}"
    echo -e "     Expected error message containing: '${substring}'"
    echo -e "     Actual .message: ${actual}"
    FAIL=$((FAIL + 1))
  fi
}

check_errors_min_count() {
  local body="$1" min="$2" label="$3"
  local count
  count=$(echo "$body" | \
    jq 'if (.message | type == "array") then (.message | length) else 0 end' \
    2>/dev/null || echo "0")
  if [ "$count" -ge "$min" ] 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} ${label} — ${count} error messages returned (≥ ${min} required)"
    PASS=$((PASS + 1))
  else
    local actual
    actual=$(echo "$body" | jq -c '.message // "«no .message field»"' 2>/dev/null)
    echo -e "  ${RED}✗${NC} ${label} — only ${count} error messages (need ≥ ${min})"
    echo -e "     Actual .message: ${actual}"
    FAIL=$((FAIL + 1))
  fi
}

check_message_contains_re() {
  local body="$1" pattern="$2" label="$3"
  local msg
  msg=$(echo "$body" | jq -r '.message // ""' 2>/dev/null)
  if echo "$msg" | grep -qiE "$pattern"; then
    echo -e "  ${GREEN}✓${NC} ${label}"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} ${label}"
    echo -e "     Pattern: '${pattern}'"
    echo -e "     Got .message: ${msg}"
    FAIL=$((FAIL + 1))
  fi
}

# NEW: Runs from the backend root so Prisma can find the .env file
extract_reset_token() {
  local email="$1"
  (cd "${SCRIPT_DIR}/../.." && node -e "
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    prisma.user.findUnique({ where: { email: '$email' } })
      .then(u => {
        if (u && u.passwordResetToken) {
          // Print token to stdout so Bash can capture it
          console.log(u.passwordResetToken);
        } else {
          // Print to stderr so it bypasses variable capture and shows in terminal
          console.error('  [Prisma Debug] User found, but passwordResetToken is null!');
        }
        return prisma.\$disconnect();
      })
      .catch(err => {
        console.error('  [Prisma Error]', err.message);
        prisma.\$disconnect();
        process.exit(1);
      });
  ") | tr -d '[:space:]'
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo ""
echo "════════════════════════════════════════════════════════════════"
echo " Group B — Auth & Security Validation Suite"
echo "════════════════════════════════════════════════════════════════"

# ══════════════════════════════════════════════════════════════════
echo ""
echo "─── SETUP ──────────────────────────────────────────────────────"
echo "    Creating B-1 test user: ${B1_EMAIL}"

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${B1_EMAIL}\",\"password\":\"${B1_PASS}\",\"fullName\":\"B1 Reset Tester\",\"phone\":\"0901230001\",\"roles\":\"CLIENT_CEO\"}")
SETUP_CODE=$(echo "$RES" | tail -n1)
SETUP_BODY=$(echo "$RES" | sed '$d')

if [ "$SETUP_CODE" = "201" ]; then
  echo -e "${GREEN}✓ Setup complete — B1 user registered.${NC}"
else
  echo -e "${RED}✗ Setup failed (HTTP ${SETUP_CODE}) — B-1 tests will be skipped.${NC}"
  echo "  Response: ${SETUP_BODY}"
  echo ""
fi

# ══════════════════════════════════════════════════════════════════
echo ""
echo "─── B-1: Forgot Password / Reset Password ───────────────────────"

step_header "B1·T01 — forgot-password: non-existent email → 201 generic (not 404)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"nobody-${TS}@gmail.com\"}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Returns 201 for unknown email (no information leak)"
check_message_contains_re "$BODY" "If an account" "Generic anti-enumeration message returned"

step_header "B1·T02 — forgot-password: real user email → same 201 generic response"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${B1_EMAIL}\"}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Returns 201 for real user too"
check_message_contains_re "$BODY" "If an account" "Same generic wording as T01 (indistinguishable)"

step_header "B1·T03 — reset-password: invalid token → 400"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/reset-password" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"thisisatotallyfaketoken000\",\"newPassword\":\"${B1_NEW_PASS}\"}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "400" "$CODE" "Invalid token rejected"
check_message_contains_re "$BODY" "invalid|expired" "Error message says invalid/expired"

echo ""
if [ "$SETUP_CODE" = "201" ]; then
  echo -e "${CYAN}  Running full reset-flow (T04–T08)${NC}"

  step_header "B1·T04 — extract reset token from DB via Prisma"
  RESET_TOKEN=$(extract_reset_token "$B1_EMAIL")

  if [ -z "$RESET_TOKEN" ] || [ "$RESET_TOKEN" = "null" ]; then
    echo -e "  ${RED}✗${NC} Token not found in DB for ${B1_EMAIL}"
    FAIL=$((FAIL + 1))
  else
    echo -e "  ${GREEN}✓${NC} Token extracted from DB (first 16 chars): ${RESET_TOKEN:0:16}..."
    PASS=$((PASS + 1))

    step_header "B1·T05 — reset-password: valid token → 201 success"
    RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/reset-password" \
      -H "Content-Type: application/json" \
      -d "{\"token\":\"${RESET_TOKEN}\",\"newPassword\":\"${B1_NEW_PASS}\"}")
    CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
    print_body "$BODY"
    check_status "201" "$CODE" "Valid token accepted — password changed"
    check_message_contains_re "$BODY" "reset successfully|reset success" "Success confirmation message"

    step_header "B1·T06 — login with OLD password → 401 (invalidated by reset)"
    RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"${B1_EMAIL}\",\"password\":\"${B1_PASS}\"}")
    CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
    print_body "$BODY"
    check_status "401" "$CODE" "Old password rejected after reset"

    step_header "B1·T07 — login with NEW password → 201 (reset confirmed end-to-end)"
    RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"${B1_EMAIL}\",\"password\":\"${B1_NEW_PASS}\"}")
    CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
    print_body "$BODY"
    check_status "201" "$CODE" "New password accepted — full reset flow verified"
    check_field_present "$BODY" ".access_token" "access_token present in login response"

    step_header "B1·T08 — reset-password: reuse same token → 400 (one-time use)"
    RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/reset-password" \
      -H "Content-Type: application/json" \
      -d "{\"token\":\"${RESET_TOKEN}\",\"newPassword\":\"AnotherAttempt789!\"}")
    CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
    print_body "$BODY"
    check_status "400" "$CODE" "Consumed token correctly rejected (one-time use enforced)"
  fi
fi

# ══════════════════════════════════════════════════════════════════
echo ""
echo "─── B-2: Email Validity (Disposable + MX Check) ─────────────────"

b2_body() {
  printf '{"email":"%s","password":"%s","fullName":"B2 Test","phone":"0901230002","roles":"CLIENT_CEO"}' \
    "$1" "$VALID_PASS"
}

step_header "B2·T09 — mailinator.com → 400 (disposable domain)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register" \
  -H "Content-Type: application/json" -d "$(b2_body "b2-${TS}@mailinator.com")")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "400" "$CODE" "mailinator.com blocked"
check_message_contains_re "$BODY" "throwaway|Temporary|disposable|temporary" "Rejection message mentions disposable"

step_header "B2·T10 — guerrillamail.com → 400 (disposable domain)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register" \
  -H "Content-Type: application/json" -d "$(b2_body "b2-${TS}@guerrillamail.com")")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "400" "$CODE" "guerrillamail.com blocked"
check_message_contains_re "$BODY" "throwaway|Temporary|disposable|temporary" "Rejection message mentions disposable"

step_header "B2·T11 — tempmail.com → 400 (disposable domain)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register" \
  -H "Content-Type: application/json" -d "$(b2_body "b2-${TS}@tempmail.com")")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "400" "$CODE" "tempmail.com blocked"
check_message_contains_re "$BODY" "throwaway|Temporary|disposable|temporary" "Rejection message mentions disposable"

step_header "B2·T12 — fake domain (no MX records) → 400 [DNS lookup: allow 15s]"
FAKE_DOMAIN="nonexistentxyz${TS}.invalid"
RES=$(curl -s -w "\n%{http_code}" --max-time 15 -X POST "${BASE_URL}/auth/register" \
  -H "Content-Type: application/json" -d "$(b2_body "b2-test@${FAKE_DOMAIN}")")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "400" "$CODE" "Fake domain (no MX) blocked"
check_message_contains_re "$BODY" "domain|exist|mail" "Rejection message mentions domain/mail"

step_header "B2·T13 — gmail.com → email check passes (validator must not block it)"
VALID_GMAIL="b2-valid-${TS}@gmail.com"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register" \
  -H "Content-Type: application/json" -d "$(b2_body "$VALID_GMAIL")")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
MSG=$(echo "$BODY" | jq -r '.message // ""' 2>/dev/null)
if echo "$MSG" | grep -qiE "disposable|throwaway|domain does not exist|MX|cannot receive"; then
  echo -e "  ${RED}✗${NC} gmail.com incorrectly blocked by email validator"
  FAIL=$((FAIL + 1))
else
  echo -e "  ${GREEN}✓${NC} gmail.com NOT blocked by email validator"
  PASS=$((PASS + 1))
fi

# ══════════════════════════════════════════════════════════════════
echo ""
echo "─── B-3: Email Normalization ────────────────────────────────────"

step_header "B3·T14 — register padded uppercase → stored as lowercase"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register" \
  -H "Content-Type: application/json" -d "{\"email\":\"${B3_EMAIL_UPPER}\",\"password\":\"${B3_PASS}\",\"fullName\":\"B3 Norm Test\",\"phone\":\"0901230003\",\"roles\":\"CLIENT_CEO\"}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Registration accepted"
check_field_equals "$BODY" ".user.email" "$B3_EMAIL_LOWER" "Response .user.email is normalized lowercase"

step_header "B3·T15 — login with normalized lowercase email → 201"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" -d "{\"email\":\"${B3_EMAIL_LOWER}\",\"password\":\"${B3_PASS}\"}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Login succeeds"

step_header "B3·T16 — re-register same email (lowercase) → 409 conflict"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register" \
  -H "Content-Type: application/json" -d "{\"email\":\"${B3_EMAIL_LOWER}\",\"password\":\"${B3_PASS}\",\"fullName\":\"Duplicate\",\"phone\":\"0901230004\",\"roles\":\"CLIENT_CEO\"}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "409" "$CODE" "Duplicate correctly rejected"

step_header "B3·T17 — mixed-case → stored as lowercase"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register" \
  -H "Content-Type: application/json" -d "{\"email\":\"${B3_EMAIL_MIXED}\",\"password\":\"${B3_PASS}\",\"fullName\":\"B3 Mixed\",\"phone\":\"0901230005\",\"roles\":\"CLIENT_CEO\"}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Mixed-case registration accepted"
check_field_equals "$BODY" ".user.email" "$B3_EMAIL_MIXED_LOWER" "MixeD-cAsE fully lowercased"

# ══════════════════════════════════════════════════════════════════
echo ""
echo "─── B-5: Password Feedback (all failing rules returned at once) ──"

b5_body() {
  local pw="$1" idx="$2"
  printf '{"email":"b5-%s-%s@gmail.com","password":"%s","fullName":"B5 Test","phone":"090123%04d","roles":"CLIENT_CEO"}' \
    "$TS" "$idx" "$pw" "$idx"
}

# FIX: Sending a single space " " guarantees ALL 5 checks will fail.
step_header "B5·T18 — password=' ' → all 5 rules fail simultaneously (5 error messages)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register" \
  -H "Content-Type: application/json" -d "$(b5_body " " "18")")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "400" "$CODE" "Weak password rejected"
check_errors_min_count "$BODY" 5 "5 error messages in one response (all rules at once)"
check_errors_contain "$BODY" "8 characters"      "Rule: minimum 8 characters"
check_errors_contain "$BODY" "uppercase"          "Rule: at least one uppercase letter"
check_errors_contain "$BODY" "lowercase"          "Rule: at least one lowercase letter"
check_errors_contain "$BODY" "number"             "Rule: at least one number"
check_errors_contain "$BODY" "special character"  "Rule: at least one special character"

step_header "B5·T19 — password='validpass1!' (no uppercase) → exactly the uppercase error"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register" \
  -H "Content-Type: application/json" -d "$(b5_body "validpass1!" "19")")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "400" "$CODE" "Rejected"
check_errors_contain "$BODY" "uppercase" "Uppercase rule specifically flagged"

step_header "B5·T20 — password='VALIDPASS1!' (no lowercase) → lowercase error"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register" \
  -H "Content-Type: application/json" -d "$(b5_body "VALIDPASS1!" "20")")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "400" "$CODE" "Rejected"
check_errors_contain "$BODY" "lowercase" "Lowercase rule specifically flagged"

step_header "B5·T21 — password='ValidPass!' (no number) → number error"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register" \
  -H "Content-Type: application/json" -d "$(b5_body "ValidPass!" "21")")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "400" "$CODE" "Rejected"
check_errors_contain "$BODY" "number" "Number rule specifically flagged"

step_header "B5·T22 — password='ValidPass1' (no special char) → special char error"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register" \
  -H "Content-Type: application/json" -d "$(b5_body "ValidPass1" "22")")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "400" "$CODE" "Rejected"
check_errors_contain "$BODY" "special character" "Special-character rule specifically flagged"

step_header "B5·T23 — password='Short1!' (7 chars — too short) → length error"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register" \
  -H "Content-Type: application/json" -d "$(b5_body "Short1!" "23")")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "400" "$CODE" "Rejected"
check_errors_contain "$BODY" "8 characters" "Min-length rule specifically flagged"

step_header "B5·T24 — password='ValidPass1!' (all rules met) → DTO passes (no password errors)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register" \
  -H "Content-Type: application/json" -d "$(b5_body "ValidPass1!" "24")")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
MSG=$(echo "$BODY" | jq -c '.message // ""' 2>/dev/null)
if echo "$MSG" | grep -qiE "8 characters|uppercase|lowercase|number|special character"; then
  echo -e "  ${RED}✗${NC} Strong password incorrectly failed a password rule"
  FAIL=$((FAIL + 1))
else
  echo -e "  ${GREEN}✓${NC} Strong password passes DTO validation"
  PASS=$((PASS + 1))
fi

# ══════════════════════════════════════════════════════════════════
print_summary "Group B — Auth & Security Validation"