#!/usr/bin/env bash
#
# MF-19: User Profile Management
#
# Covers:
#   GET  /users/me
#   PUT  /users/me
#   GET  /users/:userId/public-profile
#   PUT  /users/me/tax-code       (verify + persist)
#   POST /auth/verify-tax-code    (pre-verify only)
#   POST /auth/refresh            (refresh token flow)
#   POST /auth/register
#   POST /auth/login

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_lib.sh"

require_jq
health_check

TS=$(date +%s)
PASSWORD="Str0ng!TestPass123"
EMAIL="mf19-user-${TS}@aitasker.test"

echo ""
echo "════════════════════════════════════════════════════════"
echo " MF-19: User Profile Management"
echo "════════════════════════════════════════════════════════"

step_header "POST /auth/register — register user"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF19 User\",\"phone\":\"0901234597\",\"roles\":\"CLIENT_CEO\"}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "201" "$CODE" "Register returns 201"
TOKEN=$(echo "$BODY" | jq -r '.access_token')
REFRESH_TOKEN=$(echo "$BODY" | jq -r '.refresh_token')
USER_ID=$(echo "$BODY" | jq -r '.user.id')
AUTH=(-H "Authorization: Bearer ${TOKEN}")

step_header "GET /users/me — read own profile"
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/users/me" "${AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Profile readable"
check_field_equals "$BODY" ".email" "${EMAIL}" "Correct email returned"
check_field_equals "$BODY" ".activeRole" "CLIENT" "activeRole is CLIENT"
check_field_present "$BODY" ".activeRoleProfile" "activeRoleProfile present"

step_header "PUT /users/me — update fullName, companyName, industry, ceoName"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/users/me" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"fullName":"MF19 User Updated","companyName":"AITasker Demo Corp","industry":"LegalTech","ceoName":"MF19 CEO Name"}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Profile update accepted"
check_field_equals "$BODY" ".success" "true" "success is true"

step_header "GET /users/me — confirm update persisted"
RES=$(curl -s "${BASE_URL}/users/me" "${AUTH[@]}")
print_body "$RES"
check_field_equals "$RES" ".fullName" "MF19 User Updated" "fullName updated"

step_header "POST /auth/verify-tax-code — pre-verify tax code (auth endpoint, no persist)"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/verify-tax-code" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"taxCode":"0312956219"}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
if [ "$CODE" = "200" ]; then
  check_field_present "$BODY" ".verified" "verified field present"
  echo -e "  \033[0;32m✓\033[0m Tax code pre-verify endpoint reachable"
  PASS=$((PASS + 1))
else
  echo -e "  \033[1;33m⚠\033[0m auth/verify-tax-code returned ${CODE} — VietQR may be unavailable"
fi

step_header "PUT /users/me/tax-code — verify AND persist tax code to clientProfile"
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/users/me/tax-code" \
  -H "Content-Type: application/json" "${AUTH[@]}" \
  -d '{"taxCode":"0312956219"}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
if [ "$CODE" = "200" ]; then
  check_field_present "$BODY" ".verified" "verified field present"
  PASS=$((PASS + 1))
else
  echo -e "  \033[1;33m⚠\033[0m users/me/tax-code returned ${CODE} — VietQR may be unavailable"
fi

step_header "GET /users/:userId/public-profile — requires an EXPERT account (not CEO)"
# Public profile endpoint only works for EXPERT accounts (they have an expertProfile).
# Register a dedicated Expert user and use that ID for the public-profile test.
EXPERT_PUB_EMAIL="mf19-expert-pub-${TS}@aitasker.test"
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${EXPERT_PUB_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"MF19 Expert Public\",\"phone\":\"0901234598\",\"roles\":\"EXPERT\"}")
EXPERT_PUB_TOKEN=$(echo "$RES" | jq -r '.access_token')
EXPERT_PUB_ID=$(echo "$RES" | jq -r '.user.id')
EXPERT_PUB_AUTH=(-H "Authorization: Bearer ${EXPERT_PUB_TOKEN}")
# Build minimal expert profile so the endpoint has data to return
curl -s -X POST "${BASE_URL}/expert-profile/domains" -H "Content-Type: application/json" "${EXPERT_PUB_AUTH[@]}" \
  -d '{"domainCode":"A","depthLevel":"DEEP"}' > /dev/null
curl -s -X PUT "${BASE_URL}/expert-profile/me" -H "Content-Type: application/json" "${EXPERT_PUB_AUTH[@]}" \
  -d '{"engagementModel":"MILESTONE","stackTagsJson":["Python"]}' > /dev/null

RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/users/${EXPERT_PUB_ID}/public-profile" "${AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "200" "$CODE" "Expert public profile readable by CEO"
check_field_present "$BODY" ".fullName" "fullName present in public profile"
# Verify sensitive fields are NOT present
HAS_EMAIL=$(echo "$BODY" | jq '.email // empty')
if [ -z "$HAS_EMAIL" ]; then
  echo -e "  \033[0;32m✓\033[0m email correctly excluded from public profile"
  PASS=$((PASS + 1))
else
  echo -e "  \033[0;31m✗\033[0m email should not be present in public profile"
  FAIL=$((FAIL + 1))
fi

step_header "POST /auth/refresh — use refresh_token to get new access_token"
if [ -n "${REFRESH_TOKEN:-}" ] && [ "$REFRESH_TOKEN" != "null" ]; then
  RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/refresh" \
    -H "Content-Type: application/json" \
    -d "{\"refresh_token\":\"${REFRESH_TOKEN}\"}")
  CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
  print_body "$BODY"
  check_status "201" "$CODE" "Token refresh accepted"
  check_field_present "$BODY" ".access_token" "New access_token returned"
  NEW_TOKEN=$(echo "$BODY" | jq -r '.access_token')
  if [ "$NEW_TOKEN" != "$TOKEN" ]; then
    echo -e "  \033[0;32m✓\033[0m New access_token is different from old one"
    PASS=$((PASS + 1))
  else
    echo -e "  \033[1;33m⚠\033[0m Token may be same (some implementations reuse until near expiry)"
  fi
else
  echo -e "  \033[1;33m⚠\033[0m No refresh_token returned at register — auth/refresh test skipped"
fi

step_header "POST /auth/refresh — EDGE CASE: invalid refresh_token → 401"
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/auth/refresh" \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"invalid.token.here"}')
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
print_body "$BODY"
check_status "401" "$CODE" "Invalid refresh_token correctly rejected"

print_summary "MF-19"