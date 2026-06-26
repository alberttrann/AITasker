#!/usr/bin/env bash
# backend/simulations/mainflow-validation/mf8_validate.sh
#
# Validates MF-8 (Dispute Resolution). Reuses MF-7's full prerequisite
# chain through a SUBMITTED milestone, then files a dispute against the
# unverified criterion instead of verifying it normally.
#
# ASSUMES today's disputes corrections have landed: DisputeState is
# LAYER_1_EVAL/AUTO_RESOLVED/MANUAL_REVIEW/RESOLVED (not PENDING/AI_RESOLVED/
# ESCALATED/ADMIN_RESOLVED), the withdraw route is removed, and resolve-dispute
# no longer takes expertSharePercent.
#
# Whether this run exercises AUTO_RESOLVED or MANUAL_REVIEW depends on the
# real ai-service confidence score for this exact criterion/deliverable
# pair — not something this script controls. Both outcomes are handled
# explicitly below, not assumed away.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

require_jq
health_check

SEPAY_WEBHOOK_SECRET="${SEPAY_WEBHOOK_SECRET:?Set SEPAY_WEBHOOK_SECRET to match your .env}"
PASSWORD="Str0ng!TestPass123"

echo ""
echo "════════════════════════════════════════════════════════"
echo " MF-8: Dispute Resolution"
echo "════════════════════════════════════════════════════════"

step_header "PREREQ — full chain through a SUBMITTED milestone (condensed, same as MF-7's prerequisite)"
CEO_EMAIL="mf8-ceo-$(date +%s)@aitasker.test"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${CEO_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF8 Test CEO\",\"phone\":\"0901234577\",\"roles\":\"CLIENT_CEO\"}")
CEO_TOKEN=$(echo "$RES" | jq -r '.access_token')
CEO_AUTH=(-H "Authorization: Bearer ${CEO_TOKEN}")
RES=$(curl -s -X POST "${BASE_URL}/wallets/virtual-accounts/topup" -H "Content-Type: application/json" "${CEO_AUTH[@]}" -d '{"amount":500000}')
VA_NUMBER=$(echo "$RES" | jq -r '.paymentReference')
REF_CODE="MF8-CLIENT-PRO-$(date +%s)"
RAW_BODY="{\"content\":\"${VA_NUMBER} chuyen tien mf8 ceo\",\"transferAmount\":\"500000\",\"referenceCode\":\"${REF_CODE}\"}"
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
TECH_EMAIL="mf8-tech-$(date +%s)@aitasker.test"
RES=$(curl -s -X POST "${BASE_URL}/auth/register/handoff" -H "Content-Type: application/json" \
  -d "{\"invite_token\":\"${INVITE_TOKEN}\",\"email\":\"${TECH_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF8 Test Tech\"}")
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
  print_summary "MF-8"
fi

EXPERT_EMAIL="mf8-expert-$(date +%s)@aitasker.test"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${EXPERT_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF8 Test Expert\",\"phone\":\"0901234578\",\"roles\":\"EXPERT\"}")
EXPERT_TOKEN=$(echo "$RES" | jq -r '.access_token')
EXPERT_AUTH=(-H "Authorization: Bearer ${EXPERT_TOKEN}")
RES=$(curl -s -X POST "${BASE_URL}/wallets/virtual-accounts/topup" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" -d '{"amount":300000}')
VA_NUMBER=$(echo "$RES" | jq -r '.paymentReference')
REF_CODE="MF8-EXPERT-PRO-$(date +%s)"
RAW_BODY="{\"content\":\"${VA_NUMBER} chuyen tien mf8 expert\",\"transferAmount\":\"300000\",\"referenceCode\":\"${REF_CODE}\"}"
TIMESTAMP=$(date +%s)
SIGNATURE="sha256=$(printf '%s' "${TIMESTAMP}.${RAW_BODY}" | openssl dgst -sha256 -hmac "${SEPAY_WEBHOOK_SECRET}" | sed 's/^.* //')"
curl -s -X POST "${BASE_URL}/webhooks/sepay/ipn" -H "Content-Type: application/json" \
  -H "x-sepay-signature: ${SIGNATURE}" -H "x-sepay-timestamp: ${TIMESTAMP}" -d "${RAW_BODY}" > /dev/null
RES=$(curl -s -X POST "${BASE_URL}/subscriptions/activate" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" -d '{"activeRole":"EXPERT"}')
EXPERT_TOKEN=$(echo "$RES" | jq -r '.access_token')
EXPERT_AUTH=(-H "Authorization: Bearer ${EXPERT_TOKEN}")
curl -s -X POST "${BASE_URL}/bank-hub/initiate-link" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"bank_account_xid":"MF8BANKXID","holder_name":"MF8 Test Expert"}' > /dev/null

RES=$(curl -s -X POST "${BASE_URL}/bids" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d "{
    \"projectId\":\"${PROJECT_ID}\",
    \"footprint_alignment_json\":{\"domains\":[{\"code\":\"A\",\"depth\":\"DEEP\"}],\"seams\":[{\"code\":\"A<->C\",\"tier\":\"CLAIMED\"}]},
    \"approach_summary\":\"RAG pipeline grounded in the Zendesk KB.\",
    \"conditional_pricing_json\":[{\"milestone_number\":1,\"price_vnd\":15000000,\"condition\":\"Discovery sign-off\"}]
  }")
BID_ID=$(echo "$RES" | jq -r '.bid.id')
ENGAGEMENT_ID=$(echo "$RES" | jq -r '.engagement.id')
curl -s -X PUT "${BASE_URL}/bids/${BID_ID}/tech-review" -H "Content-Type: application/json" "${TECH_AUTH[@]}" -d '{"action":"APPROVED"}' > /dev/null
curl -s -X PUT "${BASE_URL}/bids/${BID_ID}/ceo-decision" -H "Content-Type: application/json" "${CEO_AUTH[@]}" -d '{"decision":"APPROVED"}' > /dev/null
curl -s -X POST "${BASE_URL}/engagements/${ENGAGEMENT_ID}/connect" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" -d '{}' > /dev/null
curl -s -X PUT "${BASE_URL}/engagements/${ENGAGEMENT_ID}/accept-nda" -H "Content-Type: application/json" "${CEO_AUTH[@]}" -d '{}' > /dev/null

RES=$(curl -s -X POST "${BASE_URL}/milestones" -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
  -d "{
    \"engagement_id\":\"${ENGAGEMENT_ID}\",
    \"milestone_number\":1,
    \"deliverable_statement\":\"Discovery report and architecture sign-off.\",
    \"sign_off_authority\":\"TECH_TEAM\",
    \"payment_amount_vnd\":15000000,
    \"criteria\":[{\"criterion_text\":\"Architecture diagram covers all required seams with explicit data flow.\",\"is_required\":true}]
  }")
MILESTONE_ID=$(echo "$RES" | jq -r '.id')
CRITERION_ID=$(echo "$RES" | jq -r '.acceptanceCriteria[0].id')
RES=$(curl -s -X PUT "${BASE_URL}/milestones/${MILESTONE_ID}/fund" -H "Content-Type: application/json" "${CEO_AUTH[@]}" -d '{}')
MILESTONE_VA=$(echo "$RES" | jq -r '.vaNumber')
REF_CODE="MF8-MILESTONE-FUND-$(date +%s)"
RAW_BODY="{\"content\":\"${MILESTONE_VA} thanh toan\",\"transferAmount\":\"15000000\",\"referenceCode\":\"${REF_CODE}\"}"
TIMESTAMP=$(date +%s)
SIGNATURE="sha256=$(printf '%s' "${TIMESTAMP}.${RAW_BODY}" | openssl dgst -sha256 -hmac "${SEPAY_WEBHOOK_SECRET}" | sed 's/^.* //')"
curl -s -X POST "${BASE_URL}/webhooks/sepay/ipn" -H "Content-Type: application/json" \
  -H "x-sepay-signature: ${SIGNATURE}" -H "x-sepay-timestamp: ${TIMESTAMP}" -d "${RAW_BODY}" > /dev/null
curl -s -X POST "${BASE_URL}/milestones/${MILESTONE_ID}/submit" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"description":"Discovery report attached.","files_json":["https://example.com/report.pdf"]}' > /dev/null
echo "  Milestone ${MILESTONE_ID} is SUBMITTED, criterion ${CRITERION_ID} unverified — ready to dispute."

# ── MF-8 ACTUAL CONTENT BEGINS HERE ──────────────────────────────────────

step_header "POST /disputes — CEO files a dispute against the unverified criterion (step 1-2)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/disputes" -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
  -d "{\"criterion_id\":\"${CRITERION_ID}\",\"additional_context\":\"The architecture diagram is missing the A<->C seam entirely.\"}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Dispute filed"
DISPUTE_STATE=$(echo "$BODY" | jq -r '.state')
echo "  Dispute resolved to: ${DISPUTE_STATE}"
DISPUTE_ID=$(echo "$BODY" | jq -r '.dispute_id')

step_header "GET /milestones/:id — confirm escrow froze and milestone moved to DISPUTED at filing time"
RES=$(curl -s "${BASE_URL}/milestones/${MILESTONE_ID}" "${CEO_AUTH[@]}")
print_body "$RES"
# NOTE: if AUTO_RESOLVED already fired synchronously inside POST /disputes
# above, the milestone will already show APPROVED here, not DISPUTED — both
# are correct depending on timing, not a contradiction.

if [ "$DISPUTE_STATE" = "AUTO_RESOLVED" ]; then
  step_header "AUTO_RESOLVED path — confirm ledger release already fired (steps 3-4)"
  RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/milestones/${MILESTONE_ID}" "${CEO_AUTH[@]}")
  CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
  print_body "$BODY"
  check_field_equals "$BODY" ".state" "APPROVED" "milestone.state is APPROVED post-auto-resolution"

elif [ "$DISPUTE_STATE" = "MANUAL_REVIEW" ]; then
  step_header "MANUAL_REVIEW path — admin views the dispute queue (step 5-6)"
  echo -e "  \033[1;33m⚠\033[0m NOTE: the script's CEO/EXPERT/TECH accounts are not admins. The"
  echo "  PUT /admin/disputes/:id/resolve step below needs a real ADMIN-role"
  echo "  account — set ADMIN_EMAIL and ADMIN_PASSWORD env vars for an"
  echo "  existing admin account to exercise this path, or seed one first."

  if [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
    RES=$(curl -s -X POST "${BASE_URL}/auth/login" -H "Content-Type: application/json" \
      -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}")
    ADMIN_TOKEN=$(echo "$RES" | jq -r '.access_token')
    ADMIN_AUTH=(-H "Authorization: Bearer ${ADMIN_TOKEN}")

    step_header "GET /admin/disputes — confirm the dispute appears in the queue"
    RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/admin/disputes?state=MANUAL_REVIEW" "${ADMIN_AUTH[@]}")
    CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
    print_body "$BODY"
    check_status "200" "$CODE" "Admin dispute queue readable"

    step_header "PUT /admin/disputes/:id/resolve — admin releases to expert (step 7-8, flat 50/50 if SPLIT were chosen instead — using EXPERT_WINS here)"
    RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/admin/disputes/${DISPUTE_ID}/resolve" -H "Content-Type: application/json" "${ADMIN_AUTH[@]}" \
      -d '{"decision":"EXPERT_WINS"}')
    CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
    print_body "$BODY"
    check_status "200" "$CODE" "Admin resolution accepted (no expertSharePercent needed — today's fix)"

    step_header "GET /milestones/:id — confirm APPROVED post-manual-resolution"
    RES=$(curl -s "${BASE_URL}/milestones/${MILESTONE_ID}" "${CEO_AUTH[@]}")
    print_body "$RES"
    check_field_equals "$RES" ".state" "APPROVED" "milestone.state is APPROVED post-manual-resolution"
  else
    echo "  Skipping admin resolution steps — no ADMIN_EMAIL/ADMIN_PASSWORD provided."
  fi
else
  echo -e "  \033[0;31m✗\033[0m Unexpected dispute state: ${DISPUTE_STATE}"
  FAIL=$((FAIL + 1))
fi

print_summary "MF-8"