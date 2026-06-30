#!/usr/bin/env bash
# backend/simulations/mainflow-validation/mf4_validate.sh
#
# Validates MF-4 (AI Elicitation Engine, 5-Stage) end-to-end against a
# REAL running backend + ai-service. Reuses the exact stage1-4 sequence
# already proven in s03_elicitation_full_flow.js / mf3_validate.sh, then
# extends through Stage 5 synthesis and the auto-publish gate itself,
# which neither of those scripts actually asserted on directly.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

require_jq
health_check

SEPAY_WEBHOOK_SECRET="${SEPAY_WEBHOOK_SECRET:?Set SEPAY_WEBHOOK_SECRET to match your .env}"
CEO_EMAIL="mf4-ceo-$(date +%s)@aitasker.test"
PASSWORD="Str0ng!TestPass123"

echo ""
echo "════════════════════════════════════════════════════════"
echo " MF-4: AI Elicitation Engine (5-Stage)"
echo "════════════════════════════════════════════════════════"

step_header "PREREQ — register CEO, fund wallet, activate Client Pro"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${CEO_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF4 Test CEO\",\"phone\":\"0901234570\",\"roles\":\"CLIENT_CEO\"}")
TOKEN=$(echo "$RES" | jq -r '.access_token')
AUTH=(-H "Authorization: Bearer ${TOKEN}")
RES=$(curl -s -X POST "${BASE_URL}/wallets/virtual-accounts/topup" -H "Content-Type: application/json" "${AUTH[@]}" -d '{"amount":500000}')
VA_NUMBER=$(echo "$RES" | jq -r '.paymentReference')
REF_CODE="MF4-VALIDATE-$(date +%s)"
RAW_BODY="{\"content\":\"${VA_NUMBER} chuyen tien mf4 test\",\"transferAmount\":\"500000\",\"referenceCode\":\"${REF_CODE}\"}"
TIMESTAMP=$(date +%s)
SIGNATURE="sha256=$(printf '%s' "${TIMESTAMP}.${RAW_BODY}" | openssl dgst -sha256 -hmac "${SEPAY_WEBHOOK_SECRET}" | sed 's/^.* //')"
curl -s -X POST "${BASE_URL}/webhooks/sepay/ipn" -H "Content-Type: application/json" \
  -H "x-sepay-signature: ${SIGNATURE}" -H "x-sepay-timestamp: ${TIMESTAMP}" -d "${RAW_BODY}" > /dev/null
RES=$(curl -s -X POST "${BASE_URL}/subscriptions/activate" -H "Content-Type: application/json" "${AUTH[@]}" -d '{"activeRole":"CLIENT"}')
TOKEN=$(echo "$RES" | jq -r '.access_token')
AUTH=(-H "Authorization: Bearer ${TOKEN}")
echo "  Prerequisite chain complete."

# ── STAGE 1: SYMPTOM INTAKE (swimlane steps 1-5) ────────────────────────

step_header "POST /elicitation/sessions — guard: sub_client_tier='pro' enforced (step 1)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/elicitation/sessions" -H "Content-Type: application/json" "${AUTH[@]}" -d '{}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Session created"
check_field_equals "$BODY" ".currentStage" "1" "currentStage starts at 1"
check_field_equals "$BODY" ".state" "IN_PROGRESS" "state is IN_PROGRESS"
SESSION_ID=$(echo "$BODY" | jq -r '.id')

step_header "PUT /elicitation/sessions/:id/stage1 — LLM extraction (steps 3-4, real ai-service call)"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage1" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"symptomText":"Our customer support chatbot keeps giving wrong answers about our product catalogue. We have 50,000 daily users and no system to measure accuracy."}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Stage 1 processed"
if [ "$CODE" != "200" ]; then
  echo -e "  \033[1;33m⚠\033[0m Aborting — see body above. If this is a 500/503, check ai-service is running first."
  print_summary "MF-4"
fi
check_field_present "$BODY" ".recommendedArchetypesJson" "recommendedArchetypesJson present (step 4 output)"
RECOMMENDED=$(echo "$BODY" | jq -r '.recommendedArchetypesJson[0]')
echo "  Recommended archetype: ${RECOMMENDED}"

# ── STAGE 2: ARCHETYPE + SDLC (swimlane steps 6-7) ──────────────────────

step_header "PUT /elicitation/sessions/:id/stage2 — archetype confirmation + SDLC void injection"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage2" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d "{\"archetype\":\"${RECOMMENDED}\",\"acknowledgedVoidCodes\":[]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Stage 2 processed"
check_field_equals "$BODY" ".archetype" "${RECOMMENDED}" "archetype persisted"

# ── STAGE 3: ARCHITECTURE PROBE (swimlane step 8) ───────────────────────

step_header "PUT /elicitation/sessions/:id/stage3 — 4 behavioral probe questions"
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
check_status "200" "$CODE" "Stage 3 processed"
check_field_equals "$BODY" ".advanced" "true" "Vagueness check passed, advanced to Stage 4"

# ── STAGE 4: SCENARIO B (self-technical) — swimlane step 9d ─────────────
# Using Scenario B rather than the Scenario A/handoff path here, since
# the handoff path itself is MF-3's own dedicated script — this script
# focuses on MF-4's own synthesis/gate logic specifically.

step_header "PUT /elicitation/sessions/:id/stage4 — Scenario B, self-technical CEO completes directly"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage4" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"current_stack":"Python FastAPI, PostgreSQL, AWS ECS","data_available":"200k Zendesk conversation logs, 50k SKU catalogue","latency_requirement":"Under 3 seconds end-to-end"}' \
  --max-time 100)
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Stage 4 processed"
if [ "$CODE" != "200" ]; then
  echo -e "  \033[1;33m⚠\033[0m Aborting — see body above."
  print_summary "MF-4"
fi

# ── STAGE 5: SYNTHESIS + AUTO-PUBLISH GATE (swimlane steps 10-12) ───────
# stage4 auto-chains synthesis per earlier session confirmation — this
# response IS the synthesis result, not a separate call.

step_header "Confirm auto-publish gate outcome (step 11) — checking what stage4's response actually returned"
GATE_PASSED=$(echo "$BODY" | jq -r '.gate_passed')
echo "  gate_passed: ${GATE_PASSED}"

if [ "$GATE_PASSED" = "true" ]; then
  PROJECT_ID=$(echo "$BODY" | jq -r '.project_id')
  check_field_present "$BODY" ".project_id" "project_id present (gate passed -> project created)"
  check_field_present "$BODY" ".completeness_score" "completeness_score present"

  step_header "GET /projects/:id — confirm PUBLISHED state and Artifact A/B presence (step 12)"
  RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/projects/${PROJECT_ID}" "${AUTH[@]}")
  CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
  print_body "$BODY"
  check_status "200" "$CODE" "Project readable"
  check_field_equals "$BODY" ".state" "PUBLISHED" "project.state is PUBLISHED"
  check_field_present "$BODY" ".artifactAJson" "artifactAJson present"

  step_header "GET /elicitation/sessions/:id — confirm session reached COMPLETED"
  RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/elicitation/sessions/${SESSION_ID}" "${AUTH[@]}")
  CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
  print_body "$BODY"
  check_field_equals "$BODY" ".state" "COMPLETED" "session.state is COMPLETED"
else
  check_field_present "$BODY" ".flagged_void" "flagged_void present (gate failed)"
  check_field_present "$BODY" ".return_to_stage" "return_to_stage present"
  check_field_present "$BODY" ".advisory_note" "advisory_note present"

  step_header "GET /elicitation/sessions/:id — confirm session reached RETURNED (not RETURNED_TO_CLIENT)"
  RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/elicitation/sessions/${SESSION_ID}" "${AUTH[@]}")
  CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
  print_body "$BODY"
  check_field_equals "$BODY" ".state" "RETURNED" "session.state is RETURNED (today's blueprint-accuracy fix)"
  echo -e "  \033[1;33m⚠\033[0m Gate failed for this input — this is a legitimate outcome, not a script bug. The RETURNED state check above is still the meaningful assertion here."
fi

print_summary "MF-4"