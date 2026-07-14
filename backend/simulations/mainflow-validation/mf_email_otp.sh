#!/usr/bin/env bash
#
# mf_email_otp.sh
# Covers: Email OTP Registration & Verification Flow
#
# Tests:
# - C-1: Registration returns "OTP_SENT" and no JWT tokens.
# - C-2: Unverified login attempt is blocked with 401 "EMAIL_UNVERIFIED".
# - C-3: Submitting an invalid 6-digit OTP returns 400.
# - C-4: Submitting the correct OTP verifies the account and returns JWTs.
# - C-5: Verified login attempt succeeds.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

require_jq
health_check

if [ -z "${DATABASE_URL:-}" ] && [ -f "${SCRIPT_DIR}/../../.env" ]; then
  set -a
  source "${SCRIPT_DIR}/../../.env"
  set +a
fi

TS=$(date +%s)
PASSWORD="Str0ng!TestPass123"

# We use a simulated email. The backend WILL attempt to send a real SMTP email to this address!
# If your .env SMTP credentials are correct, this email will actually receive the OTP code.
TEST_EMAIL="otp-tester-${TS}@gmail.com"

# ─── Helper: DB Manipulation via Prisma Client ────────────────────────
run_db_script() {
  (cd "${SCRIPT_DIR}/../.." && node -e "
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    async function run() {
      try { $1 }
      catch (e) { console.error(e); process.exit(1); }
      finally { await prisma.\$disconnect(); }
    }
    run();
  ")
}

safe_extract() {
  local val
  val=$(echo "$1" | jq -r "$2 // empty")
  if [ -z "$val" ]; then
    echo "ERROR_EXTRACTION_FAILED"
  else
    echo "$val"
  fi
}

echo ""
echo "════════════════════════════════════════════════════════════════"
echo " Email OTP Verification Flow Validation Suite"
echo "════════════════════════════════════════════════════════════════"

# ══════════════════════════════════════════════════════════════════
step_header "TEST 1: Registration requires OTP (No immediate login)"

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"OTP Tester\",\"roles\":\"CLIENT_CEO\"}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"

check_status "201" "$CODE" "Registration successful"
check_field_equals "$BODY" ".message" "OTP_SENT" "Backend explicitly demands OTP Verification"

ACCESS_TOKEN=$(safe_extract "$BODY" '.access_token')
if [ "$ACCESS_TOKEN" != "ERROR_EXTRACTION_FAILED" ]; then
  echo -e "  ${RED}✗ Security Failure: Backend leaked a JWT token before email was verified!${NC}"
  FAIL=$((FAIL + 1))
else
  echo -e "  ${GREEN}✓${NC} Security Check: No JWT access token was returned."
  PASS=$((PASS + 1))
fi

# ══════════════════════════════════════════════════════════════════
step_header "TEST 2: Standard Login blocked for unverified accounts"

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${PASSWORD}\"}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"

check_status "401" "$CODE" "Login attempt blocked"
check_field_equals "$BODY" ".message" "EMAIL_UNVERIFIED" "Error explicitly flags unverified status"

# ══════════════════════════════════════════════════════════════════
step_header "TEST 3: Submitting an invalid OTP"

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/verify-otp" -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"otp\":\"000000\"}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"

check_status "400" "$CODE" "Invalid OTP rejected"
check_field_equals "$BODY" ".message" "Invalid verification code." "Correct error message"

# ══════════════════════════════════════════════════════════════════
step_header "TEST 4: Submitting the correct OTP"

echo "  [DB] Extracting the real 6-digit OTP from the database..."
REAL_OTP=$(run_db_script "
  const u = await prisma.user.findUnique({ where: { email: '${TEST_EMAIL}' }});
  console.log(u.emailOtp || 'null');
")
REAL_OTP=$(echo "$REAL_OTP" | tr -d '[:space:]')
echo "  Extracted OTP: ${REAL_OTP}"

if [ -z "$REAL_OTP" ] || [ "$REAL_OTP" = "null" ]; then
  echo -e "  ${RED}✗ Fatal Error: OTP was not saved to the database!${NC}"
  exit 1
fi

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/verify-otp" -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"otp\":\"${REAL_OTP}\"}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"

check_status "201" "$CODE" "Correct OTP accepted"
check_field_present "$BODY" ".access_token" "Full JWT Access Token issued!"
check_field_equals "$BODY" ".user.isEmailVerified" "true" "isEmailVerified flag flipped to true in response"

# ══════════════════════════════════════════════════════════════════
step_header "TEST 5: Standard Login now succeeds"

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${PASSWORD}\"}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')

check_status "201" "$CODE" "Login successful"
check_field_present "$BODY" ".access_token" "JWT Access Token returned on login"

print_summary "Email OTP Verification Flow"