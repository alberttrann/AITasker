#!/usr/bin/env bash
# _elicitation_prereq.sh — Shared prereq: registers CEO, runs all 5 stages.
#
# THE CORRECT FLOW (confirmed from elicitation.service.ts source):
#   PUT /stage4  → saves tech inputs, sets currentStage=5, returns {success:true}
#   POST /stage5 → CEO explicitly triggers synthesis → SYNCHRONOUS → returns gate result
#                  → session.state becomes COMPLETED or RETURNED immediately
#
# There is NO async synthesis. POST /stage5 blocks until done and returns the result.
# No polling needed. No sleep needed.
#
# Exports: CEO_TOKEN CEO_AUTH TECH_TOKEN TECH_AUTH PROJECT_ID SESSION_ID

_elipreq_fund_wallet() {
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

run_elicitation_prereq() {
  local prefix="${1}"
  local phone_ceo="${2}"
  local ts_val
  ts_val=$(date +%s)
  local ceo_email="${prefix}-ceo-${ts_val}@aitasker.test"

  echo "  [prereq] Registering CEO ${ceo_email}..."
  local res
  res=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
    -d "{\"email\":\"${ceo_email}\",\"password\":\"${PASSWORD}\",\"fullName\":\"${prefix} CEO\",\"phone\":\"${phone_ceo}\",\"roles\":\"CLIENT_CEO\"}")
  CEO_TOKEN=$(echo "$res" | jq -r '.access_token')
  CEO_AUTH=(-H "Authorization: Bearer ${CEO_TOKEN}")

  _elipreq_fund_wallet "$CEO_TOKEN" 500000 "${prefix}-CEO-${ts_val}"

  res=$(curl -s -X POST "${BASE_URL}/subscriptions/activate" \
    -H "Content-Type: application/json" "${CEO_AUTH[@]}" -d '{"activeRole":"CLIENT"}')
  CEO_TOKEN=$(echo "$res" | jq -r '.access_token')
  CEO_AUTH=(-H "Authorization: Bearer ${CEO_TOKEN}")
  echo "  [prereq] CEO Pro activated."

  # Register Tech Team via handoff (needed by scripts that use TECH_AUTH)
  res=$(curl -s -X POST "${BASE_URL}/elicitation/sessions" \
    -H "Content-Type: application/json" "${CEO_AUTH[@]}" -d '{}')
  SESSION_ID=$(echo "$res" | jq -r '.id')

  res=$(curl -s -X POST "${BASE_URL}/elicitation/sessions/${SESSION_ID}/generate-handoff-link" \
    -H "Content-Type: application/json" "${CEO_AUTH[@]}" -d '{}')
  local invite_token
  invite_token=$(echo "$res" | jq -r '.invite_token')

  local tech_email="${prefix}-tech-${ts_val}@aitasker.test"
  res=$(curl -s -X POST "${BASE_URL}/auth/register/handoff" -H "Content-Type: application/json" \
    -d "{\"invite_token\":\"${invite_token}\",\"email\":\"${tech_email}\",\"password\":\"${PASSWORD}\",\"fullName\":\"${prefix} Tech\"}")
  TECH_TOKEN=$(echo "$res" | jq -r '.access_token')
  TECH_AUTH=(-H "Authorization: Bearer ${TECH_TOKEN}")

  # Stage 1
  res=$(curl -s -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage1" \
    -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
    -d '{"symptomText":"Our customer support chatbot answers 2000 questions per day from our product catalogue and achieves only 71 percent accuracy causing customer churn and trust issues. We need an AI system that can accurately retrieve answers from our knowledge base with measurable quality metrics and citation of sources."}')
  local recommended
  recommended=$(echo "$res" | jq -r '.recommendedArchetypesJson[0]')
  [ -z "$recommended" ] || [ "$recommended" = "null" ] && recommended="1"

  # Auto-acknowledge any HIGH severity voids extracted by Stage 1 to prevent Quality Gate blocks
  local high_voids
  high_voids=$(echo "$res" | jq -c '[.voidListJson[] | select(.severity == "HIGH") | .void_code]')
  [ -z "$high_voids" ] || [ "$high_voids" = "null" ] && high_voids="[]"

  # Stage 2
  curl -s -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage2" \
    -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
    -d "{\"archetype\":\"${recommended}\",\"acknowledgedVoidCodes\":${high_voids}}" > /dev/null

  # Stage 3
  curl -s -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage3" \
    -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
    -d '{"probeResponses":{
      "Roughly how many people will search or ask questions per day?":"Around 2000 queries per day from 500 support agents during business hours",
      "When someone gets a wrong or unhelpful answer, what do you expect to happen next?":"Escalate to a human agent and log the failure for weekly accuracy review with the team",
      "Does this need to pull from documents/systems you already have, and which ones?":"Yes pulls from our Zendesk knowledge base and PostgreSQL product catalogue via REST API",
      "How quickly does an answer need to appear after someone asks?":"Under 3 seconds end to end for 95th percentile of all queries"
    }}' > /dev/null

  # Stage 4 — save tech inputs (sets currentStage=5, returns {success:true})
  echo "  [prereq] Running PUT /stage4 (saves tech inputs)..."
  curl -s -X PUT "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage4" \
    -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
    -d '{"current_stack":"Python FastAPI PostgreSQL AWS ECS Redis","data_available":"200k Zendesk conversation logs and 50k SKU product catalogue entries","latency_requirement":"Under 3 seconds end-to-end for 95th percentile"}' \
    --max-time 30 > /dev/null

  # Stage 5 — CEO explicitly triggers synthesis (SYNCHRONOUS, returns gate result directly)
  echo "  [prereq] Running POST /stage5 (triggers synthesis — synchronous, blocks until done)..."
  local gate_res
  gate_res=$(curl -s -X POST "${BASE_URL}/elicitation/sessions/${SESSION_ID}/stage5" \
    -H "Content-Type: application/json" "${CEO_AUTH[@]}" \
    --max-time 120)

  local gate_passed
  gate_passed=$(echo "$gate_res" | jq -r '.gate_passed')
  PROJECT_ID=$(echo "$gate_res" | jq -r '.project_id // empty')

  echo "  [prereq] Stage 5 done. gate_passed=${gate_passed}, project_id=${PROJECT_ID}"

  if [ "$gate_passed" = "true" ]; then
    echo "  [prereq] ✓ Synthesis PASSED — Project published: ${PROJECT_ID}"
  else
    local score
    score=$(echo "$gate_res" | jq -r '.completeness_score // "unknown"')
    echo "  [prereq] ⚠ Synthesis gate FAILED (score=${score}) — session state=RETURNED"
    echo "  [prereq]   Likely cause: no matching expert candidates in DB."
    echo "  [prereq]   Tests that require a project will skip gracefully."
    PROJECT_ID=""
  fi

  export CEO_TOKEN CEO_AUTH TECH_TOKEN TECH_AUTH PROJECT_ID SESSION_ID
}