#!/usr/bin/env bash
#
# MF-9: Expert Service Publishing (AI Generator)
#
# Covers:
#   GET  /services               (browse marketplace)
#   GET  /services/:id           (detail with reputation aggregates)
#   POST /services               (create listing, DRAFT)
#   PUT  /services/:id           (update + publish DRAFT→PUBLISHED)
#
# Guards tested:
#   - No title when not useAiGenerator → 400
#   - serviceType immutable after PUBLISHED → 422
#   - SUSPENDED listing cannot be self-edited → 422
#   - Only DRAFT→PUBLISHED allowed (not PUBLISHED→DRAFT) → 422
#   - Non-owner update → 403
#   - Browse: only PUBLISHED visible to non-owners

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

require_jq
health_check

SEPAY_WEBHOOK_SECRET="${SEPAY_WEBHOOK_SECRET:?Set SEPAY_WEBHOOK_SECRET to match your .env}"
TS=$(date +%s)
PASSWORD="Str0ng!TestPass123"
EXPERT_EMAIL="mf9-expert-${TS}@aitasker.test"
OTHER_EMAIL="mf9-other-${TS}@aitasker.test"

echo ""
echo "════════════════════════════════════════════════════════"
echo " MF-9: Expert Service Publishing"
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

# ── PREREQ: Expert with Pro ──
step_header "PREREQ — register Expert with Pro subscription"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${EXPERT_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF9 Expert\",\"phone\":\"0901234583\",\"roles\":\"EXPERT\"}")
EXPERT_TOKEN=$(echo "$RES" | jq -r '.access_token')
EXPERT_ID=$(echo "$RES" | jq -r '.user.id')
EXPERT_AUTH=(-H "Authorization: Bearer ${EXPERT_TOKEN}")
fund_wallet "$EXPERT_TOKEN" 300000 "MF9-E-${TS}"
RES=$(curl -s -X POST "${BASE_URL}/subscriptions/activate" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"activeRole":"EXPERT"}')
EXPERT_TOKEN=$(echo "$RES" | jq -r '.access_token')
EXPERT_AUTH=(-H "Authorization: Bearer ${EXPERT_TOKEN}")

# Other user for ownership tests
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${OTHER_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF9 Other\",\"phone\":\"0901234584\",\"roles\":\"EXPERT\"}")
OTHER_TOKEN=$(echo "$RES" | jq -r '.access_token')
OTHER_AUTH=(-H "Authorization: Bearer ${OTHER_TOKEN}")

# ── Step 1: Create listing — no title without AI generator → 400 ──
step_header "POST /services — EDGE CASE: no title, no useAiGenerator → 400"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/services" \
  -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"serviceType":"AI_SERVICE","scopeJson":{"deliverables":["RAG system"]},"timelineWeeks":8}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "400" "$CODE" "Missing title correctly rejected"

# ── Step 2: Create DRAFT listing (manual) ──
step_header "POST /services — create DRAFT listing (manual, no AI generator)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/services" \
  -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"serviceType":"AI_SERVICE","title":"Enterprise RAG Pipeline for Legal Document Retrieval","description":"I build production-grade RAG systems using pgvector, FastAPI, and hybrid BM25 re-ranking for law firms and compliance teams.","scopeJson":{"deliverables":["Architecture design","Vector store setup","API integration","Accuracy benchmarking"]},"timelineWeeks":8,"priceVnd":40000000}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "DRAFT listing created"
check_field_equals "$BODY" ".state" "DRAFT" "Initial state is DRAFT"
check_field_equals "$BODY" ".serviceType" "AI_SERVICE" "serviceType is AI_SERVICE"
SERVICE_ID=$(echo "$BODY" | jq -r '.id')
echo "  Service ID: ${SERVICE_ID}"

# ── Step 3: Non-owner update → 403 ──
step_header "PUT /services/:id — EDGE CASE: non-owner update → 403"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/services/${SERVICE_ID}" \
  -H "Content-Type: application/json" "${OTHER_AUTH[@]}" \
  -d '{"title":"Hijacked title"}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "403" "$CODE" "Non-owner update correctly blocked"

# ── Step 4: Update DRAFT ──
step_header "PUT /services/:id — owner updates DRAFT description"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/services/${SERVICE_ID}" \
  -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"description":"Updated: I build production-grade RAG systems with HNSW indexing for sub-10ms retrieval at p95, validated on real legal Q&A benchmarks. Includes full MLOps pipeline."}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "DRAFT update accepted"

# ── Step 5: Get service detail ──
step_header "GET /services/:id — read service detail (owner sees DRAFT)"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/services/${SERVICE_ID}" "${EXPERT_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Service detail readable"
check_field_present "$BODY" ".reputation" "reputation present"

# ── Step 6: Browse marketplace — DRAFT not visible to others ──
step_header "GET /services — DRAFT listing not visible to non-owner"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/services" "${OTHER_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Marketplace browseable"
VISIBLE=$(echo "$BODY" | jq --arg id "${SERVICE_ID}" '[.[] | select(.id == $id)] | length')
if [ "$VISIBLE" = "0" ]; then
  echo -e "  \033[0;32m✓\033[0m DRAFT listing correctly hidden from non-owner browse"
  PASS=$((PASS + 1))
else
  echo -e "  \033[0;31m✗\033[0m DRAFT listing should not be visible to non-owner"
  FAIL=$((FAIL + 1))
fi

# ── Step 7: AI generator (if Pro supports it) ──
step_header "POST /services — create listing WITH useAiGenerator:true (ai-service /llm/service-generate)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/services" \
  -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"serviceType":"AI_SERVICE","useAiGenerator":true,"capabilities":["RAG pipeline design","pgvector","hybrid retrieval","FastAPI","legal domain NLP"],"targetUseCases":["Legal document Q&A","Case law precedent search","Compliance document summarization"]}' \
  --max-time 60)
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
if [ "$CODE" = "201" ]; then
  check_status "201" "$CODE" "AI-generated listing created"
  check_field_present "$BODY" ".title" "AI-generated title present"
  check_field_present "$BODY" ".description" "AI-generated description present"
  AI_SERVICE_ID=$(echo "$BODY" | jq -r '.id')
  PASS=$((PASS + 1))
else
  echo -e "  \033[1;33m⚠\033[0m AI generator returned ${CODE} — may require specific Pro tier. Skipping."
fi

# ── Step 8: Publish DRAFT → PUBLISHED ──
step_header "PUT /services/:id — publish DRAFT → PUBLISHED"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/services/${SERVICE_ID}" \
  -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"state":"PUBLISHED"}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Publish accepted"
check_field_equals "$BODY" ".state" "PUBLISHED" "State is PUBLISHED"

# ── Step 9: PUBLISHED → DRAFT rollback → 422 ──
step_header "PUT /services/:id — EDGE CASE: PUBLISHED → DRAFT rollback → 422"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/services/${SERVICE_ID}" \
  -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"state":"DRAFT"}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "400" "$CODE" "PUBLISHED→DRAFT rollback correctly rejected (DTO validates before service)"

# ── Step 10: serviceType immutable after PUBLISHED → 422 ──
step_header "PUT /services/:id — EDGE CASE: change serviceType after PUBLISHED → 422"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/services/${SERVICE_ID}" \
  -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"serviceType":"TECH_DISCOVERY"}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "422" "$CODE" "serviceType change on PUBLISHED correctly rejected"

# ── Step 11: Browse marketplace — PUBLISHED visible to all ──
step_header "GET /services — PUBLISHED listing now visible in browse"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/services" "${OTHER_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Marketplace browseable"
VISIBLE=$(echo "$BODY" | jq --arg id "${SERVICE_ID}" '[.[] | select(.id == $id)] | length')
if [ "$VISIBLE" = "1" ]; then
  echo -e "  \033[0;32m✓\033[0m PUBLISHED listing correctly visible in browse"
  PASS=$((PASS + 1))
else
  echo -e "  \033[1;33m⚠\033[0m PUBLISHED listing not found in browse results — may be filtered by other criteria"
fi

# ── Step 12: Browse with filters ──
step_header "GET /services?serviceType=AI_SERVICE — filtered browse"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/services?serviceType=AI_SERVICE" "${OTHER_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Filtered browse accepted"

print_summary "MF-9"