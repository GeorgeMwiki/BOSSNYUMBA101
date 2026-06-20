-- =============================================================================
-- Migration 0329 — document_signatures: e-sign capture for the documents
-- surface (POST /api/v1/documents/:id/sign).
--
-- WHY THIS MIGRATION EXISTS
-- -------------------------
-- The tenant-mobile client (apps/tenant-mobile/src/api/documents.ts) POSTs to
-- /api/v1/documents/:id/sign so a renter can sign a lease. Before this table
-- the route did not exist and the signature could never be captured — a renter
-- could never sign a lease. This table is the durable, tenant-scoped record of
-- WHO signed WHICH document, WHEN, with WHAT signature payload, and a tamper-
-- evident audit hash over the captured fields.
--
-- ONE TABLE
--   * document_signatures — one row per (tenant_id, document_id, signer_id).
--     The UNIQUE constraint makes the sign write IDEMPOTENT: a renter who taps
--     "sign" twice (double-submit / retry) collapses to a single signature, not
--     a duplicate. `document_id` references the document_uploads row the
--     documents router serves. `signer_id` / `signer_role` capture the signer
--     identity FROM THE JWT (never the request body). `signature_payload` is the
--     opaque client attestation (e.g. a biometric token / drawn-signature blob
--     reference). `audit_hash` is a SHA-256 over the canonical signed fields so
--     the record is tamper-evident.
--
-- TENANT SCOPE (CLAUDE.md hard rule): tenant-scoped (`tenant_id` TEXT to match
-- document_uploads.tenant_id, which is TEXT). FORCE-enables RLS with a
-- tenant-isolation policy on the canonical `app.current_tenant_id` GUC (bare
-- compare, no cast — tenant_id is already text) PLUS a service-role bypass,
-- mirroring the 0322 shape. A TENANT can NEVER read ANOTHER tenant's
-- signatures; cross-document IDOR is additionally blocked at the app layer
-- (uniform-404 when the document is not the caller's).
--
-- FRESH-DB SAFETY / IDEMPOTENCY (CLAUDE.md hard rule): every object uses
-- CREATE ... IF NOT EXISTS + guarded DO-blocks + a pg_roles guard around the
-- anon REVOKE. On a fully-migrated DB this is a pure no-op. Every NOT NULL is
-- in the CREATE TABLE or on a freshly-created column WITH a DEFAULT.
--
-- NO FK to document_uploads: document_uploads.id is TEXT (application-minted
-- ids, not uuid); a hard FK would couple drop-order and is unnecessary — the
-- app layer validates the parent document is the caller's before inserting.
--
-- Companion files:
--   * services/api-gateway/src/routes/documents.hono.ts  (POST /:id/sign)
--   * packages/database/src/migrations/down/0329_down_document_signatures.sql
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- document_signatures — one row per (tenant_id, document_id, signer_id).
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS document_signatures (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           text        NOT NULL,
  document_id         text        NOT NULL,
  signer_id           text        NOT NULL,
  signer_role         text        NOT NULL DEFAULT 'tenant',
  -- Opaque client attestation: a biometric token reference, a drawn-signature
  -- blob URL, or any provider token. We store it verbatim; it is NOT a secret
  -- key and carries no plaintext PII.
  signature_payload   text        NOT NULL,
  -- How the signature was captured (biometric / drawn / typed / otp). Free-form
  -- but constrained to a small known set so the surface can render a label.
  signature_method    text        NOT NULL DEFAULT 'biometric',
  signed_at           timestamptz NOT NULL DEFAULT now(),
  -- Tamper-evident hash over the canonical signed fields. SHA-256 hex.
  audit_hash          text        NOT NULL,
  ip_address          text,
  user_agent          text,
  created_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT document_signatures_method_chk CHECK (
    signature_method IN ('biometric', 'drawn', 'typed', 'otp', 'click')
  ),
  CONSTRAINT document_signatures_tenant_doc_signer_uq
    UNIQUE (tenant_id, document_id, signer_id)
);

-- Hot path: list / look up a document's signatures within the tenant.
CREATE INDEX IF NOT EXISTS idx_document_signatures_tenant_doc
  ON document_signatures (tenant_id, document_id);

-- Signer-centric lookups ("documents I have signed").
CREATE INDEX IF NOT EXISTS idx_document_signatures_tenant_signer
  ON document_signatures (tenant_id, signer_id);

-- -----------------------------------------------------------------------------
-- RLS — FORCE + tenant isolation on the canonical GUC + service-role bypass +
-- guarded anon REVOKE. Mirrors the 0322 shape.
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  tbl text;
  tenant_tables text[] := ARRAY[
    'document_signatures'
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

COMMENT ON TABLE document_signatures IS
  'E-sign capture for the documents surface. One row per (tenant_id, '
  'document_id, signer_id) — the UNIQUE constraint makes POST '
  '/documents/:id/sign idempotent. Signer identity comes from the JWT, never '
  'the body. audit_hash is a SHA-256 over the canonical signed fields '
  '(tamper-evident). RLS FORCE on app.current_tenant_id + service-role bypass. '
  'Added in 0329.';

COMMENT ON COLUMN document_signatures.signature_payload IS
  'Opaque client attestation (biometric token reference / drawn-signature blob '
  'URL / provider token). Stored verbatim; NOT a secret key, no plaintext PII.';

COMMENT ON COLUMN document_signatures.audit_hash IS
  'SHA-256 hex over the canonical signed fields (tenant_id|document_id|'
  'signer_id|signed_at|signature_payload). Tamper-evidence for the signature.';

COMMIT;
