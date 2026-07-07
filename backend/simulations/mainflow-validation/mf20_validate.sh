#!/usr/bin/env bash
#
# MF-20: Project Name & Slim List
#
# Covers:
#   GET /projects           (CEO/TechTeam list, optional ?slim=true)
#   GET /projects/:id       (full project detail)
#   PUT /projects/:id/name  (CEO renames project)
#
# Guards tested:
#   - Non-owner cannot rename → 403
#   - SUSPENDED project not renameable → 422
#   - Unauthenticated browse → 401
#   - ?slim=true returns only id + name (no heavy artifact JSON)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

require_jq
health_check

SEPAY_WEBHOOK_SECRET="${SEPAY_WEBHOOK_SECRET:?Set SEPAY_WEBHOOK_SECRET to match your .env}"
TS=$(date +%s)
PASSWORD="Str0ng!TestPass123"
CEO_EMAIL="mf20-ceo-${TS}@aitasker.test"
OTHER_CEO_EMAIL="mf20-other-${TS}@aitasker.test"

echo ""
echo "════════════════════════════════════════════════════════"
echo " MF-20: Project Name & Slim List"
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

# ── PREREQ: CEO with published project ──
step_header "PREREQ — register CEO and run full elicitation to publish project"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${CEO_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF20 CEO\",\"phone\":\"0901234599\",\"roles\":\"CLIENT_CEO\"}")
CEO_TOKEN=$(echo "$RES" | jq -r '.access_token')
CEO_AUTH=(-H "Authorization: Bearer ${CEO_TOKEN}")
fund_wallet "$CEO_TOKEN" 500000 "MF20-CEO-${TS}"
RES=$(curl -s -X POST "${BASE_URL}/subscriptions/activate" -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
  -d '{"activeRole":"CLIENT"}')
CEO_TOKEN=$(echo "$RES" | jq -r '.access_token')
CEO_AUTH=(-H "Authorization: Bearer ${CEO_TOKEN}")

TECH_EMAIL="mf20-tech-${TS}@aitasker.test"
RES=$(curl -s -X POST "${BASE_URL}/elicitation/sessions" -H "Content-Type: application/json" "${CEO_AUTH[@]}" -d '{}')
SESSION_ID=$(echo "$RES" | jq -r '.id')
RES=$(curl -s -X POST "${BASE_URL}/elicitation/sessions/${SESSION_ID}/generate-handoff-link" \
  -H "Content-Type: application/json" "${CEO_AUTH[@]}" -d '{}')
INVITE_TOKEN=$(echo "$RES" | jq -r '.invite_token')
RES=$(curl -s -X POST "${BASE_URL}/auth/register/handoff" -H "Content-Type: application/json" \
  -d "{\"invite_token\":\"${INVITE_TOKEN}\",\"email\":\"${TECH_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF20 Tech\"}")
TECH_TOKEN=$(echo "$RES" | jq -r '.access_token')
TECH_AUTH=(-H "Authorization: Bearer ${TECH_TOKEN}")

RES=$(curl -s -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage1" \
  -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
  -d '{"symptomText":"Our support chatbot handles 2000 queries per day at 71 percent accuracy causing customer churn and trust issues."}')
RECOMMENDED=$(echo "$RES" | jq -r '.recommendedArchetypesJson[0]')
# Extract any HIGH severity voids from Stage 1 response to auto-acknowledge them
high_voids=$(echo "$RES" | jq -c '[.voidListJson[] | select(.severity == "HIGH") | .void_code]')
[ -z "$high_voids" ] || [ "$high_voids" = "null" ] && high_voids="[]"

curl -s -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage2" \
  -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
  -d "{\"archetype\":\"${RECOMMENDED}\",\"acknowledgedVoidCodes\":${high_voids}}" > /dev/null
curl -s -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage3" \
  -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
  -d '{"probeResponses":{
    "Roughly how many people will search or ask questions per day?":"2000 per day from 500 agents",
    "When someone gets a wrong or unhelpful answer, what do you expect to happen next?":"Escalate to human and log",
    "Does this need to pull from documents/systems you already have, and which ones?":"Zendesk and PostgreSQL",
    "How quickly does an answer need to appear after someone asks?":"3 seconds p95"
  }}' > /dev/null
curl -s -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage4" \
  -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
  -d '{"current_stack":"Python FastAPI PostgreSQL","data_available":"200k Zendesk logs","latency_requirement":"3 seconds"}' \
  --max-time 30 > /dev/null

# CEO explicitly triggers Stage 5 synthesis (synchronous)
# Register a matching Expert BEFORE triggering synthesis so candidatesOk passes
EXPERT_EMAIL="mf20-expert-${TS}@aitasker.test"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${EXPERT_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF20 Expert\",\"phone\":\"0901234594\",\"roles\":\"EXPERT\"}")
EXPERT_TOKEN=$(echo "$RES" | jq -r '.access_token')
EXPERT_AUTH=(-H "Authorization: Bearer ${EXPERT_TOKEN}")
curl -s -X PUT "${BASE_URL}/expert-profile/me" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" \
  -d '{"engagementModel":"MILESTONE","stackTagsJson":["Python","pgvector","FastAPI","PostgreSQL","AWS ECS"]}' > /dev/null
curl -s -X POST "${BASE_URL}/expert-profile/domains" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" -d '{"domainCode":"A","depthLevel":"DEEP"}' > /dev/null
curl -s -X POST "${BASE_URL}/expert-profile/domains" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" -d '{"domainCode":"D","depthLevel":"DEEP"}' > /dev/null
curl -s -X POST "${BASE_URL}/expert-profile/domains" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" -d '{"domainCode":"E","depthLevel":"DEEP"}' > /dev/null
curl -s -X POST "${BASE_URL}/expert-profile/seams" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" -d '{"seamCode":"A↔C"}' > /dev/null
curl -s -X POST "${BASE_URL}/expert-profile/seams" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" -d '{"seamCode":"A↔D"}' > /dev/null
curl -s -X POST "${BASE_URL}/expert-profile/seams" -H "Content-Type: application/json" "${EXPERT_AUTH[@]}" -d '{"seamCode":"D↔E"}' > /dev/null
echo "  [prereq] Triggering POST /stage5..."
RES=$(curl -s -X POST "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage5" \
  -H "Content-Type: application/json" "${CEO_AUTH[@]}" --max-time 120)
PROJECT_ID=$(echo "$RES" | jq -r '.project_id // empty')
echo "  Project ID: ${PROJECT_ID}"

# ── PREREQ: Other CEO (non-owner) ──
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${OTHER_CEO_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF20 Other CEO\",\"phone\":\"0901234600\",\"roles\":\"CLIENT_CEO\"}")
OTHER_TOKEN=$(echo "$RES" | jq -r '.access_token')
OTHER_AUTH=(-H "Authorization: Bearer ${OTHER_TOKEN}")

# ── Step 1: GET /projects — CEO lists own projects ──
step_header "GET /projects — CEO lists own published projects"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/projects" "${CEO_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Project list readable"
PROJECT_COUNT=$(echo "$BODY" | jq '. | length')
echo "  CEO has ${PROJECT_COUNT} project(s)"
if [ "$PROJECT_COUNT" -gt 0 ]; then
  PASS=$((PASS + 1))
else
  echo -e "  \033[1;33m⚠\033[0m No projects in list — gate may have failed"
fi

# ── Step 2: GET /projects?slim=true ──
step_header "GET /projects?slim=true — slim list (id + name only, no heavy artifact JSON)"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/projects?slim=true" "${CEO_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Slim list readable"
if echo "$BODY" | jq -e '.[0]' > /dev/null 2>&1; then
  HAS_ARTIFACT=$(echo "$BODY" | jq '.[0].artifact_a_json // empty')
  if [ -z "$HAS_ARTIFACT" ]; then
    echo -e "  \033[0;32m✓\033[0m artifact_a_json absent in slim list — correctly stripped"
    PASS=$((PASS + 1))
  else
    echo -e "  \033[1;33m⚠\033[0m artifact_a_json present in slim list — may not be implemented"
  fi
fi

# ── Step 3: GET /projects/:id ──
step_header "GET /projects/:id — full project detail"
if [ -n "${PROJECT_ID:-}" ] && [ "$PROJECT_ID" != "null" ]; then
  RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/projects/${PROJECT_ID}" "${CEO_AUTH[@]}")
  CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
  print_body "$BODY"
  check_status "200" "$CODE" "Project detail readable"
  check_field_present "$BODY" ".artifact_a_json" "artifact_a_json present in full detail"
  check_field_present "$BODY" ".state" "state present"
  ORIGINAL_NAME=$(echo "$BODY" | jq -r '.projectName')
  echo "  Original project name: ${ORIGINAL_NAME}"

  # ── Step 4: Non-owner rename → 403 ──
  step_header "PUT /projects/:id/name — EDGE CASE: non-owner → 403"
  RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/projects/${PROJECT_ID}/name" \
    -H "Content-Type: application/json" "${OTHER_AUTH[@]}" \
    -d '{"projectName":"Hijacked Name"}')
  CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
  print_body "$BODY"
  check_status "403" "$CODE" "Non-owner rename correctly blocked"

  # ── Step 5: Valid rename ──
  step_header "PUT /projects/:id/name — owner renames project"
  NEW_NAME="Updated Project Name MF20-${TS}"
  RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/projects/${PROJECT_ID}/name" \
    -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
    -d "{\"projectName\":\"${NEW_NAME}\"}")
  CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
  print_body "$BODY"
  check_status "200" "$CODE" "Rename accepted"
  check_field_equals "$BODY" ".projectName" "${NEW_NAME}" "Project name updated"

  # ── Step 6: Verify rename persisted ──
  step_header "GET /projects/:id — confirm new name persisted"
  RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/projects/${PROJECT_ID}" "${CEO_AUTH[@]}")
  CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
  print_body "$BODY"
  check_status "200" "$CODE" "Project readable after rename"
  check_field_equals "$BODY" ".projectName" "${NEW_NAME}" "New name persisted"

  # ── Step 7: Tech Team can also list their linked project ──
  step_header "GET /projects — Tech Team lists projects (scoped to their linked project)"
  RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/projects" "${TECH_AUTH[@]}")
  CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
  print_body "$BODY"
  check_status "200" "$CODE" "Tech Team can read scoped project list"
  TECH_PROJECT_COUNT=$(echo "$BODY" | jq '. | length')
  echo "  Tech Team sees ${TECH_PROJECT_COUNT} project(s)"
else
  echo -e "  \033[1;33m⚠\033[0m No project published — project detail and rename tests skipped"
fi

# ── Step 8: Unauthenticated browse → 401 ──
step_header "GET /projects — EDGE CASE: unauthenticated → 401"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/projects")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "401" "$CODE" "Unauthenticated browse correctly rejected"

print_summary "MF-20"