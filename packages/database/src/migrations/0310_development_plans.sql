-- =============================================================================
-- Migration 0310 - Property development pro-forma plans (Gap-4 d).
--
-- A development pro-forma is BossNyumba's real-estate retarget of LitFin's
-- loan business-plan generator (src/core/litfin-ai/actions/tools/
-- business-plan-tools.ts). Where LitFin generated a borrower business plan
-- to support a loan application, BN generates a DEVELOPMENT pro-forma a
-- property owner / developer uses to plan a new build / refurbishment:
-- which units, expected rent, construction cost, financing, occupancy
-- ramp, and the resulting cash-flow / return.
--
-- Section taxonomy is retargeted from LitFin's business-plan sections:
--   * management-organisation  -> staffing-plan
--   * market-analysis          -> tenant-demand
--   * products-services        -> unit-mix
--   * use-of-loan              -> use-of-funds
--   * sector-performance       -> location-market
--   (executive-summary / financial-overview / risk-mitigation / swot-
--    analysis / cover-page kept.)
--
-- Backs:
--   * services/api-gateway/src/routes/development-plans.hono.ts
--   * services/api-gateway/src/composition/brain-tools/
--       development-plan-tools.ts  (development.plan.* chat tools)
--   * packages/database/src/schemas/development-plans.schema.ts
--
-- Tables:
--   * development_plans          - one row per pro-forma (owner / developer
--                                  draft). Holds the financial-assumption
--                                  set as JSONB + a currency_code.
--   * development_plan_sections  - one row per section of a plan (e.g.
--                                  staffing-plan / tenant-demand / unit-mix).
--
-- Tenant scope (CLAUDE.md hard rule — mirrors mig 0304 / 0305):
--   tenant_id::text = current_setting('app.current_tenant_id', true)
--   RLS is ENABLED + FORCEd on every table with a tenant-isolation policy.
--
-- Multi-currency (CLAUDE.md hard rule): the plan carries a currency_code;
-- monetary financial assumptions live inside the assumptions JSONB keyed by
-- assumption id (no jurisdiction currency is hard-coded). The display
-- surface formats with formatCurrency.
--
-- IDEMPOTENT + FORWARD-ONLY (CLAUDE.md hard rule: migrations are
-- immutable). Every object uses IF NOT EXISTS / guarded DO-blocks so a
-- fresh DB and a re-run both converge. development_plan_sections FK to
-- development_plans ON DELETE CASCADE (a section has no meaning without its
-- plan).
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- development_plans
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS development_plans (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL,
  title         text        NOT NULL,
  -- Optional property the pro-forma is for (kept loose: no FK so a plan can
  -- precede the property record for a greenfield build).
  property_id   uuid,
  status        text        NOT NULL DEFAULT 'draft',
  currency_code text        NOT NULL DEFAULT 'TZS',
  -- Financial assumption set: { assumptionKey: numericValue, ... }.
  assumptions   jsonb       NOT NULL DEFAULT '{}'::jsonb,
  metadata      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  provenance    jsonb       NOT NULL DEFAULT '{"via":"unknown"}'::jsonb,
  audit_hash_id text,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'development_plans_status_chk'
  ) THEN
    ALTER TABLE development_plans
      ADD CONSTRAINT development_plans_status_chk
      CHECK (status IN ('draft', 'generating', 'ready', 'archived'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'development_plans_title_chk'
  ) THEN
    ALTER TABLE development_plans
      ADD CONSTRAINT development_plans_title_chk
      CHECK (char_length(title) BETWEEN 1 AND 200);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'development_plans_currency_chk'
  ) THEN
    ALTER TABLE development_plans
      ADD CONSTRAINT development_plans_currency_chk
      CHECK (char_length(currency_code) = 3);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS development_plans_tenant_status
  ON development_plans (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS development_plans_tenant_property
  ON development_plans (tenant_id, property_id);

ALTER TABLE development_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE development_plans FORCE  ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'development_plans'
       AND policyname = 'development_plans_tenant_isolation'
  ) THEN
    CREATE POLICY development_plans_tenant_isolation
      ON development_plans
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- development_plan_sections
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS development_plan_sections (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL,
  plan_id       uuid        NOT NULL
                  REFERENCES development_plans(id) ON DELETE CASCADE,
  -- Canonical section id (e.g. staffing-plan / tenant-demand / unit-mix).
  section_key   text        NOT NULL,
  title_en      text        NOT NULL,
  title_sw      text        NOT NULL,
  -- Generated / edited prose for the section. EN + SW kept side-by-side so
  -- the locale toggle is absolute (CLAUDE.md hard rule).
  body_en       text        NOT NULL DEFAULT '',
  body_sw       text        NOT NULL DEFAULT '',
  sort_order    integer     NOT NULL DEFAULT 0,
  status        text        NOT NULL DEFAULT 'pending',
  provenance    jsonb       NOT NULL DEFAULT '{"via":"unknown"}'::jsonb,
  audit_hash_id text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'development_plan_sections_status_chk'
  ) THEN
    ALTER TABLE development_plan_sections
      ADD CONSTRAINT development_plan_sections_status_chk
      CHECK (status IN ('pending', 'generating', 'ready'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'development_plan_sections_key_chk'
  ) THEN
    ALTER TABLE development_plan_sections
      ADD CONSTRAINT development_plan_sections_key_chk
      CHECK (char_length(section_key) BETWEEN 1 AND 80);
  END IF;
END $$;

-- One row per (plan, section_key) — re-generating a section UPSERTs.
CREATE UNIQUE INDEX IF NOT EXISTS development_plan_sections_plan_key_uq
  ON development_plan_sections (plan_id, section_key);

CREATE INDEX IF NOT EXISTS development_plan_sections_tenant_plan
  ON development_plan_sections (tenant_id, plan_id, sort_order);

ALTER TABLE development_plan_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE development_plan_sections FORCE  ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'development_plan_sections'
       AND policyname = 'development_plan_sections_tenant_isolation'
  ) THEN
    CREATE POLICY development_plan_sections_tenant_isolation
      ON development_plan_sections
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));
  END IF;
END $$;

COMMIT;
