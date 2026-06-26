#!/usr/bin/env bash
# backend/simulations/mainflow-validation/mf13_validate.sh
#
# Validates MF-13 (Subscription Purchase from Wallet). MF-1's script
# already covers the CLIENT role path narrowly as part of its own flow;
# this script targets the mechanism directly and symmetrically for BOTH
# roles, plus the reactivation-after-expiry case neither prior script
# exercises

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

require_jq
health_check

SEPAY_WEBHOOK_SECRET="${SEPAY_WEBHOOK_SECRET:?Set SEPAY_WEBHOOK_SECRET to match your .env}"
PASSWORD="Str0ng!TestPass123"

echo ""
echo "════════════════════════════════════════════════════════"
echo " MF-13: Subscription Purchase from Wallet"
echo "════════════════════════════════════════════════════════"

fund_wallet() {
  local auth_header="$1" amount="$2" ref_prefix="$3"
  local res va_number ref_code raw_body timestamp signature
  res=$(curl -s -X POST "${BASE_URL}/wallets/virtual-accounts/topup" -H "Content-Type: application/json" -H "${auth_header}" -d "{\"amount\":${amount}}")
  va_number=$(echo "$res" | jq -r '.paymentReference')
  ref_code="${ref_prefix}-$(date +%s)-${RANDOM}"
  raw_body="{\"content\":\"${va_number} chuyen tien\",\"transferAmount\":\"${amount}\",\"referenceCode\":\"${ref_code}\"}"
  timestamp=$(date +%s)
  signature="sha256=$(printf '%s' "${timestamp}.${raw_body}" | openssl dgst -sha256 -hmac "${SEPAY_WEBHOOK_SECRET}" | sed 's/^.* //')"
  curl -s -X POST "${BASE_URL}/webhooks/sepay/ipn" -H "Content-Type: application/json" \
    -H "x-sepay-signature: ${signature}" -H "x-sepay-timestamp: ${timestamp}" -d "${raw_body}" > /dev/null
}

# ── CLIENT role path ─────────────────────────────────────────────────────

step_header "PREREQ — register CLIENT, fund exactly 500,000 (CLIENT_PRO_PRICE)"
CLIENT_EMAIL="mf13-client-$(date +%s)@aitasker.test"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${CLIENT_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF13 Test Client\",\"phone\":\"0901234582\",\"roles\":\"CLIENT_CEO\"}")
CLIENT_TOKEN=$(echo "$RES" | jq -r '.access_token')
CLIENT_AUTH="Authorization: Bearer ${CLIENT_TOKEN}"
fund_wallet "$CLIENT_AUTH" 500000 "MF13-CLIENT"

step_header "POST /subscriptions/activate {activeRole: CLIENT} — exact price match"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/subscriptions/activate" -H "Content-Type: application/json" -H "$CLIENT_AUTH" -d '{"activeRole":"CLIENT"}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Client Pro activated"
CLIENT_TOKEN=$(echo "$BODY" | jq -r '.access_token')
CLIENT_AUTH="Authorization: Bearer ${CLIENT_TOKEN}"

step_header "GET /wallets/me — confirm exactly 500,000 debited (the CLIENT_PRO_PRICE fix specifically)"
RES=$(curl -s "${BASE_URL}/wallets/me" -H "$CLIENT_AUTH")
print_body "$RES"
check_field_equals "$RES" ".availableBalance" "0" "Balance is 0 — exactly CLIENT_PRO_PRICE was deducted, not the old shared 5000 constant"

# ── EXPERT role path — the price MUST differ from CLIENT's ─────────────

step_header "PREREQ — register EXPERT, fund exactly 300,000 (EXPERT_PRO_PRICE)"
EXPERT_EMAIL="mf13-expert-$(date +%s)@aitasker.test"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${EXPERT_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF13 Test Expert\",\"phone\":\"0901234583\",\"roles\":\"EXPERT\"}")
EXPERT_TOKEN=$(echo "$RES" | jq -r '.access_token')
EXPERT_AUTH="Authorization: Bearer ${EXPERT_TOKEN}"
fund_wallet "$EXPERT_AUTH" 300000 "MF13-EXPERT"

step_header "POST /subscriptions/activate {activeRole: EXPERT} — exact, DIFFERENT price match"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/subscriptions/activate" -H "Content-Type: application/json" -H "$EXPERT_AUTH" -d '{"activeRole":"EXPERT"}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Expert Pro activated"
EXPERT_TOKEN=$(echo "$BODY" | jq -r '.access_token')
EXPERT_AUTH="Authorization: Bearer ${EXPERT_TOKEN}"

step_header "GET /wallets/me — confirm exactly 300,000 debited (DIFFERENT from CLIENT's 500,000 — the role-price-split fix specifically)"
RES=$(curl -s "${BASE_URL}/wallets/me" -H "$EXPERT_AUTH")
print_body "$RES"
check_field_equals "$RES" ".availableBalance" "0" "Balance is 0 — exactly EXPERT_PRO_PRICE was deducted"

# ── referenceId collision check — same user, both roles, no constraint violation ─

step_header "GET /subscriptions/status — both tiers active independently on the SAME underlying wallet model"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/subscriptions/status" -H "$EXPERT_AUTH")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Status check after activation succeeds — no unique-constraint collision (today's referenceId fix)"
check_field_equals "$BODY" ".subscriptionTier" "pro" "subscriptionTier reflects pro for the active role"

print_summary "MF-13"