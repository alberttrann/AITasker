#!/usr/bin/env bash
#
# Validates MF-18 (Manual Dispute Resolution & Account Management).
# ASSUMES admin_suspend_actions_addition.txt has landed — suspend-spec
# and suspend-user didn't exist anywhere before that patch. Needs a real
# ADMIN account via ADMIN_EMAIL/ADMIN_PASSWORD.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

require_jq
health_check

if [ -z "${ADMIN_EMAIL:-}" ] || [ -z "${ADMIN_PASSWORD:-}" ]; then
  echo -e "\033[0;31m✗ ADMIN_EMAIL and ADMIN_PASSWORD are required for this script.\033[0m"
  exit 1
fi

SEPAY_WEBHOOK_SECRET="${SEPAY_WEBHOOK_SECRET:?Set SEPAY_WEBHOOK_SECRET to match your .env}"
PASSWORD="Str0ng!TestPass123"

echo ""
echo "════════════════════════════════════════════════════════"
echo " MF-18: Manual Dispute Resolution & Account Management"
echo "════════════════════════════════════════════════════════"

step_header "Log in as ADMIN"
RES=$(curl -s -X POST "${BASE_URL}/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}")
ADMIN_TOKEN=$(echo "$RES" | jq -r '.access_token')
ADMIN_AUTH=(-H "Authorization: Bearer ${ADMIN_TOKEN}")
if [ "$ADMIN_TOKEN" = "null" ] || [ -z "$ADMIN_TOKEN" ]; then
  echo -e "  \033[0;31m✗\033[0m Admin login failed — check ADMIN_EMAIL/ADMIN_PASSWORD."
  exit 1
fi

# ── DISPUTE RESOLUTION (steps 1-5) — reuses the real dispute-filing chain ─

step_header "PREREQ — full chain through a filed dispute (condensed, same pattern as mf8_validate.sh)"
CEO_EMAIL="mf18-ceo-$(date +%s)@aitasker.test"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${CEO_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF18 Test CEO\",\"phone\":\"0901234597\",\"roles\":\"CLIENT_CEO\"}")
CEO_TOKEN=$(echo "$RES" | jq -r '.access_token')
CEO_AUTH=(-H "Authorization: Bearer ${CEO_TOKEN}")
RES=$(curl -s -X POST "${BASE_URL}/wallets/virtual-accounts/topup" -H "Content-Type: application/json" "${CEO_AUTH[@]}" -d '{"amount":500000}')
VA_NUMBER=$(echo "$RES" | jq -r '.paymentReference')
REF_CODE="MF18-CEOPRO-$(date +%s)"
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
RES=$(curl -s -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage4" -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
  -d '{"current_stack":"Python FastAPI, PostgreSQL, AWS ECS","data_available":"200k Zendesk conversation logs, 50k SKU catalogue","latency_requirement":"Under 3 seconds end-to-end"}' --max-time 100)
GATE_PASSED=$(echo "$RES" | jq -r '.gate_passed')
PROJECT_ID=$(echo "$RES" | jq -r '.project_id')
if [ "$GATE_PASSED" != "true" ]; then
  echo "  Full stage4 response: ${RES}"
  echo -e "  \033[1;33m⚠\033[0m Synthesis gate failed — aborting the dispute-resolution section, continuing to suspend-spec/suspend-user below regardless."
else
  RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
    -d "{\"email\":\"mf18-expert-$(date +%s)@aitasker.test\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF18 Test Expert\",\"phone\":\"0901234598\",\"roles\":\"EXPERT\"}")
  EXPERT_TOKEN=$(echo "$RES" | jq -r '.access_token')
  EXPERT_AUTH=(-H "Authorization: Bearer ${EXPERT_TOKEN}")
  RES=$(curl -s -X POST "${BASE_URL}/wallets/virtual-accounts/topup" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" -d '{"amount":300000}')
  VA_NUMBER=$(echo "$RES" | jq -r '.paymentReference')
  REF_CODE="MF18-EXPPRO-$(date +%s)"
  RAW_BODY="{\"content\":\"${VA_NUMBER} chuyen tien\",\"transferAmount\":\"300000\",\"referenceCode\":\"${REF_CODE}\"}"
  TIMESTAMP=$(date +%s)
  SIGNATURE="sha256=$(printf '%s' "${TIMESTAMP}.${RAW_BODY}" | openssl dgst -sha256 -hmac "${SEPAY_WEBHOOK_SECRET}" | sed 's/^.* //')"
  curl -s -X POST "${BASE_URL}/webhooks/sepay/ipn" -H "Content-Type: application/json" \
    -H "x-sepay-signature: ${SIGNATURE}" -H "x-sepay-timestamp: ${TIMESTAMP}" -d "${RAW_BODY}" > /dev/null
  RES=$(curl -s -X POST "${BASE_URL}/subscriptions/activate" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" -d '{"activeRole":"EXPERT"}')
  EXPERT_TOKEN=$(echo "$RES" | jq -r '.access_token')
  EXPERT_AUTH=(-H "Authorization: Bearer ${EXPERT_TOKEN}")

  RES=$(curl -s -X POST "${BASE_URL}/bids" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
    -d "{\"projectId\":\"${PROJECT_ID}\",\"footprint_alignment_json\":{\"domains\":[{\"code\":\"A\",\"depth\":\"DEEP\"}],\"seams\":[{\"code\":\"A<->C\",\"tier\":\"CLAIMED\"}]},\"approach_summary\":\"RAG pipeline.\",\"conditional_pricing_json\":[{\"milestone_number\":1,\"price_vnd\":15000000,\"condition\":\"Discovery sign-off\"}]}")
  BID_ID=$(echo "$RES" | jq -r '.bid.id')
  ENGAGEMENT_ID=$(echo "$RES" | jq -r '.engagement.id')
  curl -s -X PUT "${BASE_URL}/bids/${BID_ID}/ceo-decision" -H "Content-Type: application/json" "${CEO_AUTH[@]}" -d '{"decision":"APPROVED"}' > /dev/null
  curl -s -X POST "${BASE_URL}/engagements/${ENGAGEMENT_ID}/connect" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" -d '{}' > /dev/null
  curl -s -X PUT "${BASE_URL}/engagements/${ENGAGEMENT_ID}/accept-nda" -H "Content-Type: application/json" "${CEO_AUTH[@]}" -d '{}' > /dev/null

  RES=$(curl -s -X POST "${BASE_URL}/milestones" -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
    -d "{\"engagement_id\":\"${ENGAGEMENT_ID}\",\"milestone_number\":1,\"deliverable_statement\":\"Discovery report.\",\"sign_off_authority\":\"TECH_TEAM\",\"payment_amount_vnd\":15000000,\"criteria\":[{\"criterion_text\":\"Diagram complete.\",\"is_required\":true}]}")
  MILESTONE_ID=$(echo "$RES" | jq -r '.id')
  CRITERION_ID=$(echo "$RES" | jq -r '.acceptanceCriteria[0].id')
  RES=$(curl -s -X PUT "${BASE_URL}/milestones/${MILESTONE_ID}/fund" -H "Content-Type: application/json" "${CEO_AUTH[@]}" -d '{}')
  MILESTONE_VA=$(echo "$RES" | jq -r '.vaNumber')
  REF_CODE="MF18-MFUND-$(date +%s)"
  RAW_BODY="{\"content\":\"${MILESTONE_VA} thanh toan\",\"transferAmount\":\"15000000\",\"referenceCode\":\"${REF_CODE}\"}"
  TIMESTAMP=$(date +%s)
  SIGNATURE="sha256=$(printf '%s' "${TIMESTAMP}.${RAW_BODY}" | openssl dgst -sha256 -hmac "${SEPAY_WEBHOOK_SECRET}" | sed 's/^.* //')"
  curl -s -X POST "${BASE_URL}/webhooks/sepay/ipn" -H "Content-Type: application/json" \
    -H "x-sepay-signature: ${SIGNATURE}" -H "x-sepay-timestamp: ${TIMESTAMP}" -d "${RAW_BODY}" > /dev/null
  curl -s -X POST "${BASE_URL}/milestones/${MILESTONE_ID}/submit" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
    -d '{"description":"Submitted.","files_json":[]}' > /dev/null

  RES=$(curl -s -X POST "${BASE_URL}/disputes" -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
    -d "{\"criterion_id\":\"${CRITERION_ID}\",\"additional_context\":\"Diagram is incomplete.\"}")
  DISPUTE_STATE=$(echo "$RES" | jq -r '.state')
  DISPUTE_ID=$(echo "$RES" | jq -r '.dispute_id')
  echo "  Dispute filed, resolved to: ${DISPUTE_STATE}"

  if [ "$DISPUTE_STATE" = "MANUAL_REVIEW" ]; then
    step_header "PUT /admin/disputes/:id/resolve — admin SPLITs 50/50 (steps 2-3, the SPLIT path, not yet exercised live this session)"
    RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/admin/disputes/${DISPUTE_ID}/resolve" -H "Content-Type: application/json" "${ADMIN_AUTH[@]}" \
      -d '{"decision":"SPLIT"}')
    CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
    print_body "$BODY"
    check_status "200" "$CODE" "Admin SPLIT resolution accepted"

    step_header "GET /milestones/:id — confirm APPROVED post-split"
    RES=$(curl -s "${BASE_URL}/milestones/${MILESTONE_ID}" "${CEO_AUTH[@]}")
    print_body "$RES"
    check_field_equals "$RES" ".state" "APPROVED" "milestone.state is APPROVED post-split"
  else
    echo -e "  \033[1;33m⚠\033[0m Dispute auto-resolved before reaching MANUAL_REVIEW — nothing for admin to manually resolve this run. Not a failure, just genuine ai-service judgment outside this script's control."
  fi
fi

# ── SPEC PULL-BACK (steps 6-8) ───────────────────────────────────────────

if [ -n "${PROJECT_ID:-}" ]; then
  step_header "PUT /admin/projects/:id/suspend-spec — emergency pull-back"
  RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/admin/projects/${PROJECT_ID}/suspend-spec" -H "Content-Type: application/json" "${ADMIN_AUTH[@]}")
  CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
  print_body "$BODY"
  check_status "200" "$CODE" "Suspend-spec accepted"
  check_field_equals "$BODY" ".state" "SUSPENDED" "project.state is SUSPENDED"

  step_header "GET /projects/:id/artifact-a — confirm hidden from the marketplace post-suspension"
  RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/projects/${PROJECT_ID}/artifact-a" "${ADMIN_AUTH[@]}")
  CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
  print_body "$BODY"
  if [ "$CODE" = "403" ] || [ "$CODE" = "422" ] || [ "$CODE" = "404" ]; then
    echo -e "  \033[0;32m✓\033[0m Suspended spec correctly inaccessible (HTTP ${CODE})"
    PASS=$((PASS + 1))
  else
    echo -e "  \033[0;31m✗\033[0m Suspended spec still accessible — HTTP ${CODE}"
    FAIL=$((FAIL + 1))
  fi
else
  echo -e "\033[1;33m⚠\033[0m Skipping spec pull-back — no PROJECT_ID from the section above (synthesis gate failed earlier)."
fi

# ── ACCOUNT SUSPENSION (steps 9-12) — tests the isActive revocation directly ─

step_header "PREREQ — register a throwaway account to suspend"
SUSPEND_EMAIL="mf18-suspend-target-$(date +%s)@aitasker.test"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${SUSPEND_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"Suspend Target\",\"phone\":\"0901234599\",\"roles\":\"EXPERT\"}")
SUSPEND_USER_ID=$(echo "$RES" | jq -r '.user.id')
SUSPEND_TOKEN=$(echo "$RES" | jq -r '.access_token')
SUSPEND_AUTH=(-H "Authorization: Bearer ${SUSPEND_TOKEN}")

step_header "GET /users/me — confirm this token works BEFORE suspension"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/users/me" "${SUSPEND_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
check_status "200" "$CODE" "Pre-suspension token works"

step_header "PUT /admin/users/:id/suspend — suspend the account (step 10)"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/admin/users/${SUSPEND_USER_ID}/suspend" -H "Content-Type: application/json" "${ADMIN_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Suspend accepted"
check_field_equals "$BODY" ".isActive" "false" "isActive is false"

step_header "GET /users/me — SAME pre-existing token, expect rejection NOW (the actual revocation claim under test, not just 'suspend returned 200')"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/users/me" "${SUSPEND_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "401" "$CODE" "Pre-existing token now rejected — confirms JwtStrategy's per-request isActive re-check actually works, not just trusted"

step_header "POST /auth/login — suspended account CAN still log in (login() never checks isActive — confirmed directly, not assumed), but the fresh token is immediately useless"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"${SUSPEND_EMAIL}\",\"password\":\"${PASSWORD}\"}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Login succeeds despite suspension (this is the real, confirmed behavior — login() has no isActive guard)"
NEW_TOKEN=$(echo "$BODY" | jq -r '.access_token')

step_header "GET /users/me — confirm the FRESH login token is ALSO immediately rejected (the actual, practically-equivalent guarantee)"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/users/me" -H "Authorization: Bearer ${NEW_TOKEN}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "401" "$CODE" "Fresh post-suspension token also rejected — the practical lockout is real even though login() itself doesn't gate it"

print_summary "MF-18"