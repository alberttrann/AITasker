#!/usr/bin/env bash
# backend/simulations/mainflow-validation/mf12_validate.sh
#
# Validates MF-12 (Expert Withdrawal / Chi Hộ). MF-2's script already
# exercises this briefly as a downstream check; this script targets it
# directly, including the FAILURE path (PUT /admin/withdrawals/:id/fail)
# which has never been exercised anywhere this session.
#
# Needs a real ADMIN account via ADMIN_EMAIL/ADMIN_PASSWORD env vars —
# admins aren't self-registerable by design, same as MF-8's script.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

require_jq
health_check

SEPAY_WEBHOOK_SECRET="${SEPAY_WEBHOOK_SECRET:?Set SEPAY_WEBHOOK_SECRET to match your .env}"
PASSWORD="Str0ng!TestPass123"

echo ""
echo "════════════════════════════════════════════════════════"
echo " MF-12: Expert Withdrawal (Chi Hộ)"
echo "════════════════════════════════════════════════════════"

step_header "PREREQ — register expert, fund wallet directly (no subscription needed for this flow)"
EMAIL="mf12-expert-$(date +%s)@aitasker.test"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF12 Test Expert\",\"phone\":\"0901234581\",\"roles\":\"EXPERT\"}")
TOKEN=$(echo "$RES" | jq -r '.access_token')
AUTH=(-H "Authorization: Bearer ${TOKEN}")
RES=$(curl -s -X POST "${BASE_URL}/wallets/virtual-accounts/topup" -H "Content-Type: application/json" "${AUTH[@]}" -d '{"amount":1000000}')
VA_NUMBER=$(echo "$RES" | jq -r '.paymentReference')
REF_CODE="MF12-FUND-$(date +%s)"
RAW_BODY="{\"content\":\"${VA_NUMBER} chuyen tien mf12 test\",\"transferAmount\":\"1000000\",\"referenceCode\":\"${REF_CODE}\"}"
TIMESTAMP=$(date +%s)
SIGNATURE="sha256=$(printf '%s' "${TIMESTAMP}.${RAW_BODY}" | openssl dgst -sha256 -hmac "${SEPAY_WEBHOOK_SECRET}" | sed 's/^.* //')"
curl -s -X POST "${BASE_URL}/webhooks/sepay/ipn" -H "Content-Type: application/json" \
  -H "x-sepay-signature: ${SIGNATURE}" -H "x-sepay-timestamp: ${TIMESTAMP}" -d "${RAW_BODY}" > /dev/null
echo "  Expert wallet funded to 1,000,000."

step_header "POST /withdrawals — guard check: no bank linked yet, expect rejection"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/withdrawals" -H "Content-Type: application/json" "${AUTH[@]}" -d '{"amount":500000}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "409" "$CODE" "Withdrawal correctly rejected — no bank account linked"

step_header "POST /bank-hub/initiate-link — link the bank account"
RES=$(curl -s -X POST "${BASE_URL}/bank-hub/initiate-link" -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"bank_account_xid":"MF12BANKXID","holder_name":"MF12 Test Expert"}')
print_body "$RES"

step_header "POST /withdrawals — guard check: amount exceeds balance, expect 422 (step 2 Guard 2)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/withdrawals" -H "Content-Type: application/json" "${AUTH[@]}" -d '{"amount":5000000}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "422" "$CODE" "Over-balance withdrawal correctly rejected"

step_header "POST /withdrawals — real request within balance (step 1-2)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/withdrawals" -H "Content-Type: application/json" "${AUTH[@]}" -d '{"amount":500000}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Withdrawal request accepted"
check_field_present "$BODY" ".message" "Teacher-approved placeholder message present (no real chi-hộ API call)"
WITHDRAWAL_ID=$(echo "$BODY" | jq -r '.withdrawal_request_id')

step_header "GET /wallets/me — confirm availableBalance debited immediately (atomic, step 2's DB TX)"
RES=$(curl -s "${BASE_URL}/wallets/me" "${AUTH[@]}")
print_body "$RES"
check_field_equals "$RES" ".availableBalance" "500000" "Balance debited by exactly the withdrawal amount"

step_header "GET /withdrawals — confirm the request appears as PENDING"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/withdrawals" "${AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Withdrawal history readable"

if [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
  RES=$(curl -s -X POST "${BASE_URL}/auth/login" -H "Content-Type: application/json" \
    -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}")
  ADMIN_TOKEN=$(echo "$RES" | jq -r '.access_token')
  ADMIN_AUTH=(-H "Authorization: Bearer ${ADMIN_TOKEN}")

  step_header "PUT /admin/withdrawals/:id/fail — exercise the FAILURE path (step 8, never tested anywhere this session)"
  RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/admin/withdrawals/${WITHDRAWAL_ID}/fail" -H "Content-Type: application/json" "${ADMIN_AUTH[@]}")
  CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
  print_body "$BODY"
  check_status "200" "$CODE" "Admin fail action accepted"
  check_field_equals "$BODY" ".status" "FAILED" "withdrawal status is FAILED"

  step_header "GET /wallets/me — confirm balance RESTORED (step 8's stated reversal: available_balance += amount)"
  RES=$(curl -s "${BASE_URL}/wallets/me" "${AUTH[@]}")
  print_body "$RES"
  check_field_equals "$RES" ".availableBalance" "1000000" "Balance fully restored after failure reversal"
else
  echo ""
  echo -e "  \033[1;33m⚠\033[0m Skipping the admin fail-path check — set ADMIN_EMAIL/ADMIN_PASSWORD to exercise it."
  echo "  Without it, the failure-path reversal (a real, distinct piece of"
  echo "  this flow's logic) goes unverified this run."
fi

print_summary "MF-12"