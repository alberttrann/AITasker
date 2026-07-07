#!/usr/bin/env bash
#
# MF-12: Expert Withdrawal (Chi Hộ Manual Payout)
#
# Covers:
#   POST /withdrawals
#   GET  /withdrawals
#   PUT  /admin/withdrawals/:id/complete
#   PUT  /admin/withdrawals/:id/fail
#   POST /webhooks/sepay/chi-ho-credit   (stub smoke)
#
# Guards tested:
#   - No bank linked → 409
#   - amount < 2000 → 400
#   - amount > availableBalance → 422 INSUFFICIENT_BALANCE

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

require_jq
health_check

SEPAY_WEBHOOK_SECRET="${SEPAY_WEBHOOK_SECRET:?Set SEPAY_WEBHOOK_SECRET to match your .env}"
TS=$(date +%s)
PASSWORD="Str0ng!TestPass123"
EXPERT_EMAIL="mf12-expert-${TS}@aitasker.test"

echo ""
echo "════════════════════════════════════════════════════════"
echo " MF-12: Expert Withdrawal (Chi Hộ)"
echo "════════════════════════════════════════════════════════"

fund_wallet() {
  local token="$1" amount="$2" ref="$3"
  local auth=(-H "Authorization: Bearer ${token}")
  local va_res va raw ts sig
  va_res=$(curl -s -X POST "${BASE_URL}/wallets/virtual-accounts/topup" \
    -H "Content-Type: application/json" "${auth[@]}" -d "{\"amount\":${amount}}")
  va=$(echo "$va_res" | jq -r '.paymentReference')
  raw="{\"content\":\"${va} chuyen tien ${ref}\",\"transferAmount\":\"${amount}\",\"referenceCode\":\"${ref}\"}"
  ts=$(date +%s)
  sig="sha256=$(printf '%s' "${ts}.${raw}" | openssl dgst -sha256 -hmac "${SEPAY_WEBHOOK_SECRET}" | sed 's/^.* //')"
  curl -s -X POST "${BASE_URL}/webhooks/sepay/ipn" -H "Content-Type: application/json" \
    -H "x-sepay-signature: ${sig}" -H "x-sepay-timestamp: ${ts}" -d "${raw}" > /dev/null
}

# ── PREREQ ──
step_header "PREREQ — register Expert with Pro + funded wallet"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${EXPERT_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF12 Expert\",\"phone\":\"0901234588\",\"roles\":\"EXPERT\"}")
EXPERT_TOKEN=$(echo "$RES" | jq -r '.access_token')
EXPERT_AUTH=(-H "Authorization: Bearer ${EXPERT_TOKEN}")
fund_wallet "$EXPERT_TOKEN" 700000 "MF12-FUND-${TS}"
RES=$(curl -s -X POST "${BASE_URL}/subscriptions/activate" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"activeRole":"EXPERT"}')
EXPERT_TOKEN=$(echo "$RES" | jq -r '.access_token')
EXPERT_AUTH=(-H "Authorization: Bearer ${EXPERT_TOKEN}")
echo "  Expert ready. Balance ~400,000 after 300,000 subscription cost."

# ── Step 1: Withdraw without bank linked → 409 ──
step_header "POST /withdrawals — EDGE CASE: no bank linked → 409"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/withdrawals" \
  -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"amount":50000}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "409" "$CODE" "No bank account correctly blocks withdrawal"

# ── Step 2: Link bank account ──
step_header "POST /bank-hub/initiate-link — link bank account first"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/bank-hub/initiate-link" \
  -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"bank_account_xid":"MF12BANK9876","holder_name":"MF12 Expert"}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Bank linked"

# ── Step 3: Below minimum → 400 ──
step_header "POST /withdrawals — EDGE CASE: amount < 2000 → 400"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/withdrawals" \
  -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"amount":1000}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "400" "$CODE" "Below minimum correctly rejected"

# ── Step 4: Exceeds balance → 422 ──
step_header "POST /withdrawals — EDGE CASE: amount > balance → 422 INSUFFICIENT_BALANCE"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/withdrawals" \
  -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"amount":999999999}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "422" "$CODE" "Exceeds balance correctly rejected"

# ── Step 5: Valid withdrawal ──
step_header "POST /withdrawals — valid withdrawal request (50,000 VND)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/withdrawals" \
  -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"amount":50000}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Withdrawal request accepted"
check_field_present "$BODY" ".withdrawal_request_id" "withdrawal_request_id present"
check_field_equals "$BODY" ".status" "PENDING" "status is PENDING"
WITHDRAWAL_ID=$(echo "$BODY" | jq -r ".withdrawal_request_id")
echo "  Withdrawal: ${WITHDRAWAL_ID}"

# ── Step 6: List withdrawals ──
step_header "GET /withdrawals — expert lists withdrawal history"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/withdrawals" "${EXPERT_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Withdrawal history readable"

# ── Step 7: Stub webhook smoke ──
step_header "POST /webhooks/sepay/chi-ho-credit — smoke test stub endpoint"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/webhooks/sepay/chi-ho-credit" \
  -H "Content-Type: application/json" \
  -d "{\"withdrawal_id\":\"${WITHDRAWAL_ID}\",\"status\":\"credited\"}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "chi-ho-credit stub reachable"

# ── Step 8: Admin completes withdrawal ──
if [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
  RES=$(curl -s -X POST "${BASE_URL}/auth/login" -H "Content-Type: application/json" \
    -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}")
  ADMIN_TOKEN=$(echo "$RES" | jq -r '.access_token')
  ADMIN_AUTH=(-H "Authorization: Bearer ${ADMIN_TOKEN}")

  step_header "GET /admin/withdrawals — admin views pending withdrawals"
  RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/admin/withdrawals" "${ADMIN_AUTH[@]}")
  CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
  print_body "$BODY"
  check_status "200" "$CODE" "Admin withdrawal queue readable"

  step_header "PUT /admin/withdrawals/:id/complete — admin marks withdrawal complete"
  RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/admin/withdrawals/${WITHDRAWAL_ID}/complete" \
    "${ADMIN_AUTH[@]}")
  CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
  print_body "$BODY"
  check_status "200" "$CODE" "Withdrawal completed"
  check_field_equals "$BODY" ".status" "COMPLETED" "status is COMPLETED"

  # ── Step 9: Create a second withdrawal to test the fail path ──
  step_header "POST /withdrawals — second withdrawal for fail-path test"
  RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/withdrawals" \
    -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
    -d '{"amount":20000}')
  CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
  WITHDRAWAL2_ID=$(echo "$BODY" | jq -r ".withdrawal_request_id")
  print_body "$BODY"
  check_status "201" "$CODE" "Second withdrawal request accepted"

  BALANCE_BEFORE=$(curl -s "${BASE_URL}/wallets/me" "${EXPERT_AUTH[@]}" | jq -r '.availableBalance')

  step_header "PUT /admin/withdrawals/:id/fail — admin fails payout → wallet refunded"
  RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/admin/withdrawals/${WITHDRAWAL2_ID}/fail" \
    "${ADMIN_AUTH[@]}" -H "Content-Type: application/json" \
    -d '{"fail_reason":"Bank account rejected transfer"}')
  CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
  print_body "$BODY"
  check_status "200" "$CODE" "Withdrawal fail accepted"
  check_field_equals "$BODY" ".status" "FAILED" "status is FAILED"

  BALANCE_AFTER=$(curl -s "${BASE_URL}/wallets/me" "${EXPERT_AUTH[@]}" | jq -r '.availableBalance')
  echo "  Balance before fail: ${BALANCE_BEFORE}, after: ${BALANCE_AFTER}"
  if [ "$BALANCE_AFTER" -gt "$BALANCE_BEFORE" ]; then
    echo -e "  \033[0;32m✓\033[0m Balance restored after failed withdrawal"
    PASS=$((PASS + 1))
  else
    echo -e "  \033[0;31m✗\033[0m Balance not restored — expected refund after fail"
    FAIL=$((FAIL + 1))
  fi
else
  echo ""
  echo -e "  \033[1;33m⚠\033[0m Set ADMIN_EMAIL/ADMIN_PASSWORD to test admin withdrawal complete/fail paths"
fi

print_summary "MF-12"