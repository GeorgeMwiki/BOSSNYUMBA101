-- =============================================================================
-- Down-migration 0327 — reverse applicant_kyc + applicant_profile.
--
-- Dev/staging only — DATA LOSS. Dropping these tables removes every renter-
-- applicant KYC submission and profile / notification preference. The fail-safe
-- consequence is identity-only, not financial: with no tables the estate-manager
-- applicant routes surface a clean DB error mapped to a 5xx; the tenant app
-- shows an error state rather than a wrong/leaked identity. NO money/ledger
-- records live here — identity + preferences only; LedgerService owns the money
-- path and never depended on these tables. DATA LOSS: discards all KYC
-- submissions and applicant profiles.
--
-- Reverses migration 0327_applicant_identity.sql.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS service_role_bypass ON applicant_profile;
DROP POLICY IF EXISTS tenant_isolation_modify ON applicant_profile;
DROP POLICY IF EXISTS tenant_isolation_select ON applicant_profile;

DROP POLICY IF EXISTS service_role_bypass ON applicant_kyc;
DROP POLICY IF EXISTS tenant_isolation_modify ON applicant_kyc;
DROP POLICY IF EXISTS tenant_isolation_select ON applicant_kyc;

DROP INDEX IF EXISTS applicant_profile_tenant_applicant_uq;
DROP INDEX IF EXISTS applicant_kyc_tenant_applicant_idx;

DROP TABLE IF EXISTS applicant_profile;
DROP TABLE IF EXISTS applicant_kyc;

COMMIT;
