-- =============================================================================
-- Down-migration 0335 — reverse co_owner_invites.
--
-- Dev/staging only — DATA LOSS. Dropping this table removes every PENDING team
-- invitation. The fail-safe consequence: GET /owner/account/co-owners returns
-- only the already-accepted members (resolved from the users table, unaffected)
-- and the Settings → Users tab degrades honestly until the table is restored;
-- pending invitees must be re-invited. NO money / licence / ledger records live
-- here — already-accepted co-owners are real `users` rows and are NOT touched
-- by this down. Already-dispatched invite emails in notification_dispatch_log
-- are also unaffected (separate table).
-- DATA LOSS: discards every pending invite (owners must re-invite).
--
-- Reverses migration 0335_co_owner_invites.sql.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS tenant_isolation_co_owner_invites    ON co_owner_invites;
DROP POLICY IF EXISTS co_owner_invites_service_role_bypass ON co_owner_invites;

DROP INDEX IF EXISTS idx_co_owner_invites_tenant_status;
DROP INDEX IF EXISTS uniq_co_owner_invites_token;

DROP TABLE IF EXISTS co_owner_invites;

COMMIT;
