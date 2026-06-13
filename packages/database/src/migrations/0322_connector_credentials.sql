-- =============================================================================
-- Migration 0322 — connector_credentials: per-tenant per-account OAuth state
-- for the connector fabric.
--
-- WHY THIS MIGRATION EXISTS
-- -------------------------
-- The connector fabric (services/api-gateway/src/composition/connector-fabric.ts)
-- surfaces each connector's lifecycle status (connected accounts, scopes,
-- expiry) by reading this shared, kind-generic credential store. The OAuth
-- connect/callback flow + connector-token-cipher.ts seal access/refresh tokens
-- as AES-GCM ciphertext sealed with a tenant-bound DEK and write them here; the
-- fabric NEVER decrypts — only presence / expiry / scopes are surfaced.
--
-- ONE TABLE
--   * connector_credentials — one row per (tenant_id, connector_kind,
--     connector_account). `connector_account` is the provider-side identifier
--     (Slack workspace id, Gmail address, …). `access_token_enc` /
--     `refresh_token_enc` are ENCRYPTED-AT-REST (bytea ciphertext only); the
--     database NEVER sees plaintext. `scopes` is the granted OAuth scope set.
--     `audit_hash` carries the hash-chain link for the credential write.
--
-- NO connector_kind CHECK enum (DIVERGENCE from the original Borjie omnidata
-- batch, which pinned slack/gmail/outlook_*/google_calendar): BossNyumba's
-- connector catalogue (services/api-gateway/src/composition/connector-catalog.ts)
-- ships a far broader kind set (whatsapp, voice, teams, google-drive, notion,
-- salesforce, hubspot, github, gitlab, jira, linear, zoom, facebook, instagram,
-- linkedin, tiktok, x, youtube, …). The catalogue is the source of truth for
-- valid kinds; a DB-level enum would reject every connector beyond the original
-- five. Validity is enforced at the application layer against the catalogue.
--
-- TENANT SCOPE (CLAUDE.md hard rule): tenant-scoped (`tenant_id` TEXT; no FK).
-- FORCE-enables RLS with a tenant-isolation policy on the canonical
-- `app.current_tenant_id` GUC (bare compare, no cast; NEVER the legacy
-- `app.tenant_id` — 0297 repointed legacy GUCs) plus a service-role bypass
-- mirroring 0316/0317. A TENANT can NEVER read ANOTHER tenant's credentials.
--
-- FRESH-DB SAFETY / IDEMPOTENCY (CLAUDE.md hard rule): every object uses
-- CREATE ... IF NOT EXISTS + guarded DO-blocks + a pg_roles guard around the
-- anon REVOKE. On a fully-migrated DB this is a pure no-op. Every NOT NULL is in
-- the CREATE TABLE or on a freshly-created column WITH a DEFAULT.
--
-- Companion files:
--   * packages/database/src/schemas/connector-credentials.schema.ts
--   * services/api-gateway/src/composition/connector-fabric.ts
--   * services/api-gateway/src/composition/connector-token-cipher.ts
--   * packages/database/src/migrations/down/0322_down_connector_credentials.sql
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- connector_credentials — per-tenant per-account OAuth state.
--
-- One row per (tenant_id, connector_kind, connector_account). Tokens are
-- ENCRYPTED-AT-REST — the column carries ciphertext only.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS connector_credentials (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           text NOT NULL,
  connector_kind      text NOT NULL,
  connector_account   text NOT NULL,
  access_token_enc    bytea,
  refresh_token_enc   bytea,
  scopes              text[] NOT NULL DEFAULT ARRAY[]::text[],
  expires_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  audit_hash          text NOT NULL,
  CONSTRAINT connector_credentials_tenant_kind_account_uq
    UNIQUE (tenant_id, connector_kind, connector_account)
);

-- Status hot path: the fabric lists a tenant's credentials filtered by kind.
CREATE INDEX IF NOT EXISTS idx_connector_creds_tenant_kind
  ON connector_credentials (tenant_id, connector_kind);

-- Expiry sweep / refresh scheduling.
CREATE INDEX IF NOT EXISTS idx_connector_creds_expiry
  ON connector_credentials (tenant_id, expires_at)
  WHERE expires_at IS NOT NULL;

-- -----------------------------------------------------------------------------
-- RLS — FORCE + tenant isolation on the canonical GUC + service-role bypass +
-- guarded anon REVOKE. Mirrors the 0316/0317 shape.
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  tbl text;
  tenant_tables text[] := ARRAY[
    'connector_credentials'
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

COMMENT ON TABLE connector_credentials IS
  'Per-tenant OAuth state for the connector fabric. access_token_enc and '
  'refresh_token_enc are AES-GCM ciphertext sealed with a tenant-bound DEK; the '
  'database NEVER sees plaintext. RLS FORCE on app.current_tenant_id + '
  'service-role bypass. connector_kind is validated against the application '
  'catalogue, not a DB enum. Added in 0322.';

COMMENT ON COLUMN connector_credentials.access_token_enc IS
  'ENCRYPTED-AT-REST. AES-GCM ciphertext over the OAuth access token. Sealed '
  'with a tenant-bound DEK from KMS. connector-token-cipher.ts is the only '
  'decrypt path.';

COMMENT ON COLUMN connector_credentials.refresh_token_enc IS
  'ENCRYPTED-AT-REST. AES-GCM ciphertext over the OAuth refresh token. Sealed '
  'with the same tenant-bound DEK as access_token_enc. Providers that rotate '
  'the refresh token on refresh cause the application to replace both '
  'ciphertexts.';

COMMIT;
