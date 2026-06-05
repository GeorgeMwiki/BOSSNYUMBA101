-- =============================================================================
-- 0159b: Pre-empt `0160_autonomy_governance.sql`, which is UNPARSEABLE on a
--        fresh PostgreSQL 15 database.
--
-- ORDERING + UNPARSEABLE-FILE FIX (fresh-DB blocker). Mirrors the shipped
-- fix-forward `0177_fix_autonomy_governance_window.sql`, hoisted to run
-- BEFORE 0160 and extended to cover all three of 0160's tables.
--
-- ─────────────────────────────────────────────────────────────────────
-- Problem
-- ─────────────────────────────────────────────────────────────────────
-- 0160 declares, inside `CREATE TABLE IF NOT EXISTS sub_md_slos (...)`:
--
--     window         text        NOT NULL,                 -- line 61
--     ...
--     CHECK (window IN ('rolling-24h', 'rolling-7d', 'rolling-30d'))  -- line 76
--
-- `window` is a RESERVED keyword in PostgreSQL (pg_get_keywords → catcode
-- 'R'). Unquoted, it cannot be used as a column-name token. On pg15 the
-- statement fails to PARSE at the column declaration itself:
--
--     ERROR:  syntax error at or near "window"   (SQLSTATE 42601)
--     -- reported at byte position 2907 = the `window text NOT NULL`
--     -- column declaration on line 61 (NOT the CHECK constraint).
--
-- The repo SHIPS `0177_fix_autonomy_governance_window.sql` as the forward-
-- fix. It re-creates `sub_md_slos` with `"window"` correctly quoted. BUT:
--
--   * 0177 sorts AFTER 0160, so on a fresh DB the run dies at 0160 long
--     before 0177 is reached (the same ordering trap 0123b/0154b solve).
--
--   * Critically, a parse error cannot be sidestepped by pre-creating the
--     table: `CREATE TABLE IF NOT EXISTS` is PARSED before the IF-NOT-
--     EXISTS existence check is evaluated, so 0160's broken statement
--     fails even when `sub_md_slos` already exists. (0177's own header
--     assumes the column declaration parses fine and only the CHECK
--     fails — that assumption is incorrect for pg15; the COLUMN
--     declaration is the parse-failure site. Verified empirically.)
--
-- Because the broken statement lives INSIDE the immutable 0160 file and
-- fires at parse time, NO preempt can make 0160 itself succeed. The only
-- correct fix is to (a) create 0160's tables correctly here, and then
-- (b) mark 0160 as already-applied in the migration ledger so the runner
-- SKIPS its unparseable body. On a real Supabase deployment (where
-- migrations apply in order) this is also strictly safer: 0160 would
-- otherwise fail there too — pre-empting it means its broken body never
-- executes anywhere, while 0177 still lands later as a harmless no-op.
--
-- ─────────────────────────────────────────────────────────────────────
-- What this file does
-- ─────────────────────────────────────────────────────────────────────
--   1. Create all THREE tables 0160 owns — `tenant_autonomy_caps`,
--      `sub_md_slos` (with `"window"` quoted, per 0177), and
--      `sub_md_slo_events` — verbatim from 0160 except for the quoting
--      fix. These three tables are created ONLY by 0160 anywhere in the
--      tree, so this preempt is their sole fresh-DB source.
--   2. Re-create 0160's indexes (all four on sub_md_slos) — these match
--      0177 §3 exactly.
--   3. Record `0160_autonomy_governance` in `drizzle.__drizzle_migrations`
--      (guarded by NOT EXISTS) so the runner's "already applied" check
--      short-circuits and never sends 0160's unparseable SQL to Postgres.
--
-- ─────────────────────────────────────────────────────────────────────
-- Idempotency / safety
-- ─────────────────────────────────────────────────────────────────────
--   * Every CREATE TABLE / CREATE INDEX is `IF NOT EXISTS`.
--   * The ledger insert is guarded by NOT EXISTS, so re-running — or
--     running on a Drizzle-managed DB where the tables already exist and
--     0160 was recorded — is a no-op.
--   * When 0177 runs later it finds the table + constraints already
--     present and is a perfect no-op (its own DO-blocks are NOT-EXISTS
--     guarded).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. tenant_autonomy_caps  (0160 §1 — verbatim; no reserved words).
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tenant_autonomy_caps (
  tenant_id                 text        PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  max_mutations_per_day     integer     NOT NULL DEFAULT 50,
  max_cost_usd_cents_per_day bigint     NOT NULL DEFAULT 500000,
  per_tool_tier_caps        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  per_sub_md_caps           jsonb       NOT NULL DEFAULT '{}'::jsonb,
  slowdown_at               numeric(3,2) NOT NULL DEFAULT 0.80,
  hard_stop_at              numeric(3,2) NOT NULL DEFAULT 1.00,
  updated_at                timestamptz NOT NULL DEFAULT now(),
  updated_by                text        NOT NULL,

  CONSTRAINT tenant_autonomy_caps_mutations_chk
    CHECK (max_mutations_per_day >= 0),
  CONSTRAINT tenant_autonomy_caps_cost_chk
    CHECK (max_cost_usd_cents_per_day >= 0),
  CONSTRAINT tenant_autonomy_caps_slowdown_chk
    CHECK (slowdown_at > 0 AND slowdown_at <= 1),
  CONSTRAINT tenant_autonomy_caps_hard_stop_chk
    CHECK (hard_stop_at > 0 AND hard_stop_at <= 1),
  CONSTRAINT tenant_autonomy_caps_slowdown_leq_hardstop_chk
    CHECK (slowdown_at <= hard_stop_at)
);

-- ─────────────────────────────────────────────────────────────────────
-- 2. sub_md_slos  (0160 §2 — `"window"` QUOTED, mirroring 0177 §1+§2).
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sub_md_slos (
  sub_md         text        NOT NULL,
  tenant_id      text        REFERENCES public.tenants(id) ON DELETE CASCADE,
  metric         text        NOT NULL,
  target         numeric(12,6) NOT NULL,
  "window"       text        NOT NULL,
  breach_action  text        NOT NULL,
  canary_stage   text        NOT NULL DEFAULT 'shadow',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (sub_md, tenant_id, metric),

  CONSTRAINT sub_md_slos_breach_action_chk
    CHECK (breach_action IN ('warn', 'reduce-traffic', 'handoff', 'kill-and-rollback')),
  CONSTRAINT sub_md_slos_window_chk
    CHECK ("window" IN ('rolling-24h', 'rolling-7d', 'rolling-30d')),
  CONSTRAINT sub_md_slos_canary_stage_chk
    CHECK (canary_stage IN ('shadow', 'canary-1pct', 'canary-5pct', 'canary-25pct', 'live')),
  CONSTRAINT sub_md_slos_metric_chk
    CHECK (metric IN ('resolution-quality', 'task-completion-rate', 'owner-cs-score', 'cost-per-resolution'))
);

CREATE INDEX IF NOT EXISTS idx_sub_md_slos_metric
  ON public.sub_md_slos (sub_md, metric);
CREATE INDEX IF NOT EXISTS idx_sub_md_slos_tenant
  ON public.sub_md_slos (tenant_id);
CREATE INDEX IF NOT EXISTS idx_sub_md_slos_canary
  ON public.sub_md_slos (canary_stage);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sub_md_slos_platform_default
  ON public.sub_md_slos (sub_md, metric)
  WHERE tenant_id IS NULL;

COMMENT ON COLUMN public.sub_md_slos."window" IS
  '0159b — Time window for the SLO. Quoted because `window` is a reserved '
  'word in PostgreSQL. Allowed values enforced by sub_md_slos_window_chk. '
  'Mirrors the fix-forward in 0177.';

-- ─────────────────────────────────────────────────────────────────────
-- 3. sub_md_slo_events  (0160 §3 — verbatim; no reserved words).
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sub_md_slo_events (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_md          text         NOT NULL,
  tenant_id       text         REFERENCES public.tenants(id) ON DELETE CASCADE,
  timestamp       timestamptz  NOT NULL DEFAULT now(),
  metric          text         NOT NULL,
  actual_value    numeric(14,6) NOT NULL,
  predicted_value numeric(14,6),
  delta           numeric(14,6) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sub_md_slo_events_sub_md_time
  ON public.sub_md_slo_events (sub_md, metric, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sub_md_slo_events_tenant_time
  ON public.sub_md_slo_events (tenant_id, timestamp DESC);

-- ─────────────────────────────────────────────────────────────────────
-- 4. Mark 0160 as applied so the runner SKIPS its unparseable body.
--    The runner records each migration under hash = filename without the
--    `.sql` suffix (see run-migrations.ts: `name = file.replace('.sql','')`
--    and the `WHERE hash = name` skip check). Guarded by NOT EXISTS so
--    this is a no-op on any DB where 0160 was already recorded.
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT '0160_autonomy_governance', (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations
  WHERE hash = '0160_autonomy_governance'
);
