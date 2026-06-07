#!/usr/bin/env bash
# =============================================================================
# run-integration-tests.sh — DB-backed integration tests against throwaway PG
# =============================================================================
# Local mirror of .github/workflows/integration-tests.yml. Spins a disposable
# pgvector/pgvector:pg16 container, seeds the Supabase JWT-claim roles + the
# vector extension, applies every migration via `pnpm migrate`, then runs the
# database package test suite with DATABASE_URL + LIVE_DB=1 exported so the six
# DB-integration tests that otherwise self-skip actually execute:
#
#   packages/database/src/__tests__/migration-writer.integration.test.ts  (3)
#   packages/database/src/__tests__/brain-thread.integration.test.ts      (2)
#   packages/database/src/__tests__/user-action-tracker.test.ts (live)    (1)
#
# Usage:
#   ./scripts/run-integration-tests.sh           # start PG, migrate, test, clean
#   KEEP_DB=1 ./scripts/run-integration-tests.sh # leave the container running
#
# Requires: Docker running, pnpm 8.15, node 20.
# =============================================================================
set -euo pipefail

CONTAINER=bn-integration-pg
HOST_PORT="${PG_PORT:-55433}"
PGUSER=bossnyumba
PGPASSWORD=bossnyumba
PGDB=bossnyumba_integration
export DATABASE_URL="postgres://${PGUSER}:${PGPASSWORD}@localhost:${HOST_PORT}/${PGDB}"
export LIVE_DB=1

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

cleanup() {
  if [ "${KEEP_DB:-0}" = "1" ]; then
    echo "KEEP_DB=1 set — leaving container '${CONTAINER}' running on port ${HOST_PORT}."
    return
  fi
  echo "Removing container '${CONTAINER}'..."
  docker rm -f "${CONTAINER}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> Starting throwaway Postgres (pgvector/pgvector:pg16) on :${HOST_PORT}"
docker rm -f "${CONTAINER}" >/dev/null 2>&1 || true
docker run -d --name "${CONTAINER}" \
  -e "POSTGRES_USER=${PGUSER}" \
  -e "POSTGRES_PASSWORD=${PGPASSWORD}" \
  -e "POSTGRES_DB=${PGDB}" \
  -p "${HOST_PORT}:5432" \
  pgvector/pgvector:pg16 >/dev/null

echo "==> Waiting for Postgres to accept connections"
for i in $(seq 1 30); do
  if docker exec "${CONTAINER}" pg_isready -U "${PGUSER}" >/dev/null 2>&1; then
    echo "    ready after ${i}s"
    break
  fi
  sleep 1
  if [ "$i" = "30" ]; then echo "Postgres did not become ready" >&2; exit 1; fi
done

echo "==> Enabling pgvector extension"
docker exec -e "PGPASSWORD=${PGPASSWORD}" "${CONTAINER}" \
  psql -U "${PGUSER}" -d "${PGDB}" -c "CREATE EXTENSION IF NOT EXISTS vector" >/dev/null

echo "==> Seeding Supabase roles (authenticated, anon, service_role)"
docker exec -i -e "PGPASSWORD=${PGPASSWORD}" "${CONTAINER}" \
  psql -U "${PGUSER}" -d "${PGDB}" >/dev/null <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END
$$;
SQL

echo "==> Applying migrations (pnpm migrate)"
pnpm migrate

echo "==> Running database integration tests (DATABASE_URL + LIVE_DB=1 set)"
pnpm -C packages/database test

echo "==> Done."
