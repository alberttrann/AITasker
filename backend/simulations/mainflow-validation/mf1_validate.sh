#!/usr/bin/env bash
#
# Validates MF-1 (Client/CEO Registration & Subscription) end-to-end
# against a REAL running backend — every step below is a literal HTTP
# call, same as a teacher would make by hand in Swagger.
#
# Usage:
#   cd backend
#   npm run start:dev &
#   export SEPAY_WEBHOOK_SECRET=whsec_test_secret_for_simulation   # match your .env
#   bash simulations/mainflow-validation/mf1_validate.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

require_jq
health_check

SEPAY_WEBHOOK_SECRET="${SEPAY_WEBHOOK_SECRET:?Set SEPAY_WEBHOOK_SECRET to match your .env}"
EMAIL="mf1-ceo-$(date +%s)@aitasker.test"
PASSWORD="Str0ng!TestPass123"

echo ""
echo "════════════════════════════════════════════════════════"
echo " MF-1: Client (CEO) Registration & Subscription"
echo "════════════════════════════════════════════════════════"

# ── PHASE A: REGISTRATION (swimlane steps 1-9) ──────────────────────────

step_header "POST /auth/register — create CEO account"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF1 Test CEO\",\"phone\":\"0901234567\",\"roles\":\"CLIENT_CEO\"}")
CODE=$(echo "$RES" | tail -n1)
BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Register returns 201"
check_field_present "$BODY" ".access_token" "access_token"
check_field_equals "$BODY" ".user.activeRole" "CLIENT" "user.activeRole"
check_field_equals "$BODY" ".user.clientSubtype" "CEO" "user.clientSubtype"
TOKEN=$(echo "$BODY" | jq -r '.access_token')
AUTH=(-H "Authorization: Bearer ${TOKEN}")

step_header "GET /wallets/me — fresh wallet should be zero balance (step 9 dashboard check)"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/wallets/me" "${AUTH[@]}")
CODE=$(echo "$RES" | tail -n1)
BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "GET wallet returns 200"
check_field_equals "$BODY" ".availableBalance" "0" "Fresh wallet balance is 0"

# ── EARLY GUARD CHECK: insufficient balance before any top-up ──────────
# Natural point in the swimlane to test Guard 2 — zero setup needed, the
# wallet is genuinely empty right now.

step_header "POST /subscriptions/activate — BEFORE funding, expect 422 INSUFFICIENT_BALANCE"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/subscriptions/activate" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"activeRole":"CLIENT"}')
CODE=$(echo "$RES" | tail -n1)
BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "422" "$CODE" "Activate with zero balance returns 422 (requires today's blueprint-accuracy fix)"

# ── PHASE B: WALLET TOP-UP (swimlane steps 10-16) ───────────────────────

step_header "POST /wallets/virtual-accounts/topup — request top-up QR"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/wallets/virtual-accounts/topup" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"amount":500000}')
CODE=$(echo "$RES" | tail -n1)
BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Topup-QR returns 201"
check_field_present "$BODY" ".paymentReference" "paymentReference (VA number)"
check_field_present "$BODY" ".qrCodeUrl" "qrCodeUrl"
VA_NUMBER=$(echo "$BODY" | jq -r '.paymentReference')

step_header "POST /webhooks/sepay/ipn — simulate the real signed SePay webhook"
REF_CODE="MF1-VALIDATE-$(date +%s)"
RAW_BODY="{\"content\":\"${VA_NUMBER} chuyen tien mf1 test\",\"transferAmount\":\"500000\",\"referenceCode\":\"${REF_CODE}\"}"
TIMESTAMP=$(date +%s)
SIGNATURE="sha256=$(printf '%s' "${TIMESTAMP}.${RAW_BODY}" | openssl dgst -sha256 -hmac "${SEPAY_WEBHOOK_SECRET}" | sed 's/^.* //')"

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/webhooks/sepay/ipn" \
  -H "Content-Type: application/json" \
  -H "x-sepay-signature: ${SIGNATURE}" \
  -H "x-sepay-timestamp: ${TIMESTAMP}" \
  -d "${RAW_BODY}")
CODE=$(echo "$RES" | tail -n1)
BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "IPN webhook accepted"
check_field_equals "$BODY" ".success" "true" "IPN reports success:true"

step_header "GET /wallets/me — balance should now be 500,000"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/wallets/me" "${AUTH[@]}")
CODE=$(echo "$RES" | tail -n1)
BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "GET wallet returns 200"
check_field_equals "$BODY" ".availableBalance" "500000" "Balance is exactly 500,000 (CLIENT_PRO_PRICE)"

# ── PHASE C: SUBSCRIPTION ACTIVATION (swimlane steps 17-21) ─────────────

step_header "POST /subscriptions/activate — now properly funded, expect 201"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/subscriptions/activate" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"activeRole":"CLIENT"}')
CODE=$(echo "$RES" | tail -n1)
BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Activation succeeds"
check_field_present "$BODY" ".access_token" "Fresh access_token reissued (step 20)"
NEW_TOKEN=$(echo "$BODY" | jq -r '.access_token')
AUTH=(-H "Authorization: Bearer ${NEW_TOKEN}")

step_header "GET /wallets/me — balance should now be 0 (debited for Pro)"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/wallets/me" "${AUTH[@]}")
CODE=$(echo "$RES" | tail -n1)
BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_field_equals "$BODY" ".availableBalance" "0" "Balance is 0 after subscription debit (step 21)"

step_header "POST /subscriptions/activate — immediate repeat, expect 409 ALREADY_SUBSCRIBED"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/subscriptions/activate" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"activeRole":"CLIENT"}')
CODE=$(echo "$RES" | tail -n1)
BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "409" "$CODE" "Repeat activation correctly rejected"

step_header "GET /subscriptions/status — confirm tier=pro with expiry set (step 21 unlock check)"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/subscriptions/status" "${AUTH[@]}")
CODE=$(echo "$RES" | tail -n1)
BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Status check returns 200"
check_field_equals "$BODY" ".subscriptionTier" "pro" "subscriptionTier is pro"
check_field_present "$BODY" ".subscriptionExpires" "subscriptionExpires (should be ~6 months out)"

print_summary "MF-1"