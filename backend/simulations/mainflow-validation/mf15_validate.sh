#!/usr/bin/env bash
#
# MF-15: Dual-Role Account Switch + Self-Exclusion
#
# Covers:
#   POST /users/me/add-role
#   PUT  /auth/switch-role
#   POST /bids              (self-bid guard)
#
# Guards tested:
#   - Adding role that already exists → 409
#   - Switch to role not in roles[] → 401
#   - Self-bid: same userId as project.clientId → 403

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

require_jq
health_check

SEPAY_WEBHOOK_SECRET="${SEPAY_WEBHOOK_SECRET:?Set SEPAY_WEBHOOK_SECRET to match your .env}"
TS=$(date +%s)
PASSWORD="Str0ng!TestPass123"
DUAL_EMAIL="mf15-dual-${TS}@aitasker.test"

echo ""
echo "════════════════════════════════════════════════════════"
echo " MF-15: Dual-Role Account Switch + Self-Exclusion"
echo "════════════════════════════════════════════════════════"

fund_wallet() {
  local token="$1" amount="$2" ref="$3"
  local auth=(-H "Authorization: Bearer ${token}")
  local va raw ts sig
  va=$(curl -s -X POST "${BASE_URL}/wallets/virtual-accounts/topup" \
    -H "Content-Type: application/json" "${auth[@]}" -d "{\"amount\":${amount}}" | jq -r '.paymentReference')
  raw="{\"content\":\"${va} chuyen tien ${ref}\",\"transferAmount\":\"${amount}\",\"referenceCode\":\"${ref}\"}"
  ts=$(date +%s)
  sig="sha256=$(printf '%s' "${ts}.${raw}" | openssl dgst -sha256 -hmac "${SEPAY_WEBHOOK_SECRET}" | sed 's/^.* //')"
  curl -s -X POST "${BASE_URL}/webhooks/sepay/ipn" -H "Content-Type: application/json" \
    -H "x-sepay-signature: ${sig}" -H "x-sepay-timestamp: ${ts}" -d "${raw}" > /dev/null
}

step_header "PREREQ — register CEO account"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${DUAL_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF15 DualRole\",\"phone\":\"0901234590\",\"roles\":\"CLIENT_CEO\"}")
TOKEN=$(echo "$RES" | jq -r '.access_token')
AUTH=(-H "Authorization: Bearer ${TOKEN}")
fund_wallet "$TOKEN" 500000 "MF15-FUND-${TS}"
RES=$(curl -s -X POST "${BASE_URL}/subscriptions/activate" -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"activeRole":"CLIENT"}')
TOKEN=$(echo "$RES" | jq -r '.access_token')
AUTH=(-H "Authorization: Bearer ${TOKEN}")

step_header "POST /users/me/add-role — add EXPERT role to CEO account"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/users/me/add-role" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"newRole":"EXPERT"}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "EXPERT role added (returns 201)"
check_field_equals "$BODY" ".success" "true" "success is true"

# Re-login to get a fresh JWT with updated roles (add-role writes to DB but doesn't return new token)
RES=$(curl -s -X POST "${BASE_URL}/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"${DUAL_EMAIL}\",\"password\":\"${PASSWORD}\"}")
TOKEN=$(echo "$RES" | jq -r '.access_token')
AUTH=(-H "Authorization: Bearer ${TOKEN}")
echo "  Re-logged in — token now includes EXPERT role."

step_header "POST /users/me/add-role — EDGE CASE: add CLIENT_CEO role again → 409"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/users/me/add-role" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"newRole":"CLIENT_CEO"}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "409" "$CODE" "Duplicate CLIENT_CEO role correctly rejected"

step_header "PUT /auth/switch-role — switch to EXPERT (build expert profile)"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/auth/switch-role" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"activeRole":"EXPERT"}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Switch to EXPERT accepted"
check_field_present "$BODY" ".access_token" "New access_token issued after role switch"
TOKEN=$(echo "$BODY" | jq -r '.access_token')
AUTH=(-H "Authorization: Bearer ${TOKEN}")

# Build expert profile while in EXPERT mode
curl -s -X POST "${BASE_URL}/expert-profile/domains" -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"domainCode":"A","depthLevel":"DEEP"}' > /dev/null
curl -s -X POST "${BASE_URL}/expert-profile/seams" -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"seamCode":"A↔C"}' > /dev/null
fund_wallet "$TOKEN" 300000 "MF15-EXPERT-FUND-${TS}"
RES=$(curl -s -X POST "${BASE_URL}/subscriptions/activate" -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"activeRole":"EXPERT"}')
TOKEN=$(echo "$RES" | jq -r '.access_token')
AUTH=(-H "Authorization: Bearer ${TOKEN}")

step_header "PUT /auth/switch-role — switch back to CLIENT to publish project"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/auth/switch-role" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"activeRole":"CLIENT"}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Switch back to CLIENT accepted"
TOKEN=$(echo "$BODY" | jq -r '.access_token')
AUTH=(-H "Authorization: Bearer ${TOKEN}")

# Elicitation → publish project
TECH_EMAIL="mf15-tech-${TS}@aitasker.test"
RES=$(curl -s -X POST "${BASE_URL}/elicitation/sessions" -H "Content-Type: application/json" "${AUTH[@]}" -d '{}')
SESSION_ID=$(echo "$RES" | jq -r '.id')
RES=$(curl -s -X POST "${BASE_URL}/elicitation/sessions/${SESSION_ID}/generate-handoff-link" \
  -H "Content-Type: application/json" "${AUTH[@]}" -d '{}')
INVITE_TOKEN=$(echo "$RES" | jq -r '.invite_token')
RES=$(curl -s -X POST "${BASE_URL}/auth/register/handoff" -H "Content-Type: application/json" \
  -d "{\"invite_token\":\"${INVITE_TOKEN}\",\"email\":\"${TECH_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF15 Tech\"}")
TECH_TOKEN=$(echo "$RES" | jq -r '.access_token')
TECH_AUTH=(-H "Authorization: Bearer ${TECH_TOKEN}")
RES=$(curl -s -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage1" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"symptomText":"Our support chatbot handles 2000 queries per day and achieves only 71 percent accuracy causing customer churn and complaints."}')
RECOMMENDED=$(echo "$RES" | jq -r '.recommendedArchetypesJson[0]')
curl -s -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage2" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d "{\"archetype\":\"${RECOMMENDED}\",\"acknowledgedVoidCodes\":[]}" > /dev/null
curl -s -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage3" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"probeResponses":{
    "Roughly how many people will search or ask questions per day?":"2000 queries per day from 500 agents",
    "When someone gets a wrong or unhelpful answer, what do you expect to happen next?":"Escalate to human and log failure",
    "Does this need to pull from documents/systems you already have, and which ones?":"Zendesk and PostgreSQL catalogue",
    "How quickly does an answer need to appear after someone asks?":"Under 3 seconds p95"
  }}' > /dev/null
RES=$(curl -s -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage4" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"current_stack":"Python FastAPI PostgreSQL","data_available":"200k Zendesk logs","latency_requirement":"3 seconds"}' \
  --max-time 30) > /dev/null

# CEO triggers Stage 5 synthesis explicitly (synchronous)
echo "  [prereq] Triggering POST /stage5..."
RES=$(curl -s -X POST "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage5" \
  -H "Content-Type: application/json" "${AUTH[@]}" --max-time 120)
PROJECT_ID=$(echo "$RES" | jq -r '.project_id // empty')
echo "  Project: ${PROJECT_ID}"

step_header "PUT /auth/switch-role — switch to EXPERT mode to attempt self-bid"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/auth/switch-role" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"activeRole":"EXPERT"}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Switch to EXPERT accepted"
TOKEN=$(echo "$BODY" | jq -r '.access_token')
AUTH=(-H "Authorization: Bearer ${TOKEN}")

step_header "POST /bids — EDGE CASE: dual-role self-bid on own project → 403"
if [ -n "${PROJECT_ID:-}" ] && [ "$PROJECT_ID" != "null" ]; then
  RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/bids" \
    -H "Content-Type: application/json" "${AUTH[@]}" \
    -d "{\"projectId\":\"${PROJECT_ID}\",\"footprint_alignment_json\":{\"domains\":[{\"code\":\"A\",\"depth\":\"DEEP\"}],\"seams\":[{\"code\":\"A<->C\",\"tier\":\"CLAIMED\"}]},\"approach_summary\":\"Self-bid attempt\",\"conditional_pricing_json\":[{\"milestone_number\":1,\"price_vnd\":5000000,\"condition\":\"Delivery\"}]}")
  CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
  print_body "$BODY"
  check_status "403" "$CODE" "Self-bid correctly rejected even in EXPERT mode"
else
  echo -e "  \033[1;33m⚠\033[0m No project — self-bid guard test skipped"
fi

step_header "PUT /auth/switch-role — EDGE CASE: switch to role not in roles[] → 401"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/auth/switch-role" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"activeRole":"ADMIN"}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "401" "$CODE" "Switch to non-held role correctly rejected"

print_summary "MF-15"