-- =============================================================================
-- Migration 0274 — Tenant scale-tier discriminator (SC-1).
--
-- Ported from Borjie 0145 — generalised for the real-estate domain.
--
-- Companion to (future):
--   - packages/owner-os-tabs/src/scale-defaults.ts (default tabs per tier)
--   - services/api-gateway/src/services/orchestration/scale-flows.ts
--   - services/api-gateway/src/routes/orgs/signup.hono.ts (auto-detect on signup)
--   - packages/database/src/seeds/scale-fixtures/* (5 fixtures, one per tier)
--   - Docs/OPS/SCALE_TIERS.md
--
-- Wave: SCALE-AWARE (any landlord/property-management size from a 1-unit
-- single-family landlord to a 5,000-unit multi-portfolio commercial REIT).
-- BossNyumba is one product — we adapt defaults, tab sets, persona
-- register, and orchestration depth from a single discriminator on
-- `tenants`.
--
-- Tiers (real estate):
--   T1 single_unit       1-5 units, single-family / individual landlord
--   T2 small_portfolio   5-50 units, multi-unit, 1-2 property managers
--   T3 mid_portfolio     50-500 units, multi-building, property-management
--                        company with admin + maintenance teams
--   T4 large_portfolio   500-5,000 units, multi-region, full compliance +
--                        finance + leasing teams (commercial REIT class)
--   T5 multi_country     multi-tenant group, cross-border, multi-currency
--                        consolidation (multi-region holdings)
--
-- The signup wizard collects (unit_count, building_count, region_count,
-- cross_border?) and the API computes a tier; the result persists here
-- so every brain prompt and tab defaulter can read it cheap.
--
-- BACKWARDS COMPATIBLE: every existing tenant defaults to 't1_single_unit'
-- (the safest, simplest tier). No existing tenant breaks.
--
-- Idempotent (IF NOT EXISTS + DO blocks). Append-only. Forward-only.
-- IMMUTABLE: per CLAUDE.md "Migrations are immutable" — never edit
-- this file after merge; append a new numbered file instead.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- scale_tier — owner-org size discriminator.
-- Snake-case-prefixed values so they fit the existing CHECK-string pattern
-- used by other tenants columns.
-- -----------------------------------------------------------------------------
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS scale_tier text NOT NULL DEFAULT 't1_single_unit';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'tenants_scale_tier_chk'
  ) THEN
    ALTER TABLE tenants
      ADD CONSTRAINT tenants_scale_tier_chk
      CHECK (scale_tier IN (
        't1_single_unit',
        't2_small_portfolio',
        't3_mid_portfolio',
        't4_large_portfolio',
        't5_multi_country'
      ));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- scale_signals — opaque jsonb the auto-detect wizard persists so we can
-- recompute tier later (after tenant invites land, after the second
-- building is added, etc.). Shape:
--   {
--     "unitCount":     int,
--     "buildingCount": int,
--     "regionCount":   int,
--     "crossBorder":   bool,
--     "computedAt":    iso8601
--   }
-- Kept tiny — no PII. The recomputer reads this, recomputes, updates
-- scale_tier if it changed and writes an audit-event for the transition.
-- -----------------------------------------------------------------------------
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS scale_signals jsonb NOT NULL DEFAULT '{}'::jsonb;

-- -----------------------------------------------------------------------------
-- Helpful index — admin-web filters by tier, brain reads tier per turn.
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS tenants_scale_tier_idx
  ON tenants (scale_tier);

COMMIT;
