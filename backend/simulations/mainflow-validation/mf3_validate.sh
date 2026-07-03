#!/usr/bin/env bash
#
# Validates MF-3 (Tech Team Account Creation via Handoff Link) end-to-end
# against a REAL running backend. Requires running a real CEO through
# Elicitation Stage 1-4 first (reusing the exact proven payload shapes
# from s03_elicitation_full_flow.js), since the handoff link can only be
# generated from a real, in-progress session.
#
# Usage: same as mf1/mf2 — backend running, SEPAY_WEBHOOK_SECRET set.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

require_jq
health_check

SEPAY_WEBHOOK_SECRET="${SEPAY_WEBHOOK_SECRET:?Set SEPAY_WEBHOOK_SECRET to match your .env}"
CEO_EMAIL="mf3-ceo-$(date +%s)@aitasker.test"
PASSWORD="Str0ng!TestPass123"

echo ""
echo "════════════════════════════════════════════════════════"
echo " MF-3: Tech Team Account Creation via Handoff Link"
echo "════════════════════════════════════════════════════════"

# ── PREREQUISITE: real CEO + Client Pro + elicitation session to Stage 4 ─

step_header "PREREQ — register CEO"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${CEO_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF3 Test CEO\",\"phone\":\"0901234569\",\"roles\":\"CLIENT_CEO\"}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "CEO registered"
TOKEN=$(echo "$BODY" | jq -r '.access_token')
AUTH=(-H "Authorization: Bearer ${TOKEN}")

step_header "PREREQ — fund wallet + activate Client Pro (SubscriptionGuard prerequisite for elicitation)"
RES=$(curl -s -X POST "${BASE_URL}/wallets/virtual-accounts/topup" -H "Content-Type: application/json" "${AUTH[@]}" -d '{"amount":500000}')
VA_NUMBER=$(echo "$RES" | jq -r '.paymentReference')
REF_CODE="MF3-VALIDATE-$(date +%s)"
RAW_BODY="{\"content\":\"${VA_NUMBER} chuyen tien mf3 test\",\"transferAmount\":\"500000\",\"referenceCode\":\"${REF_CODE}\"}"
TIMESTAMP=$(date +%s)
SIGNATURE="sha256=$(printf '%s' "${TIMESTAMP}.${RAW_BODY}" | openssl dgst -sha256 -hmac "${SEPAY_WEBHOOK_SECRET}" | sed 's/^.* //')"
curl -s -X POST "${BASE_URL}/webhooks/sepay/ipn" -H "Content-Type: application/json" \
  -H "x-sepay-signature: ${SIGNATURE}" -H "x-sepay-timestamp: ${TIMESTAMP}" -d "${RAW_BODY}" > /dev/null
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/subscriptions/activate" -H "Content-Type: application/json" "${AUTH[@]}" -d '{"activeRole":"CLIENT"}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Client Pro activated"
update_token_if_success "201" "$CODE" "$BODY"

step_header "PREREQ — POST /elicitation/sessions — create session"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/elicitation/sessions" -H "Content-Type: application/json" "${AUTH[@]}" -d '{}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Session created at stage 1"
SESSION_ID=$(echo "$BODY" | jq -r '.id')

step_header "PREREQ — Stage 1 (real ai-service call, may take a few seconds)"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage1" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"symptomText":"Our customer support chatbot keeps giving wrong answers about our product catalogue. We have 50,000 daily users and no system to measure accuracy."}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Stage 1 processed"
if [ "$CODE" != "200" ]; then
  echo -e "  \033[1;33m⚠\033[0m Stage 1 failed — see response body above for the actual error. Aborting prerequisite chain; everything below depends on this succeeding."
  print_summary "MF-3"
fi
RECOMMENDED=$(echo "$BODY" | jq -r '.recommendedArchetypesJson[0]')
echo "  Recommended archetype: ${RECOMMENDED} (NOTE: steps below assume this is '1' — matching s03's established assumption for this exact symptom text; update if ai-service ever recommends differently for it)"

step_header "PREREQ — Stage 2 (pick top recommendation)"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage2" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d "{\"archetype\":\"${RECOMMENDED}\",\"acknowledgedVoidCodes\":[]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
check_status "200" "$CODE" "Stage 2 processed"
if [ "$CODE" != "200" ]; then
  echo -e "  \033[1;33m⚠\033[0m Stage 2 failed — aborting prerequisite chain."
  print_summary "MF-3"
fi

step_header "PREREQ — Stage 3 (4 fixed archetype-1 probe questions, specific answers)"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage3" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"probeResponses":{
    "Roughly how many people will search or ask questions per day?":"Around 2,000 per day",
    "When someone gets a wrong or unhelpful answer, what do you expect to happen next?":"Escalate to a human agent on a wrong answer",
    "Does this need to pull from documents/systems you already have, and which ones?":"Pulls from our Zendesk knowledge base and PostgreSQL product catalogue",
    "How quickly does an answer need to appear after someone asks?":"Needs to respond within 3 seconds"
  }}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Stage 3 processed, vagueness check passed"
if [ "$CODE" != "200" ]; then
  echo -e "  \033[1;33m⚠\033[0m Stage 3 failed — aborting prerequisite chain."
  print_summary "MF-3"
fi
check_field_equals "$BODY" ".advanced" "true" "Stage 3 advanced (not flagged as vague)"

step_header "PREREQ — Stage 4 (auto-chains real ai-service synthesis, may take up to 90s)"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage4" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"current_stack":"Python FastAPI, PostgreSQL, AWS ECS","data_available":"200k Zendesk conversation logs, 50k SKU catalogue","latency_requirement":"Under 3 seconds end-to-end"}' \
  --max-time 100)
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Stage 4 processed"
if [ "$CODE" != "200" ]; then
  echo -e "  \033[1;33m⚠\033[0m Stage 4 failed — aborting prerequisite chain."
  print_summary "MF-3"
fi

# ── MF-3 ACTUAL FLOW BEGINS HERE (swimlane steps 1-7) ───────────────────

step_header "POST /elicitation/sessions/:id/generate-handoff-link — generate the signed handoff JWT"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/elicitation/sessions/${SESSION_ID}/generate-handoff-link" \
  -H "Content-Type: application/json" "${AUTH[@]}" -d '{}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
if [ "$CODE" = "404" ]; then
  echo -e "  \033[1;33m⚠\033[0m 404 — if the naming-consistency rename hasn't landed yet, try invite-tech-team instead. NOT silently retrying — fix the rename or update this script deliberately."
fi
check_status "201" "$CODE" "Handoff link generated"
check_field_present "$BODY" ".invite_link" "invite_link present"
check_field_equals "$BODY" ".expires_in" "72h" "expires_in is 72h"
INVITE_LINK=$(echo "$BODY" | jq -r '.invite_link')
INVITE_TOKEN=$(echo "$INVITE_LINK" | sed -n 's/.*token=\(.*\)/\1/p')

TECH_EMAIL="mf3-tech-$(date +%s)@aitasker.test"

step_header "POST /auth/register/handoff — tech team member registers via the link"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register/handoff" \
  -H "Content-Type: application/json" \
  -d "{\"invite_token\":\"${INVITE_TOKEN}\",\"email\":\"${TECH_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF3 Test Tech Team\"}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Tech team registration succeeds"
check_field_equals "$BODY" ".user.clientSubtype" "TECH_TEAM" "user.clientSubtype is TECH_TEAM"
TECH_TOKEN=$(echo "$BODY" | jq -r '.access_token')
TECH_AUTH=(-H "Authorization: Bearer ${TECH_TOKEN}")

step_header "GET /engagements — confirm dashboard scoping (per resolved Open Question 3)"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/engagements" "${TECH_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Tech team can read their scoped engagements list (empty is fine — no engagements exist yet for this fresh project)"

step_header "POST /auth/register/handoff — reuse the SAME link a second time, expect rejection (single-use)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register/handoff" \
  -H "Content-Type: application/json" \
  -d "{\"invite_token\":\"${INVITE_TOKEN}\",\"email\":\"mf3-tech-reuse-$(date +%s)@aitasker.test\",\"password\":\"${PASSWORD}\",\"fullName\":\"Reuse Attempt\"}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "401" "$CODE" "Reused link correctly rejected (already consumed)"

step_header "POST /elicitation/sessions/:id/generate-handoff-link — resend, confirm OLD link is now superseded"
RES=$(curl -s -X POST "${BASE_URL}/elicitation/sessions/${SESSION_ID}/generate-handoff-link" -H "Content-Type: application/json" "${AUTH[@]}" -d '{}')
NEW_INVITE_LINK=$(echo "$RES" | jq -r '.invite_link')
NEW_INVITE_TOKEN=$(echo "$NEW_INVITE_LINK" | sed -n 's/.*token=\(.*\)/\1/p')

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register/handoff" \
  -H "Content-Type: application/json" \
  -d "{\"invite_token\":\"${INVITE_TOKEN}\",\"email\":\"mf3-tech-stale-$(date +%s)@aitasker.test\",\"password\":\"${PASSWORD}\",\"fullName\":\"Stale Link Attempt\"}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "401" "$CODE" "Old (pre-resend) token correctly rejected as superseded"

print_summary "MF-3"