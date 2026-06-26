#!/usr/bin/env bash
# backend/simulations/mainflow-validation/mf16_validate.sh
#
# Validates MF-16 (Expert Portfolio Tier 2 Auto-Upgrade). MF-2's script
# already exercises one submission/outcome as a downstream check; this
# script targets the REJECTED path and the 5-attempt lockout threshold
# specifically — neither exercised anywhere this session. Whether any
# given submission is APPROVED or REJECTED depends on a real ai-service
# judgment this script can't control, so both outcomes are handled
# explicitly, same discipline as MF-8's dispute script.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

require_jq
health_check

SEPAY_WEBHOOK_SECRET="${SEPAY_WEBHOOK_SECRET:?Set SEPAY_WEBHOOK_SECRET to match your .env}"
PASSWORD="Str0ng!TestPass123"

echo ""
echo "════════════════════════════════════════════════════════"
echo " MF-16: Expert Portfolio Tier 2 Auto-Upgrade"
echo "════════════════════════════════════════════════════════"

step_header "PREREQ — register expert, claim a seam, activate Expert Pro"
EMAIL="mf16-expert-$(date +%s)@aitasker.test"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF16 Test Expert\",\"phone\":\"0901234585\",\"roles\":\"EXPERT\"}")
TOKEN=$(echo "$RES" | jq -r '.access_token')
AUTH=(-H "Authorization: Bearer ${TOKEN}")
RES=$(curl -s -X POST "${BASE_URL}/expert-profile/seams" -H "Content-Type: application/json" "${AUTH[@]}" -d '{"seamCode":"A↔C"}')
SEAM_CLAIM_ID=$(echo "$RES" | jq -r '.id')
RES=$(curl -s -X POST "${BASE_URL}/wallets/virtual-accounts/topup" -H "Content-Type: application/json" "${AUTH[@]}" -d '{"amount":300000}')
VA_NUMBER=$(echo "$RES" | jq -r '.paymentReference')
REF_CODE="MF16-FUND-$(date +%s)"
RAW_BODY="{\"content\":\"${VA_NUMBER} chuyen tien mf16\",\"transferAmount\":\"300000\",\"referenceCode\":\"${REF_CODE}\"}"
TIMESTAMP=$(date +%s)
SIGNATURE="sha256=$(printf '%s' "${TIMESTAMP}.${RAW_BODY}" | openssl dgst -sha256 -hmac "${SEPAY_WEBHOOK_SECRET}" | sed 's/^.* //')"
curl -s -X POST "${BASE_URL}/webhooks/sepay/ipn" -H "Content-Type: application/json" \
  -H "x-sepay-signature: ${SIGNATURE}" -H "x-sepay-timestamp: ${TIMESTAMP}" -d "${RAW_BODY}" > /dev/null
RES=$(curl -s -X POST "${BASE_URL}/subscriptions/activate" -H "Content-Type: application/json" "${AUTH[@]}" -d '{"activeRole":"EXPERT"}')
TOKEN=$(echo "$RES" | jq -r '.access_token')
AUTH=(-H "Authorization: Bearer ${TOKEN}")
echo "  Expert ready: seam A<->C claimed (Tier 1), Pro active."

# ── A genuinely weak submission, deliberately, to test the REJECTED path ─

step_header "POST /portfolio-submissions — a deliberately thin, vague submission (step 3-4, expect REJECTED)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/portfolio-submissions" -H "Content-Type: application/json" "${AUTH[@]}" \
  -d "{\"seamClaimId\":\"${SEAM_CLAIM_ID}\",\"projectDescription\":\"$(printf 'I worked on a project once. %.0s' {1..3})\",\"decisionPoints\":\"$(printf 'I made some choices. %.0s' {1..2})\"}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Submission accepted for evaluation (the SUBMISSION itself, not the verdict, is what's being accepted)"
STATUS=$(echo "$BODY" | jq -r '.status')
echo "  Evaluation outcome: ${STATUS}"

if [ "$STATUS" = "REJECTED" ]; then
  check_field_present "$BODY" ".advisoryNote" "advisoryNote (gap_advisory) present on rejection"

  step_header "GET /expert-profile/me — confirm submissionCount incremented, seam still CLAIMED (not upgraded)"
  RES=$(curl -s "${BASE_URL}/expert-profile/me" "${AUTH[@]}")
  print_body "$RES"
  SEAM_TIER=$(echo "$RES" | jq -r ".seamClaims[] | select(.id==\"${SEAM_CLAIM_ID}\") | .verificationTier")
  SUBMISSION_COUNT=$(echo "$RES" | jq -r ".seamClaims[] | select(.id==\"${SEAM_CLAIM_ID}\") | .submissionCount")
  if [ "$SEAM_TIER" = "CLAIMED" ]; then
    echo -e "  \033[0;32m✓\033[0m verificationTier still CLAIMED, not upgraded — correct for a rejection"
    PASS=$((PASS + 1))
  else
    echo -e "  \033[0;31m✗\033[0m verificationTier is ${SEAM_TIER} — should still be CLAIMED after a rejection"
    FAIL=$((FAIL + 1))
  fi
  echo "  submissionCount is now: ${SUBMISSION_COUNT}"

elif [ "$STATUS" = "APPROVED" ]; then
  echo -e "  \033[1;33m⚠\033[0m The deliberately-thin submission was approved anyway — ai-service judged it"
  echo "  differently than expected. Not necessarily a bug (LLM judgment, not"
  echo "  this script's call), but worth a manual look if this is unexpected."
  check_field_present "$BODY" ".evaluationTierUpgraded" "evaluationTierUpgraded present"
else
  echo -e "  \033[0;31m✗\033[0m Unexpected status: ${STATUS}"
  FAIL=$((FAIL + 1))
fi

# ── Throttle/lockout: only meaningful to test if we're tracking the REAL count ──

step_header "Re-check submission count via a second weak attempt — confirms the throttle counter is live, not a one-shot"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/portfolio-submissions" -H "Content-Type: application/json" "${AUTH[@]}" \
  -d "{\"seamClaimId\":\"${SEAM_CLAIM_ID}\",\"projectDescription\":\"$(printf 'I worked on a project once. %.0s' {1..3})\",\"decisionPoints\":\"$(printf 'I made some choices. %.0s' {1..2})\"}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
STATUS2=$(echo "$BODY" | jq -r '.status')
if [ "$CODE" = "201" ]; then
  check_status "201" "$CODE" "Second submission also accepted (still within the 5-attempt limit)"
elif [ "$CODE" = "422" ]; then
  echo -e "  \033[1;33m⚠\033[0m 422 — likely ALREADY_VERIFIED_OR_HIGHER if the first attempt above was unexpectedly APPROVED. Consistent with the branch taken above, not a new issue."
else
  check_status "201" "$CODE" "Second submission accepted"
fi

# ── OPT-IN: drive all the way to the 5-attempt lockout boundary ─────────
# Skipped by default — needs 3 more real ai-service round-trips on top of
# the 2 already made above, genuinely slow. Set RUN_LOCKOUT_TEST=1 to
# include it. Cannot verify the exact 30-day locked_until duration from
# outside (no DB access from this script), but CAN verify the 429 itself
# actually triggers on the 6th attempt, which neither prior script does.
if [ "${RUN_LOCKOUT_TEST:-0}" = "1" ] && [ "$STATUS" != "APPROVED" ] && [ "$STATUS2" != "APPROVED" ]; then
  step_header "RUN_LOCKOUT_TEST=1 — driving 3 more attempts to reach the 5-attempt threshold"
  for i in 3 4 5; do
    RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/portfolio-submissions" -H "Content-Type: application/json" "${AUTH[@]}" \
      -d "{\"seamClaimId\":\"${SEAM_CLAIM_ID}\",\"projectDescription\":\"$(printf 'I worked on a project once. %.0s' {1..3})\",\"decisionPoints\":\"$(printf 'I made some choices. %.0s' {1..2})\"}")
    CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
    echo "  Attempt ${i}: HTTP ${CODE}, status=$(echo "$BODY" | jq -r '.status // .message' 2>/dev/null)"
    if [ "$CODE" != "201" ]; then
      echo -e "  \033[1;33m⚠\033[0m Stopped early at attempt ${i} (HTTP ${CODE}) — an APPROVED outcome along the way would explain this, check the printed status above."
      break
    fi
  done

  step_header "POST /portfolio-submissions — 6th attempt, expect 429 TOO_MANY_ATTEMPTS"
  RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/portfolio-submissions" -H "Content-Type: application/json" "${AUTH[@]}" \
    -d "{\"seamClaimId\":\"${SEAM_CLAIM_ID}\",\"projectDescription\":\"$(printf 'I worked on a project once. %.0s' {1..3})\",\"decisionPoints\":\"$(printf 'I made some choices. %.0s' {1..2})\"}")
  CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
  print_body "$BODY"
  check_status "429" "$CODE" "6th attempt correctly locked out"
  check_field_present "$BODY" ".lockedUntil" "lockedUntil present in the error response"
elif [ "${RUN_LOCKOUT_TEST:-0}" = "1" ]; then
  echo -e "  \033[1;33m⚠\033[0m Skipping the lockout drive — an earlier attempt was APPROVED, so the seam is already past CLAIMED and the throttle logic no longer applies to it."
fi

print_summary "MF-16"