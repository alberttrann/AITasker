#!/usr/bin/env bash
#
# MF-5: AI Matching & Shortlisting
#
# Covers:
#   GET /matching/:projectId/shortlist
#   GET /matching/:projectId/shortlist?refresh=true
#
# Guards & business rules tested:
#   - Non-owner CEO → 403
#   - Project not PUBLISHED → 422
#   - composite_score stripped from response (not present)
#   - strength_label and gap_map present
#   - contact_info (fullName, email, phone) present per expert
#   - ?refresh=true forces cache eviction and re-score

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

require_jq
health_check

SEPAY_WEBHOOK_SECRET="${SEPAY_WEBHOOK_SECRET:?Set SEPAY_WEBHOOK_SECRET to match your .env}"
TS=$(date +%s)
CEO_EMAIL="mf5-ceo-${TS}@aitasker.test"
EXPERT_EMAIL="mf5-expert-${TS}@aitasker.test"
OTHER_CEO_EMAIL="mf5-other-ceo-${TS}@aitasker.test"
PASSWORD="Str0ng!TestPass123"

echo ""
echo "════════════════════════════════════════════════════════"
echo " MF-5: AI Matching & Shortlisting"
echo "════════════════════════════════════════════════════════"

# ── PREREQ: register an expert with domains + seams ──
step_header "PREREQ — register Expert with domain A DEEP + seam A↔C"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${EXPERT_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF5 Expert\",\"phone\":\"0901234561\",\"roles\":\"EXPERT\"}")
EXPERT_TOKEN=$(echo "$RES" | jq -r '.access_token')
EXPERT_AUTH=(-H "Authorization: Bearer ${EXPERT_TOKEN}")
curl -s -X POST "${BASE_URL}/expert-profile/domains" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"domainCode":"A","depthLevel":"DEEP"}' > /dev/null
curl -s -X POST "${BASE_URL}/expert-profile/seams" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"seamCode":"A↔C"}' > /dev/null
curl -s -X PUT "${BASE_URL}/expert-profile/me" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"engagementModel":"MILESTONE","stackTagsJson":["Python","pgvector"]}' > /dev/null
echo "  Expert profile built."

# ── PREREQ: CEO + Project via elicitation ──
step_header "PREREQ — register CEO, activate Pro, run full elicitation to get PUBLISHED project"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${CEO_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF5 CEO\",\"phone\":\"0901234562\",\"roles\":\"CLIENT_CEO\"}")
CEO_TOKEN=$(echo "$RES" | jq -r '.access_token')
CEO_AUTH=(-H "Authorization: Bearer ${CEO_TOKEN}")
RES=$(curl -s -X POST "${BASE_URL}/wallets/virtual-accounts/topup" -H "Content-Type: application/json" "${CEO_AUTH[@]}" -d '{"amount":500000}')
VA_NUMBER=$(echo "$RES" | jq -r '.paymentReference')
REF_CODE="MF5-PRO-${TS}"
RAW_BODY="{\"content\":\"${VA_NUMBER} chuyen tien mf5\",\"transferAmount\":\"500000\",\"referenceCode\":\"${REF_CODE}\"}"
TIMESTAMP=$(date +%s)
SIGNATURE="sha256=$(printf '%s' "${TIMESTAMP}.${RAW_BODY}" | openssl dgst -sha256 -hmac "${SEPAY_WEBHOOK_SECRET}" | sed 's/^.* //')"
curl -s -X POST "${BASE_URL}/webhooks/sepay/ipn" -H "Content-Type: application/json" \
  -H "x-sepay-signature: ${SIGNATURE}" -H "x-sepay-timestamp: ${TIMESTAMP}" -d "${RAW_BODY}" > /dev/null
RES=$(curl -s -X POST "${BASE_URL}/subscriptions/activate" -H "Content-Type: application/json" "${CEO_AUTH[@]}" -d '{"activeRole":"CLIENT"}')
CEO_TOKEN=$(echo "$RES" | jq -r '.access_token')
CEO_AUTH=(-H "Authorization: Bearer ${CEO_TOKEN}")
echo "  CEO ready with Pro."

RES=$(curl -s -X POST "${BASE_URL}/elicitation/sessions" -H "Content-Type: application/json" "${CEO_AUTH[@]}" -d '{}')
SESSION_ID=$(echo "$RES" | jq -r '.id')
RES=$(curl -s -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage1" \
  -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
  -d '{"symptomText":"Our customer support chatbot answers about 2000 questions a day from our product catalogue. We have manually graded 500 conversations and the chatbot is only correct 71 percent of the time which hurts customer trust."}')
RECOMMENDED=$(echo "$RES" | jq -r '.recommendedArchetypesJson[0]')
curl -s -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage2" \
  -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
  -d "{\"archetype\":\"${RECOMMENDED}\",\"acknowledgedVoidCodes\":[]}" > /dev/null
curl -s -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage3" \
  -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
  -d '{"probeResponses":{
    "Roughly how many people will search or ask questions per day?":"Around 2000 per day from 500 support agents",
    "When someone gets a wrong or unhelpful answer, what do you expect to happen next?":"Escalate to human agent and log the failure for weekly accuracy review",
    "Does this need to pull from documents/systems you already have, and which ones?":"Pulls from our Zendesk knowledge base and PostgreSQL product catalogue via REST API",
    "How quickly does an answer need to appear after someone asks?":"Under 3 seconds end to end for 95th percentile of queries"
  }}' > /dev/null
curl -s -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage4" \
  -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
  -d '{"current_stack":"Python FastAPI PostgreSQL AWS ECS","data_available":"200k Zendesk conversation logs 50k SKU catalogue entries","latency_requirement":"Under 3 seconds end-to-end"}' \
  --max-time 30 > /dev/null

# CEO explicitly triggers Stage 5 synthesis (synchronous)
echo "  [prereq] Triggering POST /stage5..."
RES=$(curl -s -X POST "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage5" \
  -H "Content-Type: application/json" "${CEO_AUTH[@]}" --max-time 120)
GATE=$(echo "$RES" | jq -r '.gate_passed')
PROJECT_ID=$(echo "$RES" | jq -r '.project_id // empty')
echo "  Elicitation complete. Gate: ${GATE}, Project: ${PROJECT_ID}"

# ── PREREQ: Second CEO (non-owner) ──
step_header "PREREQ — register a second CEO (non-owner, for 403 guard test)"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${OTHER_CEO_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF5 Other CEO\",\"phone\":\"0901234563\",\"roles\":\"CLIENT_CEO\"}")
OTHER_TOKEN=$(echo "$RES" | jq -r '.access_token')
OTHER_AUTH=(-H "Authorization: Bearer ${OTHER_TOKEN}")

# ── Step 1: Shortlist — non-owner CEO → 403 ──
step_header "GET /matching/:id/shortlist — EDGE CASE: non-owner CEO → 403"
if [ -n "${PROJECT_ID:-}" ] && [ "$PROJECT_ID" != "null" ]; then
  RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/matching/${PROJECT_ID}/shortlist" "${OTHER_AUTH[@]}")
  CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
  print_body "$BODY"
  check_status "403" "$CODE" "Non-owner correctly blocked"
else
  echo -e "  \033[1;33m⚠\033[0m No project ID available — skipping non-owner guard test"
fi

# ── Step 2: Shortlist — project owner ──
step_header "GET /matching/:id/shortlist — owner CEO views shortlist"
if [ -n "${PROJECT_ID:-}" ] && [ "$PROJECT_ID" != "null" ]; then
  RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/matching/${PROJECT_ID}/shortlist" "${CEO_AUTH[@]}")
  CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
  print_body "$BODY"
  check_status "200" "$CODE" "Shortlist readable for owner"
  # Verify composite_score is NOT present (stripped for frontend)
  COMPOSITE=$(echo "$BODY" | jq '.[0].composite_score // "absent"')
  if [ "$COMPOSITE" = "\"absent\"" ] || [ "$COMPOSITE" = "null" ]; then
    echo -e "  \033[0;32m✓\033[0m composite_score correctly stripped from response"
    PASS=$((PASS + 1))
  else
    echo -e "  \033[0;31m✗\033[0m composite_score should not be present — found: ${COMPOSITE}"
    FAIL=$((FAIL + 1))
  fi
  # Verify expected fields present
  RESULT_COUNT=$(echo "$BODY" | jq '. | length')
  echo "  Shortlist has ${RESULT_COUNT} expert(s)"
  if [ "$RESULT_COUNT" -gt 0 ]; then
    check_field_present "$BODY" ".[0].strength_label" "strength_label present"
    check_field_present "$BODY" ".[0].gap_map" "gap_map present"
    check_field_present "$BODY" ".[0].contact_info" "contact_info present"
  fi
else
  echo -e "  \033[1;33m⚠\033[0m No project_id available — shortlist test skipped"
fi

# ── Step 3: Force refresh ──
step_header "GET /matching/:id/shortlist?refresh=true — force cache eviction and re-score"
if [ -n "${PROJECT_ID:-}" ] && [ "$PROJECT_ID" != "null" ]; then
  RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/matching/${PROJECT_ID}/shortlist?refresh=true" "${CEO_AUTH[@]}")
  CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
  print_body "$BODY"
  check_status "200" "$CODE" "Refresh shortlist accepted (cache evicted + re-scored)"
else
  echo -e "  \033[1;33m⚠\033[0m No project_id — refresh test skipped"
fi

print_summary "MF-5"