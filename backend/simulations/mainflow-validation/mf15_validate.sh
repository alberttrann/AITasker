#!/usr/bin/env bash
# backend/simulations/mainflow-validation/mf15_validate.sh
#
# Validates MF-15 (Dual-Role Account Switch).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

require_jq
health_check

SEPAY_WEBHOOK_SECRET="${SEPAY_WEBHOOK_SECRET:?Set SEPAY_WEBHOOK_SECRET to match your .env}"
PASSWORD="Str0ng!TestPass123"

echo ""
echo "════════════════════════════════════════════════════════"
echo " MF-15: Dual-Role Account Switch"
echo "════════════════════════════════════════════════════════"

step_header "PREREQ — register as EXPERT first (deliberately, see header note)"
EMAIL="mf15-dualrole-$(date +%s)@aitasker.test"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF15 Test Dual Role\",\"phone\":\"0901234584\",\"roles\":\"EXPERT\"}")
TOKEN=$(echo "$RES" | jq -r '.access_token')
AUTH=(-H "Authorization: Bearer ${TOKEN}")

step_header "POST /users/me/add-role — add CLIENT_CEO to the existing EXPERT account"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/users/me/add-role" -H "Content-Type: application/json" "${AUTH[@]}" -d '{"newRole":"CLIENT_CEO"}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Role added"

step_header "PUT /auth/switch-role — switch to CLIENT (step 2)"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/auth/switch-role" -H "Content-Type: application/json" "${AUTH[@]}" -d '{"activeRole":"CLIENT"}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Switch succeeds"
TOKEN=$(echo "$BODY" | jq -r '.access_token')
AUTH=(-H "Authorization: Bearer ${TOKEN}")

step_header "GET /users/me — confirm clientSubtype is CEO, not null (the actual bug under test)"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/users/me" "${AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Profile readable"
check_field_equals "$BODY" ".clientSubtype" "CEO" "clientSubtype is CEO (today's addRole fix — without it, this is null)"

step_header "POST /elicitation/sessions — actually attempt a CEO-only action, the real-world consequence of the bug above"
RES=$(curl -s -X POST "${BASE_URL}/wallets/virtual-accounts/topup" -H "Content-Type: application/json" "${AUTH[@]}" -d '{"amount":500000}')
VA_NUMBER=$(echo "$RES" | jq -r '.paymentReference')
REF_CODE="MF15-VALIDATE-$(date +%s)"
RAW_BODY="{\"content\":\"${VA_NUMBER} chuyen tien mf15\",\"transferAmount\":\"500000\",\"referenceCode\":\"${REF_CODE}\"}"
TIMESTAMP=$(date +%s)
SIGNATURE="sha256=$(printf '%s' "${TIMESTAMP}.${RAW_BODY}" | openssl dgst -sha256 -hmac "${SEPAY_WEBHOOK_SECRET}" | sed 's/^.* //')"
curl -s -X POST "${BASE_URL}/webhooks/sepay/ipn" -H "Content-Type: application/json" \
  -H "x-sepay-signature: ${SIGNATURE}" -H "x-sepay-timestamp: ${TIMESTAMP}" -d "${RAW_BODY}" > /dev/null
RES=$(curl -s -X POST "${BASE_URL}/subscriptions/activate" -H "Content-Type: application/json" "${AUTH[@]}" -d '{"activeRole":"CLIENT"}')
TOKEN=$(echo "$RES" | jq -r '.access_token')
AUTH=(-H "Authorization: Bearer ${TOKEN}")

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/elicitation/sessions" -H "Content-Type: application/json" "${AUTH[@]}" -d '{}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "CEO-only action succeeds — confirms the fix end-to-end, not just the field read above"
SESSION_ID=$(echo "$BODY" | jq -r '.id')

step_header "PUT /auth/switch-role — switch back to EXPERT (confirms switching is reversible, not one-way)"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/auth/switch-role" -H "Content-Type: application/json" "${AUTH[@]}" -d '{"activeRole":"EXPERT"}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Switch back succeeds"
TOKEN=$(echo "$BODY" | jq -r '.access_token')
AUTH=(-H "Authorization: Bearer ${TOKEN}")

step_header "PUT /auth/switch-role — attempt to switch to a role NEVER added (e.g. ADMIN), expect rejection"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/auth/switch-role" -H "Content-Type: application/json" "${AUTH[@]}" -d '{"activeRole":"ADMIN"}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "401" "$CODE" "Switch to an unowned role correctly rejected"

# ── SELF-EXCLUSION ENFORCEMENT (the flow's own stated focus, steps 4-5) ──

step_header "PUT /auth/switch-role — back to EXPERT for the self-exclusion check"
RES=$(curl -s -X PUT "${BASE_URL}/auth/switch-role" -H "Content-Type: application/json" "${AUTH[@]}" -d '{"activeRole":"EXPERT"}')
TOKEN=$(echo "$RES" | jq -r '.access_token')
AUTH=(-H "Authorization: Bearer ${TOKEN}")

step_header "PUT /auth/switch-role back to CLIENT, complete elicitation through publish (need a real OWN project to test bidding against)"
RES=$(curl -s -X PUT "${BASE_URL}/auth/switch-role" -H "Content-Type: application/json" "${AUTH[@]}" -d '{"activeRole":"CLIENT"}')
TOKEN=$(echo "$RES" | jq -r '.access_token')
AUTH=(-H "Authorization: Bearer ${TOKEN}")
RES=$(curl -s -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage1" -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"symptomText":"Our customer support chatbot answers about 2,000 questions a day from our product catalogue. We have manually graded a sample of 500 recent conversations against the correct catalogue answers, and the chatbot is only correct 71% of the time, which is hurting customer trust."}')
RECOMMENDED=$(echo "$RES" | jq -r '.recommendedArchetypesJson[0]')
curl -s -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage2" -H "Content-Type: application/json" "${AUTH[@]}" \
  -d "{\"archetype\":\"${RECOMMENDED}\",\"acknowledgedVoidCodes\":[]}" > /dev/null
curl -s -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage3" -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"probeResponses":{
    "Roughly how many people will search or ask questions per day?":"Around 2,000 per day",
    "When someone gets a wrong or unhelpful answer, what do you expect to happen next?":"Escalate to a human agent on a wrong answer",
    "Does this need to pull from documents/systems you already have, and which ones?":"Pulls from our Zendesk knowledge base and PostgreSQL product catalogue",
    "How quickly does an answer need to appear after someone asks?":"Needs to respond within 3 seconds"
  }}' > /dev/null
RES=$(curl -s -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage4" -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"current_stack":"Python FastAPI, PostgreSQL, AWS ECS","data_available":"200k Zendesk conversation logs, 50k SKU catalogue","latency_requirement":"Under 3 seconds end-to-end"}' --max-time 100)
GATE_PASSED=$(echo "$RES" | jq -r '.gate_passed')
PROJECT_ID=$(echo "$RES" | jq -r '.project_id')
if [ "$GATE_PASSED" != "true" ]; then
  echo "  Full stage4 response: ${RES}"
  echo -e "  \033[1;33m⚠\033[0m Synthesis gate failed — aborting, self-exclusion check needs a real published project owned by this same account."
  print_summary "MF-15"
fi
echo "  Own project published: ${PROJECT_ID}"

step_header "PUT /auth/switch-role — switch to EXPERT, then attempt to bid on OWN project (the actual safety property)"
RES=$(curl -s -X PUT "${BASE_URL}/auth/switch-role" -H "Content-Type: application/json" "${AUTH[@]}" -d '{"activeRole":"EXPERT"}')
TOKEN=$(echo "$RES" | jq -r '.access_token')
AUTH=(-H "Authorization: Bearer ${TOKEN}")

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/bids" -H "Content-Type: application/json" "${AUTH[@]}" \
  -d "{
    \"projectId\":\"${PROJECT_ID}\",
    \"footprint_alignment_json\":{\"domains\":[{\"code\":\"A\",\"depth\":\"DEEP\"}],\"seams\":[{\"code\":\"A↔C\",\"tier\":\"CLAIMED\"}]},
    \"approach_summary\":\"Self-bid attempt — should be rejected.\",
    \"conditional_pricing_json\":[{\"milestone_number\":1,\"price_vnd\":15000000,\"condition\":\"Discovery sign-off\"}]
  }")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "403" "$CODE" "Self-bid on own project correctly rejected, regardless of activeRole (MF-15's core safety property)"

print_summary "MF-15"