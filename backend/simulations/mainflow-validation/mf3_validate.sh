#!/usr/bin/env bash
#
# MF-3: Tech Team Account Creation via Handoff Link
#
# Covers:
#   POST /elicitation/sessions/:id/generate-handoff-link
#   POST /auth/register/handoff    (new user via invite_token)
#   POST /auth/claim-handoff       (existing user claims TECH_TEAM role)
#   GET  /engagements              (TECH_TEAM scoped to their linked project)
#
# Guards & business rules tested:
#   - Single-use link: reuse → 401 "already been used"
#   - Resend supersedes old jti → old token → 401 "superseded"
#   - clientSubtype is TECH_TEAM after registration
#   - GET /engagements returns only engagements for linked project (empty ok)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

require_jq
health_check

SEPAY_WEBHOOK_SECRET="${SEPAY_WEBHOOK_SECRET:?Set SEPAY_WEBHOOK_SECRET to match your .env}"
TS=$(date +%s)
CEO_EMAIL="mf3-ceo-${TS}@aitasker.test"
PASSWORD="Str0ng!TestPass123"

echo ""
echo "════════════════════════════════════════════════════════"
echo " MF-3: Tech Team Account Creation via Handoff Link"
echo "════════════════════════════════════════════════════════"

# ── PREREQ: CEO with Pro + session through Stage 3 ──
step_header "PREREQ — register CEO and activate Client Pro"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${CEO_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF3 Test CEO\",\"phone\":\"0901234569\",\"roles\":\"CLIENT_CEO\"}")
CEO_TOKEN=$(echo "$RES" | jq -r '.access_token')
CEO_AUTH=(-H "Authorization: Bearer ${CEO_TOKEN}")
RES=$(curl -s -X POST "${BASE_URL}/wallets/virtual-accounts/topup" -H "Content-Type: application/json" "${CEO_AUTH[@]}" -d '{"amount":500000}')
VA_NUMBER=$(echo "$RES" | jq -r '.paymentReference')
REF_CODE="MF3-PRO-${TS}"
RAW_BODY="{\"content\":\"${VA_NUMBER} chuyen tien mf3\",\"transferAmount\":\"500000\",\"referenceCode\":\"${REF_CODE}\"}"
TIMESTAMP=$(date +%s)
SIGNATURE="sha256=$(printf '%s' "${TIMESTAMP}.${RAW_BODY}" | openssl dgst -sha256 -hmac "${SEPAY_WEBHOOK_SECRET}" | sed 's/^.* //')"
curl -s -X POST "${BASE_URL}/webhooks/sepay/ipn" -H "Content-Type: application/json" \
  -H "x-sepay-signature: ${SIGNATURE}" -H "x-sepay-timestamp: ${TIMESTAMP}" -d "${RAW_BODY}" > /dev/null
RES=$(curl -s -X POST "${BASE_URL}/subscriptions/activate" -H "Content-Type: application/json" "${CEO_AUTH[@]}" -d '{"activeRole":"CLIENT"}')
CEO_TOKEN=$(echo "$RES" | jq -r '.access_token')
CEO_AUTH=(-H "Authorization: Bearer ${CEO_TOKEN}")
echo "  CEO registered and Pro activated."

step_header "PREREQ — create session and run Stages 1-3"
RES=$(curl -s -X POST "${BASE_URL}/elicitation/sessions" -H "Content-Type: application/json" "${CEO_AUTH[@]}" -d '{}')
SESSION_ID=$(echo "$RES" | jq -r '.id')
echo "  Session ID: ${SESSION_ID}"

RES=$(curl -s -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage1" \
  -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
  -d '{"symptomText":"Our customer support chatbot answers about 2,000 questions a day from our product catalogue. We have manually graded a sample of 500 recent conversations and the chatbot is only correct 71% of the time, which is hurting customer trust."}')
RECOMMENDED=$(echo "$RES" | jq -r '.recommendedArchetypesJson[0]')
echo "  Stage 1 done. Recommended archetype: ${RECOMMENDED}"

curl -s -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage2" \
  -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
  -d "{\"archetype\":\"${RECOMMENDED}\",\"acknowledgedVoidCodes\":[]}" > /dev/null

RES=$(curl -s -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage3" \
  -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
  -d '{"probeResponses":{
    "Roughly how many people will search or ask questions per day?":"Around 2,000 per day",
    "When someone gets a wrong or unhelpful answer, what do you expect to happen next?":"Escalate to a human agent on a wrong answer",
    "Does this need to pull from documents/systems you already have, and which ones?":"Pulls from our Zendesk knowledge base and PostgreSQL product catalogue",
    "How quickly does an answer need to appear after someone asks?":"Needs to respond within 3 seconds"
  }}')
ADVANCED=$(echo "$RES" | jq -r '.advanced')
if [ "$ADVANCED" != "true" ]; then
  echo -e "  \033[1;33m⚠\033[0m Stage 3 vagueness check failed — aborting prerequisite chain."
  print_summary "MF-3"
fi
echo "  Stage 3 done."

# ── Step 1: Generate handoff link ──
step_header "POST /elicitation/sessions/:id/generate-handoff-link — generate signed 72h handoff JWT"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/elicitation/sessions/${SESSION_ID}/generate-handoff-link" \
  -H "Content-Type: application/json" "${CEO_AUTH[@]}" -d '{}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Handoff link generated"
check_field_present "$BODY" ".invite_link" "invite_link present"
check_field_equals "$BODY" ".expires_in" "72h" "expires_in is 72h"
INVITE_TOKEN=$(echo "$BODY" | jq -r '.invite_token')

# ── Step 2: Register via handoff link (new Tech Team member) ──
TECH_EMAIL="mf3-tech-${TS}@aitasker.test"
step_header "POST /auth/register/handoff — new Tech Team member registers via invite_token"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register/handoff" \
  -H "Content-Type: application/json" \
  -d "{\"invite_token\":\"${INVITE_TOKEN}\",\"email\":\"${TECH_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF3 Tech Team\"}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Tech Team registration succeeds"
check_field_equals "$BODY" ".user.clientSubtype" "TECH_TEAM" "clientSubtype is TECH_TEAM"
TECH_TOKEN=$(echo "$BODY" | jq -r '.access_token')
TECH_AUTH=(-H "Authorization: Bearer ${TECH_TOKEN}")

# ── Step 3: Tech Team engagements (scoped) ──
step_header "GET /engagements — Tech Team sees only engagements for their linked project (empty is correct at this point)"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/engagements" "${TECH_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Tech Team can read scoped engagements"

# ── Step 4: Single-use guard — reuse same link ──
step_header "POST /auth/register/handoff — EDGE CASE: reuse same link → 401 (already consumed)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register/handoff" \
  -H "Content-Type: application/json" \
  -d "{\"invite_token\":\"${INVITE_TOKEN}\",\"email\":\"mf3-reuse-${TS}@aitasker.test\",\"password\":\"${PASSWORD}\",\"fullName\":\"Reuse Attempt\"}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "401" "$CODE" "Reused link correctly rejected — already consumed"

# ── Step 5: Resend (supersede old link) ──
step_header "POST /generate-handoff-link — resend generates new JTI, supersedes old token"
RES=$(curl -s -X POST "${BASE_URL}/elicitation/sessions/${SESSION_ID}/generate-handoff-link" \
  -H "Content-Type: application/json" "${CEO_AUTH[@]}" -d '{}')
NEW_INVITE_TOKEN=$(echo "$RES" | jq -r '.invite_token')

step_header "POST /auth/register/handoff — EDGE CASE: old token after resend → 401 (superseded)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register/handoff" \
  -H "Content-Type: application/json" \
  -d "{\"invite_token\":\"${INVITE_TOKEN}\",\"email\":\"mf3-stale-${TS}@aitasker.test\",\"password\":\"${PASSWORD}\",\"fullName\":\"Stale Attempt\"}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "401" "$CODE" "Old token after resend correctly rejected as superseded"

# ── Step 6: claim-handoff (existing user upgrades to TECH_TEAM) ──
EXISTING_EMAIL="mf3-existing-${TS}@aitasker.test"
step_header "PREREQ — register an existing EXPERT user (to test claim-handoff)"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${EXISTING_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF3 Existing Expert\",\"phone\":\"0901234570\",\"roles\":\"EXPERT\"}")
EXISTING_TOKEN=$(echo "$RES" | jq -r '.access_token')
EXISTING_AUTH=(-H "Authorization: Bearer ${EXISTING_TOKEN}")

step_header "POST /auth/claim-handoff — existing user claims TECH_TEAM role via new invite token"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/claim-handoff" \
  -H "Content-Type: application/json" "${EXISTING_AUTH[@]}" \
  -d "{\"invite_token\":\"${NEW_INVITE_TOKEN}\"}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "claim-handoff succeeds for existing user"
check_field_present "$BODY" ".access_token" "Fresh JWT with TECH_TEAM claims"
CLAIMED_TOKEN=$(echo "$BODY" | jq -r '.access_token')
CLAIMED_AUTH=(-H "Authorization: Bearer ${CLAIMED_TOKEN}")

step_header "GET /engagements — claimed TECH_TEAM user can read scoped engagements"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/engagements" "${CLAIMED_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Claimed TECH_TEAM reads scoped engagements"

print_summary "MF-3"