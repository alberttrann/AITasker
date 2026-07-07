#!/usr/bin/env bash
#
# MF-18: Real-time Messaging (HTTP REST side)
#
# Covers:
#   GET  /engagements/:id/messages
#   GET  /projects/:id/messages
#   POST /messages/:id/read
#   GET  /engagements/:id/messages/unread-count

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

require_jq
health_check

SEPAY_WEBHOOK_SECRET="${SEPAY_WEBHOOK_SECRET:?Set SEPAY_WEBHOOK_SECRET to match your .env}"
TS=$(date +%s)
PASSWORD="Str0ng!TestPass123"
CEO_EMAIL="mf18-ceo-${TS}@aitasker.test"
EXPERT_EMAIL="mf18-expert-${TS}@aitasker.test"

echo ""
echo "════════════════════════════════════════════════════════"
echo " MF-18: REST Messaging Endpoints"
echo "════════════════════════════════════════════════════════"

fund_wallet() {
  local token="$1" amount="$2" ref="$3"
  local auth=(-H "Authorization: Bearer ${token}")
  local va raw ts sig
  va=$(curl -s -X POST "${BASE_URL}/wallets/virtual-accounts/topup" \
    -H "Content-Type: application/json" "${auth[@]}" -d "{\"amount\":${amount}}" | jq -r '.paymentReference')
  raw="{\"content\":\"${va} chuyen tien ${ref}\",\"transferAmount\":\"${amount}\",\"referenceCode\":\"${ref}\"}"
  ts=$(date +%s)
  sig="sha256=$(printf '%s' "${ts}.${raw}" | openssl dgst -sha256 -hmac "${SEPAY_WEBHOOK_SECRET}" | sed 's/^.* //')"
  curl -s -X POST "${BASE_URL}/webhooks/sepay/ipn" -H "Content-Type: application/json" \
    -H "x-sepay-signature: ${sig}" -H "x-sepay-timestamp: ${ts}" -d "${raw}" > /dev/null
}

# ── PREREQ: Build CONNECTED engagement ──
step_header "PREREQ — build CEO + Expert + CONNECTED engagement for messaging tests"

source "${SCRIPT_DIR}/_elicitation_prereq.sh"

EXPERT_EMAIL="mf18-expert-${TS}@aitasker.test"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${EXPERT_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF18 Expert\",\"phone\":\"0901234595\",\"roles\":\"EXPERT\"}")
EXPERT_TOKEN=$(echo "$RES" | jq -r '.access_token')
EXPERT_AUTH=(-H "Authorization: Bearer ${EXPERT_TOKEN}")

# Set engagementModel and stackTags FIRST — ensures expertProfile row is fully populated
# before domains/seams are added. scoreEligibleExperts filters on expertProfile IS NOT NULL.
curl -s -X PUT "${BASE_URL}/expert-profile/me" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"engagementModel":"MILESTONE","stackTagsJson":["Python","pgvector","FastAPI","PostgreSQL","AWS ECS"]}' > /dev/null

# Now add domain and seam claims
# Super-Expert profile to guarantee matching across all non-deterministic AI specs
curl -s -X POST "${BASE_URL}/expert-profile/domains" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" -d '{"domainCode":"A","depthLevel":"DEEP"}' > /dev/null
curl -s -X POST "${BASE_URL}/expert-profile/domains" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" -d '{"domainCode":"D","depthLevel":"DEEP"}' > /dev/null
curl -s -X POST "${BASE_URL}/expert-profile/domains" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" -d '{"domainCode":"E","depthLevel":"DEEP"}' > /dev/null
curl -s -X POST "${BASE_URL}/expert-profile/seams" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" -d '{"seamCode":"A↔C"}' > /dev/null
curl -s -X POST "${BASE_URL}/expert-profile/seams" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" -d '{"seamCode":"A↔D"}' > /dev/null
curl -s -X POST "${BASE_URL}/expert-profile/seams" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" -d '{"seamCode":"D↔E"}' > /dev/null
# Fund wallet — Expert Pro costs 300,000 VND
fund_wallet "$EXPERT_TOKEN" 400000 "MF18-E-${TS}"
RES=$(curl -s -X POST "${BASE_URL}/subscriptions/activate" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"activeRole":"EXPERT"}')
EXPERT_TOKEN=$(echo "$RES" | jq -r '.access_token')
EXPERT_AUTH=(-H "Authorization: Bearer ${EXPERT_TOKEN}")
echo "  Expert ${EXPERT_EMAIL} ready with Pro + domain A DEEP + seam A↔C"

run_elicitation_prereq "mf18" "0901234596"
echo "  Project: ${PROJECT_ID}"

ENG_ID=""
if [ -n "${PROJECT_ID:-}" ] && [ "$PROJECT_ID" != "null" ]; then
  # Link Tech Team to project via DB (same workaround as MF-6 — linkedProjectId backend gap)
  TECH_USER_ID=$(curl -s "${BASE_URL}/users/me" "${TECH_AUTH[@]}" | jq -r '.id // empty')
  if [ -n "${DATABASE_URL:-}" ] && [ -n "${TECH_USER_ID:-}" ] && [ "$TECH_USER_ID" != "null" ]; then
    psql "${DATABASE_URL}" -c "UPDATE tech_team_profiles SET linked_project_id='${PROJECT_ID}' WHERE user_id='${TECH_USER_ID}';" > /dev/null 2>&1
    echo "  Tech Team ${TECH_USER_ID} linked to project ${PROJECT_ID} via DB workaround"
  fi

  RES=$(curl -s -X POST "${BASE_URL}/bids" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
    -d "{\"projectId\":\"${PROJECT_ID}\",\"footprint_alignment_json\":{\"domains\":[{\"code\":\"A\",\"depth\":\"DEEP\"}],\"seams\":[{\"code\":\"A<->C\",\"tier\":\"CLAIMED\"}]},\"approach_summary\":\"RAG pipeline with hybrid retrieval for customer support chatbot accuracy overhaul.\",\"conditional_pricing_json\":[{\"milestone_number\":1,\"price_vnd\":15000000,\"condition\":\"Delivery\"}]}")
  BID_ID=$(echo "$RES" | jq -r '.bid.id')
  ENG_ID=$(echo "$RES" | jq -r '.engagement.id')

  # Tech review — may fail if linkedProjectId DB workaround wasn't available
  TECH_REVIEW_RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/bids/${BID_ID}/tech-review" \
    -H "Content-Type: application/json" "${TECH_AUTH[@]}" -d '{"action":"APPROVED"}')
  TECH_CODE=$(echo "$TECH_REVIEW_RES" | tail -n1)
  if [ "$TECH_CODE" = "200" ]; then
    curl -s -X PUT "${BASE_URL}/bids/${BID_ID}/ceo-decision" -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
      -d '{"decision":"APPROVED"}' > /dev/null
  else
    echo "  Tech review returned ${TECH_CODE} (linkedProjectId gap) — skipping CEO decision for messaging prereq"
    echo "  Messaging tests still run — connect/NDA don't require TECH_APPROVED"
  fi

  curl -s -X POST "${BASE_URL}/engagements/${ENG_ID}/connect" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" > /dev/null
  curl -s -X PUT "${BASE_URL}/engagements/${ENG_ID}/accept-nda" -H "Content-Type: application/json" "${CEO_AUTH[@]}" > /dev/null
  echo "  Engagement ${ENG_ID} CONNECTED. Project: ${PROJECT_ID}"
else
  echo -e "  \033[1;33m⚠\033[0m No project published — messaging tests will use empty/null IDs (graceful skip)"
fi

if [ -z "${PROJECT_ID:-}" ] || [ "$PROJECT_ID" = "null" ] || [ -z "${ENG_ID:-}" ] || [ "$ENG_ID" = "null" ]; then
  echo ""
  echo -e "  \033[1;33m⚠\033[0m Messaging tests SKIPPED — no CONNECTED engagement available"
  echo -e "       The Expert was registered with domain A DEEP + seam A↔C."
  echo -e "       If gate still fails (score=0.85 but candidatesOk=false), the ai-service"
  echo -e "       /llm/matching call may have thrown an exception (caught silently in runSynthesis)."
  echo -e "       Check ai-service logs for matching errors."
  print_summary "MF-18"
fi

# ── Step 1: Project messages (pre-bid Q&A) ──
step_header "GET /projects/:id/messages — pre-bid Q&A thread (may be empty)"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/projects/${PROJECT_ID}/messages" "${CEO_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Project messages thread readable"

# ── Step 2: Engagement messages ──
step_header "GET /engagements/:id/messages — engagement chat history"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/engagements/${ENG_ID}/messages" "${CEO_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Engagement messages readable"
# If any messages exist, test read
MSG_ID=$(echo "$BODY" | jq -r '.[0].id // empty')

step_header "GET /engagements/:id/messages — Expert reads same thread"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/engagements/${ENG_ID}/messages" "${EXPERT_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Expert can read engagement messages"

# ── Step 3: Unread count ──
step_header "GET /engagements/:id/messages/unread-count — CEO unread count"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/engagements/${ENG_ID}/messages/unread-count" "${CEO_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Unread count readable"
check_field_present "$BODY" ".unread_count" "unread_count field present"

# ── Step 4: Mark message as read ──
if [ -n "${MSG_ID:-}" ] && [ "$MSG_ID" != "null" ]; then
  step_header "POST /messages/:id/read — mark message as read"
  RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/messages/${MSG_ID}/read" \
    -H "Content-Type: application/json" "${CEO_AUTH[@]}")
  CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
  print_body "$BODY"
  check_status "200" "$CODE" "Message marked as read"
else
  echo ""
  echo -e "  \033[1;33m⚠\033[0m No messages in thread yet (WebSocket sends them) — mark-read test skipped"
  echo "  Note: WebSocket events (joinRoom, sendMessage) are not testable via cURL."
  echo "  Use wscat or the frontend UI to verify real-time push events."
fi

step_header "GET /engagements/:id/messages/unread-count — unread count after mark-read (should be 0)"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/engagements/${ENG_ID}/messages/unread-count" "${CEO_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Unread count still readable after mark-read"

print_summary "MF-18"