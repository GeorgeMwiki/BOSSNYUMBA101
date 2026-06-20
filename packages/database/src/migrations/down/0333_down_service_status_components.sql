-- =============================================================================
-- Down-migration 0333 — reverse service_status_components.
--
-- Dev/staging only. Dropping this table removes the maintained platform status
-- board. The fail-safe consequence is purely cosmetic: with no table the
-- PUBLIC GET /api/v1/public/status route surfaces a DB error the router maps to
-- an honest-degraded response, and the marketing StatusBoard already renders an
-- error/retry state rather than fabricating green. NO money/tenant/PII data
-- lives here — only coarse component health.
--
-- Reverses migration 0333_service_status_components.sql.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS service_role_write ON service_status_components;
DROP POLICY IF EXISTS public_read ON service_status_components;

DROP INDEX IF EXISTS service_status_components_status_idx;

DROP TABLE IF EXISTS service_status_components;

COMMIT;
