#!/usr/bin/env bash
#
# validate_group_a_patches.sh
# Covers: Group A Bug Fixes & Remaining Auth/Project Patches

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

require_jq
health_check

# ─── Load .env ────────────────────────────────────────────────────────
if [ -z "${DATABASE_URL:-}" ] && [ -f "${SCRIPT_DIR}/../../.env" ]; then
  set -a
  source "${SCRIPT_DIR}/../../.env"
  set +a
fi

SEPAY_WEBHOOK_SECRET="${SEPAY_WEBHOOK_SECRET:-whsec_test_secret_for_simulation}"
TS=$(date +%s)
PASSWORD="Str0ng!TestPass123"

CEO1_EMAIL="a1-ceo1-${TS}@gmail.com"
CEO2_EMAIL="a1-ceo2-${TS}@gmail.com"
EXPERT_EMAIL="a1-expert-${TS}@gmail.com"
TECH1_EMAIL="a1-tech1-${TS}@gmail.com"
TECH2_EMAIL="a1-tech2-${TS}@gmail.com"

# ─── Helper: DB Manipulation via Prisma Client ────────────────────────
run_db_script() {
  (cd "${SCRIPT_DIR}/../.." && node -e "
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    async function run() {
      try { $1 }
      catch (e) { console.error(e); process.exit(1); }
      finally { await prisma.\$disconnect(); }
    }
    run();
  ")
}

# Safely extract values to prevent "null" cascading errors
safe_extract() {
  local val
  val=$(echo "$1" | jq -r "$2 // empty")
  if [ -z "$val" ]; then
    echo "ERROR_EXTRACTION_FAILED"
  else
    echo "$val"
  fi
}

echo ""
echo "════════════════════════════════════════════════════════════════"
echo " Group A & Remaining Patches Validation Suite"
echo "════════════════════════════════════════════════════════════════"

# ══════════════════════════════════════════════════════════════════
step_header "SETUP — Register Users"

# CEO 1
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${CEO1_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"CEO One\",\"roles\":\"CLIENT_CEO\"}")

CEO1_TOKEN=$(safe_extract "$RES" '.access_token')
CEO1_ID=$(safe_extract "$RES" '.user.id')

if [ "$CEO1_TOKEN" = "ERROR_EXTRACTION_FAILED" ]; then
  echo -e "${RED}✗ Fatal Setup Error: Failed to register CEO 1. Response:${NC}"
  echo "$RES"
  exit 1
fi

CEO1_AUTH=(-H "Authorization: Bearer ${CEO1_TOKEN}")

# Manually fund wallet & activate pro via DB to ensure 100% stability in tests
run_db_script "
  await prisma.user.update({
    where: { id: '${CEO1_ID}' },
    data: { 
      subscriptionClientTier: 'pro',
      subClientExpiresAt: new Date(Date.now() + 86400000 * 30) // +30 days
    }
  });
  await prisma.wallet.update({
    where: { userId: '${CEO1_ID}' },
    data: { availableBalance: 10000000n }
  });
"
echo "  ✓ CEO 1 registered and PRO activated via DB injection"

# CEO 2
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${CEO2_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"CEO Two\",\"roles\":\"CLIENT_CEO\"}")
CEO2_TOKEN=$(safe_extract "$RES" '.access_token')
CEO2_AUTH=(-H "Authorization: Bearer ${CEO2_TOKEN}")
echo "  ✓ CEO 2 registered"

# EXPERT
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${EXPERT_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"Expert One\",\"roles\":\"EXPERT\"}")
EXP_TOKEN=$(safe_extract "$RES" '.access_token')
EXP_ID=$(safe_extract "$RES" '.user.id')
EXP_AUTH=(-H "Authorization: Bearer ${EXP_TOKEN}")

run_db_script "
  await prisma.user.update({
    where: { id: '${EXP_ID}' },
    data: { 
      subscriptionExpertTier: 'pro',
      subExpertExpiresAt: new Date(Date.now() + 86400000 * 30)
    }
  });
"

# Set expert tags so matching works later
curl -s -X PUT "${BASE_URL}/expert-profile/me" -H "Content-Type: application/json" "${EXP_AUTH[@]}" \
  -d '{"engagementModel":"MILESTONE","stackTagsJson":["Python","FastAPI"]}' > /dev/null
curl -s -X POST "${BASE_URL}/expert-profile/domains" -H "Content-Type: application/json" "${EXP_AUTH[@]}" \
  -d '{"domainCode":"A","depthLevel":"DEEP"}' > /dev/null
curl -s -X POST "${BASE_URL}/expert-profile/seams" -H "Content-Type: application/json" "${EXP_AUTH[@]}" \
  -d '{"seamCode":"A↔C"}' > /dev/null
echo "  ✓ Expert registered and configured"

# ══════════════════════════════════════════════════════════════════
step_header "A-2: Subscription Expiry Check"

RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/subscriptions/status" "${CEO1_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
check_status "200" "$CODE" "Status fetched"
check_field_equals "$BODY" ".subscriptionTier" "pro" "Before expiry: tier is 'pro'"

echo "  [DB] Backdating CEO 1 subscription expiry to yesterday..."
run_db_script "
  await prisma.user.update({
    where: { id: '${CEO1_ID}' },
    data: { subClientExpiresAt: new Date(Date.now() - 86400000 * 2) } // 2 days ago
  });
"

RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/subscriptions/status" "${CEO1_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Status fetched"
check_field_equals "$BODY" ".subscriptionTier" "free" "After expiry: backend correctly overrides tier to 'free'"
check_field_equals "$BODY" ".isExpired" "true" "isExpired flag is explicitly set to true"

echo "  [DB] Restoring CEO 1 subscription for remaining tests..."
run_db_script "
  await prisma.user.update({
    where: { id: '${CEO1_ID}' },
    data: { subClientExpiresAt: new Date(Date.now() + 86400000 * 30) } // +30 days
  });
"

# ══════════════════════════════════════════════════════════════════
step_header "Patch: Verify Reset Token Endpoint"

# 1. Generate Token
curl -s -X POST "${BASE_URL}/auth/forgot-password" -H "Content-Type: application/json" \
  -d "{\"email\":\"${CEO2_EMAIL}\"}" > /dev/null

# Safely extract the token
RESET_TOKEN=$(run_db_script "
  const u = await prisma.user.findUnique({ where: { email: '${CEO2_EMAIL}' }});
  if (u && u.passwordResetToken) {
    console.log(u.passwordResetToken);
  } else {
    console.error('TOKEN_NULL');
  }
")

# Clean any weird whitespace from the token
RESET_TOKEN=$(echo "$RESET_TOKEN" | tr -d '[:space:]')

if [ -z "$RESET_TOKEN" ] || [ "$RESET_TOKEN" = "TOKEN_NULL" ]; then
  echo -e "  ${RED}✗ Token generation failed. Is SMTP configured correctly in .env?${NC}"
  FAIL=$((FAIL + 1))
else
  RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/auth/verify-reset-token/${RESET_TOKEN}")
  CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
  print_body "$BODY"
  check_status "200" "$CODE" "Valid token verification -> 200 OK"
  check_field_equals "$BODY" ".valid" "true" "Returns { valid: true }"

  RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/auth/verify-reset-token/fake-token-123")
  CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
  print_body "$BODY"
  check_status "400" "$CODE" "Invalid token verification -> 400 Bad Request"

  echo "  [DB] Backdating reset token expiry..."
  run_db_script "
    await prisma.user.update({
      where: { email: '${CEO2_EMAIL}' },
      data: { passwordResetTokenExpiresAt: new Date(Date.now() - 3600000) } // -1 hour
    });
  "
  RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/auth/verify-reset-token/${RESET_TOKEN}")
  CODE=$(echo "$RES" | tail -n1)
  check_status "400" "$CODE" "Expired token verification -> 400 Bad Request"
fi

# ══════════════════════════════════════════════════════════════════
step_header "A-1: Elicitation Ownership Guard (processStage5)"

RES=$(curl -s -X POST "${BASE_URL}/elicitation/sessions" "${CEO1_AUTH[@]}")
SESSION_ID=$(safe_extract "$RES" '.id')

if [ "$SESSION_ID" = "ERROR_EXTRACTION_FAILED" ]; then
  echo -e "${RED}✗ Failed to create session. Aborting A-1.${NC}"
  exit 1
fi

echo "  [DB] Fast-forwarding session to Stage 5 readiness..."
run_db_script "
  await prisma.elicitationSession.update({
    where: { id: '${SESSION_ID}' },
    data: {
      currentStage: 5,
      stage1SymptomsJson: ['Support issue'],
      archetype: '1',
      stage3ProbesJson: { q: 'a' },
      stage4TechInputsJson: { current_stack: 'Node' }
    }
  });
"

# CEO 2 tries to trigger Stage 5 on CEO 1's session
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage5" \
  "${CEO2_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "403" "$CODE" "Ownership Guard: CEO 2 blocked from triggering CEO 1's Stage 5 synthesis"

# Project Creation Fallback (Guarantees stability for next tests)
echo "  [DB] Forcing Project Creation for downstream tests..."
PROJECT_ID=$(run_db_script "
  const p = await prisma.project.create({
    data: {
      clientId: '${CEO1_ID}',
      elicitationSessionId: '${SESSION_ID}',
      state: 'PUBLISHED',
      archetype: '1',
      projectName: 'Test Project',
      requiredDomainsJson: [{domain_code: 'A', required_depth: 'DEEP'}],
      requiredSeamsJson: [{seam_code: 'A↔C', criticality: 'load_bearing'}],
      milestoneFrameworkJson: [{milestone_number: 1, deliverable_statement: 'Setup'}]
    }
  });
  console.log(p.id);
")
PROJECT_ID=$(echo "$PROJECT_ID" | tr -d '[:space:]')
echo "  Project ID: ${PROJECT_ID}"

# ══════════════════════════════════════════════════════════════════
step_header "Patch: GET /projects/:id missing fields"

RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/projects/${PROJECT_ID}" "${CEO1_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Fetched project details"
check_field_present "$BODY" ".required_domains_json" "required_domains_json is exposed to frontend"
check_field_present "$BODY" ".required_seams_json" "required_seams_json is exposed to frontend"
check_field_present "$BODY" ".milestone_framework_json" "milestone_framework_json is exposed to frontend"

# ══════════════════════════════════════════════════════════════════
step_header "A-1-EXT: Tech Team Handoff Linking Fix"

RES=$(curl -s -X POST "${BASE_URL}/elicitation/sessions/${SESSION_ID}/generate-handoff-link" \
  -H "Content-Type: application/json" "${CEO1_AUTH[@]}" -d '{}')
INVITE_TOKEN=$(safe_extract "$RES" '.invite_token')

# 1. NEW Tech Team registers via Handoff
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register/handoff" \
  -H "Content-Type: application/json" \
  -d "{\"invite_token\":\"${INVITE_TOKEN}\",\"email\":\"${TECH1_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"Tech One\"}")
CODE=$(echo "$RES" | tail -n1)
check_status "201" "$CODE" "New Tech Team registered via handoff"

# Check DB
LINKED_PID=$(run_db_script "
  const u = await prisma.user.findUnique({ where: { email: '${TECH1_EMAIL}' }});
  const t = await prisma.techTeamProfile.findUnique({ where: { userId: u.id }});
  console.log(t.linkedProjectId || 'null');
")
LINKED_PID=$(echo "$LINKED_PID" | tr -d '[:space:]')
echo "  Linked Project ID (New Register): ${LINKED_PID}"

if [ "${LINKED_PID}" = "${PROJECT_ID}" ]; then
  echo -e "  ${GREEN}✓${NC} registerHandoff successfully linked the existing project!"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} registerHandoff failed to link existing project (got ${LINKED_PID})"
  FAIL=$((FAIL + 1))
fi

# ══════════════════════════════════════════════════════════════════
step_header "A-3: Bid Submission & Transaction Stability"

echo "  [DB] Injecting Expert into Project Shortlist..."
run_db_script "
  await prisma.projectShortlistCache.upsert({
    where: { projectId: '${PROJECT_ID}' },
    create: { projectId: '${PROJECT_ID}', resultsJson: [{expert_id: '${EXP_ID}'}] },
    update: { resultsJson: [{expert_id: '${EXP_ID}'}] }
  });
"

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/bids" \
  -H "Content-Type: application/json" "${EXP_AUTH[@]}" \
  -d "{\"projectId\":\"${PROJECT_ID}\",\"footprint_alignment_json\":{\"domains\":[],\"seams\":[]},\"approach_summary\":\"Test Bid\",\"conditional_pricing_json\":[{\"milestone_number\":1,\"price_vnd\":100000,\"condition\":\"Delivery complete\"}]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Bid successfully created (EventEmitters processed safely)"

print_summary "Group A & Remaining Patches"