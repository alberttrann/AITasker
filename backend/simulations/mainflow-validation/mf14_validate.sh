#!/usr/bin/env bash
#
# Validates MF-14 (Pay-Gated Document Release). 

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

require_jq
health_check

SEPAY_WEBHOOK_SECRET="${SEPAY_WEBHOOK_SECRET:?Set SEPAY_WEBHOOK_SECRET to match your .env}"
PASSWORD="Str0ng!TestPass123"

echo ""
echo "════════════════════════════════════════════════════════"
echo " MF-14: Pay-Gated Document Release (IPN-Triggered)"
echo "════════════════════════════════════════════════════════"

step_header "PREREQ — full chain through an AWAITING_PAYMENT milestone with a real, linked TECH_TEAM and a SECOND, unrelated TECH_TEAM (for the negative case)"
CEO_EMAIL="mf14-ceo-$(date +%s)@aitasker.test"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${CEO_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF14 Test CEO\",\"phone\":\"0901234593\",\"roles\":\"CLIENT_CEO\"}")
CEO_TOKEN=$(echo "$RES" | jq -r '.access_token')
CEO_AUTH=(-H "Authorization: Bearer ${CEO_TOKEN}")
RES=$(curl -s -X POST "${BASE_URL}/wallets/virtual-accounts/topup" -H "Content-Type: application/json" "${CEO_AUTH[@]}" -d '{"amount":500000}')
VA_NUMBER=$(echo "$RES" | jq -r '.paymentReference')
REF_CODE="MF14-CEO-PRO-$(date +%s)"
RAW_BODY="{\"content\":\"${VA_NUMBER} chuyen tien\",\"transferAmount\":\"500000\",\"referenceCode\":\"${REF_CODE}\"}"
TIMESTAMP=$(date +%s)
SIGNATURE="sha256=$(printf '%s' "${TIMESTAMP}.${RAW_BODY}" | openssl dgst -sha256 -hmac "${SEPAY_WEBHOOK_SECRET}" | sed 's/^.* //')"
curl -s -X POST "${BASE_URL}/webhooks/sepay/ipn" -H "Content-Type: application/json" \
  -H "x-sepay-signature: ${SIGNATURE}" -H "x-sepay-timestamp: ${TIMESTAMP}" -d "${RAW_BODY}" > /dev/null
RES=$(curl -s -X POST "${BASE_URL}/subscriptions/activate" -H "Content-Type: application/json" "${CEO_AUTH[@]}" -d '{"activeRole":"CLIENT"}')
CEO_TOKEN=$(echo "$RES" | jq -r '.access_token')
CEO_AUTH=(-H "Authorization: Bearer ${CEO_TOKEN}")

RES=$(curl -s -X POST "${BASE_URL}/elicitation/sessions" -H "Content-Type: application/json" "${CEO_AUTH[@]}" -d '{}')
SESSION_ID=$(echo "$RES" | jq -r '.id')
RES=$(curl -s -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage1" -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
  -d '{"symptomText":"Our customer support chatbot answers about 2,000 questions a day from our product catalogue. We have manually graded a sample of 500 recent conversations against the correct catalogue answers, and the chatbot is only correct 71% of the time, which is hurting customer trust."}')
RECOMMENDED=$(echo "$RES" | jq -r '.recommendedArchetypesJson[0]')
curl -s -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage2" -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
  -d "{\"archetype\":\"${RECOMMENDED}\",\"acknowledgedVoidCodes\":[]}" > /dev/null
curl -s -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage3" -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
  -d '{"probeResponses":{
    "Roughly how many people will search or ask questions per day?":"Around 2,000 per day",
    "When someone gets a wrong or unhelpful answer, what do you expect to happen next?":"Escalate to a human agent on a wrong answer",
    "Does this need to pull from documents/systems you already have, and which ones?":"Pulls from our Zendesk knowledge base and PostgreSQL product catalogue",
    "How quickly does an answer need to appear after someone asks?":"Needs to respond within 3 seconds"
  }}' > /dev/null

# 1. Register Unrelated Tech Team (for negative test later)
UNRELATED_TECH_EMAIL="mf14-unrelated-tech-$(date +%s)@aitasker.test"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${UNRELATED_TECH_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"Unrelated Tech\",\"phone\":\"0901234594\",\"roles\":\"EXPERT\"}")
UNRELATED_TOKEN=$(echo "$RES" | jq -r '.access_token')
UNRELATED_AUTH=(-H "Authorization: Bearer ${UNRELATED_TOKEN}")

# 2. Register Expert (MUST BE DONE BEFORE STAGE 4 SYNTHESIS SO GATE PASSES)
EXPERT_EMAIL="mf14-expert-$(date +%s)@aitasker.test"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${EXPERT_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF14 Test Expert\",\"phone\":\"0901234595\",\"roles\":\"EXPERT\"}")
EXPERT_TOKEN=$(echo "$RES" | jq -r '.access_token')
EXPERT_AUTH=(-H "Authorization: Bearer ${EXPERT_TOKEN}")

# Claim domains and seams so they match the RAG project
curl -s -X PUT "${BASE_URL}/expert-profile/me" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"engagementModel":"MILESTONE","stackTagsJson":["Python","pgvector","FastAPI","PostgreSQL","AWS ECS"]}' > /dev/null
curl -s -X POST "${BASE_URL}/expert-profile/domains" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"domainCode":"A","depthLevel":"DEEP"}' > /dev/null
curl -s -X POST "${BASE_URL}/expert-profile/seams" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"seamCode":"A↔C"}' > /dev/null

VA_NUMBER=$(curl -s -X POST "${BASE_URL}/wallets/virtual-accounts/topup" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" -d '{"amount":300000}' | jq -r '.paymentReference')
REF_CODE="MF14-EXPERT-PRO-$(date +%s)"
RAW_BODY="{\"content\":\"${VA_NUMBER} chuyen tien\",\"transferAmount\":\"300000\",\"referenceCode\":\"${REF_CODE}\"}"
TIMESTAMP=$(date +%s)
SIGNATURE="sha256=$(printf '%s' "${TIMESTAMP}.${RAW_BODY}" | openssl dgst -sha256 -hmac "${SEPAY_WEBHOOK_SECRET}" | sed 's/^.* //')"
curl -s -X POST "${BASE_URL}/webhooks/sepay/ipn" -H "Content-Type: application/json" \
  -H "x-sepay-signature: ${SIGNATURE}" -H "x-sepay-timestamp: ${TIMESTAMP}" -d "${RAW_BODY}" > /dev/null
RES=$(curl -s -X POST "${BASE_URL}/subscriptions/activate" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" -d '{"activeRole":"EXPERT"}')
EXPERT_TOKEN=$(echo "$RES" | jq -r '.access_token')
EXPERT_AUTH=(-H "Authorization: Bearer ${EXPERT_TOKEN}")

# 3. Complete Stage 4 Handoff Process
RES=$(curl -s -X POST "${BASE_URL}/elicitation/sessions/${SESSION_ID}/generate-handoff-link" -H "Content-Type: application/json" "${CEO_AUTH[@]}" -d '{}')
# FIX: Direct extraction of invite_token, sed regex is obsolete
INVITE_TOKEN=$(echo "$RES" | jq -r '.invite_token')

TECH_EMAIL="mf14-tech-$(date +%s)@aitasker.test"
RES=$(curl -s -X POST "${BASE_URL}/auth/register/handoff" -H "Content-Type: application/json" \
  -d "{\"invite_token\":\"${INVITE_TOKEN}\",\"email\":\"${TECH_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF14 Test Tech\"}")
TECH_TOKEN=$(echo "$RES" | jq -r '.access_token')
TECH_AUTH=(-H "Authorization: Bearer ${TECH_TOKEN}")

# Enriched inputs guarantee > 0.70 AI completeness score
curl -s -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage4-handoff" -H "Content-Type: application/json" "${TECH_AUTH[@]}" \
  -d '{"current_stack":"Python FastAPI PostgreSQL AWS ECS Redis","data_available":"200k Zendesk conversation logs and 50k SKU product catalogue entries","latency_requirement":"Under 3 seconds end-to-end for 95th percentile"}' --max-time 100 > /dev/null

# CEO triggers synthesis (This generates the actual Gate Passed result and Project ID)
RES=$(curl -s -X POST "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage5" -H "Content-Type: application/json" "${CEO_AUTH[@]}" --max-time 120)

GATE_PASSED=$(echo "$RES" | jq -r '.gate_passed')
PROJECT_ID=$(echo "$RES" | jq -r '.project_id')

if [ "$GATE_PASSED" != "true" ]; then
  echo "  Full stage4-handoff response: ${RES}"
  echo -e "  \033[1;33m⚠\033[0m Synthesis gate failed — aborting."
  print_summary "MF-14"
fi

# Workaround for Tech review gap:
TECH_USER_ID=$(curl -s "${BASE_URL}/users/me" "${TECH_AUTH[@]}" | jq -r '.id')
if [ -n "${DATABASE_URL:-}" ]; then
  psql "${DATABASE_URL}" -c "UPDATE tech_team_profiles SET linked_project_id='${PROJECT_ID}' WHERE user_id='${TECH_USER_ID}';" > /dev/null 2>&1
fi

RES=$(curl -s -X POST "${BASE_URL}/bids" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d "{\"projectId\":\"${PROJECT_ID}\",\"footprint_alignment_json\":{\"domains\":[{\"code\":\"A\",\"depth\":\"DEEP\"}],\"seams\":[{\"code\":\"A<->C\",\"tier\":\"CLAIMED\"}]},\"approach_summary\":\"RAG pipeline.\",\"conditional_pricing_json\":[{\"milestone_number\":1,\"price_vnd\":15000000,\"condition\":\"Discovery sign-off\"}]}")
BID_ID=$(echo "$RES" | jq -r '.bid.id')
ENGAGEMENT_ID=$(echo "$RES" | jq -r '.engagement.id')
curl -s -X PUT "${BASE_URL}/bids/${BID_ID}/tech-review" -H "Content-Type: application/json" "${TECH_AUTH[@]}" -d '{"action":"APPROVED"}' > /dev/null
curl -s -X PUT "${BASE_URL}/bids/${BID_ID}/ceo-decision" -H "Content-Type: application/json" "${CEO_AUTH[@]}" -d '{"decision":"APPROVED"}' > /dev/null
curl -s -X POST "${BASE_URL}/engagements/${ENGAGEMENT_ID}/connect" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" -d '{}' > /dev/null
curl -s -X PUT "${BASE_URL}/engagements/${ENGAGEMENT_ID}/accept-nda" -H "Content-Type: application/json" "${CEO_AUTH[@]}" -d '{}' > /dev/null

RES=$(curl -s -X POST "${BASE_URL}/milestones" -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
  -d "{\"engagement_id\":\"${ENGAGEMENT_ID}\",\"milestone_number\":1,\"deliverable_statement\":\"Discovery report.\",\"sign_off_authority\":\"TECH_TEAM\",\"payment_amount_vnd\":15000000,\"criteria\":[{\"criterion_text\":\"Diagram complete.\",\"is_required\":true}]}")
MILESTONE_ID=$(echo "$RES" | jq -r '.id')
RES=$(curl -s -X PUT "${BASE_URL}/milestones/${MILESTONE_ID}/fund" -H "Content-Type: application/json" "${CEO_AUTH[@]}" -d '{}')
MILESTONE_VA=$(echo "$RES" | jq -r '.vaNumber')
echo "  Milestone ${MILESTONE_ID} is AWAITING_PAYMENT — ready for the staging phase."

# ── MF-14 ACTUAL CONTENT BEGINS HERE ─────────────────────────────────────

step_header "POST /milestones/:id/paygated-docs — expert stages a doc BEFORE funding (steps 1-2)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/milestones/${MILESTONE_ID}/paygated-docs" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"document_url":"https://example.com/architecture-deep-dive.pdf"}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Document staged"
check_field_equals "$BODY" ".releaseState" "STAGED" "releaseState is STAGED (step 2)"

step_header "GET /milestones/:id/paygated-docs — TECH_TEAM attempts access BEFORE funding, expect empty/blocked (step 3, not yet visible)"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/milestones/${MILESTONE_ID}/paygated-docs" "${TECH_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "403" "$CODE" "Staged-only documents correctly inaccessible before release"

step_header "POST /webhooks/sepay/ipn — fund the milestone, triggering the auto-release (step 4)"
REF_CODE="MF14-FUND-$(date +%s)"
RAW_BODY="{\"content\":\"${MILESTONE_VA} thanh toan\",\"transferAmount\":\"15000000\",\"referenceCode\":\"${REF_CODE}\"}"
TIMESTAMP=$(date +%s)
SIGNATURE="sha256=$(printf '%s' "${TIMESTAMP}.${RAW_BODY}" | openssl dgst -sha256 -hmac "${SEPAY_WEBHOOK_SECRET}" | sed 's/^.* //')"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/webhooks/sepay/ipn" -H "Content-Type: application/json" \
  -H "x-sepay-signature: ${SIGNATURE}" -H "x-sepay-timestamp: ${TIMESTAMP}" -d "${RAW_BODY}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Funding IPN accepted"

step_header "GET /milestones/:id/paygated-docs — TECH_TEAM (real, linked) accesses post-release (step 5 — the bug fixed earlier this session)"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/milestones/${MILESTONE_ID}/paygated-docs" "${TECH_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Linked TECH_TEAM can access released documents"
check_field_equals "$BODY" ".[0].releaseState" "RELEASED" "Document's releaseState is RELEASED"

step_header "GET /milestones/:id/paygated-docs — EXPERT (the document's own author) can also access"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/milestones/${MILESTONE_ID}/paygated-docs" "${EXPERT_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Document's own author can access"

step_header "GET /milestones/:id/paygated-docs — UNRELATED expert (no party relationship) correctly blocked"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/milestones/${MILESTONE_ID}/paygated-docs" "${UNRELATED_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "403" "$CODE" "Unrelated expert correctly blocked (the engagement-membership tightening, not just role-holding)"

step_header "GET /milestones/:id/paygated-docs — CEO PERMANENTLY EXCLUDED regardless of release state (the flow's central RBAC rule)"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/milestones/${MILESTONE_ID}/paygated-docs" "${CEO_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "403" "$CODE" "CEO correctly blocked even after release"

print_summary "MF-14"