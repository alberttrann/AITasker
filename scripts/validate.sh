#!/usr/bin/env bash
# scripts/validate.sh
# Run from the repo root: bash scripts/validate.sh
#
# Layers:
#   1. TypeScript compile    — catches type errors and missing fields
#   2. ESLint                — catches code style and import issues
#   3. Unit tests            — fast business logic tests, no DB
#   4. Integration + Swagger — full API contract tests against real test DB
#
# On Windows: run via Git Bash or WSL.
# Alternatively use: npm run validate (see package.json)

set -euo pipefail

# Colours
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
pass() { echo -e "${GREEN}✓  $1${NC}"; }
fail() { echo -e "${RED}✗  $1${NC}"; echo -e "${RED}Fix the above before pushing.${NC}"; exit 1; }
info() { echo -e "${YELLOW}→  $1${NC}"; }
divider() { echo -e "\n${YELLOW}────────────────────────────────────────${NC}"; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   AITasker — Validation Suite        ║"
echo "╚══════════════════════════════════════╝"

# Layer 1: TypeScript
divider
info "Layer 1: TypeScript compile check"
cd "$ROOT/backend"
if npx tsc --noEmit; then
  pass "TypeScript: no type errors"
else
  fail "TypeScript: compile errors found"
fi

# Layer 2: ESLint
divider
info "Layer 2: ESLint"
if npm run lint -- --max-warnings 0; then
  pass "ESLint: clean"
else
  fail "ESLint: errors or warnings found"
fi

# Layer 3: Unit tests
divider
info "Layer 3: Unit tests (mocked deps, no DB)"
if npx jest --config jest.unit.config.js --passWithNoTests; then
  pass "Unit tests: all passed"
else
  fail "Unit tests: failures found"
fi

# Layer 4: Integration + Swagger tests
divider
info "Layer 4: Integration + Swagger tests (starting test DB)"

cd "$ROOT"
docker compose -f backend/docker-compose.test.yml up -d --wait
info "Test DB healthy"

cd "$ROOT/backend"
DATABASE_URL="postgresql://aitasker_test:aitasker_test@localhost:5433/aitasker_test" \
  npx prisma migrate deploy
info "Migrations applied"

# Run tests — always tear down DB afterwards, even on failure
set +e
npm run test:e2e
TEST_EXIT=$?
set -e

cd "$ROOT"
docker compose -f backend/docker-compose.test.yml down
info "Test DB stopped and wiped"

if [ $TEST_EXIT -ne 0 ]; then
  fail "Integration/Swagger tests: failures found"
fi
pass "Integration + Swagger tests: all passed"

# Summary 
divider
echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   All checks passed — safe to push   ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
echo ""