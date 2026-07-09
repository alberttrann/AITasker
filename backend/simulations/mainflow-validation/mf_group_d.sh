#!/usr/bin/env bash
#
# mf_group_d.sh
# Covers: Group D — Elicitation Stage Logic & State Management

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
CEO_EMAIL="c-ceo-${TS}@gmail.com"

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
echo " Group D: Elicitation Stage Logic Validation Suite"
echo "════════════════════════════════════════════════════════════════"

# ══════════════════════════════════════════════════════════════════
step_header "SETUP — Register CEO & Activate Pro"

RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${CEO_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"CEO Group D\",\"roles\":\"CLIENT_CEO\"}")
CEO_TOKEN=$(safe_extract "$RES" '.access_token')
CEO_ID=$(safe_extract "$RES" '.user.id')

if [ "$CEO_TOKEN" = "ERROR_EXTRACTION_FAILED" ]; then
  echo -e "${RED}✗ Fatal Setup Error: Failed to register CEO.${NC}"
  echo "$RES"
  exit 1
fi

run_db_script "
  await prisma.user.update({
    where: { id: '${CEO_ID}' },
    data: { 
      subscriptionClientTier: 'pro',
      subClientExpiresAt: new Date(Date.now() + 86400000 * 30)
    }
  });
"
CEO_AUTH=(-H "Authorization: Bearer ${CEO_TOKEN}")
echo "  ✓ CEO registered and Pro activated via DB"

# ══════════════════════════════════════════════════════════════════
step_header "Session Initialization"

RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/elicitation/sessions" "${CEO_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
check_status "201" "$CODE" "Session created"
SESSION_ID=$(safe_extract "$BODY" '.id')
echo "  Session ID: ${SESSION_ID}"

# ══════════════════════════════════════════════════════════════════
step_header "D-1: Stage 1 Original Input Storage & Diffing"

SYMPTOM_TEXT="We need a RAG system for customer support that can answer questions from 500 users daily with under 3 second response time, connecting to our Zendesk database, with a budget of 100 million VND."

echo "  [PUT] Submitting Stage 1 (Calls AI Service - Please wait ~15s)..."
T1=$(date +%s)
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage1" \
  -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
  -d "{\"symptomText\":\"${SYMPTOM_TEXT}\"}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
T2=$(date +%s)

check_status "200" "$CODE" "Stage 1 AI synthesis completed ($((T2-T1))s)"

RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/elicitation/sessions/${SESSION_ID}" "${CEO_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')

check_field_present "$BODY" ".stage1OriginalInput" "stage1OriginalInput was persisted to DB"
check_field_equals "$BODY" ".stage1OriginalInput" "$SYMPTOM_TEXT" "Persisted text matches exact user input"
check_field_present "$BODY" ".stage1SymptomsJson" "AI-generated symptoms list also present"

# D-1 LLM Bypass Test
echo "  [DB] Reverting session to Stage 1 to test bypass..."
run_db_script "
  await prisma.elicitationSession.update({
    where: { id: '${SESSION_ID}' },
    data: { currentStage: 1 }
  });
"

echo "  [PUT] Resubmitting EXACT SAME Stage 1 text..."
T3=$(date +%s)
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage1" \
  -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
  -d "{\"symptomText\":\"${SYMPTOM_TEXT}\"}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
T4=$(date +%s)
BYPASS_TIME=$((T4-T3))

check_status "200" "$CODE" "Stage 1 bypass succeeded"
if [ "$BYPASS_TIME" -lt 2 ]; then
  echo -e "  ${GREEN}✓${NC} LLM Skip confirmed! Response took ${BYPASS_TIME}s (much faster than initial $((T2-T1))s)"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} LLM Skip failed. Response took ${BYPASS_TIME}s (expected < 2s)"
  FAIL=$((FAIL + 1))
fi

# ══════════════════════════════════════════════════════════════════
step_header "D-3: Stage 3 Dynamic Probe Questions"

echo "  [DB] Fast-forwarding session to Stage 3 readiness..."
# We explicitly set currentStage = 3 here so the Stage 3 guard passes,
# regardless of what the LLM bypass returned earlier.
run_db_script "
  await prisma.elicitationSession.update({
    where: { id: '${SESSION_ID}' },
    data: { 
      currentStage: 3,
      archetype: '1'
    }
  });
"

echo "  [GET] Fetching dynamic questions for Archetype 1 from DB..."
RES=$(curl -s "${BASE_URL}/config/archetypes/1/probe-questions")
Q1=$(echo "$RES" | jq -r '.[0].questionText')
Q2=$(echo "$RES" | jq -r '.[1].questionText')
Q3=$(echo "$RES" | jq -r '.[2].questionText')
Q4=$(echo "$RES" | jq -r '.[3].questionText')

echo "  [PUT] Submitting Stage 3 using fetched questions (Calls AI - Please wait ~5s)..."
# Construct payload using the EXACT strings returned from the config endpoint
PAYLOAD=$(jq -n \
  --arg q1 "$Q1" --arg a1 "Around 500 daily users" \
  --arg q2 "$Q2" --arg a2 "Escalate to human agents" \
  --arg q3 "$Q3" --arg a3 "Zendesk API and Postgres" \
  --arg q4 "$Q4" --arg a4 "Under 3 seconds p95" \
  '{probeResponses: {($q1): $a1, ($q2): $a2, ($q3): $a3, ($q4): $a4}}')

RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage3" \
  -H "Content-Type: application/json" "${CEO_AUTH[@]}" -d "$PAYLOAD")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')

check_status "200" "$CODE" "Stage 3 processed dynamic questions successfully"
check_field_equals "$BODY" ".advanced" "true" "Vagueness check passed and advanced to stage 4"

# ══════════════════════════════════════════════════════════════════
step_header "D-4: Stage 4 Auto-save Draft (No LLM)"

echo "  [PATCH] Saving Stage 4 draft (should not call AI or advance stage)..."
RES=$(curl -s -w "\n%{http_code}" -X PATCH "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage4-draft" \
  -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
  -d '{"draftJson":{"current_stack":"Typing some nodejs...","data_available":"looking for logs..."}}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
check_status "200" "$CODE" "PATCH /stage4-draft returned 200 OK"
check_field_equals "$BODY" ".saved" "true" "Draft confirmed saved"

echo "  [GET] Verifying draft exists in session payload..."
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/elicitation/sessions/${SESSION_ID}" "${CEO_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
check_field_present "$BODY" ".stage4DraftJson" "stage4DraftJson is present"
check_field_equals "$BODY" ".currentStage" "4" "Stage did NOT advance (LLM was skipped)"

# ══════════════════════════════════════════════════════════════════
step_header "D-4: Stage 4 Additional Requirement 1"

echo "  [PUT] Submitting full Stage 4 with additional_requirement_1 field..."
echo "        (Calls AI Stage 5 Synthesis - Please wait up to 60s)..."
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage4" \
  -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
  -d '{
    "current_stack": "Node.js, PostgreSQL",
    "data_available": "Zendesk CSV dumps",
    "latency_requirement": "Under 3 seconds",
    "additional_requirement_1": "Must be compliant with European GDPR data storage requirements."
  }' --max-time 90)
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')

check_status "200" "$CODE" "Stage 4 submission succeeded"
check_field_equals "$BODY" ".success" "true" "Returned success: true"

# Verify the field was saved to the DB before being sent to AI
SAVED_REQ=$(run_db_script "
  const s = await prisma.elicitationSession.findUnique({ where: { id: '${SESSION_ID}' }});
  console.log(s.stage4TechInputsJson.additional_requirement_1 || 'null');
")
SAVED_REQ=$(echo "$SAVED_REQ" | tr -d '\n' | tr -d '\r')

if [[ "$SAVED_REQ" == *"GDPR"* ]]; then
  echo -e "  ${GREEN}✓${NC} additional_requirement_1 was successfully persisted to the tech inputs JSON"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} additional_requirement_1 was not found in stage4TechInputsJson"
  FAIL=$((FAIL + 1))
fi

print_summary "Group D — Elicitation Logic"