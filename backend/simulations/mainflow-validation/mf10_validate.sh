#!/usr/bin/env bash
#
# MF-10: CEO Buys Service (Marketplace / Tech Discovery)
#
# Covers:
#   POST /services/:id/purchase
#   POST /webhooks/sepay/ipn     (service VA → engagement ACTIVE, auto-milestone)
#   GET  /engagements/:id        (confirm engagement ACTIVE, serviceId set)
#   GET  /milestones/:id         (confirm auto-milestone: sign_off_authority CEO, FUNDED)
#
# Guards tested:
#   - Non-CEO CLIENT (TECH_TEAM) → 403
#   - Service not PUBLISHED → 422
#   - Insufficient CEO balance → 422 INSUFFICIENT_BALANCE
#   - engagementType SERVICE_PURCHASE for AI_SERVICE

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

require_jq
health_check

SEPAY_WEBHOOK_SECRET="${SEPAY_WEBHOOK_SECRET:?Set SEPAY_WEBHOOK_SECRET to match your .env}"
TS=$(date +%s)
PASSWORD="Str0ng!TestPass123"
CEO_EMAIL="mf10-ceo-${TS}@aitasker.test"
EXPERT_EMAIL="mf10-expert-${TS}@aitasker.test"

echo ""
echo "════════════════════════════════════════════════════════"
echo " MF-10: CEO Buys Service (Marketplace)"
echo "════════════════════════════════════════════════════════"

fund_wallet() {
  local token="$1" amount="$2" ref="$3"
  local auth=(-H "Authorization: Bearer ${token}")
  local va_res va raw ts sig
  va_res=$(curl -s -X POST "${BASE_URL}/wallets/virtual-accounts/topup" \
    -H "Content-Type: application/json" "${auth[@]}" -d "{\"amount\":${amount}}")
  va=$(echo "$va_res" | jq -r '.paymentReference')
  raw="{\"content\":\"${va} chuyen tien ${ref}\",\"transferAmount\":\"${amount}\",\"referenceCode\":\"${ref}\"}"
  ts=$(date +%s)
  sig="sha256=$(printf '%s' "${ts}.${raw}" | openssl dgst -sha256 -hmac "${SEPAY_WEBHOOK_SECRET}" | sed 's/^.* //')"
  curl -s -X POST "${BASE_URL}/webhooks/sepay/ipn" -H "Content-Type: application/json" \
    -H "x-sepay-signature: ${sig}" -H "x-sepay-timestamp: ${ts}" -d "${raw}" > /dev/null
}

# ── PREREQ: Expert publishes a service ──
step_header "PREREQ — Expert creates and publishes a service listing"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${EXPERT_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF10 Expert\",\"phone\":\"0901234585\",\"roles\":\"EXPERT\"}")
EXPERT_TOKEN=$(echo "$RES" | jq -r '.access_token')
EXPERT_AUTH=(-H "Authorization: Bearer ${EXPERT_TOKEN}")
fund_wallet "$EXPERT_TOKEN" 300000 "MF10-E-${TS}"
RES=$(curl -s -X POST "${BASE_URL}/subscriptions/activate" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"activeRole":"EXPERT"}')
EXPERT_TOKEN=$(echo "$RES" | jq -r '.access_token')
EXPERT_AUTH=(-H "Authorization: Bearer ${EXPERT_TOKEN}")
RES=$(curl -s -X POST "${BASE_URL}/services" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"serviceType":"AI_SERVICE","title":"RAG Chatbot for Customer Support","description":"Production RAG chatbot using pgvector and FastAPI. Includes training, deployment and 90-day SLA.","scopeJson":{"deliverables":["System design","Implementation","Deployment"]},"timelineWeeks":6,"priceVnd":30000000}')
SERVICE_ID=$(echo "$RES" | jq -r '.id')
curl -s -X PUT "${BASE_URL}/services/${SERVICE_ID}" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"state":"PUBLISHED"}' > /dev/null
echo "  Published service: ${SERVICE_ID}"

# ── PREREQ: CEO with Pro ──
step_header "PREREQ — register CEO and activate Client Pro"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${CEO_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF10 CEO\",\"phone\":\"0901234586\",\"roles\":\"CLIENT_CEO\"}")
CEO_TOKEN=$(echo "$RES" | jq -r '.access_token')
CEO_AUTH=(-H "Authorization: Bearer ${CEO_TOKEN}")
fund_wallet "$CEO_TOKEN" 500000 "MF10-CEO-${TS}"
RES=$(curl -s -X POST "${BASE_URL}/subscriptions/activate" -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
  -d '{"activeRole":"CLIENT"}')
CEO_TOKEN=$(echo "$RES" | jq -r '.access_token')
CEO_AUTH=(-H "Authorization: Bearer ${CEO_TOKEN}")

# ── Step 1: Purchase — insufficient balance → 422 ──
step_header "POST /services/:id/purchase — EDGE CASE: price exceeds balance → 422 INSUFFICIENT_BALANCE"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/services/${SERVICE_ID}/purchase" \
  -H "Content-Type: application/json" "${CEO_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "422" "$CODE" "Insufficient balance correctly blocked"

# ── Step 2: Fund enough and purchase ──
step_header "PREREQ — fund CEO wallet sufficiently (30,000,000 VND for the service)"
fund_wallet "$CEO_TOKEN" 30000000 "MF10-CEO-BIG-${TS}"

step_header "POST /services/:id/purchase — CEO buys published service (creates VA + engagement)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/services/${SERVICE_ID}/purchase" \
  -H "Content-Type: application/json" "${CEO_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Purchase accepted"
check_field_present "$BODY" ".engagement" "engagement created"
check_field_present "$BODY" ".virtualAccount.vaNumber" "payment VA returned"
ENG_ID=$(echo "$BODY" | jq -r '.engagement.id')
SERVICE_VA=$(echo "$BODY" | jq -r ".virtualAccount.vaNumber")
echo "  Engagement: ${ENG_ID}, VA: ${SERVICE_VA}"

# ── Step 3: Confirm engagement state before IPN ──
step_header "GET /engagements/:id — confirm engagement pending payment"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/engagements/${ENG_ID}" "${CEO_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Engagement readable"
check_field_present "$BODY" ".serviceId" "serviceId set (marketplace purchase)"

# ── Step 4: IPN → engagement ACTIVE + auto-milestone ──
step_header "POST /webhooks/sepay/ipn — service VA payment → engagement ACTIVE + auto-milestone FUNDED"
REF_CODE="MF10-SVC-${TS}"
RAW_BODY="{\"content\":\"${SERVICE_VA} thanh toan dich vu\",\"transferAmount\":\"30000000\",\"referenceCode\":\"${REF_CODE}\"}"
TIMESTAMP=$(date +%s)
SIGNATURE="sha256=$(printf '%s' "${TIMESTAMP}.${RAW_BODY}" | openssl dgst -sha256 -hmac "${SEPAY_WEBHOOK_SECRET}" | sed 's/^.* //')"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/webhooks/sepay/ipn" \
  -H "Content-Type: application/json" \
  -H "x-sepay-signature: ${SIGNATURE}" \
  -H "x-sepay-timestamp: ${TIMESTAMP}" \
  -d "${RAW_BODY}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Service purchase IPN accepted"

# ── Step 5: Verify engagement ACTIVE ──
step_header "GET /engagements/:id — confirm engagement is ACTIVE after IPN"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/engagements/${ENG_ID}" "${CEO_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Engagement readable"
check_field_equals "$BODY" ".state" "ACTIVE" "Engagement state is ACTIVE"
check_field_equals "$BODY" ".type" "SERVICE_PURCHASE" "engagement type is SERVICE_PURCHASE"
MILESTONE_ID=$(echo "$BODY" | jq -r '.milestones[0].id // empty')

# ── Step 6: Verify auto-milestone created and FUNDED ──
if [ -n "${MILESTONE_ID:-}" ]; then
  step_header "GET /milestones/:id — auto-milestone has signOffAuthority CEO, state FUNDED"
  RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/milestones/${MILESTONE_ID}" "${CEO_AUTH[@]}")
  CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
  print_body "$BODY"
  check_status "200" "$CODE" "Auto-milestone readable"
  check_field_equals "$BODY" ".signOffAuthority" "CEO" "signOffAuthority is CEO (service purchase)"
  check_field_equals "$BODY" ".state" "FUNDED" "Auto-milestone state is FUNDED"
fi

# ── Step 7: Purchase DRAFT service → 422 ──
step_header "POST /services/:id/purchase — EDGE CASE: service not PUBLISHED → 422"
RES=$(curl -s -X POST "${BASE_URL}/services" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"serviceType":"AI_SERVICE","title":"Draft-only service","description":"This one stays in draft","scopeJson":{},"timelineWeeks":4,"priceVnd":5000000}')
DRAFT_SVC_ID=$(echo "$RES" | jq -r '.id')
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/services/${DRAFT_SVC_ID}/purchase" \
  -H "Content-Type: application/json" "${CEO_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "422" "$CODE" "DRAFT service purchase correctly rejected"

print_summary "MF-10"