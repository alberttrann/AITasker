#!/usr/bin/env bash
#
# Validates MF-2 (Expert Registration, Profile & Tier 1->2 Verification)
# end-to-end against a REAL running backend.
#
# Usage: same as mf1_validate.sh — backend running, SEPAY_WEBHOOK_SECRET set.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

require_jq
health_check

SEPAY_WEBHOOK_SECRET="${SEPAY_WEBHOOK_SECRET:?Set SEPAY_WEBHOOK_SECRET to match your .env}"
EMAIL="mf2-expert-$(date +%s)@aitasker.test"
PASSWORD="Str0ng!TestPass123"

echo ""
echo "════════════════════════════════════════════════════════"
echo " MF-2: Expert Registration, Profile & Tier 1->2 Verification"
echo "════════════════════════════════════════════════════════"

# ── PHASE A: REGISTRATION (swimlane steps 1-3) ──────────────────────────

step_header "POST /auth/register — create EXPERT account"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF2 Test Expert\",\"phone\":\"0901234568\",\"roles\":\"EXPERT\"}")
CODE=$(echo "$RES" | tail -n1)
BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Register returns 201"
check_field_equals "$BODY" ".user.activeRole" "EXPERT" "user.activeRole"
TOKEN=$(echo "$BODY" | jq -r '.access_token')
AUTH=(-H "Authorization: Bearer ${TOKEN}")

# ── PHASE B: PROFILE BUILD (swimlane steps 4-10) ────────────────────────

step_header "POST /expert-profile/domains — declare Domain A at DEEP (Tier 1 CLAIMED)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/expert-profile/domains" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"domainCode":"A","depthLevel":"DEEP"}')
CODE=$(echo "$RES" | tail -n1)
BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Domain depth claim accepted"
check_field_equals "$BODY" ".verificationTier" "CLAIMED" "verificationTier is CLAIMED (Tier 1)"

step_header "POST /expert-profile/seams — claim seam A↔C (Tier 1 CLAIMED)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/expert-profile/seams" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"seamCode":"A↔C"}')
CODE=$(echo "$RES" | tail -n1)
BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Seam claim accepted"
check_field_equals "$BODY" ".verificationTier" "CLAIMED" "verificationTier is CLAIMED (Tier 1)"
SEAM_CLAIM_ID=$(echo "$BODY" | jq -r '.id')

step_header "PUT /expert-profile/me — set stack tags + engagement model"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/expert-profile/me" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"engagementModel":"MILESTONE","stackTagsJson":["Python","Kafka","Go"]}')
CODE=$(echo "$RES" | tail -n1)
BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Profile update accepted"

step_header "GET /expert-profile/me — confirm the full profile reflects everything above"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/expert-profile/me" "${AUTH[@]}")
CODE=$(echo "$RES" | tail -n1)
BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Profile read returns 200"
check_field_equals "$BODY" ".profile.engagementModel" "MILESTONE" "engagementModel persisted (nested under .profile in the real response)"

# ── PHASE C: TIER 2 VERIFICATION (swimlane steps 11-17) ─────────────────

step_header "POST /portfolio-submissions — attempt while still FREE tier, expect SubscriptionGuard rejection"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/portfolio-submissions" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d "{\"seamClaimId\":\"${SEAM_CLAIM_ID}\",\"projectDescription\":\"$(printf 'x%.0s' {1..60})\",\"decisionPoints\":\"$(printf 'y%.0s' {1..25})\"}")
CODE=$(echo "$RES" | tail -n1)
BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "403" "$CODE" "Rejected while free tier (SubscriptionGuard wired correctly)"

step_header "POST /wallets/virtual-accounts/topup — fund the expert's wallet"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/wallets/virtual-accounts/topup" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"amount":300000}')
CODE=$(echo "$RES" | tail -n1)
BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Topup-QR returns 201"
VA_NUMBER=$(echo "$BODY" | jq -r '.paymentReference')

step_header "POST /webhooks/sepay/ipn — fund the wallet for real"
REF_CODE="MF2-VALIDATE-$(date +%s)"
RAW_BODY="{\"content\":\"${VA_NUMBER} chuyen tien mf2 test\",\"transferAmount\":\"300000\",\"referenceCode\":\"${REF_CODE}\"}"
TIMESTAMP=$(date +%s)
SIGNATURE="sha256=$(printf '%s' "${TIMESTAMP}.${RAW_BODY}" | openssl dgst -sha256 -hmac "${SEPAY_WEBHOOK_SECRET}" | sed 's/^.* //')"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/webhooks/sepay/ipn" \
  -H "Content-Type: application/json" \
  -H "x-sepay-signature: ${SIGNATURE}" \
  -H "x-sepay-timestamp: ${TIMESTAMP}" \
  -d "${RAW_BODY}")
CODE=$(echo "$RES" | tail -n1)
BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "IPN accepted"

step_header "POST /subscriptions/activate — activate Expert Pro (300,000)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/subscriptions/activate" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"activeRole":"EXPERT"}')
CODE=$(echo "$RES" | tail -n1)
BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Expert Pro activation succeeds"
check_field_present "$BODY" ".access_token" "Fresh access_token reissued"
update_token_if_success "201" "$CODE" "$BODY"

step_header "POST /portfolio-submissions — retry now Pro, real ai-service call (may take a few seconds)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/portfolio-submissions" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d "{\"seamClaimId\":\"${SEAM_CLAIM_ID}\",\"projectDescription\":\"Built a production RAG pipeline for a 500-lawyer law firm handling case law retrieval and document summarisation at scale.\",\"decisionPoints\":\"Evaluated BERTScore vs ROUGE for output quality; chose BERTScore for low lexical overlap robustness; calibrated rejection threshold on 150 annotated pairs.\"}")
CODE=$(echo "$RES" | tail -n1)
BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Submission accepted and evaluated"
check_field_present "$BODY" ".llmConfidence" "llmConfidence present"
check_field_present "$BODY" ".status" "status present (APPROVED or REJECTED)"
SUBMISSION_ID=$(echo "$BODY" | jq -r '.id')

step_header "GET /portfolio-submissions/:id — confirm result is readable back"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/portfolio-submissions/${SUBMISSION_ID}" "${AUTH[@]}")
CODE=$(echo "$RES" | tail -n1)
BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Submission detail readable"

# ── PHASE D: BANK ACCOUNT LINK (swimlane steps 18-24) ───────────────────

step_header "POST /bank-hub/initiate-link — link bank account (confirmed workaround: direct form, no real SePay Hosted Link)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/bank-hub/initiate-link" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"bank_account_xid":"BANKXID12345","holder_name":"MF2 Test Expert"}')
CODE=$(echo "$RES" | tail -n1)
BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Bank link accepted"
check_field_equals "$BODY" ".success" "true" "Bank link reports success"

# ── MF-12 LOOP CLOSURE CHECK (per the resolved open question) ───────────

step_header "POST /withdrawals — confirm bank-link guard cleared (insufficient-balance is the EXPECTED outcome here)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/withdrawals" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"amount":2000}')
CODE=$(echo "$RES" | tail -n1)
BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
if [ "$CODE" = "201" ] || [ "$CODE" = "422" ]; then
  echo -e "  \033[0;32m✓\033[0m Bank-link guard cleared — got HTTP ${CODE} (201 funded or 422 insufficient balance, both prove the bank-account-required guard passed)"
  PASS=$((PASS + 1))
else
  echo -e "  \033[0;31m✗\033[0m Unexpected status ${CODE} — if this is the bank-account-required error, the link above didn't actually take"
  FAIL=$((FAIL + 1))
fi

step_header "GET /withdrawals — confirm the list reflects the above"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/withdrawals" "${AUTH[@]}")
CODE=$(echo "$RES" | tail -n1)
BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Withdrawal history readable"

print_summary "MF-2"