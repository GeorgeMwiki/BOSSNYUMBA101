-- =============================================================================
-- Migration 0330 — device_tokens: push-receiver registration for the canonical
-- /api/v1/me/device-tokens surface.
--
-- WHY THIS MIGRATION EXISTS
-- -------------------------
-- Both mobile apps register their device push token by POSTing to
-- /api/v1/me/device-tokens (apps/tenant-mobile/src/lib/notifications/
-- push-register.ts and apps/staff-mobile/.../push-register.ts). Before this
-- migration that route did NOT exist and the table backing the canonical `/me`
-- surface was absent — so no device ever received a push. This table is the
-- per-(user, token, platform) registration the new `/me` router upserts into,
-- bound to the JWT's tenant + user.
--
-- ONE TABLE
--   * device_tokens — one row per (user_id, token, platform). The UNIQUE
--     constraint makes the register write IDEMPOTENT: re-registering the same
--     token from the same user on the same platform collapses to a single row
--     (ON CONFLICT … DO UPDATE bumps last_seen_at + un-revokes). `token` is the
--     Expo/FCM/APNS receiver token. `app` records which client registered it so
--     fan-out can target a surface. Soft-revoke via `revoked_at` (DELETE
--     /device-tokens/:token) preserves the audit trail.
--
-- TENANT SCOPE (CLAUDE.md hard rule): tenant-scoped (`tenant_id` TEXT). FORCE-
-- enables RLS with a tenant-isolation policy on the canonical
-- `app.current_tenant_id` GUC (bare compare, no cast) PLUS a service-role
-- bypass, mirroring the 0322 shape. A TENANT can NEVER read ANOTHER tenant's
-- device tokens.
--
-- RELATIONSHIP TO device_push_tokens (0287): 0287 backs the legacy
-- /api/v1/device-push-tokens router (multi-token-kind: expo/fcm/apns columns).
-- device_tokens backs the NEW canonical /api/v1/me/device-tokens surface the
-- mobile clients actually call, with a single opaque `token` column keyed on
-- (user_id, token, platform) per the client payload. They are independent
-- registration stores; this migration does not touch 0287.
--
-- FRESH-DB SAFETY / IDEMPOTENCY (CLAUDE.md hard rule): every object uses
-- CREATE ... IF NOT EXISTS + guarded DO-blocks + a pg_roles guard around the
-- anon REVOKE. On a fully-migrated DB this is a pure no-op. Every NOT NULL is
-- in the CREATE TABLE or on a freshly-created column WITH a DEFAULT.
--
-- Companion files:
--   * services/api-gateway/src/routes/me.hono.ts  (POST/DELETE device-tokens)
--   * packages/database/src/migrations/down/0330_down_device_tokens.sql
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- device_tokens — one row per (user_id, token, platform).
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS device_tokens (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text        NOT NULL,
  user_id         text        NOT NULL,
  token           text        NOT NULL,
  platform        text        NOT NULL,
  app             text,
  installed_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  revoked_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT device_tokens_platform_chk CHECK (
    platform IN ('ios', 'android', 'web')
  ),
  CONSTRAINT device_tokens_token_len_chk CHECK (
    char_length(token) BETWEEN 8 AND 500
  ),
  CONSTRAINT device_tokens_user_token_platform_uq
    UNIQUE (user_id, token, platform)
);

-- Fan-out / "my active devices" hot path.
CREATE INDEX IF NOT EXISTS idx_device_tokens_tenant_user_active
  ON device_tokens (tenant_id, user_id)
  WHERE revoked_at IS NULL;

-- Revoke-by-token lookup (DELETE /device-tokens/:token).
CREATE INDEX IF NOT EXISTS idx_device_tokens_tenant_token
  ON device_tokens (tenant_id, token);

-- -----------------------------------------------------------------------------
-- RLS — FORCE + tenant isolation on the canonical GUC + service-role bypass +
-- guarded anon REVOKE. Mirrors the 0322 shape.
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  tbl text;
  tenant_tables text[] := ARRAY[
    'device_tokens'
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

COMMENT ON TABLE device_tokens IS
  'Push-receiver registration for the canonical /api/v1/me/device-tokens '
  'surface. One row per (user_id, token, platform) — the UNIQUE constraint '
  'makes register idempotent. Soft-revoke via revoked_at. Tenant + user come '
  'from the JWT, never the body. RLS FORCE on app.current_tenant_id + '
  'service-role bypass. Added in 0330. Distinct from device_push_tokens (0287) '
  'which backs the legacy /device-push-tokens router.';

COMMIT;
