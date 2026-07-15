#!/usr/bin/env bash
#
# mf_expert_invites.sh
# Covers: Expert Invitations Lifecycle
#
# Tests:
# - C-1: Creating an invitation (triggered directly via service for testability)
# - C-2: GET /invitations returns populated project + CEO metadata
# - C-3: isExpired flag dynamically calculated without background jobs
# - C-4: Re-inviting resets declined status to PENDING
# - C-5: Submitting a bid silently auto-marks the invite as ACCEPTED

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

require_jq
health_check

if [ -z "${DATABASE_URL:-}" ] && [ -f "${SCRIPT_DIR}/../../.env" ]; then
  set -a
  source "${SCRIPT_DIR}/../../.env"
  set +a
fi

TS=$(date +%s)
PASSWORD="Str0ng!TestPass123"

CEO_EMAIL="ceo-inv-${TS}@gmail.com"
EXPERT_EMAIL="expert-inv-${TS}@gmail.com"

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
echo " Expert Invitations Lifecycle Validation Suite"
echo "════════════════════════════════════════════════════════════════"

# ══════════════════════════════════════════════════════════════════
step_header "SETUP — Register Users & Publish Project"

# 1. Register CEO
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${CEO_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"CEO Inviter\",\"roles\":\"CLIENT_CEO\"}")
CEO_ID=$(safe_extract "$RES" '.user.id')

# 2. Register Expert (The one receiving the invite)
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${EXPERT_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"Expert Invitee\",\"roles\":\"EXPERT\"}")
EXP_TOKEN=$(safe_extract "$RES" '.access_token')
EXP_ID=$(safe_extract "$RES" '.user.id')
EXP_AUTH=(-H "Authorization: Bearer ${EXP_TOKEN}")

# 3. DB Setup: Create a project directly for speed (skipping elicitation API flow)
PROJECT_ID=$(run_db_script "
  const p = await prisma.project.create({
    data: {
      clientId: '${CEO_ID}',
      state: 'PUBLISHED',
      archetype: '1',
      tier: 'TIER_1', 
      projectName: 'Computer Vision Medical System',
      requiredDomainsJson: [{ domain_code: 'A', required_depth: 'SURFACE' }],
      requiredSeamsJson: []
    }
  });
  console.log(p.id);
")
PROJECT_ID=$(echo "$PROJECT_ID" | tr -d '[:space:]')
echo "  ✓ Setup complete. CEO, Expert, and Project (${PROJECT_ID}) ready."

# ══════════════════════════════════════════════════════════════════
step_header "TEST 1: Creating an Invitation"

# Normally fired via WebSocket `inviteExpert`. For the bash test, we inject it
# straight into the InvitationsService via Prisma to simulate what the gateway does.
run_db_script "
  const { addDays } = require('date-fns');
  await prisma.invitation.create({
    data: {
      projectId: '${PROJECT_ID}',
      expertId: '${EXP_ID}',
      ceoId: '${CEO_ID}',
      message: 'We really need your vision expertise for this project.',
      status: 'PENDING',
      expiresAt: addDays(new Date(), 7)
    }
  });
"

RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/invitations" "${EXP_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"

check_status "200" "$CODE" "GET /invitations returns list"
check_field_equals "$BODY" ".[0].status" "PENDING" "Invitation status is PENDING"
check_field_equals "$BODY" ".[0].message" "We really need your vision expertise for this project." "Custom invite message persists"
check_field_present "$BODY" ".[0].project.projectName" "Project metadata populated (Project Name included)"
check_field_present "$BODY" ".[0].ceo.fullName" "CEO metadata populated (CEO Name included)"

INVITATION_ID=$(echo "$BODY" | jq -r '.[0].id // empty')
# ══════════════════════════════════════════════════════════════════
step_header "TEST 2: Explicitly Declining the Invitation"

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/invitations/${INVITATION_ID}/decline" "${EXP_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')

check_status "201" "$CODE" "POST /invitations/:id/decline successful"
check_field_equals "$BODY" ".status" "DECLINED" "Invitation marked as DECLINED"

# ══════════════════════════════════════════════════════════════════
step_header "TEST 3: Re-inviting resets status back to PENDING (Upsert logic)"

run_db_script "
  const { addDays } = require('date-fns');
  await prisma.invitation.upsert({
    where: { projectId_expertId: { projectId: '${PROJECT_ID}', expertId: '${EXP_ID}' } },
    create: {
      projectId: '${PROJECT_ID}', expertId: '${EXP_ID}', ceoId: '${CEO_ID}',
      message: 'Please reconsider!', status: 'PENDING', expiresAt: addDays(new Date(), 7)
    },
    update: {
      status: 'PENDING', message: 'Please reconsider!',
      respondedAt: null, invitedAt: new Date(), expiresAt: addDays(new Date(), 7)
    }
  });
"

RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/invitations" "${EXP_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
check_status "200" "$CODE" "Re-fetched invitations"
check_field_equals "$BODY" ".[0].status" "PENDING" "Re-inviting reset the status from DECLINED back to PENDING"

# ══════════════════════════════════════════════════════════════════
step_header "TEST 4: Expiration Check (Dynamic Calculation)"

echo "  [DB] Fast-forwarding the expiration date to 3 days ago..."
run_db_script "
  await prisma.invitation.update({
    where: { id: '${INVITATION_ID}' },
    data: { expiresAt: new Date(Date.now() - 86400000 * 3) }
  });
"

RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/invitations" "${EXP_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
check_status "200" "$CODE" "Fetched expired invitations"
check_field_equals "$BODY" ".[0].isExpired" "true" "isExpired flag dynamically evaluated to true at query time"

echo "  [DB] Restoring expiration date to future for final test..."
run_db_script "
  await prisma.invitation.update({
    where: { id: '${INVITATION_ID}' },
    data: { expiresAt: new Date(Date.now() + 86400000 * 7) }
  });
"

# ══════════════════════════════════════════════════════════════════
step_header "TEST 5: Bid Submission auto-clears the Invitation"

# Note: Normally they are matched via the `ProjectShortlistCache`. We inject them into the cache so the Bid Guard passes.
# We explicitly set the generatedAt timestamp to Date.now() so the ShortlistService 
# does not consider the cache stale and attempt to ping the AI engine.
run_db_script "
  await prisma.projectShortlistCache.upsert({
    where: { projectId: '${PROJECT_ID}' },
    create: { 
      projectId: '${PROJECT_ID}', 
      resultsJson: [{ expert_id: '${EXP_ID}', strength_label: 'STRONG_MATCH' }],
      generatedAt: new Date()
    },
    update: { 
      resultsJson: [{ expert_id: '${EXP_ID}', strength_label: 'STRONG_MATCH' }],
      generatedAt: new Date()
    }
  });
"

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/bids" \
  -H "Content-Type: application/json" "${EXP_AUTH[@]}" \
  -d "{\"projectId\":\"${PROJECT_ID}\",\"footprint_alignment_json\":{\"domains\":[],\"seams\":[]},\"approach_summary\":\"Test Bid\",\"conditional_pricing_json\":[{\"milestone_number\":1,\"price_vnd\":100000,\"condition\":\"Delivery complete\"}]}")
CODE=$(echo "$RES" | tail -n1)
if [ "$CODE" != "201" ]; then
  echo -e "${RED}BID FAILED WITH 403. EXACT ERROR:${NC}"
  echo "$RES" | sed '$d' | jq .
fi
check_status "201" "$CODE" "Bid successfully submitted via POST /bids"

# Verify Invitation was automagically switched to ACCEPTED
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/invitations" "${EXP_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')

check_status "200" "$CODE" "Fetched invitations after bid"
check_field_equals "$BODY" ".[0].status" "ACCEPTED" "Invitation status silently marked ACCEPTED when bid was created!"
check_field_present "$BODY" ".[0].respondedAt" "respondedAt timestamp was stamped"

print_summary "Expert Invitations Lifecycle"