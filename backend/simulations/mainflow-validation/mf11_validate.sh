#!/usr/bin/env bash
#
# MF-11: Wallet Top-Up + IPN Idempotency
#
# Covers:
#   POST /wallets/virtual-accounts/topup
#   POST /webhooks/sepay/ipn       (WALLET_TOPUP + idempotency)
#   GET  /wallets/me
#   GET  /wallets/me/transactions

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

require_jq
health_check

SEPAY_WEBHOOK_SECRET="${SEPAY_WEBHOOK_SECRET:?Set SEPAY_WEBHOOK_SECRET to match your .env}"
TS=$(date +%s)
PASSWORD="Str0ng!TestPass123"
EMAIL="mf11-user-${TS}@aitasker.test"

echo ""
echo "════════════════════════════════════════════════════════"
echo " MF-11: Wallet Top-Up + IPN Idempotency"
echo "════════════════════════════════════════════════════════"

step_header "PREREQ — register user"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF11 User\",\"phone\":\"0901234587\",\"roles\":\"EXPERT\"}")
TOKEN=$(echo "$RES" | jq -r '.access_token')
AUTH=(-H "Authorization: Bearer ${TOKEN}")

step_header "GET /wallets/me — initial balance is 0"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/wallets/me" "${AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Wallet readable"
check_field_equals "$BODY" ".availableBalance" "0" "Initial balance is 0"

step_header "POST /wallets/virtual-accounts/topup — get VietQR + paymentReference"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/wallets/virtual-accounts/topup" \
  -H "Content-Type: application/json" "${AUTH[@]}" -d '{"amount":200000}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Topup VA returned"
check_field_present "$BODY" ".qrCodeUrl" "qrCodeUrl present"
check_field_present "$BODY" ".paymentReference" "paymentReference present"
VA_NUMBER=$(echo "$BODY" | jq -r '.paymentReference')

step_header "POST /webhooks/sepay/ipn — first credit (200,000 VND)"
REF_CODE="MF11-A-${TS}"
RAW_BODY="{\"content\":\"${VA_NUMBER} chuyen tien mf11\",\"transferAmount\":\"200000\",\"referenceCode\":\"${REF_CODE}\"}"
TIMESTAMP=$(date +%s)
SIGNATURE="sha256=$(printf '%s' "${TIMESTAMP}.${RAW_BODY}" | openssl dgst -sha256 -hmac "${SEPAY_WEBHOOK_SECRET}" | sed 's/^.* //')"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/webhooks/sepay/ipn" \
  -H "Content-Type: application/json" \
  -H "x-sepay-signature: ${SIGNATURE}" -H "x-sepay-timestamp: ${TIMESTAMP}" -d "${RAW_BODY}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "IPN accepted"
check_field_equals "$BODY" ".success" "true" "success is true"

step_header "GET /wallets/me — balance updated to 200,000"
RES=$(curl -s "${BASE_URL}/wallets/me" "${AUTH[@]}")
print_body "$RES"
check_field_equals "$RES" ".availableBalance" "200000" "Balance is 200,000"

step_header "POST /webhooks/sepay/ipn — REPLAY same referenceCode (idempotency)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/webhooks/sepay/ipn" \
  -H "Content-Type: application/json" \
  -H "x-sepay-signature: ${SIGNATURE}" -H "x-sepay-timestamp: ${TIMESTAMP}" -d "${RAW_BODY}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Replay returns 201"
check_field_equals "$BODY" ".message" "Already processed" "Replay detected — not double-credited"

step_header "GET /wallets/me — balance still 200,000 (not doubled)"
RES=$(curl -s "${BASE_URL}/wallets/me" "${AUTH[@]}")
print_body "$RES"
check_field_equals "$RES" ".availableBalance" "200000" "Balance unchanged after replay"

step_header "POST /webhooks/sepay/ipn — second unique topup (new referenceCode)"
RES2=$(curl -s -X POST "${BASE_URL}/wallets/virtual-accounts/topup" \
  -H "Content-Type: application/json" "${AUTH[@]}" -d '{"amount":100000}')
VA2=$(echo "$RES2" | jq -r '.paymentReference')
REF2="MF11-B-${TS}"
RAW2="{\"content\":\"${VA2} chuyen tien mf11b\",\"transferAmount\":\"100000\",\"referenceCode\":\"${REF2}\"}"
TS2=$(date +%s)
SIG2="sha256=$(printf '%s' "${TS2}.${RAW2}" | openssl dgst -sha256 -hmac "${SEPAY_WEBHOOK_SECRET}" | sed 's/^.* //')"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/webhooks/sepay/ipn" \
  -H "Content-Type: application/json" \
  -H "x-sepay-signature: ${SIG2}" -H "x-sepay-timestamp: ${TS2}" -d "${RAW2}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Second unique topup accepted"

step_header "GET /wallets/me — balance is now 300,000"
RES=$(curl -s "${BASE_URL}/wallets/me" "${AUTH[@]}")
print_body "$RES"
check_field_equals "$RES" ".availableBalance" "300000" "Balance is 300,000 after two unique top-ups"

step_header "GET /wallets/me/transactions — transaction history has 2 TOP_UP entries"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/wallets/me/transactions" "${AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Transaction history readable"
TOPUP_COUNT=$(echo "$BODY" | jq '[.[] | select(.transactionType == "TOP_UP")] | length')
if [ "$TOPUP_COUNT" -ge 2 ]; then
  echo -e "  \033[0;32m✓\033[0m Transaction history has ${TOPUP_COUNT} TOP_UP entries"
  PASS=$((PASS + 1))
else
  echo -e "  \033[0;31m✗\033[0m Expected ≥2 TOP_UP entries, found ${TOPUP_COUNT}"
  FAIL=$((FAIL + 1))
fi

print_summary "MF-11"