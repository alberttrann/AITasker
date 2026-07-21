#!/usr/bin/env bash
#
# validate_group_c.sh
# Covers: Group C — CMS Config, De-hardcoding, Admin Subscription Packages
#
# Tests:
# - C-1: Public config endpoints (Domains, Seams, Archetypes, Probe Questions)
# - C-2: Admin Config RBAC (401 / 403 blocks for unauthorized users)
# - C-3: Admin Config CRUD (Create, Update, Soft-Delete)
# - C-4: Admin Subscription Package Management

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

TS=$(date +%s)
PASSWORD="Str0ng!TestPass123"

ADMIN_EMAIL="c-admin-${TS}@gmail.com"
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
echo " Group C: CMS Config & De-hardcoding Validation Suite"
echo "════════════════════════════════════════════════════════════════"

# ══════════════════════════════════════════════════════════════════
step_header "SETUP — Register Admin & CEO"

# 1. Register CEO (Standard)
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${CEO_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"CEO User\",\"roles\":\"CLIENT_CEO\"}")
CEO_TOKEN=$(safe_extract "$RES" '.access_token')

if [ "$CEO_TOKEN" = "ERROR_EXTRACTION_FAILED" ]; then
  echo -e "${RED}✗ Fatal Setup Error: Failed to register CEO.${NC}"
  echo "Server response:"
  echo "$RES" | jq . || echo "$RES"
  exit 1
fi
CEO_AUTH=(-H "Authorization: Bearer ${CEO_TOKEN}")
echo "  ✓ CEO registered (for RBAC tests)"

# 2. Register User, Promote to Admin via DB, then Login
RES=$(curl -s -X POST "${BASE_URL}/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${PASSWORD}\",\"fullName\":\"Admin User\",\"roles\":\"CLIENT_CEO\"}")

ADMIN_TOKEN_TEMP=$(safe_extract "$RES" '.access_token')
if [ "$ADMIN_TOKEN_TEMP" = "ERROR_EXTRACTION_FAILED" ]; then
  echo -e "${RED}✗ Fatal Setup Error: Failed to register Admin baseline user.${NC}"
  echo "Server response:"
  echo "$RES" | jq . || echo "$RES"
  exit 1
fi

run_db_script "
  await prisma.user.update({
    where: { email: '${ADMIN_EMAIL}' },
    data: { activeRole: 'ADMIN', roles: ['ADMIN'] }
  });
"

RES=$(curl -s -X POST "${BASE_URL}/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${PASSWORD}\"}")
ADMIN_TOKEN=$(safe_extract "$RES" '.access_token')
ADMIN_AUTH=(-H "Authorization: Bearer ${ADMIN_TOKEN}")
echo "  ✓ Admin registered, promoted, and logged in"

# ══════════════════════════════════════════════════════════════════
step_header "C-1: Public Config Read Endpoints (No Auth)"

RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/config/domains")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
check_status "200" "$CODE" "GET /config/domains"
DOMAIN_COUNT=$(echo "$BODY" | jq '. | length')
if [ "$DOMAIN_COUNT" -ge 6 ]; then
  echo -e "  ${GREEN}✓${NC} Found ${DOMAIN_COUNT} domains (expected ≥ 6)"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Found ${DOMAIN_COUNT} domains (expected ≥ 6)"
  FAIL=$((FAIL + 1))
fi

RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/config/seams")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
check_status "200" "$CODE" "GET /config/seams"
SEAM_COUNT=$(echo "$BODY" | jq '. | length')
if [ "$SEAM_COUNT" -ge 10 ]; then
  echo -e "  ${GREEN}✓${NC} Found ${SEAM_COUNT} seams (expected ≥ 10)"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Found ${SEAM_COUNT} seams (expected ≥ 10)"
  FAIL=$((FAIL + 1))
fi

RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/config/archetypes/1/probe-questions")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
check_status "200" "$CODE" "GET /config/archetypes/1/probe-questions"
PQ_COUNT=$(echo "$BODY" | jq '. | length')
if [ "$PQ_COUNT" -eq 4 ]; then
  echo -e "  ${GREEN}✓${NC} Found exactly 4 probe questions for Archetype 1"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Found ${PQ_COUNT} probe questions (expected 4)"
  FAIL=$((FAIL + 1))
fi

RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/config/archetypes/999/probe-questions")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
check_status "200" "$CODE" "GET /config/archetypes/999/probe-questions (non-existent)"
check_field_equals "$BODY" "length" "0" "Returns empty array [] (not 404)"

# ══════════════════════════════════════════════════════════════════
step_header "C-2: Admin RBAC & Security Guards"

RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/admin/config/domains")
CODE=$(echo "$RES" | tail -n1)
check_status "401" "$CODE" "No token -> 401 Unauthorized"

RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/admin/config/domains" "${CEO_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1)
check_status "403" "$CODE" "CEO token -> 403 Forbidden"

RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/admin/config/domains" "${ADMIN_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1)
check_status "200" "$CODE" "Admin token -> 200 OK"

# ══════════════════════════════════════════════════════════════════
step_header "C-3: Admin Config CRUD (Domains & Probe Questions)"

echo "  [POST] Creating a custom domain..."
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/admin/config/domains" "${ADMIN_AUTH[@]}" \
  -H "Content-Type: application/json" \
  -d "{\"code\":\"Z\",\"name\":\"Custom Admin Domain\",\"sortOrder\":99}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
check_status "201" "$CODE" "Domain created successfully"
DOMAIN_ID=$(safe_extract "$BODY" '.id')

echo "  [PUT] Updating custom domain..."
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/admin/config/domains/${DOMAIN_ID}" "${ADMIN_AUTH[@]}" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Updated Admin Domain\"}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
check_status "200" "$CODE" "Domain updated successfully"
check_field_equals "$BODY" ".name" "Updated Admin Domain" "Name change persisted"

echo "  [DELETE] Soft-deleting custom domain..."
RES=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE_URL}/admin/config/domains/${DOMAIN_ID}" "${ADMIN_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
check_status "200" "$CODE" "Domain deleted successfully"
check_field_equals "$BODY" ".isActive" "false" "isActive flag set to false"

echo "  [GET] Verifying soft-delete blocks public view..."
RES=$(curl -s "${BASE_URL}/config/domains")
DELETED_VISIBLE=$(echo "$RES" | jq "[.[] | select(.id == \"${DOMAIN_ID}\")] | length")
if [ "$DELETED_VISIBLE" -eq 0 ]; then
  echo -e "  ${GREEN}✓${NC} Soft-deleted domain is hidden from public API"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Soft-deleted domain is still visible in public API"
  FAIL=$((FAIL + 1))
fi

echo "  [POST] Adding a new probe question to Archetype 1..."
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/admin/config/probe-questions" "${ADMIN_AUTH[@]}" \
  -H "Content-Type: application/json" \
  -d "{\"archetypeCode\":\"1\",\"questionText\":\"Extra security question?\",\"displayOrder\":5}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
check_status "201" "$CODE" "Probe question created"
PQ_ID=$(safe_extract "$BODY" '.id')

RES=$(curl -s "${BASE_URL}/config/archetypes/1/probe-questions")
PQ_COUNT=$(echo "$RES" | jq '. | length')
if [ "$PQ_COUNT" -eq 5 ]; then
  echo -e "  ${GREEN}✓${NC} Archetype 1 now has 5 probe questions publicly visible"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Expected 5 questions, found ${PQ_COUNT}"
  FAIL=$((FAIL + 1))
fi

# Clean up
curl -s -X DELETE "${BASE_URL}/admin/config/probe-questions/${PQ_ID}" "${ADMIN_AUTH[@]}" > /dev/null

# ══════════════════════════════════════════════════════════════════
step_header "C-4: Subscription Packages Admin Control"

echo "  [GET] Fetching existing packages..."
RES=$(curl -s -w "\n%{http_code}" "${BASE_URL}/admin/subscriptions/packages" "${ADMIN_AUTH[@]}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
check_status "200" "$CODE" "Packages listed"

echo "  [POST] Creating an Enterprise package..."
RES=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/admin/subscriptions/packages" "${ADMIN_AUTH[@]}" \
  -H "Content-Type: application/json" \
  -d "{\"role\":\"CLIENT\",\"name\":\"Client Enterprise\",\"priceVnd\":2000000,\"durationMonths\":12}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
check_status "201" "$CODE" "Enterprise package created"
PKG_ID=$(safe_extract "$BODY" '.id')

echo "  [PUT] Updating package price..."
RES=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/admin/subscriptions/packages/${PKG_ID}" "${ADMIN_AUTH[@]}" \
  -H "Content-Type: application/json" \
  -d "{\"priceVnd\":2500000}")
CODE=$(echo "$RES" | tail -n1); BODY=$(echo "$RES" | sed '$d')
check_status "200" "$CODE" "Package price updated"
check_field_equals "$BODY" ".priceVnd" "2500000" "New price persisted"

print_summary "Group C — CMS Config & Packages"