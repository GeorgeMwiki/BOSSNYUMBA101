-- =============================================================================
-- Migration 0334 — owner_settings: per-(tenant, user) owner-portal preferences.
--
-- WHY THIS MIGRATION EXISTS
-- -------------------------
-- The owner-portal Settings page (apps/owner-portal/src/pages/SettingsPage.tsx)
-- used to FAKE-SUCCESS every Save: `handleSave` slept 1s and flashed a green
-- toast WITHOUT persisting anything. Language / currency / timezone / date-format
-- and the six notification toggles evaporated on reload. This migration creates
-- the durable per-user store those controls write to, read by the new owner-
-- account router (services/api-gateway/src/routes/owner/owner-account.hono.ts,
-- GET/PUT /owner/account/settings).
--
-- ONE TABLE
--   * owner_settings — one row per (tenant_id, user_id). DOUBLE-scoped:
--     tenant_id (RLS isolation) AND user_id (per-user ownership; the route
--     filters every read/write by user_id from the JWT so one owner can NEVER
--     read or overwrite a co-owner's preferences — anti-IDOR on top of RLS).
--
-- CURRENCY (CLAUDE.md hard rule — multi-currency, never hard-code TZS/KES):
--   `currency` is a free-form ISO-4217 TEXT code (no enum, no DB-pinned TZS).
--   The complementary `currency_preferences` table (scope_kind='user') remains
--   the canonical FX-resolution chain source; the route MIRRORS the chosen
--   currency into currency_preferences so the FX normaliser keeps resolving
--   user → tenant → platform-default. This table additionally owns the owner-
--   portal-only display prefs (timezone, date_format, language, notification
--   toggles) that currency_preferences does not model.
--
-- LANGUAGE (CLAUDE.md hard rule — English default · bilingual sw/en):
--   `language` is constrained to 'en' | 'sw'; defaults to 'en'.
--
-- TENANT SCOPE (CLAUDE.md hard rule): tenant-scoped (`tenant_id` TEXT; no FK,
-- matching the tenant_id-as-text convention used by 0316/0317/0322/0331).
-- FORCE-enables RLS with a tenant-isolation policy on the canonical
-- `app.current_tenant_id` GUC (bare compare, no cast; NEVER the legacy
-- `app.tenant_id`) plus a service-role bypass and a guarded anon REVOKE,
-- mirroring 0331/0335.
--
-- FRESH-DB SAFETY / IDEMPOTENCY (CLAUDE.md hard rule): every object uses
-- CREATE ... IF NOT EXISTS + guarded DO-blocks + a pg_roles guard around the
-- anon REVOKE. On a fully-migrated DB this is a pure no-op. Every NOT NULL has
-- a DEFAULT or a non-null literal the route always writes.
--
-- Companion files:
--   * services/api-gateway/src/routes/owner/owner-account.hono.ts (routes)
--   * services/api-gateway/src/routes/owner/owner-account-repo.ts  (repo)
--   * apps/owner-portal/src/pages/SettingsPage.tsx                 (FE)
--   * packages/database/src/migrations/down/0334_down_owner_settings.sql
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- owner_settings — per-(tenant, user) owner-portal preferences.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS owner_settings (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          text NOT NULL,
  -- The owner this row belongs to. ALWAYS resolved from the JWT (auth.userId)
  -- by the route layer and used as the per-user ownership predicate on every
  -- read/write — never client input. Anti-IDOR on top of RLS.
  user_id            text NOT NULL,

  -- Display preferences.
  -- 'en' | 'sw' — English default, bilingual toggle is ABSOLUTE per CLAUDE.md.
  language           text NOT NULL DEFAULT 'en',
  -- ISO-4217 currency code (uppercase). Currency-agnostic: NEVER DB-pinned TZS.
  currency           text NOT NULL DEFAULT 'USD',
  -- IANA timezone string (e.g. 'Africa/Dar_es_Salaam'). TZ-first but not pinned.
  timezone           text NOT NULL DEFAULT 'Africa/Dar_es_Salaam',
  -- Free-form date-format token ('DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD').
  date_format        text NOT NULL DEFAULT 'DD/MM/YYYY',

  -- Notification preferences. One jsonb object keyed by the six FE toggle ids
  -- (payment, maintenance, approval, overdue, weekly, monthly) → boolean. Kept
  -- as jsonb (not columns) so new toggle ids land WITHOUT a migration.
  notification_prefs jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT owner_settings_language_chk
    CHECK (language IN ('en', 'sw')),
  -- One settings row per owner per tenant — the route upserts on this key.
  CONSTRAINT owner_settings_tenant_user_uniq
    UNIQUE (tenant_id, user_id)
);

-- Hot path: resolve the caller's own settings row.
CREATE INDEX IF NOT EXISTS idx_owner_settings_tenant_user
  ON owner_settings (tenant_id, user_id);

-- -----------------------------------------------------------------------------
-- RLS — FORCE + tenant isolation on the canonical GUC + service-role bypass +
-- guarded anon REVOKE. Mirrors the 0331 shape.
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  tbl text;
  tenant_tables text[] := ARRAY[
    'owner_settings'
  ];
BEGIN
  FOREACH tbl IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('ALTER TABLE %I FORCE  ROW LEVEL SECURITY;', tbl);

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename  = tbl
         AND policyname = 'tenant_isolation_' || tbl
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL '
        || 'USING (tenant_id = current_setting(''app.current_tenant_id'', true)) '
        || 'WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true));',
        'tenant_isolation_' || tbl, tbl
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename  = tbl
         AND policyname = tbl || '_service_role_bypass'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL '
        || 'USING (current_setting(''app.is_service_role'', true) = ''true'') '
        || 'WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');',
        tbl || '_service_role_bypass', tbl
      );
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon;', tbl);
    END IF;
  END LOOP;
END $$;

COMMENT ON TABLE owner_settings IS
  'Per-(tenant_id, user_id) owner-portal preferences: language (en|sw), '
  'currency (ISO-4217, never DB-pinned TZS), timezone, date_format, and a '
  'notification_prefs jsonb. DOUBLE-scoped — tenant_id (RLS) + user_id '
  '(per-user ownership; the route filters every read/write by it, anti-IDOR). '
  'currency is mirrored into currency_preferences (scope_kind=user) so the FX '
  'resolver chain stays canonical. RLS FORCE on app.current_tenant_id + '
  'service-role bypass. Added in 0334.';

COMMENT ON COLUMN owner_settings.user_id IS
  'The owner this settings row belongs to. ALWAYS resolved from the JWT by the '
  'route layer (never client input) and used as the per-user ownership '
  'predicate so one owner can never read/overwrite a co-owner''s preferences.';

COMMENT ON COLUMN owner_settings.currency IS
  'ISO-4217 display currency. Currency-agnostic; mirrored into '
  'currency_preferences (scope_kind=user). NEVER hard-pinned TZS/KES.';

COMMIT;
