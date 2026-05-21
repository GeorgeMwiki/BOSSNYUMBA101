-- ─────────────────────────────────────────────────────────────────────
-- Migration 0183 — user_action_tracker (progressive-disclosure mastery).
--
-- Closes the persistence gap for the chat-ui MasteryGate / useUserMastery
-- pair. Each (tenant_id, user_id, action_id) tuple holds a lifetime
-- counter plus first/last-seen timestamps. The mastery scorer reads
-- one slice per render: O(1) lookup via the composite primary key.
--
-- Schema:
--
--   user_action_tracker
--   ├── tenant_id   TEXT   NOT NULL  (component of composite PK)
--   ├── user_id     TEXT   NOT NULL  (component of composite PK)
--   ├── action_id   TEXT   NOT NULL  (component of composite PK)
--   ├── action_count BIGINT NOT NULL DEFAULT 0  CHECK (action_count >= 0)
--   ├── first_seen  TIMESTAMPTZ NOT NULL DEFAULT NOW()
--   └── last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW()
--
-- Idempotent — IF NOT EXISTS on the table + index; policies are
-- DROP-then-CREATE inside a DO/IF EXISTS guard (no `CREATE POLICY IF
-- NOT EXISTS` form in Postgres).
--
-- RLS predicate: `tenant_id::text = current_setting('app.current_tenant_id', true)`.
-- The NULL escape branch is intentional — utility migrations that pre-seed
-- platform-default action catalogues need to write rows before the GUC
-- is bound (mirrors the pattern in memory_blocks, currency_preferences).
-- ─────────────────────────────────────────────────────────────────────

-- ============================================================================
-- 1. Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_action_tracker (
  tenant_id    TEXT        NOT NULL,
  user_id      TEXT        NOT NULL,
  action_id    TEXT        NOT NULL,
  action_count BIGINT      NOT NULL DEFAULT 0,
  first_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, user_id, action_id),
  CONSTRAINT user_action_tracker_action_count_chk CHECK (action_count >= 0)
);

-- ============================================================================
-- 2. Indexes
-- ============================================================================

-- "Recently active users in this tenant" cohort queries — the PK
-- already covers (tenant_id, user_id, action_id) lookups, so we only
-- need the supplementary (tenant_id, last_seen DESC) ordering.
CREATE INDEX IF NOT EXISTS idx_user_action_tracker_tenant_last_seen
  ON user_action_tracker (tenant_id, last_seen DESC);

-- ============================================================================
-- 3. Row-Level Security
-- ============================================================================

ALTER TABLE user_action_tracker ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_action_tracker FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'user_action_tracker') THEN
    DROP POLICY IF EXISTS user_action_tracker_tenant_isolation
      ON user_action_tracker;
    CREATE POLICY user_action_tracker_tenant_isolation ON user_action_tracker
      USING (
        tenant_id IS NULL
        OR tenant_id::text = current_setting('app.current_tenant_id', true)
      );

    DROP POLICY IF EXISTS user_action_tracker_tenant_isolation_insert
      ON user_action_tracker;
    CREATE POLICY user_action_tracker_tenant_isolation_insert
      ON user_action_tracker
      FOR INSERT
      WITH CHECK (
        tenant_id IS NULL
        OR tenant_id::text = current_setting('app.current_tenant_id', true)
      );

    DROP POLICY IF EXISTS user_action_tracker_tenant_isolation_update
      ON user_action_tracker;
    CREATE POLICY user_action_tracker_tenant_isolation_update
      ON user_action_tracker
      FOR UPDATE
      USING (
        tenant_id IS NULL
        OR tenant_id::text = current_setting('app.current_tenant_id', true)
      )
      WITH CHECK (
        tenant_id IS NULL
        OR tenant_id::text = current_setting('app.current_tenant_id', true)
      );
  END IF;
END $$;
