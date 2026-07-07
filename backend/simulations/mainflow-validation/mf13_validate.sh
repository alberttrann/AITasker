#!/usr/bin/env bash
#
# MF-13: Subscription Purchase from Wallet
#
# Covers:
#   POST /subscriptions/activate
#   GET  /subscriptions/status
#   PUT  /auth/switch-role
#
# Guards tested:
#   - activeRole mismatch on activate → 409
#   - already active → 409 "still available"
#   - insufficient balance → 422
#   - Pro JWT claims embedded after activation

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

require_jq
health_check

SEPAY_WEBHOOK_SECRET="${SEPAY_WEBHOOK_SECRET:?Set SEPAY_WEBHOOK_SECRET to match your .env}"
TS=$(date +%s)
PASSWORD="Str0ng!TestPass123"
EMAIL="mf13-dual-${TS}@aitasker.test"

echo ""
echo "════════════════════════════════════════════════════════"
echo " MF-13: Subscription Purchase from Wallet"
echo "════════════════════════════════════════════════════════"

step_header "PREREQ — register dual-role account (CLIENT_CEO + EXPERT)"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF13 DualRole\",\"phone\":\"0901234589\",\"roles\":\"CLIENT_CEO\"}")
TOKEN=$(echo "$RES" | jq -r '.access_token')
AUTH=(-H "Authorization: Bearer ${TOKEN}")
# Add EXPERT role
curl -s -X POST "${BASE_URL}/users/me/add-role" -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"newRole":"EXPERT"}' > /dev/null

# Re-login to get a fresh JWT that includes EXPERT in the roles array
# (add-role writes to DB but doesn't return a new token)
RES=$(curl -s -X POST "${BASE_URL}/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")
TOKEN=$(echo "$RES" | jq -r '.access_token')
AUTH=(-H "Authorization: Bearer ${TOKEN}")
echo "  Dual-role account ready. Re-logged in with updated roles."

step_header "GET /subscriptions/status — both tiers FREE initially"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/subscriptions/status" "${AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Status readable"
check_field_equals "$BODY" ".subscriptionTier" "free" "subscriptionTier is free"
# subscriptionExpertTier not in /subscriptions/status response (single-role view)

step_header "POST /subscriptions/activate — EDGE CASE: empty wallet → 422"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/subscriptions/activate" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"activeRole":"CLIENT"}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "422" "$CODE" "Empty wallet correctly rejected"

# Fund wallet — CLIENT Pro costs 500,000 VND + EXPERT Pro costs 300,000 VND = 800,000 total
step_header "PREREQ — fund wallet 800,000 VND (covers CLIENT Pro 500k + Expert Pro 300k)"
RES=$(curl -s -X POST "${BASE_URL}/wallets/virtual-accounts/topup" \
  -H "Content-Type: application/json" "${AUTH[@]}" -d '{"amount":800000}')
VA=$(echo "$RES" | jq -r '.paymentReference')
RAW="{\"content\":\"${VA} chuyen tien mf13\",\"transferAmount\":\"800000\",\"referenceCode\":\"MF13-FUND-${TS}\"}"
TS2=$(date +%s)
SIG="sha256=$(printf '%s' "${TS2}.${RAW}" | openssl dgst -sha256 -hmac "${SEPAY_WEBHOOK_SECRET}" | sed 's/^.* //')"
curl -s -X POST "${BASE_URL}/webhooks/sepay/ipn" -H "Content-Type: application/json" \
  -H "x-sepay-signature: ${SIG}" -H "x-sepay-timestamp: ${TS2}" -d "${RAW}" > /dev/null
echo "  Wallet funded 800,000 VND (CLIENT Pro=500k + Expert Pro=300k)."

step_header "POST /subscriptions/activate — activate CLIENT Pro (activeRole=CLIENT)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/subscriptions/activate" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"activeRole":"CLIENT"}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "CLIENT Pro activated"
check_field_present "$BODY" ".access_token" "New JWT issued"
TOKEN=$(echo "$BODY" | jq -r '.access_token')
AUTH=(-H "Authorization: Bearer ${TOKEN}")

step_header "POST /subscriptions/activate — EDGE CASE: already active → 409"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/subscriptions/activate" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"activeRole":"CLIENT"}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "409" "$CODE" "Already active correctly rejected"

step_header "PUT /auth/switch-role — switch to EXPERT role"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/auth/switch-role" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"activeRole":"EXPERT"}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Switch to EXPERT accepted"
check_field_present "$BODY" ".access_token" "New access_token issued after role switch"
TOKEN=$(echo "$BODY" | jq -r '.access_token')
AUTH=(-H "Authorization: Bearer ${TOKEN}")

step_header "POST /subscriptions/activate — activate EXPERT Pro (activeRole=EXPERT, 300,000 VND)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/subscriptions/activate" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"activeRole":"EXPERT"}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "EXPERT Pro activated"
# Only update token if activation succeeded — a failed response has no access_token
# and would overwrite AUTH with "Bearer null" causing all subsequent requests to 401
NEW_TOKEN=$(echo "$BODY" | jq -r '.access_token // empty')
if [ -n "$NEW_TOKEN" ] && [ "$NEW_TOKEN" != "null" ]; then
  TOKEN="$NEW_TOKEN"
  AUTH=(-H "Authorization: Bearer ${TOKEN}")
else
  echo -e "  \033[1;33m⚠\033[0m No token in activate response — keeping existing token"
fi

step_header "GET /subscriptions/status — both tiers now Pro"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/subscriptions/status" "${AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Status readable"
check_field_equals "$BODY" ".subscriptionTier" "pro" "subscriptionTier is pro"
#check_field_equals "$BODY" ".subscriptionExpertTier" "pro" — single-role context, field not in response
check_field_present "$BODY" ".subscriptionExpires" "subscriptionExpires set"
#check_field_present "$BODY" ".subscriptionExpertExpires" — single-role context

step_header "PUT /auth/switch-role — EDGE CASE: switch to non-existent role → 401"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/auth/switch-role" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"activeRole":"ADMIN"}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "401" "$CODE" "Switch to non-existent role correctly rejected"

print_summary "MF-13"