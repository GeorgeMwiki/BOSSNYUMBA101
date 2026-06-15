-- =============================================================================
-- Migration 0341 — device_tokens: make push-registration uniqueness
-- TENANT-SCOPED so a multi-tenant user's device is never displaced.
--
-- WHY THIS MIGRATION EXISTS (Mode-C R2 — M11)
-- -------------------------------------------
-- 0330_device_tokens.sql declared `device_tokens_user_token_platform_uq`
-- UNIQUE (user_id, token, platform) — WITHOUT tenant_id. The canonical
-- registration upsert (services/api-gateway/src/routes/me.hono.ts) keys its
-- ON CONFLICT on that same (user_id, token, platform) triple and, in its DO
-- UPDATE, sets `tenant_id = EXCLUDED.tenant_id`.
--
-- For a user who belongs to 2+ tenants on the SAME physical device (same
-- Expo/FCM/APNS receiver token, same platform), this collapses both tenants
-- onto ONE row: registering the device under tenant B finds the row already
-- present under tenant A (the (user, token, platform) triple matches across
-- tenants) and REASSIGNS tenant_id to B. Tenant A's registration is silently
-- migrated off — push is born-dark for the displaced tenant. The intended
-- model (0330's COMMENT) is "one row per registration", and a multi-tenant
-- device legitimately has one registration PER TENANT.
--
-- FIX
-- ---
-- Replace the tenant-blind uniqueness with a tenant-scoped one so the same
-- (user, token, platform) can coexist across tenants, one row each:
--   DROP  CONSTRAINT device_tokens_user_token_platform_uq
--         UNIQUE (user_id, token, platform)
--   ADD   CONSTRAINT device_tokens_tenant_user_token_platform_uq
--         UNIQUE (tenant_id, user_id, token, platform)
-- The gateway upsert is updated in lockstep to ON CONFLICT
-- (tenant_id, user_id, token, platform), so it can never reassign tenant_id
-- across tenants again (the conflict target now includes tenant_id, so a
-- cross-tenant row is no longer a conflict — it is a fresh INSERT).
--
-- RLS / TENANT SCOPE (CLAUDE.md hard rule): UNCHANGED. device_tokens keeps its
-- FORCE RLS + tenant_isolation_device_tokens + service-role bypass from 0330;
-- this migration only swaps a uniqueness constraint and touches no policy. The
-- new constraint STRENGTHENS tenant separation (rows can no longer be silently
-- moved between tenants by the upsert).
--
-- FRESH-DB SAFETY / IDEMPOTENCY (CLAUDE.md hard rule): DROP CONSTRAINT IF
-- EXISTS + ADD CONSTRAINT guarded by a NOT-EXISTS pg_constraint check, both
-- inside one transaction. On a fully-migrated DB this is a pure no-op; on a
-- fresh-from-0330 DB it swaps the constraint. The ADD is ordered after the
-- DROP but the new constraint is a strict superset key, so no duplicate can
-- exist that the old (narrower) constraint did not already forbid — the ADD
-- never fails on legitimate data.
--
-- Companion files:
--   * services/api-gateway/src/routes/me.hono.ts  (ON CONFLICT target updated)
--   * packages/database/src/migrations/0330_device_tokens.sql (original table)
-- =============================================================================

BEGIN;

-- Drop the tenant-blind uniqueness from 0330.
ALTER TABLE device_tokens
  DROP CONSTRAINT IF EXISTS device_tokens_user_token_platform_uq;

-- Add the tenant-scoped uniqueness: one registration per
-- (tenant, user, token, platform) so a multi-tenant device coexists, one row
-- per tenant. Guarded so re-apply over an already-migrated DB is a no-op.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'device_tokens_tenant_user_token_platform_uq'
       AND conrelid = 'device_tokens'::regclass
  ) THEN
    ALTER TABLE device_tokens
      ADD CONSTRAINT device_tokens_tenant_user_token_platform_uq
        UNIQUE (tenant_id, user_id, token, platform);
  END IF;
END $$;

COMMENT ON CONSTRAINT device_tokens_tenant_user_token_platform_uq ON device_tokens IS
  'Tenant-scoped registration uniqueness: one row per (tenant_id, user_id, '
  'token, platform). Replaces 0330''s tenant-blind (user_id, token, platform) '
  'constraint so a user on 2+ tenants registering the same device no longer '
  'has one tenant''s row silently reassigned to another by the /me upsert. '
  'Added in 0341 (Mode-C M11). The gateway ON CONFLICT target matches this key.';

COMMIT;
