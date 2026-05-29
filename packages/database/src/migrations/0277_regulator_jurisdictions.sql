-- =============================================================================
-- Migration 0277 — Regulator jurisdictions + tenant.regulator_set +
--                   currency / language allowlist generalisation.
--
-- Ported from Borjie 0143 — generalised for the real-estate domain.
--
-- Companion to (future):
--   - services/api-gateway/src/services/tenant-config/*
--   - packages/database/src/schemas/regulator-jurisdictions.schema.ts
--   - packages/database/src/seeds/regulator-jurisdictions.seed.ts
--   - Docs/OPS/WORLD_SCALE_TENANTS.md
--
-- World-scale tenant config.
--   BossNyumba is global from day one. Tanzania + Kenya are the GTM
--   beachhead, NOT a hardcode. This migration:
--
--     1. Creates `regulator_jurisdictions` — tenant-AGNOSTIC catalogue
--        of real-estate regulatory authorities per country (TZ rent
--        boards / housing authorities, KE rent tribunal, UG Lands
--        Ministry, NG Lagos Tenancy Law board, ZA Rental Housing
--        Tribunal, UK Property Ombudsman, US local landlord-tenant
--        boards, AU NSW Tenancy Tribunal, generic fallback). One row
--        per (country, name_en).
--
--     2. Adds `tenants.regulator_set` — the active regulator set the
--        tenant operates under (TZ-set / KE-set / UG-set / NG-set /
--        ZA-set / UK-set / US-set / AU-set / generic). Defaults to
--        'TZ-set' so existing Tanzanian rows stay binary-identical.
--
--     3. Adds `tenants.country_code` — ISO-3166-1 alpha-2 — IF NOT
--        already present (BossNyumba 0036 already added it for some
--        deployments; we guard accordingly).
--
--     4. Adds `tenants.primary_currency` with widened CHECK to admit
--        TZS / USD / KES / UGX / NGN / EUR / ZAR / GBP / AUD. TZS
--        remains the default.
--
--     5. Adds `tenants.default_language` with widened CHECK to admit
--        sw / en / fr / pt / sw-KE / es / af. sw remains the default
--        (Tanzanian + Kenyan markets are bilingual sw/en).
--
-- Tenant scope:
--   * `regulator_jurisdictions` is tenant-AGNOSTIC — regulators publish
--     the same authority list to every operator.
--   * `tenants.regulator_set` / `country_code` / `primary_currency` /
--     `default_language` are per-row on tenants — RLS already covers
--     the parent table.
--
-- Hard rules:
--   * Idempotent. Forward-only. Append-only. NEVER edited after merge.
--   * NO breaking changes — TZ defaults stay identical.
--   * NEVER hard-code TZS / sw / TZ outside this migration. The
--     application layer must read `tenant.primary_currency`,
--     `tenant.default_language`, `tenant.regulator_set` from the
--     tenant-config service.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── §1. regulator_jurisdictions (tenant-agnostic catalogue) ─────────────────
CREATE TABLE IF NOT EXISTS regulator_jurisdictions (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  /** ISO-3166-1 alpha-2 country code. */
  country_code             text        NOT NULL,
  /** Authority name in English — e.g. 'Property Ombudsman', 'Rental Housing Tribunal'. */
  name_en                  text        NOT NULL,
  /** Authority name in the local language (sw / fr / pt / es / af / etc.). */
  name_local               text,
  /** Short slug for code-side switches — e.g. 'rht-za', 'tpos-uk'. */
  slug                     text        NOT NULL,
  /** Regulator set the row belongs to — drives tenant.regulator_set joins. */
  regulator_set            text        NOT NULL,
  /**
   * Mandate type (real-estate-focused):
   *   - 'tenancy-tribunal'    — rent disputes, evictions, deposits
   *   - 'housing-authority'   — landlord licensing, social housing
   *   - 'building-safety'     — fire, electrical, structural inspections
   *   - 'property-tax'        — rates, council tax, transfer duty
   *   - 'land-registry'       — title deeds, transfers, encumbrances
   *   - 'planning-permission' — zoning, change-of-use, development
   *   - 'rental-protection'   — rent control, fair-rent acts
   *   - 'hoa-strata'          — HOA, strata, body-corporate oversight
   *   - 'tenant-rights'       — tenant advocacy, ombudsman
   *   - 'data-protection'     — POPI / GDPR / PDPA / DPA
   *   - 'generic'             — fallback
   */
  mandate                  text        NOT NULL,
  /** Public URL — landing page / contact / portal. */
  contact_url              text,
  /** Endpoint the api-gateway POSTs Data Subject Requests to (optional). */
  dsr_endpoint             text,
  /** Endpoint for landlord-licence renewal status checks (optional). */
  licence_renewal_endpoint text,
  /** Free-form metadata (e.g. region, currency, kyc-bundle slug). */
  attributes               jsonb       NOT NULL DEFAULT '{}'::jsonb,
  active_from              date,
  active_until             date,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'regulator_jurisdictions_country_chk'
  ) THEN
    ALTER TABLE regulator_jurisdictions
      ADD CONSTRAINT regulator_jurisdictions_country_chk
      CHECK (char_length(country_code) = 2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'regulator_jurisdictions_set_chk'
  ) THEN
    ALTER TABLE regulator_jurisdictions
      ADD CONSTRAINT regulator_jurisdictions_set_chk
      CHECK (regulator_set IN (
        'TZ-set', 'KE-set', 'UG-set', 'NG-set', 'ZA-set',
        'UK-set', 'US-set', 'AU-set', 'generic'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'regulator_jurisdictions_mandate_chk'
  ) THEN
    ALTER TABLE regulator_jurisdictions
      ADD CONSTRAINT regulator_jurisdictions_mandate_chk
      CHECK (mandate IN (
        'tenancy-tribunal',
        'housing-authority',
        'building-safety',
        'property-tax',
        'land-registry',
        'planning-permission',
        'rental-protection',
        'hoa-strata',
        'tenant-rights',
        'data-protection',
        'generic'
      ));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS regulator_jurisdictions_set_slug_unq
  ON regulator_jurisdictions (regulator_set, slug);

CREATE INDEX IF NOT EXISTS regulator_jurisdictions_country_idx
  ON regulator_jurisdictions (country_code);

CREATE INDEX IF NOT EXISTS regulator_jurisdictions_set_idx
  ON regulator_jurisdictions (regulator_set);

-- Tenant-agnostic catalogue — no RLS (same model as system seed tables).

-- ─── §2. tenants.regulator_set ───────────────────────────────────────────────
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS regulator_set text NOT NULL DEFAULT 'TZ-set';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'tenants_regulator_set_chk'
  ) THEN
    ALTER TABLE tenants
      ADD CONSTRAINT tenants_regulator_set_chk
      CHECK (regulator_set IN (
        'TZ-set', 'KE-set', 'UG-set', 'NG-set', 'ZA-set',
        'UK-set', 'US-set', 'AU-set', 'generic'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS tenants_regulator_set_idx
  ON tenants (regulator_set);

-- ─── §3. tenants.country_code (canonical ISO-3166-1 alpha-2) ─────────────────
-- BossNyumba 0036 added this column for some deployments. We guard the
-- ADD COLUMN with IF NOT EXISTS; the CHECK is also guarded.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT 'TZ';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'tenants_country_code_chk'
  ) THEN
    ALTER TABLE tenants
      ADD CONSTRAINT tenants_country_code_chk
      CHECK (char_length(country_code) = 2);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS tenants_country_code_idx
  ON tenants (country_code);

-- ─── §4. tenants.primary_currency + CHECK (real-estate currencies) ──────────
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS primary_currency text NOT NULL DEFAULT 'TZS';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'tenants_primary_currency_chk'
  ) THEN
    ALTER TABLE tenants DROP CONSTRAINT tenants_primary_currency_chk;
  END IF;
  ALTER TABLE tenants
    ADD CONSTRAINT tenants_primary_currency_chk
    CHECK (primary_currency IN (
      'TZS', 'USD', 'KES', 'UGX', 'NGN', 'EUR',
      'ZAR', 'GBP', 'AUD'
    ));
END $$;

-- ─── §5. tenants.default_language + CHECK (sw/en bilingual + others) ─────────
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS default_language text NOT NULL DEFAULT 'sw';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'tenants_default_language_chk'
  ) THEN
    ALTER TABLE tenants DROP CONSTRAINT tenants_default_language_chk;
  END IF;
  ALTER TABLE tenants
    ADD CONSTRAINT tenants_default_language_chk
    CHECK (default_language IN (
      'sw', 'en', 'fr', 'pt', 'sw-KE', 'es', 'af'
    ));
END $$;

COMMIT;
