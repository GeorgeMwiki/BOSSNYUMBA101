-- =============================================================================
-- Migration 0299 - Idempotency Keys (hard DB-level uniqueness)
--
-- Closes H2 deferral: the previous `services/api-gateway/src/middleware/
-- idempotency.ts` cached responses in Redis but had NO server-side hard
-- uniqueness. Under a Redis split-brain (or before the first replica
-- finishes a SETEX) two simultaneous requests with the same key could
-- both pass through to the handler and double-execute side effects.
--
-- This table is the canonical dedup record. The middleware INSERTS
-- BEFORE invoking the handler — a duplicate INSERT collides on the
-- unique constraint and is treated as a replay. After the handler runs
-- the row is UPDATEed with the captured response so the next replay
-- returns the same status / body / headers.
--
-- Companion to:
--   - services/api-gateway/src/middleware/idempotency.ts (read-through)
--   - services/api-gateway/src/middleware/db-idempotency.middleware.ts
--   - packages/database/src/schemas/idempotency-keys.schema.ts
--   - services/api-gateway/src/composition/idempotency-sweeper.ts
--
-- Tenant scope: `tenant_id` is NULL for anonymous (webhook) calls, in
-- which case the unique scope is (key, resource_kind, NULL). For
-- authenticated calls the scope is (tenant_id, key, resource_kind).
--
-- RLS is FORCE-enabled per CLAUDE.md hard rule. The composite policy
-- below allows current_setting('app.current_tenant_id') matches OR
-- NULL rows (anonymous webhooks) provided current_setting is empty;
-- the read-side scoping for anonymous rows happens in the middleware
-- (it always uses `tenant_id IS NULL` predicates explicitly).
--
-- Append-only / forward-only / IMMUTABLE: never edit this file after
-- merge. Field/index additions land in a new numbered migration.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text,                                   -- NULL for anonymous (webhook)
  key             text        NOT NULL,                   -- Idempotency-Key header value
  resource_kind   text        NOT NULL,                   -- e.g. 'webhook.stripe' | 'owner.bulk-action'
  request_hash    text        NOT NULL,                   -- sha256(method + path + body)
  response_status integer,                                -- populated on completion
  response_body   jsonb,                                  -- populated on completion
  response_headers jsonb,                                 -- populated on completion
  state           text        NOT NULL DEFAULT 'in_flight',
  actor_id        text,                                   -- requesting user / agent
  created_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

-- State machine guard.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'idempotency_keys_state_chk'
  ) THEN
    ALTER TABLE idempotency_keys
      ADD CONSTRAINT idempotency_keys_state_chk
      CHECK (state IN ('in_flight', 'completed', 'failed'));
  END IF;
END $$;

-- The canonical hard uniqueness — two requests with the same
-- (tenant, key, resource_kind) cannot both win the INSERT race.
-- We use a partial unique index per tenant variant because PostgreSQL
-- treats NULL as distinct in UNIQUE constraints unless we segregate.

-- Authenticated scope: (tenant_id, key, resource_kind) — UNIQUE.
CREATE UNIQUE INDEX IF NOT EXISTS idempotency_keys_tenant_unique
  ON idempotency_keys (tenant_id, key, resource_kind)
  WHERE tenant_id IS NOT NULL;

-- Anonymous scope: (key, resource_kind) when tenant is NULL — UNIQUE.
CREATE UNIQUE INDEX IF NOT EXISTS idempotency_keys_anon_unique
  ON idempotency_keys (key, resource_kind)
  WHERE tenant_id IS NULL;

-- Sweep-by-expiry cron path.
CREATE INDEX IF NOT EXISTS idempotency_keys_expires_idx
  ON idempotency_keys (expires_at);

-- Operator lookup-by-state path.
CREATE INDEX IF NOT EXISTS idempotency_keys_state_idx
  ON idempotency_keys (state, created_at);

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'idempotency_keys'
       AND policyname = 'idempotency_keys_tenant_isolation'
  ) THEN
    -- Tenant-scoped rows: visible to the matching tenant.
    -- Anonymous (NULL tenant_id) rows: visible only when no tenant
    -- context is set (webhook handlers). The middleware always
    -- supplies an explicit tenant predicate too, so this is defence
    -- in depth.
    CREATE POLICY idempotency_keys_tenant_isolation
      ON idempotency_keys
      FOR ALL
      USING (
        (tenant_id IS NOT NULL
          AND tenant_id = current_setting('app.current_tenant_id', true))
        OR
        (tenant_id IS NULL
          AND coalesce(current_setting('app.current_tenant_id', true), '') = '')
      )
      WITH CHECK (
        (tenant_id IS NOT NULL
          AND tenant_id = current_setting('app.current_tenant_id', true))
        OR
        (tenant_id IS NULL
          AND coalesce(current_setting('app.current_tenant_id', true), '') = '')
      );
  END IF;
END $$;

COMMIT;
