-- =============================================================================
-- Down-migration 0331 — reverse rfb_requests.
--
-- Dev/staging only — DATA LOSS. Dropping this table removes every applicant's
-- open Request-For-Application. The fail-safe consequence: the marketplace RFB
-- routes (POST /marketplace/rfb, GET /marketplace/rfb/mine, cancel) fault and
-- degrade honestly until the table is restored. NO money/licence/ledger records
-- live here — an RFB is a renter's wish list, not a financial obligation.
-- DATA LOSS: discards every applicant's posted requests (renters must re-post).
--
-- Reverses migration 0331_rfb_requests.sql.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS tenant_isolation_rfb_requests    ON rfb_requests;
DROP POLICY IF EXISTS rfb_requests_service_role_bypass ON rfb_requests;

DROP INDEX IF EXISTS idx_rfb_requests_tenant_status;
DROP INDEX IF EXISTS idx_rfb_requests_tenant_applicant;

DROP TABLE IF EXISTS rfb_requests;

COMMIT;
