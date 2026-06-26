#!/usr/bin/env bash
# backend/simulations/mainflow-validation/mf11_validate.sh
#
# Validates MF-11 (Wallet Top-Up). Simplest flow in the whole system —
# this exact mechanism has already been proven correct dozens of times
# as a prerequisite step in every other script this session. This script
# exercises it as its own dedicated target: the idempotency guarantee
# specifically, not just "did the balance go up once."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

require_jq
health_check

SEPAY_WEBHOOK_SECRET="${SEPAY_WEBHOOK_SECRET:?Set SEPAY_WEBHOOK_SECRET to match your .env}"
PASSWORD="Str0ng!TestPass123"

echo ""
echo "════════════════════════════════════════════════════════"
echo " MF-11: Wallet Top-Up"
echo "════════════════════════════════════════════════════════"

step_header "PREREQ — register a user"
EMAIL="mf11-user-$(date +%s)@aitasker.test"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF11 Test User\",\"phone\":\"0901234580\",\"roles\":\"CLIENT_CEO\"}")
TOKEN=$(echo "$RES" | jq -r '.access_token')
AUTH=(-H "Authorization: Bearer ${TOKEN}")

step_header "GET /wallets/me — fresh wallet is zero (sanity baseline)"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/wallets/me" "${AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Wallet readable"
check_field_equals "$BODY" ".availableBalance" "0" "Fresh balance is 0"

step_header "POST /wallets/virtual-accounts/topup — request the permanent WALLET_TOPUP VA (steps 1-2)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/wallets/virtual-accounts/topup" -H "Content-Type: application/json" "${AUTH[@]}" -d '{"amount":250000}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Topup-QR returned"
VA_NUMBER=$(echo "$BODY" | jq -r '.paymentReference')

step_header "POST /webhooks/sepay/ipn — real signed webhook (steps 3-5)"
REF_CODE="MF11-VALIDATE-$(date +%s)"
RAW_BODY="{\"content\":\"${VA_NUMBER} chuyen tien mf11 test\",\"transferAmount\":\"250000\",\"referenceCode\":\"${REF_CODE}\"}"
TIMESTAMP=$(date +%s)
SIGNATURE="sha256=$(printf '%s' "${TIMESTAMP}.${RAW_BODY}" | openssl dgst -sha256 -hmac "${SEPAY_WEBHOOK_SECRET}" | sed 's/^.* //')"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/webhooks/sepay/ipn" -H "Content-Type: application/json" \
  -H "x-sepay-signature: ${SIGNATURE}" -H "x-sepay-timestamp: ${TIMESTAMP}" -d "${RAW_BODY}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "IPN accepted"
check_field_equals "$BODY" ".success" "true" "IPN reports success"

step_header "GET /wallets/me — balance reflects the top-up (step 6)"
RES=$(curl -s "${BASE_URL}/wallets/me" "${AUTH[@]}")
print_body "$RES"
check_field_equals "$RES" ".availableBalance" "250000" "Balance is exactly 250,000"

step_header "POST /webhooks/sepay/ipn — REPLAY the IDENTICAL webhook (idempotency guarantee, the flow's own stated purpose)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/webhooks/sepay/ipn" -H "Content-Type: application/json" \
  -H "x-sepay-signature: ${SIGNATURE}" -H "x-sepay-timestamp: ${TIMESTAMP}" -d "${RAW_BODY}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Replay accepted (not rejected outright)"
check_field_equals "$BODY" ".message" "Already processed" "Replay correctly recognized as already-processed, not double-credited"

step_header "GET /wallets/me — balance MUST still be 250,000, not 500,000 (the actual guarantee under test)"
RES=$(curl -s "${BASE_URL}/wallets/me" "${AUTH[@]}")
print_body "$RES"
check_field_equals "$RES" ".availableBalance" "250000" "Balance unchanged after replay — idempotency confirmed, not just trusted"

print_summary "MF-11"