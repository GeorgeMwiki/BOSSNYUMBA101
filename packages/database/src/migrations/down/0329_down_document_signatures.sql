-- =============================================================================
-- Down-migration 0329 — reverse document_signatures.
--
-- Dev/staging only — DATA LOSS. Dropping this table discards every captured
-- e-signature (who signed which document, when, with what payload + audit
-- hash). The fail-safe consequence: POST /api/v1/documents/:id/sign can no
-- longer persist a signature until the table is restored, and existing
-- signature records are gone. NO money/ledger records live here. DATA LOSS:
-- discards every tenant's document signatures.
--
-- Reverses migration 0329_document_signatures.sql.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS tenant_isolation_document_signatures      ON document_signatures;
DROP POLICY IF EXISTS document_signatures_service_role_bypass   ON document_signatures;

DROP INDEX IF EXISTS idx_document_signatures_tenant_signer;
DROP INDEX IF EXISTS idx_document_signatures_tenant_doc;

DROP TABLE IF EXISTS document_signatures;

COMMIT;
