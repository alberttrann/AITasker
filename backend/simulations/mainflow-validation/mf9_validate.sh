#!/usr/bin/env bash
#
# Validates MF-9 (Expert Service Publishing, AI Generator). IMPORTANT:
# there is no separate POST /services/generate endpoint — AI generation
# happens inside the SAME POST /services call via useAiGenerator:true.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

require_jq
health_check

SEPAY_WEBHOOK_SECRET="${SEPAY_WEBHOOK_SECRET:?Set SEPAY_WEBHOOK_SECRET to match your .env}"
PASSWORD="Str0ng!TestPass123"

echo ""
echo "════════════════════════════════════════════════════════"
echo " MF-9: Expert Service Publishing (AI Generator)"
echo "════════════════════════════════════════════════════════"

step_header "PREREQ — register expert, activate Expert Pro (guard: sub_expert_tier='pro', step 1)"
EMAIL="mf9-expert-$(date +%s)@aitasker.test"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF9 Test Expert\",\"phone\":\"0901234590\",\"roles\":\"EXPERT\"}")
TOKEN=$(echo "$RES" | jq -r '.access_token')
AUTH=(-H "Authorization: Bearer ${TOKEN}")
RES=$(curl -s -X POST "${BASE_URL}/wallets/virtual-accounts/topup" -H "Content-Type: application/json" "${AUTH[@]}" -d '{"amount":300000}')
VA_NUMBER=$(echo "$RES" | jq -r '.paymentReference')
REF_CODE="MF9-FUND-$(date +%s)"
RAW_BODY="{\"content\":\"${VA_NUMBER} chuyen tien mf9\",\"transferAmount\":\"300000\",\"referenceCode\":\"${REF_CODE}\"}"
TIMESTAMP=$(date +%s)
SIGNATURE="sha256=$(printf '%s' "${TIMESTAMP}.${RAW_BODY}" | openssl dgst -sha256 -hmac "${SEPAY_WEBHOOK_SECRET}" | sed 's/^.* //')"
curl -s -X POST "${BASE_URL}/webhooks/sepay/ipn" -H "Content-Type: application/json" \
  -H "x-sepay-signature: ${SIGNATURE}" -H "x-sepay-timestamp: ${TIMESTAMP}" -d "${RAW_BODY}" > /dev/null
RES=$(curl -s -X POST "${BASE_URL}/subscriptions/activate" -H "Content-Type: application/json" "${AUTH[@]}" -d '{"activeRole":"EXPERT"}')
TOKEN=$(echo "$RES" | jq -r '.access_token')
AUTH=(-H "Authorization: Bearer ${TOKEN}")
echo "  Expert ready, Pro active."

step_header "POST /services with useAiGenerator:true — real ai-service call (steps 3-6)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/services" -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{
    "serviceType":"AI_SERVICE",
    "domainsJson":["A"],
    "seamsJson":["A<->C"],
    "useAiGenerator":true,
    "capabilities":["RAG pipeline construction","Zendesk knowledge base integration","Confidence-based human escalation"],
    "targetUseCases":["Customer support chatbots needing accuracy improvements","Knowledge-base-grounded Q&A systems"]
  }' --max-time 60)
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Service created via AI generator"
check_field_equals "$BODY" ".state" "DRAFT" "service.state is DRAFT (step 6)"
check_field_equals "$BODY" ".serviceType" "AI_SERVICE" "serviceType persisted"
check_field_present "$BODY" ".title" "AI-generated title present (not manually supplied)"
check_field_present "$BODY" ".description" "AI-generated description present"
check_field_present "$BODY" ".scope" "AI-generated scope present (today's earlier scope/timeline fix)"
check_field_present "$BODY" ".timeline" "AI-generated timeline present (today's earlier scope/timeline fix)"
check_field_present "$BODY" ".priceVnd" "AI-suggested priceVnd present (no manual price supplied)"
SERVICE_ID=$(echo "$BODY" | jq -r '.id')

step_header "GET /services — confirm the DRAFT service does NOT yet appear in the public marketplace browse"
RES=$(curl -s "${BASE_URL}/services" "${AUTH[@]}")
print_body "$RES"
FOUND_AS_DRAFT=$(echo "$RES" | jq "[.[] | select(.id == \"${SERVICE_ID}\")] | length")
if [ "$FOUND_AS_DRAFT" = "0" ]; then
  echo -e "  \033[0;32m✓\033[0m DRAFT service correctly absent from the public browse list"
  PASS=$((PASS + 1))
else
  echo -e "  \033[0;31m✗\033[0m DRAFT service appeared in the public browse list — should be PUBLISHED-only"
  FAIL=$((FAIL + 1))
fi

step_header "PUT /services/:id {state: PUBLISHED} — publish (steps 7-8, same endpoint, no separate publish action)"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/services/${SERVICE_ID}" -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"state":"PUBLISHED"}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Publish accepted"
check_field_equals "$BODY" ".state" "PUBLISHED" "service.state is PUBLISHED"

step_header "GET /services — confirm the service NOW appears (step 9)"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/services" "${AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
check_status "200" "$CODE" "Marketplace browse readable"
FOUND_PUBLISHED=$(echo "$BODY" | jq "[.[] | select(.id == \"${SERVICE_ID}\")] | length")
if [ "$FOUND_PUBLISHED" -ge "1" ] 2>/dev/null; then
  echo -e "  \033[0;32m✓\033[0m PUBLISHED service now appears in the marketplace"
  PASS=$((PASS + 1))
else
  echo -e "  \033[0;31m✗\033[0m PUBLISHED service still missing from the marketplace browse list"
  FAIL=$((FAIL + 1))
fi

print_summary "MF-9"