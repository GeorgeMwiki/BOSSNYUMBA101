-- =============================================================================
-- Down-migration 0326 — reverse field_captures.
--
-- Dev/staging only — DATA LOSS. Dropping this table removes every persisted
-- staff field capture (attendance / task acknowledgements / incidents / shift
-- reports). The fail-safe consequence is operational, not financial: with no
-- table the estate-manager POST routes surface a clean DB error the router maps
-- to a 5xx, and the staff app (post-fix) RETAINS+retries the queued payload
-- rather than dropping it — so an accidental down does not silently destroy
-- in-flight field data. NO money/ledger records live here — a field capture is
-- an operational event only; LedgerService owns the money path and never
-- depended on this table.
--
-- Reverses migration 0326_field_captures.sql.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS service_role_bypass ON field_captures;
DROP POLICY IF EXISTS tenant_isolation_modify ON field_captures;
DROP POLICY IF EXISTS tenant_isolation_select ON field_captures;

DROP INDEX IF EXISTS field_captures_tenant_client_uq;
DROP INDEX IF EXISTS field_captures_tenant_property_idx;
DROP INDEX IF EXISTS field_captures_tenant_type_idx;

DROP TABLE IF EXISTS field_captures;

COMMIT;
