#!/usr/bin/env bash
#
# Validates MF-5 (AI Matching & Shortlisting).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

require_jq
health_check

SEPAY_WEBHOOK_SECRET="${SEPAY_WEBHOOK_SECRET:?Set SEPAY_WEBHOOK_SECRET to match your .env}"
PASSWORD="Str0ng!TestPass123"

echo ""
echo "════════════════════════════════════════════════════════"
echo " MF-5: AI Matching & Shortlisting"
echo "════════════════════════════════════════════════════════"

# ── PREREQ — a real expert with claims, so matching has someone to find ─

step_header "PREREQ — register an expert with a real seam claim relevant to archetype 1"
EXPERT_EMAIL="mf5-expert-$(date +%s)@aitasker.test"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${EXPERT_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF5 Test Expert\",\"phone\":\"0901234571\",\"roles\":\"EXPERT\"}")
EXPERT_TOKEN=$(echo "$RES" | jq -r '.access_token')
EXPERT_AUTH=(-H "Authorization: Bearer ${EXPERT_TOKEN}")
curl -s -X POST "${BASE_URL}/expert-profile/domains" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" -d '{"domainCode":"A","depthLevel":"DEEP"}' > /dev/null
curl -s -X POST "${BASE_URL}/expert-profile/seams" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" -d '{"seamCode":"A↔C"}' > /dev/null
echo "  Expert registered with Domain A (DEEP) and seam A<->C claimed."

step_header "PREREQ — register CEO, fund, activate Client Pro, run elicitation through publish"
CEO_EMAIL="mf5-ceo-$(date +%s)@aitasker.test"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${CEO_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF5 Test CEO\",\"phone\":\"0901234572\",\"roles\":\"CLIENT_CEO\"}")
TOKEN=$(echo "$RES" | jq -r '.access_token')
AUTH=(-H "Authorization: Bearer ${TOKEN}")
RES=$(curl -s -X POST "${BASE_URL}/wallets/virtual-accounts/topup" -H "Content-Type: application/json" "${AUTH[@]}" -d '{"amount":500000}')
VA_NUMBER=$(echo "$RES" | jq -r '.paymentReference')
REF_CODE="MF5-VALIDATE-$(date +%s)"
RAW_BODY="{\"content\":\"${VA_NUMBER} chuyen tien mf5 test\",\"transferAmount\":\"500000\",\"referenceCode\":\"${REF_CODE}\"}"
TIMESTAMP=$(date +%s)
SIGNATURE="sha256=$(printf '%s' "${TIMESTAMP}.${RAW_BODY}" | openssl dgst -sha256 -hmac "${SEPAY_WEBHOOK_SECRET}" | sed 's/^.* //')"
curl -s -X POST "${BASE_URL}/webhooks/sepay/ipn" -H "Content-Type: application/json" \
  -H "x-sepay-signature: ${SIGNATURE}" -H "x-sepay-timestamp: ${TIMESTAMP}" -d "${RAW_BODY}" > /dev/null
RES=$(curl -s -X POST "${BASE_URL}/subscriptions/activate" -H "Content-Type: application/json" "${AUTH[@]}" -d '{"activeRole":"CLIENT"}')
TOKEN=$(echo "$RES" | jq -r '.access_token')
AUTH=(-H "Authorization: Bearer ${TOKEN}")

RES=$(curl -s -X POST "${BASE_URL}/elicitation/sessions" -H "Content-Type: application/json" "${AUTH[@]}" -d '{}')
SESSION_ID=$(echo "$RES" | jq -r '.id')
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
  -d '{"current_stack":"Python FastAPI, PostgreSQL, AWS ECS","data_available":"200k Zendesk conversation logs, 50k SKU catalogue","latency_requirement":"Under 3 seconds end-to-end"}' \
  --max-time 100)
GATE_PASSED=$(echo "$RES" | jq -r '.gate_passed')
PROJECT_ID=$(echo "$RES" | jq -r '.project_id')

if [ "$GATE_PASSED" != "true" ]; then
  echo "  Full stage4 response: ${RES}"
  echo -e "  \033[1;33m⚠\033[0m Synthesis gate failed for this input (gate_passed=false) — no project was published, so there is nothing for matching to fire on. The symptom text was already adjusted once to address the 3 voids seen in an earlier run (NO_GROUND_TRUTH, UNCLEAR_SUCCESS_METRIC, NO_BASELINE) — if this still fails, check the advisory_note/flagged_void in the response above for what's different this time, rather than re-running blindly."
  print_summary "MF-5"
fi
echo "  Project published: ${PROJECT_ID}"

# ── MF-5 ACTUAL CONTENT BEGINS HERE ──────────────────────────────────────
# No explicit trigger call needed — matching already fired automatically
# via the project.published event the instant the gate passed above.
# Small delay to let the event handler + ai-service call actually finish.

step_header "Wait for the automatic match to complete (async @OnEvent handler, real ai-service call)"
# NOTE: there is no way to detect readiness from the response itself —
# getMatchingShortlist() does `shortlist ?? []`, so "not yet computed" and
# "computed, zero candidates" both return an identical empty array over
# HTTP. A polling loop checking response shape cannot distinguish these
# two cases, so this is a fixed wait, not a real readiness check.
sleep 15
echo "  Waited 15s. If the check below still shows an empty shortlist, that's"
echo "  genuinely ambiguous from this endpoint alone — could mean the handler"
echo "  hasn't finished, or it finished and found zero real candidates."

step_header "GET /matching/:projectId/shortlist — read the resulting cached shortlist"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/matching/${PROJECT_ID}/shortlist" "${AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Shortlist readable"

ENTRY_COUNT=$(echo "$BODY" | jq 'length' 2>/dev/null)
if [ "$ENTRY_COUNT" != "null" ] && [ "$ENTRY_COUNT" -gt 0 ] 2>/dev/null; then
  echo -e "  \033[0;32m✓\033[0m Shortlist contains ${ENTRY_COUNT} candidate(s)"
  PASS=$((PASS + 1))

  step_header "Confirm composite_score is NEVER exposed to the frontend (blueprint step 14 — labels not numbers)"
  HAS_SCORE=$(echo "$BODY" | jq '[.[] | has("composite_score")] | any')
  if [ "$HAS_SCORE" = "false" ]; then
    echo -e "  \033[0;32m✓\033[0m composite_score correctly absent from every entry"
    PASS=$((PASS + 1))
  else
    echo -e "  \033[0;31m✗\033[0m composite_score is present — numeric scores are leaking to the frontend"
    FAIL=$((FAIL + 1))
  fi

  HAS_LABEL=$(echo "$BODY" | jq '[.[] | has("strength_label")] | all')
  if [ "$HAS_LABEL" = "true" ]; then
    echo -e "  \033[0;32m✓\033[0m Every entry has a strength_label"
    PASS=$((PASS + 1))
  else
    echo -e "  \033[0;31m✗\033[0m Some entry is missing strength_label"
    FAIL=$((FAIL + 1))
  fi
else
  echo -e "  \033[1;33m⚠\033[0m Shortlist is empty after the 15s wait. Per the note above, this is genuinely ambiguous from this endpoint alone — either the handler hasn't finished (try increasing the sleep), or it finished and found zero candidates despite the real expert+seam-claim registered above (worth checking ai-service logs directly for this project_id if increasing the wait doesn't change the result)."
  FAIL=$((FAIL + 1))
fi

print_summary "MF-5"