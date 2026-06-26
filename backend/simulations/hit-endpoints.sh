#!/usr/bin/env bash
set -uo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info() { echo -e "${YELLOW}→ $1${NC}"; }
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TEST_DB_URL="postgresql://testuser:testpassword@localhost:5433/aitasker_test"
SERVER_PORT="${PORT:-3001}"
SERVER_PID=""
ENV_BACKUP=".env.backup-before-sim"

restore_env() {
  if [ -f "$ENV_BACKUP" ]; then
    mv "$ENV_BACKUP" .env
    info "Restored original .env"
  fi
}

# kill the FULL process tree bound to the port, not just $SERVER_PID.
kill_port() {
  local port=$1
  local pids
  pids=$(netstat -ano 2>/dev/null | grep "LISTENING" | grep ":${port} " | awk '{print $NF}' | sort -u)
  for pid in $pids; do
    if [ -n "$pid" ] && [ "$pid" != "0" ]; then
      info "Killing orphaned process PID $pid still bound to port ${port}..."
      taskkill //F //PID "$pid" 2>/dev/null || true
    fi
  done
}

cleanup() {
  if [ -n "$SERVER_PID" ]; then
    info "Stopping backend server (PID $SERVER_PID)..."
    kill "$SERVER_PID" 2>/dev/null
    wait "$SERVER_PID" 2>/dev/null
  fi
  kill_port "$SERVER_PORT"
  info "Stopping test database..."
  docker compose -f docker-compose.test.yml down >/dev/null 2>&1
  restore_env
}
trap cleanup EXIT

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║  AITasker — Live Endpoint Simulation Suite ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# clear the port BEFORE doing anything else, in case a previous
# run's orphan is still sitting there from before this script even started.
info "Clearing port ${SERVER_PORT} of any orphaned processes..."
kill_port "$SERVER_PORT"
sleep 1

FASTAPI_HOST="${FASTAPI_HOST:-127.0.0.1}"
FASTAPI_PORT="${FASTAPI_PORT:-8000}"
FASTAPI_URL_CHECK="http://${FASTAPI_HOST}:${FASTAPI_PORT}"

info "Checking ai-service at ${FASTAPI_URL_CHECK}/health ..."
if ! node simulations/health-check.js "${FASTAPI_URL_CHECK}/health"; then
  fail "ai-service is not responding at ${FASTAPI_URL_CHECK}/health"
  echo "  Start it: cd ai-service && uvicorn app.main:app --reload --reload-dir app --port 8000"
  exit 1
fi
ok "ai-service is up"

# explicitly verify the Docker daemon itself is reachable 
if ! docker info > /dev/null 2>&1; then
  fail "Docker daemon is not reachable. Is Docker Desktop running?"
  echo "  Start Docker Desktop and wait for 'Engine running' before retrying."
  exit 1
fi
ok "Docker daemon is up"

info "Starting isolated test database (port 5433)..."
docker compose -f docker-compose.test.yml up -d --wait
COMPOSE_EXIT=$?
if [ $COMPOSE_EXIT -ne 0 ]; then
  fail "docker compose up failed (exit code $COMPOSE_EXIT)."
  exit 1
fi
ok "Docker reports test database container healthy"

info "Verifying Prisma can actually reach the test database..."
DB_READY=0
for i in $(seq 1 20); do
  RESULT=$(npx prisma db execute --stdin --url="$TEST_DB_URL" <<< "SELECT 1;" 2>&1)
  if [ $? -eq 0 ]; then
    ok "Prisma confirmed connection (took ${i}s)"
    DB_READY=1
    break
  fi
  sleep 1
done

if [ "$DB_READY" -eq 0 ]; then
  fail "Prisma could not connect to the test database after 20s. Last error:"
  echo "$RESULT"
  exit 1
fi

info "Swapping in test .env for migrations..."
cp .env "$ENV_BACKUP"
cat > .env << EOF
DATABASE_URL="${TEST_DB_URL}"
DIRECT_URL="${TEST_DB_URL}"
PORT=${SERVER_PORT}
NODE_ENV=test
JWT_SECRET=${JWT_SECRET:-test-jwt-secret-not-for-production}
JWT_EXPIRES_IN=7d
SEPAY_WEBHOOK_SECRET=${SEPAY_WEBHOOK_SECRET:-whsec_test_secret_for_simulation}
PLATFORM_SETTINGS_ID=00000000-0000-0000-0000-000000000004
FASTAPI_URL=${FASTAPI_URL:-http://127.0.0.1:8000/}
CORS_ORIGIN=http://localhost:5173/
EOF

info "Applying migrations to test database..."
npx prisma migrate deploy
MIGRATE_EXIT=$?

if [ $MIGRATE_EXIT -ne 0 ]; then
  fail "Migration FAILED (exit code $MIGRATE_EXIT)."
  exit 1
fi
ok "Migrations applied against the local test database"

info "Verifying elicitation_sessions table actually exists..."
TABLE_CHECK=$(npx prisma db execute --stdin --url="$TEST_DB_URL" <<< \
  "SELECT 1 FROM information_schema.tables WHERE table_name = 'elicitation_sessions';" 2>&1)
if [ $? -ne 0 ]; then
  fail "Could not verify tables exist after migration:"
  echo "$TABLE_CHECK"
  exit 1
fi
ok "Confirmed tables exist in the test database"

info "Starting backend server on port ${SERVER_PORT}..."
npm run start:dev > /tmp/aitasker-sim-server.log 2>&1 &
SERVER_PID=$!

info "Waiting for backend to become healthy..."
BACKEND_UP=0
for i in $(seq 1 60); do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    fail "Backend process died during startup. Log output:"
    cat /tmp/aitasker-sim-server.log
    exit 1
  fi
  if node simulations/health-check.js "http://127.0.0.1:${SERVER_PORT}/health" > /dev/null 2>&1; then
    ok "Backend is healthy (took ${i}s)"
    BACKEND_UP=1
    break
  fi
  sleep 1
done

if [ "$BACKEND_UP" -eq 0 ]; then
  fail "Backend did not become healthy within 60s. Log output:"
  cat /tmp/aitasker-sim-server.log
  exit 1
fi

if grep -q "neon.tech" /tmp/aitasker-sim-server.log; then
  fail "Running backend server connected to Neon, not the test DB!"
  cat /tmp/aitasker-sim-server.log
  exit 1
fi
ok "Confirmed running server is NOT connected to Neon"

# confirm THIS run's specific PID is actually what's listening on the port
ACTUAL_PID=$(netstat -ano 2>/dev/null | grep "LISTENING" | grep ":${SERVER_PORT} " | awk '{print $NF}' | head -1)
info "Process actually listening on port ${SERVER_PORT}: PID ${ACTUAL_PID:-unknown} (our server's PID tree: ${SERVER_PID})"

info "Sanity-checking one real route before running the full suite..."
SANITY_CHECK=$(node -e "
const http = require('http');
const body = JSON.stringify({});
const req = http.request('http://127.0.0.1:${SERVER_PORT}/auth/register', {
  method: 'POST',
  headers: {'Content-Type':'application/json', 'Content-Length': Buffer.byteLength(body)}
}, (res) => {
  let b = '';
  res.on('data', c => b += c);
  res.on('end', () => { console.log(res.statusCode); });
});
req.on('error', () => console.log('ERROR'));
req.write(body);
req.end();
")
if [ "$SANITY_CHECK" == "404" ]; then
  fail "Sanity check failed: POST /auth/register returned 404."
  fail "Full server log:"
  cat /tmp/aitasker-sim-server.log
  fail "Process actually on port ${SERVER_PORT}: $(netstat -ano 2>/dev/null | grep "LISTENING" | grep ":${SERVER_PORT} ")"
  exit 1
fi
ok "Sanity check passed (POST /auth/register responded with HTTP $SANITY_CHECK)"

echo ""
info "Running simulation suite against http://127.0.0.1:${SERVER_PORT} ..."
echo ""

SCENARIO_ARG=""
for arg in "$@"; do
  if [ "$arg" != "--skip-elicitation" ]; then
    SCENARIO_ARG="$arg"
  fi
done

node simulations/runner.js $SCENARIO_ARG --url "http://127.0.0.1:${SERVER_PORT}"
RUNNER_EXIT=$?

exit $RUNNER_EXIT