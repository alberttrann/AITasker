#!/usr/bin/env bash
#
# Validates MF-7 (Milestone Management + DoD + Escrow). Builds on a
# CONNECTED engagement (reuses MF-6's full prerequisite chain through NDA
# acceptance), then walks milestone creation through funding, DoD,
# submission, sign-off, and the now-patched release + withdrawal_requests
# creation.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

require_jq
health_check

SEPAY_WEBHOOK_SECRET="${SEPAY_WEBHOOK_SECRET:?Set SEPAY_WEBHOOK_SECRET to match your .env}"
PASSWORD="Str0ng!TestPass123"

echo ""
echo "════════════════════════════════════════════════════════"
echo " MF-7: Milestone Management + DoD + Escrow"
echo "════════════════════════════════════════════════════════"

# ── PREREQ — full MF-6 chain through CONNECTED, condensed (silent except summary) ─

step_header "PREREQ — CEO + project + tech team + expert through CONNECTED engagement"
CEO_EMAIL="mf7-ceo-$(date +%s)@aitasker.test"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${CEO_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF7 Test CEO\",\"phone\":\"0901234575\",\"roles\":\"CLIENT_CEO\"}")
CEO_TOKEN=$(echo "$RES" | jq -r '.access_token')
CEO_AUTH=(-H "Authorization: Bearer ${CEO_TOKEN}")
RES=$(curl -s -X POST "${BASE_URL}/wallets/virtual-accounts/topup" -H "Content-Type: application/json" "${CEO_AUTH[@]}" -d '{"amount":500000}')
VA_NUMBER=$(echo "$RES" | jq -r '.paymentReference')
REF_CODE="MF7-CLIENT-PRO-$(date +%s)"
RAW_BODY="{\"content\":\"${VA_NUMBER} chuyen tien mf7 ceo\",\"transferAmount\":\"500000\",\"referenceCode\":\"${REF_CODE}\"}"
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
# CHANGED: handoff link now generated right after Stage 3 (the natural
# point per the blueprint's own swimlane — "Stage 4: System hard-blocks
# CEO... generates handoff link"), and Stage 4 is submitted by the TECH
# TEAM MEMBER via the handoff-specific route, not the CEO directly. This
# is what actually triggers Phase 1b's tech-team-to-project linking —
# calling PUT stage4 (CEO, Scenario B) here, as an earlier version of
# this script did, never links anyone, since that route has nothing to
# do with the handoff mechanism at all.
RES=$(curl -s -X POST "${BASE_URL}/elicitation/sessions/${SESSION_ID}/generate-handoff-link" -H "Content-Type: application/json" "${CEO_AUTH[@]}" -d '{}')
INVITE_TOKEN=$(echo "$RES" | jq -r '.invite_link' | sed -n 's/.*token=\(.*\)/\1/p')
TECH_EMAIL="mf7-tech-$(date +%s)@aitasker.test"
RES=$(curl -s -X POST "${BASE_URL}/auth/register/handoff" -H "Content-Type: application/json" \
  -d "{\"invite_token\":\"${INVITE_TOKEN}\",\"email\":\"${TECH_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF7 Test Tech\"}")
TECH_TOKEN=$(echo "$RES" | jq -r '.access_token')
TECH_AUTH=(-H "Authorization: Bearer ${TECH_TOKEN}")
echo "  Tech team registered and linked via handoff."

RES=$(curl -s -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage4-handoff" -H "Content-Type: application/json" "${TECH_AUTH[@]}" \
  -d '{"current_stack":"Python FastAPI, PostgreSQL, AWS ECS","data_available":"200k Zendesk conversation logs, 50k SKU catalogue","latency_requirement":"Under 3 seconds end-to-end"}' \
  --max-time 100)
GATE_PASSED=$(echo "$RES" | jq -r '.gate_passed')
PROJECT_ID=$(echo "$RES" | jq -r '.project_id')
if [ "$GATE_PASSED" != "true" ]; then
  echo "  Full stage4-handoff response: ${RES}"
  echo -e "  \033[1;33m⚠\033[0m Synthesis gate failed — aborting. Symptom text was already adjusted once for this exact failure mode — check advisory_note/flagged_void above before re-running blindly."
  print_summary "MF-7"
fi

EXPERT_EMAIL="mf7-expert-$(date +%s)@aitasker.test"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${EXPERT_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF7 Test Expert\",\"phone\":\"0901234576\",\"roles\":\"EXPERT\"}")
EXPERT_TOKEN=$(echo "$RES" | jq -r '.access_token')
EXPERT_AUTH=(-H "Authorization: Bearer ${EXPERT_TOKEN}")
RES=$(curl -s -X POST "${BASE_URL}/wallets/virtual-accounts/topup" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" -d '{"amount":300000}')
VA_NUMBER=$(echo "$RES" | jq -r '.paymentReference')
REF_CODE="MF7-EXPERT-PRO-$(date +%s)"
RAW_BODY="{\"content\":\"${VA_NUMBER} chuyen tien mf7 expert\",\"transferAmount\":\"300000\",\"referenceCode\":\"${REF_CODE}\"}"
TIMESTAMP=$(date +%s)
SIGNATURE="sha256=$(printf '%s' "${TIMESTAMP}.${RAW_BODY}" | openssl dgst -sha256 -hmac "${SEPAY_WEBHOOK_SECRET}" | sed 's/^.* //')"
curl -s -X POST "${BASE_URL}/webhooks/sepay/ipn" -H "Content-Type: application/json" \
  -H "x-sepay-signature: ${SIGNATURE}" -H "x-sepay-timestamp: ${TIMESTAMP}" -d "${RAW_BODY}" > /dev/null
RES=$(curl -s -X POST "${BASE_URL}/subscriptions/activate" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" -d '{"activeRole":"EXPERT"}')
EXPERT_TOKEN=$(echo "$RES" | jq -r '.access_token')
EXPERT_AUTH=(-H "Authorization: Bearer ${EXPERT_TOKEN}")

# Important: expert links their bank account NOW, BEFORE release — needed
# for the withdrawal_requests creation patch to actually fire later.
curl -s -X POST "${BASE_URL}/bank-hub/initiate-link" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"bank_account_xid":"MF7BANKXID","holder_name":"MF7 Test Expert"}' > /dev/null

RES=$(curl -s -X POST "${BASE_URL}/bids" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d "{
    \"projectId\":\"${PROJECT_ID}\",
    \"footprint_alignment_json\":{\"domains\":[{\"code\":\"A\",\"depth\":\"DEEP\"}],\"seams\":[{\"code\":\"A↔C\",\"tier\":\"CLAIMED\"}]},
    \"approach_summary\":\"RAG pipeline grounded in the Zendesk KB.\",
    \"conditional_pricing_json\":[{\"milestone_number\":1,\"price_vnd\":15000000,\"condition\":\"Discovery sign-off\"}]
  }")
BID_ID=$(echo "$RES" | jq -r '.bid.id')
ENGAGEMENT_ID=$(echo "$RES" | jq -r '.engagement.id')
curl -s -X PUT "${BASE_URL}/bids/${BID_ID}/tech-review" -H "Content-Type: application/json" "${TECH_AUTH[@]}" -d '{"action":"APPROVED"}' > /dev/null
curl -s -X PUT "${BASE_URL}/bids/${BID_ID}/ceo-decision" -H "Content-Type: application/json" "${CEO_AUTH[@]}" -d '{"decision":"APPROVED"}' > /dev/null
curl -s -X POST "${BASE_URL}/engagements/${ENGAGEMENT_ID}/connect" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" -d '{}' > /dev/null
curl -s -X PUT "${BASE_URL}/engagements/${ENGAGEMENT_ID}/accept-nda" -H "Content-Type: application/json" "${CEO_AUTH[@]}" -d '{}' > /dev/null
echo "  Engagement ${ENGAGEMENT_ID} is CONNECTED."

# ── MF-7 ACTUAL CONTENT BEGINS HERE ──────────────────────────────────────

step_header "POST /milestones — CEO defines Milestone 1 (step 1-2)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/milestones" -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
  -d "{
    \"engagement_id\":\"${ENGAGEMENT_ID}\",
    \"milestone_number\":1,
    \"deliverable_statement\":\"Discovery report and architecture sign-off.\",
    \"sign_off_authority\":\"TECH_TEAM\",
    \"payment_amount_vnd\":15000000,
    \"criteria\":[{\"criterion_text\":\"Architecture diagram covers all required seams with explicit data flow.\",\"is_required\":true}]
  }")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Milestone created"
check_field_equals "$BODY" ".state" "DEFINED" "milestone.state is DEFINED"
MILESTONE_ID=$(echo "$BODY" | jq -r '.id')
CRITERION_ID=$(echo "$BODY" | jq -r '.acceptanceCriteria[0].id')

step_header "PUT /milestones/:id/fund — CEO funds the milestone, VietQR path only (step 5-6, fund-from-wallet retracted)"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/milestones/${MILESTONE_ID}/fund" -H "Content-Type: application/json" "${CEO_AUTH[@]}" -d '{}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Funding initiated, VA created"
check_field_equals "$BODY" ".state" "AWAITING_PAYMENT" "milestone.state is AWAITING_PAYMENT"
MILESTONE_VA=$(echo "$BODY" | jq -r '.vaNumber')

step_header "POST /webhooks/sepay/ipn — real milestone funding webhook (step 7-8)"
REF_CODE="MF7-MILESTONE-FUND-$(date +%s)"
RAW_BODY="{\"content\":\"${MILESTONE_VA} thanh toan milestone 1\",\"transferAmount\":\"15000000\",\"referenceCode\":\"${REF_CODE}\"}"
TIMESTAMP=$(date +%s)
SIGNATURE="sha256=$(printf '%s' "${TIMESTAMP}.${RAW_BODY}" | openssl dgst -sha256 -hmac "${SEPAY_WEBHOOK_SECRET}" | sed 's/^.* //')"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/webhooks/sepay/ipn" -H "Content-Type: application/json" \
  -H "x-sepay-signature: ${SIGNATURE}" -H "x-sepay-timestamp: ${TIMESTAMP}" -d "${RAW_BODY}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Milestone funding IPN accepted"

step_header "GET /milestones/:id — confirm IN_PROGRESS (escrow locked) and engagement ACTIVE"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/milestones/${MILESTONE_ID}" "${CEO_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_field_equals "$BODY" ".state" "IN_PROGRESS" "milestone auto-advanced to IN_PROGRESS"

step_header "POST /milestones/:id/dod/items — expert creates a DoD checklist item (steps 10-11)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/milestones/${MILESTONE_ID}/dod/items" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d "{\"item_description\":\"Architecture diagram reviewed by tech team.\",\"is_required\":true,\"maps_to_criterion_id\":\"${CRITERION_ID}\"}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "DoD item created"
check_field_equals "$BODY" ".status" "PENDING" "DoD item status is PENDING"
DOD_ITEM_ID=$(echo "$BODY" | jq -r '.id')

step_header "POST /milestones/:id/submit — guard check: expect 422 with DoD still incomplete"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/milestones/${MILESTONE_ID}/submit" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"description":"Submitting now","files_json":[]}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "422" "$CODE" "Submission correctly blocked — REQUIRED_DOD_INCOMPLETE"

step_header "PUT /milestones/:id/dod/:itemId — expert completes the DoD item (steps 12-13)"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/milestones/${MILESTONE_ID}/dod/${DOD_ITEM_ID}" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"status":"COMPLETED","completion_note":"Reviewed in sync with tech team on 2026-06-26."}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "DoD item marked COMPLETED"

step_header "POST /milestones/:id/submit — now DoD-complete, expect success (steps 14-15)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/milestones/${MILESTONE_ID}/submit" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"description":"Discovery report attached, architecture finalized.","files_json":["https://example.com/discovery-report.pdf"]}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Submission accepted"

step_header "GET /milestones/:id — confirm SUBMITTED"
RES=$(curl -s "${BASE_URL}/milestones/${MILESTONE_ID}" "${CEO_AUTH[@]}")
print_body "$RES"
check_field_equals "$RES" ".state" "SUBMITTED" "milestone.state is SUBMITTED"

step_header "PUT /criteria/:id/verify — TECH_TEAM verifies the only required criterion (steps 16-19)"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/criteria/${CRITERION_ID}/verify" -H "Content-Type: application/json" "${TECH_AUTH[@]}" \
  -d '{"verification_comment":"Diagram covers all required seams explicitly."}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Criterion verified — last required criterion, should trigger auto-release"

step_header "GET /milestones/:id — confirm APPROVED + ledger release fired"
RES=$(curl -s "${BASE_URL}/milestones/${MILESTONE_ID}" "${CEO_AUTH[@]}")
print_body "$RES"
check_field_equals "$RES" ".state" "APPROVED" "milestone.state is APPROVED (today's patch: withdrawal_requests row should now also exist)"

step_header "GET /withdrawals — admin-equivalent check via expert's own history (today's MF-7 patch)"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/withdrawals" "${EXPERT_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Withdrawal history readable"
MILESTONE_RELEASE_COUNT=$(echo "$BODY" | jq '[.[] | select(.type == "MILESTONE_RELEASE")] | length')
if [ "$MILESTONE_RELEASE_COUNT" -ge 1 ] 2>/dev/null; then
  echo -e "  \033[0;32m✓\033[0m A MILESTONE_RELEASE withdrawal_requests row exists (today's patch confirmed working end-to-end)"
  PASS=$((PASS + 1))
else
  echo -e "  \033[0;31m✗\033[0m No MILESTONE_RELEASE withdrawal_requests row found — today's patch may not have landed, or the bank-link step above didn't take"
  FAIL=$((FAIL + 1))
fi

print_summary "MF-7"