-- Migration 0169 — Phase K-A SessionStore (R1 parity gap #2).
--
-- Adds `central_intelligence.session_snapshots` for the Postgres
-- adapter in packages/central-intelligence/src/kernel/session-store/
-- postgres-session-store.ts. Mirrors the Claude Agent SDK v0.3.x
-- SessionStore protocol — opaque JSONB payload keyed by session_id,
-- with TTL via `expires_at`, optional resume_token for defer-and-
-- resume flows, and RLS on tenant_id.
--
-- The table lives in a dedicated `central_intelligence` schema (NOT
-- `public`) because:
--   1. Snapshot rows are an INTERNAL durability primitive — operators
--      should not be running ad-hoc SELECTs on them.
--   2. The schema gives a clean grant boundary: only the kernel
--      service role has write access; analytics roles get nothing.
--
-- Idempotent — every CREATE is `IF NOT EXISTS` so a partial run on a
-- broken deploy is safe to retry.

-- ============================================================================
-- 1. Schema
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS central_intelligence;

COMMENT ON SCHEMA central_intelligence IS
  '0169 — internal kernel substrate (session snapshots, file checkpoints, '
  'orchestrator durability). Not for direct analytics use.';

-- ============================================================================
-- 2. Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS central_intelligence.session_snapshots (
  session_id    TEXT        PRIMARY KEY,
  tenant_id     UUID        REFERENCES public.tenants(id) ON DELETE CASCADE,
  persona_id    TEXT        NOT NULL,
  captured_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ,
  payload       JSONB       NOT NULL,
  resume_token  TEXT,
  ttl_ms        BIGINT,
  -- Operator-facing sanity checks.
  CONSTRAINT session_snapshots_ttl_nonneg_chk
    CHECK (ttl_ms IS NULL OR ttl_ms >= 0),
  CONSTRAINT session_snapshots_token_unique UNIQUE (resume_token)
);

COMMENT ON TABLE central_intelligence.session_snapshots IS
  '0169 — Phase K-A SessionStore. One row per session snapshot keyed '
  'by session_id; JSONB payload is opaque to SQL. Cross-tenant safety '
  'via RLS on tenant_id.';

COMMENT ON COLUMN central_intelligence.session_snapshots.tenant_id IS
  'NULL for platform-tier sessions (HQ admin, regulator views).';

COMMENT ON COLUMN central_intelligence.session_snapshots.expires_at IS
  'When set, the row is treated as missing once now() exceeds it. The '
  'PostgresSessionStore.read() / .list() filter on this column; a '
  'background sweep (separate cron) hard-deletes expired rows.';

COMMENT ON COLUMN central_intelligence.session_snapshots.resume_token IS
  'Issued by a defer-decision hook so an external approval can re-enter '
  'the orchestrator with the exact paused snapshot. UNIQUE.';

-- ============================================================================
-- 3. Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS session_snapshots_tenant_captured_idx
  ON central_intelligence.session_snapshots (tenant_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS session_snapshots_persona_idx
  ON central_intelligence.session_snapshots (persona_id);

CREATE INDEX IF NOT EXISTS session_snapshots_expires_idx
  ON central_intelligence.session_snapshots (expires_at)
  WHERE expires_at IS NOT NULL;

-- ============================================================================
-- 4. RLS
-- ============================================================================

ALTER TABLE central_intelligence.session_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE central_intelligence.session_snapshots FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS session_snapshots_tenant_isolation
  ON central_intelligence.session_snapshots;
CREATE POLICY session_snapshots_tenant_isolation
  ON central_intelligence.session_snapshots
  FOR ALL
  TO authenticated
  USING (
    -- Platform-tier rows visible only to admins (handled in app-layer);
    -- tenant rows visible only to the matching tenant.
    tenant_id IS NULL
    OR tenant_id = public.current_app_tenant_id()
  )
  WITH CHECK (
    tenant_id IS NULL
    OR tenant_id = public.current_app_tenant_id()
  );

-- The anon role gets nothing; service_role bypasses RLS by Supabase
-- convention so kernel workers can perform cross-tenant maintenance.
REVOKE ALL ON central_intelligence.session_snapshots FROM anon;

-- ============================================================================
-- 5. Operator note
-- ============================================================================
--
-- After this migration runs, the orchestrator can be wired via:
--
--   import { sessionStore } from '@bossnyumba/central-intelligence';
--   const store = sessionStore.createSessionStore({
--     kind: 'postgres',
--     postgres: { pg: pgClient },
--   });
--
-- The pgClient MUST issue `SET LOCAL app.tenant_id = '<uuid>'` at the
-- start of every transaction (the api-gateway middleware in
-- services/api-gateway/src/middleware/tenant-context.ts already does
-- this for request-scoped sessions; background workers should mirror
-- the pattern).
--
-- Expected RLS coverage after 0169:
--   * rls_forced  = true
--   * policy_count = 1
--   * tenant_id   = nullable (platform-tier semantics)
--
-- A follow-up cron (Phase K-B) will hard-delete expired rows on a
-- daily schedule.
