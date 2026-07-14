#!/usr/bin/env bash
#
# mf_password_reset.sh
# Covers: Forgot Password & Reset Password Flow
#
# Tests:
# - C-1: Forgot password returns 201 (Generic success) for non-existent emails (Anti-Enumeration).
# - C-2: Forgot password returns 201 (Generic success) for real emails & triggers SMTP.
# - C-3: Submitting an invalid or expired reset token returns 400.
# - C-4: Submitting a valid reset token updates the password and logs the user in.
# - C-5: Re-using the same token is blocked (One-Time Use Enforcement).
# - C-6: Old password no longer works.

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

# We use a simulated email. The backend WILL attempt to send a real SMTP email to this address!
TEST_EMAIL="reset-tester-${TS}@gmail.com"
OLD_PASSWORD="Str0ng!OldPass123"
NEW_PASSWORD="Str0ng!NewPass456"

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
echo " Password Reset Flow Validation Suite"
echo "════════════════════════════════════════════════════════════════"

# ══════════════════════════════════════════════════════════════════
step_header "SETUP: Register and Verify a Test Account"

# 1. Register
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${OLD_PASSWORD}\",\"fullName\":\"Reset Tester\",\"roles\":\"CLIENT_CEO\"}")

# 2. Extract OTP to verify account
REAL_OTP=$(run_db_script "
  const u = await prisma.user.findUnique({ where: { email: '${TEST_EMAIL}' }});
  console.log(u.emailOtp || 'null');
")
REAL_OTP=$(echo "$REAL_OTP" | tr -d '[:space:]')

# 3. Verify Account
curl -s -X POST "${BASE_URL}/auth/verify-otp" -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"otp\":\"${REAL_OTP}\"}" > /dev/null

echo "  ✓ Setup complete. User registered and verified."

# ══════════════════════════════════════════════════════════════════
step_header "TEST 1: Anti-Enumeration (Fake Email)"

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/forgot-password" -H "Content-Type: application/json" \
  -d "{\"email\":\"fake-ghost-email-${TS}@gmail.com\"}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"

check_status "201" "$CODE" "Fake email accepted without error"
check_field_equals "$BODY" ".message" "If an account with that email exists, a reset link has been sent." "Generic security message returned"

# ══════════════════════════════════════════════════════════════════
step_header "TEST 2: Request Password Reset (Real Email)"

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/forgot-password" -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\"}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"

check_status "201" "$CODE" "Real email accepted"
check_field_equals "$BODY" ".message" "If an account with that email exists, a reset link has been sent." "Generic security message returned (Indistinguishable from fake email)"

# ══════════════════════════════════════════════════════════════════
step_header "TEST 3: Verify Reset Token Endpoint (Pre-check)"

echo "  [DB] Extracting the secure reset token from the database..."
RESET_TOKEN=$(run_db_script "
  const u = await prisma.user.findUnique({ where: { email: '${TEST_EMAIL}' }});
  console.log(u.passwordResetToken || 'null');
")
RESET_TOKEN=$(echo "$RESET_TOKEN" | tr -d '[:space:]')
echo "  Extracted Token: ${RESET_TOKEN:0:16}..."

if [ -z "$RESET_TOKEN" ] || [ "$RESET_TOKEN" = "null" ]; then
  echo -e "  ${RED}✗ Fatal Error: Reset token was not saved to the database!${NC}"
  exit 1
fi

RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/auth/verify-reset-token/${RESET_TOKEN}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"

check_status "200" "$CODE" "Token pre-check successful"
check_field_equals "$BODY" ".valid" "true" "Token is flagged as valid for the frontend"

# ══════════════════════════════════════════════════════════════════
step_header "TEST 4: Execute Password Reset"

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/reset-password" -H "Content-Type: application/json" \
  -d "{\"token\":\"${RESET_TOKEN}\",\"newPassword\":\"${NEW_PASSWORD}\"}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"

check_status "201" "$CODE" "Password reset successful"
check_field_equals "$BODY" ".message" "Password has been reset successfully. You can now log in." "Success message returned"

# ══════════════════════════════════════════════════════════════════
step_header "TEST 5: Token One-Time-Use Enforcement"

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/reset-password" -H "Content-Type: application/json" \
  -d "{\"token\":\"${RESET_TOKEN}\",\"newPassword\":\"HackerPass123!\"}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')

check_status "400" "$CODE" "Re-using the token is blocked"
check_field_equals "$BODY" ".message" "This password reset link is invalid or has expired. Please request a new one." "Correct rejection message"

# ══════════════════════════════════════════════════════════════════
step_header "TEST 6: Standard Login (Old vs New Password)"

echo "  Attempting login with OLD password..."
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${OLD_PASSWORD}\"}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
check_status "401" "$CODE" "Old password rejected"

echo "  Attempting login with NEW password..."
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${NEW_PASSWORD}\"}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
check_status "201" "$CODE" "New password accepted"
check_field_present "$BODY" ".access_token" "JWT Access Token returned"

print_summary "Password Reset Flow"