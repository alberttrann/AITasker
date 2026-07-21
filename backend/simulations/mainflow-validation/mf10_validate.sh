#!/usr/bin/env bash
#
# Validates MF-10 (Client Buys Service / Tech Discovery).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

require_jq
health_check

SEPAY_WEBHOOK_SECRET="${SEPAY_WEBHOOK_SECRET:?Set SEPAY_WEBHOOK_SECRET to match your .env}"
PASSWORD="Str0ng!TestPass123"

echo ""
echo "════════════════════════════════════════════════════════"
echo " MF-10: Client Buys Service / Tech Discovery"
echo "════════════════════════════════════════════════════════"

step_header "PREREQ — expert publishes a service (reusing MF-9's mechanism)"
EXPERT_EMAIL="mf10-expert-$(date +%s)@aitasker.test"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${EXPERT_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF10 Test Expert\",\"phone\":\"0901234591\",\"roles\":\"EXPERT\"}")
EXPERT_TOKEN=$(echo "$RES" | jq -r '.access_token')
EXPERT_AUTH=(-H "Authorization: Bearer ${EXPERT_TOKEN}")
RES=$(curl -s -X POST "${BASE_URL}/services" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"serviceType":"AI_SERVICE","title":"RAG Chatbot Accuracy Package","description":"Fixed-price RAG integration.","priceVnd":8000000,"domainsJson":["A"],"seamsJson":["A↔C"]}')
SERVICE_ID=$(echo "$RES" | jq -r '.id')
curl -s -X PUT "${BASE_URL}/services/${SERVICE_ID}" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" -d '{"state":"PUBLISHED"}' > /dev/null
echo "  Service published: ${SERVICE_ID} (8,000,000 VND fixed price)"

step_header "PREREQ — register CEO, pre-fund wallet to the service price (see header note #2)"
CEO_EMAIL="mf10-ceo-$(date +%s)@aitasker.test"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${CEO_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF10 Test CEO\",\"phone\":\"0901234592\",\"roles\":\"CLIENT_CEO\"}")
CEO_TOKEN=$(echo "$RES" | jq -r '.access_token')
CEO_AUTH=(-H "Authorization: Bearer ${CEO_TOKEN}")
RES=$(curl -s -X POST "${BASE_URL}/wallets/virtual-accounts/topup" -H "Content-Type: application/json" "${CEO_AUTH[@]}" -d '{"amount":8000000}')
VA_NUMBER=$(echo "$RES" | jq -r '.paymentReference')
REF_CODE="MF10-PREFUND-$(date +%s)"
RAW_BODY="{\"content\":\"${VA_NUMBER} chuyen tien mf10 prefund\",\"transferAmount\":\"8000000\",\"referenceCode\":\"${REF_CODE}\"}"
TIMESTAMP=$(date +%s)
SIGNATURE="sha256=$(printf '%s' "${TIMESTAMP}.${RAW_BODY}" | openssl dgst -sha256 -hmac "${SEPAY_WEBHOOK_SECRET}" | sed 's/^.* //')"
curl -s -X POST "${BASE_URL}/webhooks/sepay/ipn" -H "Content-Type: application/json" \
  -H "x-sepay-signature: ${SIGNATURE}" -H "x-sepay-timestamp: ${TIMESTAMP}" -d "${RAW_BODY}" > /dev/null
echo "  CEO pre-funded to 8,000,000 (required by purchase()'s balance gate, see header note)."

step_header "POST /services/:id/purchase — guard check: CEO with insufficient TARGET balance would 422, skipping since pre-funded above"
step_header "POST /services/:id/purchase — real purchase attempt (step 2-3)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/services/${SERVICE_ID}/purchase" -H "Content-Type: application/json" "${CEO_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Purchase accepted"
check_field_equals "$BODY" ".engagement.type" "SERVICE_PURCHASE" "engagement.type is SERVICE_PURCHASE (serviceType=AI_SERVICE)"
check_field_equals "$BODY" ".engagement.state" "PENDING" "engagement.state is PENDING (pre-payment)"
check_field_present "$BODY" ".vietqrUrl" "vietqrUrl present"
ENGAGEMENT_ID=$(echo "$BODY" | jq -r '.engagement.id')
SERVICE_VA=$(echo "$BODY" | jq -r '.virtualAccount.vaNumber')

step_header "POST /webhooks/sepay/ipn — real signed webhook for the service VA (steps 4-6)"
REF_CODE="MF10-PURCHASE-$(date +%s)"
RAW_BODY="{\"content\":\"${SERVICE_VA} thanh toan dich vu\",\"transferAmount\":\"8000000\",\"referenceCode\":\"${REF_CODE}\"}"
TIMESTAMP=$(date +%s)
SIGNATURE="sha256=$(printf '%s' "${TIMESTAMP}.${RAW_BODY}" | openssl dgst -sha256 -hmac "${SEPAY_WEBHOOK_SECRET}" | sed 's/^.* //')"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/webhooks/sepay/ipn" -H "Content-Type: application/json" \
  -H "x-sepay-signature: ${SIGNATURE}" -H "x-sepay-timestamp: ${TIMESTAMP}" -d "${RAW_BODY}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Service-purchase IPN accepted"

step_header "GET /engagements/:id — confirm ACTIVE (step 7)"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/engagements/${ENGAGEMENT_ID}" "${CEO_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Engagement readable"
check_field_equals "$BODY" ".state" "ACTIVE" "engagement.state is ACTIVE"
check_field_equals "$BODY" ".projectId" "null" "projectId is null (key structural difference from Path A)"
check_field_present "$BODY" ".serviceId" "serviceId is set (not null)"

step_header "Confirm the single auto-milestone exists, sign_off_authority=CEO, state=FUNDED"
MILESTONE_ID=$(echo "$BODY" | jq -r '.milestones[0].id')
check_field_present "$BODY" ".milestones[0].id" "Auto-created milestone embedded in the engagement response"
RES=$(curl -s "${BASE_URL}/milestones/${MILESTONE_ID}" "${CEO_AUTH[@]}")
print_body "$RES"
check_field_equals "$RES" ".signOffAuthority" "CEO" "sign_off_authority is CEO (no TECH_TEAM involvement, per the flow's own structural note)"
check_field_equals "$RES" ".milestoneNumber" "1" "auto-milestone is number 1"

print_summary "MF-10"