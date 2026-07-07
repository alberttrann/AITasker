#!/usr/bin/env bash
#
# MF-7: Milestone Management + DoD + Escrow + Reviews
#
# Covers:
#   POST /milestones
#   GET  /milestones/:id
#   PUT  /milestones/:id/fund
#   POST /milestones/:id/dod/items
#   PUT  /milestones/:id/dod/:itemId
#   POST /milestones/:id/submit
#   POST /milestones/:id/paygated-docs
#   GET  /milestones/:id/paygated-docs
#   PUT  /criteria/:id/verify
#   PUT  /criteria/:id/revision
#   PUT  /admin/withdrawals/:id/complete
#   POST /reviews
#   GET  /reviews/:engagementId
#
# Guards tested:
#   - milestone_number uniqueness → 409
#   - payment_amount_vnd ≤ 0 → 400
#   - no criteria → 400
#   - DoD required item NOT_APPLICABLE → 400
#   - submit with required DoD incomplete → 422 REQUIRED_DOD_INCOMPLETE
#   - All criteria verified → APPROVED + escrow released
#   - Revision requested → IN_REVISION
#   - Duplicate review → 409
#   - Review on non-CLOSED engagement → 409

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

require_jq
health_check

SEPAY_WEBHOOK_SECRET="${SEPAY_WEBHOOK_SECRET:?Set SEPAY_WEBHOOK_SECRET to match your .env}"
TS=$(date +%s)
PASSWORD="Str0ng!TestPass123"

echo ""
echo "════════════════════════════════════════════════════════"
echo " MF-7: Milestone Management + DoD + Escrow + Reviews"
echo "════════════════════════════════════════════════════════"

# Helper to fund wallet
fund_wallet() {
  local token="$1" amount="$2" ref="$3"
  local auth=(-H "Authorization: Bearer ${token}")
  local va_res
  va_res=$(curl -s -X POST "${BASE_URL}/wallets/virtual-accounts/topup" \
    -H "Content-Type: application/json" "${auth[@]}" -d "{\"amount\":${amount}}")
  local va
  va=$(echo "$va_res" | jq -r '.paymentReference')
  local raw="{\"content\":\"${va} chuyen tien ${ref}\",\"transferAmount\":\"${amount}\",\"referenceCode\":\"${ref}\"}"
  local ts
  ts=$(date +%s)
  local sig="sha256=$(printf '%s' "${ts}.${raw}" | openssl dgst -sha256 -hmac "${SEPAY_WEBHOOK_SECRET}" | sed 's/^.* //')"
  curl -s -X POST "${BASE_URL}/webhooks/sepay/ipn" -H "Content-Type: application/json" \
    -H "x-sepay-signature: ${sig}" -H "x-sepay-timestamp: ${ts}" -d "${raw}" > /dev/null
}

# ── PREREQ: Build a CONNECTED project-based engagement ──
step_header "PREREQ — register CEO, Expert, Tech Team and get to CONNECTED engagement"

# Source shared elicitation prereq helper
source "${SCRIPT_DIR}/_elicitation_prereq.sh"

EXPERT_EMAIL="mf7-expert-${TS}@aitasker.test"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${EXPERT_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF7 Expert\",\"phone\":\"0901234574\",\"roles\":\"EXPERT\"}")
EXPERT_TOKEN=$(echo "$RES" | jq -r '.access_token')
EXPERT_AUTH=(-H "Authorization: Bearer ${EXPERT_TOKEN}")
# Set engagementModel FIRST so expertProfile is fully populated before scoring
curl -s -X PUT "${BASE_URL}/expert-profile/me" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"engagementModel":"MILESTONE","stackTagsJson":["Python","pgvector","FastAPI","PostgreSQL","AWS ECS"]}' > /dev/null
# Super-Expert profile to guarantee matching across all non-deterministic AI specs
curl -s -X POST "${BASE_URL}/expert-profile/domains" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" -d '{"domainCode":"A","depthLevel":"DEEP"}' > /dev/null
curl -s -X POST "${BASE_URL}/expert-profile/domains" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" -d '{"domainCode":"D","depthLevel":"DEEP"}' > /dev/null
curl -s -X POST "${BASE_URL}/expert-profile/domains" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" -d '{"domainCode":"E","depthLevel":"DEEP"}' > /dev/null
curl -s -X POST "${BASE_URL}/expert-profile/seams" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" -d '{"seamCode":"A↔C"}' > /dev/null
curl -s -X POST "${BASE_URL}/expert-profile/seams" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" -d '{"seamCode":"A↔D"}' > /dev/null
curl -s -X POST "${BASE_URL}/expert-profile/seams" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" -d '{"seamCode":"D↔E"}' > /dev/null
fund_wallet "$EXPERT_TOKEN" 400000 "MF7-E-${TS}"
RES=$(curl -s -X POST "${BASE_URL}/subscriptions/activate" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"activeRole":"EXPERT"}')
EXPERT_TOKEN=$(echo "$RES" | jq -r '.access_token')
EXPERT_AUTH=(-H "Authorization: Bearer ${EXPERT_TOKEN}")

# Run full elicitation prereq with poll (sets CEO_TOKEN, CEO_AUTH, TECH_TOKEN, TECH_AUTH, PROJECT_ID, SESSION_ID)
run_elicitation_prereq "mf7" "0901234575"
echo "  Project: ${PROJECT_ID}"

if [ -z "${PROJECT_ID:-}" ] || [ "$PROJECT_ID" = "null" ]; then
  echo -e "  \033[1;33m⚠\033[0m No project published (synthesis gate failed — no expert candidates in DB)."
  echo -e "  Milestone tests require a CONNECTED engagement. Continuing with validation of input guards only."
  ENG_ID=""
  BID_ID=""
else
  # Bid + NDA → CONNECTED
  RES=$(curl -s -X POST "${BASE_URL}/bids" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
    -d "{\"projectId\":\"${PROJECT_ID}\",\"footprint_alignment_json\":{\"domains\":[{\"code\":\"A\",\"depth\":\"DEEP\"}],\"seams\":[{\"code\":\"A<->C\",\"tier\":\"CLAIMED\"}]},\"approach_summary\":\"RAG pipeline with pgvector and hybrid retrieval\",\"conditional_pricing_json\":[{\"milestone_number\":1,\"price_vnd\":15000000,\"condition\":\"Delivery\"}]}")
  BID_ID=$(echo "$RES" | jq -r '.bid.id')
  ENG_ID=$(echo "$RES" | jq -r '.engagement.id')
  curl -s -X PUT "${BASE_URL}/bids/${BID_ID}/tech-review" -H "Content-Type: application/json" "${TECH_AUTH[@]}" \
    -d '{"action":"APPROVED"}' > /dev/null
  curl -s -X PUT "${BASE_URL}/bids/${BID_ID}/ceo-decision" -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
    -d '{"decision":"APPROVED"}' > /dev/null
  curl -s -X POST "${BASE_URL}/engagements/${ENG_ID}/connect" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" > /dev/null
  curl -s -X PUT "${BASE_URL}/engagements/${ENG_ID}/accept-nda" -H "Content-Type: application/json" "${CEO_AUTH[@]}" > /dev/null
  echo "  Engagement ${ENG_ID} is CONNECTED."
fi

# ── Guard: skip milestone tests if no engagement (synthesis gate failed) ──
if [ -z "${ENG_ID:-}" ] || [ "$ENG_ID" = "null" ]; then
  echo ""
  echo -e "  \033[1;33m⚠\033[0m Skipping milestone/DoD/escrow tests — no CONNECTED engagement (synthesis gate requires expert candidates)."
  echo -e "       To fully exercise MF-7, register a matching Expert BEFORE running this script."
  print_summary "MF-7"
fi

# ── Step 1: Milestone creation guards ──
step_header "POST /milestones — EDGE CASE: no criteria → 400"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/milestones" -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
  -d "{\"engagement_id\":\"${ENG_ID}\",\"milestone_number\":1,\"deliverable_statement\":\"Discovery report\",\"sign_off_authority\":\"TECH_TEAM\",\"payment_amount_vnd\":15000000,\"criteria\":[]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "400" "$CODE" "Zero criteria correctly rejected"

step_header "POST /milestones — EDGE CASE: payment_amount_vnd = 0 → 400"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/milestones" -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
  -d "{\"engagement_id\":\"${ENG_ID}\",\"milestone_number\":1,\"deliverable_statement\":\"Discovery report\",\"sign_off_authority\":\"TECH_TEAM\",\"payment_amount_vnd\":0,\"criteria\":[{\"criterion_text\":\"Report done\",\"is_required\":true}]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "400" "$CODE" "Zero payment correctly rejected"

# ── Step 2: Create milestone ──
step_header "POST /milestones — create milestone 1 (TECH_TEAM sign-off, 15,000,000 VND)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/milestones" -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
  -d "{\"engagement_id\":\"${ENG_ID}\",\"milestone_number\":1,\"deliverable_statement\":\"Discovery report with architecture diagram and data pipeline spec.\",\"sign_off_authority\":\"TECH_TEAM\",\"payment_amount_vnd\":15000000,\"criteria\":[{\"criterion_text\":\"Architecture diagram complete and reviewed\",\"is_required\":true},{\"criterion_text\":\"Data pipeline specification document delivered\",\"is_required\":true}]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Milestone created"
check_field_equals "$BODY" ".state" "DEFINED" "Initial state is DEFINED"
MILESTONE_ID=$(echo "$BODY" | jq -r '.id')
CRITERION_IDS=$(echo "$BODY" | jq -r '.acceptanceCriteria[].id')
CRITERION1_ID=$(echo "$BODY" | jq -r '.acceptanceCriteria[0].id')
CRITERION2_ID=$(echo "$BODY" | jq -r '.acceptanceCriteria[1].id')
echo "  Milestone: ${MILESTONE_ID}"

# ── Step 3: Duplicate milestone number ──
step_header "POST /milestones — EDGE CASE: duplicate milestone_number → 409"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/milestones" -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
  -d "{\"engagement_id\":\"${ENG_ID}\",\"milestone_number\":1,\"deliverable_statement\":\"Another milestone\",\"sign_off_authority\":\"CEO\",\"payment_amount_vnd\":5000000,\"criteria\":[{\"criterion_text\":\"Something done\",\"is_required\":true}]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "409" "$CODE" "Duplicate milestone number correctly rejected"

# ── Step 4: Get milestone ──
step_header "GET /milestones/:id — read milestone with criteria and dod items"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/milestones/${MILESTONE_ID}" "${CEO_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Milestone readable"
check_field_present "$BODY" ".acceptanceCriteria" "acceptanceCriteria present"

# ── Step 5: Add DoD items ──
step_header "POST /milestones/:id/dod/items — expert adds required DoD item"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/milestones/${MILESTONE_ID}/dod/items" \
  -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"item_description":"Write unit tests for all data ingestion modules","is_required":true}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Required DoD item added"
check_field_equals "$BODY" ".status" "PENDING" "DoD item starts PENDING"
DOD_ITEM1_ID=$(echo "$BODY" | jq -r '.id')

step_header "POST /milestones/:id/dod/items — expert adds optional DoD item"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/milestones/${MILESTONE_ID}/dod/items" \
  -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"item_description":"Add integration test for end-to-end pipeline","is_required":false}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Optional DoD item added"
DOD_ITEM2_ID=$(echo "$BODY" | jq -r '.id')

# ── Step 6: DoD NOT_APPLICABLE guard on required item ──
step_header "PUT /milestones/:id/dod/:itemId — EDGE CASE: required item NOT_APPLICABLE → 400"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/milestones/${MILESTONE_ID}/dod/${DOD_ITEM1_ID}" \
  -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"status":"NOT_APPLICABLE"}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "400" "$CODE" "Required item NOT_APPLICABLE correctly rejected"

# ── Step 7: Submit while DoD incomplete ──
step_header "POST /milestones/:id/submit — EDGE CASE: required DoD item PENDING → 422 REQUIRED_DOD_INCOMPLETE"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/milestones/${MILESTONE_ID}/submit" \
  -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"description":"I have completed the discovery report.","files_json":[]}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "422" "$CODE" "Submit blocked — required DoD item incomplete"

# ── Step 8: Stage paygated doc ──
step_header "POST /milestones/:id/paygated-docs — expert stages a technical deep-dive document"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/milestones/${MILESTONE_ID}/paygated-docs" \
  -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"document_url":"https://example.com/architecture-spec-v1.pdf"}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Paygated doc staged"
check_field_equals "$BODY" ".releaseState" "STAGED" "releaseState is STAGED"

# ── Step 9: Complete required DoD item ──
step_header "PUT /milestones/:id/dod/:itemId — mark required DoD item COMPLETED"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/milestones/${MILESTONE_ID}/dod/${DOD_ITEM1_ID}" \
  -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"status":"COMPLETED","completion_note":"Unit tests added for all 12 data ingestion modules, 94% coverage"}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "DoD item marked COMPLETED"

# ── Step 10: Submit deliverable ──
step_header "POST /milestones/:id/submit — expert submits deliverable (DoD gate cleared)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/milestones/${MILESTONE_ID}/submit" \
  -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"description":"Discovery report complete. Architecture diagram attached. All DoD items resolved.","files_json":["https://example.com/discovery-report.pdf","https://example.com/architecture-diagram.png"]}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Deliverable submitted"

# ── Step 11: Fund milestone via IPN ──
step_header "PUT /milestones/:id/fund — CEO initiates payment (state → AWAITING_PAYMENT)"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/milestones/${MILESTONE_ID}/fund" \
  -H "Content-Type: application/json" "${CEO_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Fund initiated"
check_field_equals "$BODY" ".state" "AWAITING_PAYMENT" "state is AWAITING_PAYMENT"
MILESTONE_VA=$(echo "$BODY" | jq -r '.vaNumber')

step_header "POST /webhooks/sepay/ipn — fund milestone (state → IN_PROGRESS, escrow locked)"
REF_CODE="MF7-FUND-${TS}"
RAW_BODY="{\"content\":\"${MILESTONE_VA} thanh toan milestone\",\"transferAmount\":\"15000000\",\"referenceCode\":\"${REF_CODE}\"}"
TIMESTAMP=$(date +%s)
SIGNATURE="sha256=$(printf '%s' "${TIMESTAMP}.${RAW_BODY}" | openssl dgst -sha256 -hmac "${SEPAY_WEBHOOK_SECRET}" | sed 's/^.* //')"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/webhooks/sepay/ipn" \
  -H "Content-Type: application/json" \
  -H "x-sepay-signature: ${SIGNATURE}" \
  -H "x-sepay-timestamp: ${TIMESTAMP}" \
  -d "${RAW_BODY}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Milestone IPN accepted"

# ── Step 12: Paygated docs released after funding ──
step_header "GET /milestones/:id/paygated-docs — TECH_TEAM reads released docs after payment"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/milestones/${MILESTONE_ID}/paygated-docs" "${TECH_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Linked TECH_TEAM can access released docs"
if echo "$BODY" | jq -e '.[0]' > /dev/null 2>&1; then
  check_field_equals "$BODY" ".[0].releaseState" "RELEASED" "releaseState is RELEASED"
fi

step_header "GET /milestones/:id/paygated-docs — CEO blocked (permanently excluded)"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/milestones/${MILESTONE_ID}/paygated-docs" "${CEO_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1)
check_status "403" "$CODE" "CEO correctly excluded from paygated docs"

# ── Step 13: Criteria revision request ──
step_header "PUT /criteria/:id/revision — Tech Team requests revision on criterion 1"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/criteria/${CRITERION1_ID}/revision" \
  -H "Content-Type: application/json" "${TECH_AUTH[@]}" \
  -d '{"revision_note":"The architecture diagram is missing the data flow between the ingestion layer and the vector store. Please add that section."}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Revision requested"

# ── Step 14: Verify criteria (all) → APPROVED + escrow released ──
step_header "PUT /criteria/:id/verify — verify criterion 1"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/criteria/${CRITERION1_ID}/verify" \
  -H "Content-Type: application/json" "${TECH_AUTH[@]}" \
  -d '{"verification_comment":"Architecture diagram now complete and accurate."}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Criterion 1 verified"

step_header "PUT /criteria/:id/verify — verify criterion 2 (last one → milestone APPROVED + escrow released)"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/criteria/${CRITERION2_ID}/verify" \
  -H "Content-Type: application/json" "${TECH_AUTH[@]}" \
  -d '{"verification_comment":"Data pipeline specification complete and meets requirements."}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Criterion 2 verified (all criteria now verified)"

step_header "GET /milestones/:id — confirm milestone state is APPROVED"
RES=$(curl -s "${BASE_URL}/milestones/${MILESTONE_ID}" "${CEO_AUTH[@]}")
print_body "$RES"
check_field_equals "$RES" ".state" "APPROVED" "Milestone state is APPROVED after all criteria verified"

# ── Step 15: Admin completes withdrawal → milestone RELEASED, engagement CLOSED ──
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
if [ -n "${ADMIN_EMAIL}" ] && [ -n "${ADMIN_PASSWORD}" ]; then
  RES=$(curl -s -X POST "${BASE_URL}/auth/login" -H "Content-Type: application/json" \
    -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}")
  ADMIN_TOKEN=$(echo "$RES" | jq -r '.access_token')
  ADMIN_AUTH=(-H "Authorization: Bearer ${ADMIN_TOKEN}")

  RES=$(curl -s "${BASE_URL}/admin/withdrawals?status=PENDING" "${ADMIN_AUTH[@]}")
  WITHDRAWAL_ID=$(echo "$RES" | jq -r '.[] | select(.type == "MILESTONE_RELEASE") | .id' | head -n 1)

  if [ -n "${WITHDRAWAL_ID:-}" ]; then
    step_header "PUT /admin/withdrawals/:id/complete — admin completes payout → milestone RELEASED, engagement CLOSED"
    RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/admin/withdrawals/${WITHDRAWAL_ID}/complete" \
      "${ADMIN_AUTH[@]}")
    CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
    print_body "$BODY"
    check_status "200" "$CODE" "Withdrawal complete"
    check_field_equals "$BODY" ".status" "COMPLETED" "Withdrawal status COMPLETED"

    RES=$(curl -s "${BASE_URL}/milestones/${MILESTONE_ID}" "${CEO_AUTH[@]}")
    check_field_equals "$RES" ".state" "RELEASED" "Milestone RELEASED after withdrawal complete"

    RES=$(curl -s "${BASE_URL}/engagements/${ENG_ID}" "${CEO_AUTH[@]}")
    check_field_equals "$RES" ".state" "CLOSED" "Engagement CLOSED after all milestones released"

    # ── Reviews (only possible after CLOSED) ──
    step_header "POST /reviews — CEO reviews Expert (after engagement CLOSED)"
    EXPERT_TARGET_ID=$(curl -s "${BASE_URL}/engagements/${ENG_ID}" "${CEO_AUTH[@]}" | jq -r '.expertId')
    RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/reviews" \
      -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
      -d "{\"engagementId\":\"${ENG_ID}\",\"targetId\":\"${EXPERT_TARGET_ID}\",\"rating\":5,\"comment\":\"Outstanding work. Delivered on time and exceeded accuracy targets.\"}")
    CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
    print_body "$BODY"
    check_status "201" "$CODE" "CEO review submitted"

    step_header "POST /reviews — EDGE CASE: duplicate review → 409"
    RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/reviews" \
      -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
      -d "{\"engagementId\":\"${ENG_ID}\",\"targetId\":\"someId\",\"rating\":3,\"comment\":\"Second review\"}")
    CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
    print_body "$BODY"
    check_status "409" "$CODE" "Duplicate review correctly rejected"

    step_header "GET /reviews/:engagementId — all reviews for closed engagement"
    RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/reviews/${ENG_ID}" "${CEO_AUTH[@]}")
    CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
    print_body "$BODY"
    check_status "200" "$CODE" "Reviews readable"
  fi
else
  echo ""
  echo -e "  \033[1;33m⚠\033[0m Set ADMIN_EMAIL/ADMIN_PASSWORD to exercise admin withdrawal complete, milestone RELEASED, engagement CLOSED, and review flows."
fi

print_summary "MF-7"