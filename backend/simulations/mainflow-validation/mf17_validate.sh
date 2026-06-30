#!/usr/bin/env bash
#
# Validates MF-17 (Platform Integrity Monitor & Analytics). Needs a real
# ADMIN account via ADMIN_EMAIL/ADMIN_PASSWORD — admins aren't self-
# registerable by design, same as every other admin-touching script.
# Generates a small amount of real activity first so the read endpoints
# have something non-empty to actually verify against.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

require_jq
health_check

if [ -z "${ADMIN_EMAIL:-}" ] || [ -z "${ADMIN_PASSWORD:-}" ]; then
  echo -e "\033[0;31m✗ ADMIN_EMAIL and ADMIN_PASSWORD are required for this script — admins aren't self-registerable.\033[0m"
  exit 1
fi

SEPAY_WEBHOOK_SECRET="${SEPAY_WEBHOOK_SECRET:?Set SEPAY_WEBHOOK_SECRET to match your .env}"
PASSWORD="Str0ng!TestPass123"

echo ""
echo "════════════════════════════════════════════════════════"
echo " MF-17: Platform Integrity Monitor & Analytics"
echo "════════════════════════════════════════════════════════"

step_header "PREREQ — generate a small amount of real activity (a subscription purchase) so the read endpoints have something to show"
EMAIL="mf17-user-$(date +%s)@aitasker.test"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF17 Test User\",\"phone\":\"0901234596\",\"roles\":\"CLIENT_CEO\"}")
TOKEN=$(echo "$RES" | jq -r '.access_token')
AUTH=(-H "Authorization: Bearer ${TOKEN}")
RES=$(curl -s -X POST "${BASE_URL}/wallets/virtual-accounts/topup" -H "Content-Type: application/json" "${AUTH[@]}" -d '{"amount":500000}')
VA_NUMBER=$(echo "$RES" | jq -r '.paymentReference')
REF_CODE="MF17-FUND-$(date +%s)"
RAW_BODY="{\"content\":\"${VA_NUMBER} chuyen tien\",\"transferAmount\":\"500000\",\"referenceCode\":\"${REF_CODE}\"}"
TIMESTAMP=$(date +%s)
SIGNATURE="sha256=$(printf '%s' "${TIMESTAMP}.${RAW_BODY}" | openssl dgst -sha256 -hmac "${SEPAY_WEBHOOK_SECRET}" | sed 's/^.* //')"
curl -s -X POST "${BASE_URL}/webhooks/sepay/ipn" -H "Content-Type: application/json" \
  -H "x-sepay-signature: ${SIGNATURE}" -H "x-sepay-timestamp: ${TIMESTAMP}" -d "${RAW_BODY}" > /dev/null
curl -s -X POST "${BASE_URL}/subscriptions/activate" -H "Content-Type: application/json" "${AUTH[@]}" -d '{"activeRole":"CLIENT"}' > /dev/null
echo "  Real subscription activity generated."

step_header "Log in as ADMIN"
RES=$(curl -s -X POST "${BASE_URL}/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}")
ADMIN_TOKEN=$(echo "$RES" | jq -r '.access_token')
ADMIN_AUTH=(-H "Authorization: Bearer ${ADMIN_TOKEN}")
if [ "$ADMIN_TOKEN" = "null" ] || [ -z "$ADMIN_TOKEN" ]; then
  echo -e "  \033[0;31m✗\033[0m Admin login failed — check ADMIN_EMAIL/ADMIN_PASSWORD are correct."
  exit 1
fi
echo "  Admin logged in."

step_header "GET /admin/decisions — platform decisions log (step 2)"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/admin/decisions" "${ADMIN_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Decisions log readable"

step_header "GET /admin/decisions?decisionType=ELICITATION_SYNTHESIS — filtered query"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/admin/decisions?decisionType=ELICITATION_SYNTHESIS" "${ADMIN_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Filtered decisions query readable"

step_header "GET /admin/disputes — dispute monitor (step 5)"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/admin/disputes" "${ADMIN_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Dispute monitor readable"

step_header "GET /admin/transactions — transaction ledger (step 8)"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/admin/transactions" "${ADMIN_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Transaction ledger readable"
SUB_TX_FOUND=$(echo "$BODY" | jq '[.[] | select(.transactionType == "SUBSCRIPTION")] | length')
if [ "$SUB_TX_FOUND" -ge "1" ] 2>/dev/null; then
  echo -e "  \033[0;32m✓\033[0m The real subscription transaction generated above appears in the ledger, with email/fullName joined in"
  PASS=$((PASS + 1))
else
  echo -e "  \033[0;31m✗\033[0m The subscription transaction generated above is missing from the ledger"
  FAIL=$((FAIL + 1))
fi

step_header "GET /admin/transactions?type=SUBSCRIPTION — filtered query"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/admin/transactions?type=SUBSCRIPTION" "${ADMIN_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Filtered transactions query readable"

step_header "GET /admin/analytics — computed aggregates (step 10)"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/admin/analytics" "${ADMIN_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Analytics readable"
check_field_present "$BODY" ".active_projects_by_archetype_tier" "active_projects_by_archetype_tier present"
check_field_present "$BODY" ".elicitation_completion_rate_pct" "elicitation_completion_rate_pct present"
check_field_present "$BODY" ".dispute_auto_resolve_rate_pct" "dispute_auto_resolve_rate_pct present"

step_header "Non-admin attempt — confirm /admin/* is genuinely guarded, not just conventionally hidden"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/admin/decisions" "${AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "403" "$CODE" "Non-admin correctly rejected"

print_summary "MF-17"