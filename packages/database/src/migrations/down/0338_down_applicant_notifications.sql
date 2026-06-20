-- =============================================================================
-- DOWN 0338 — drop applicant_notifications + rfb_responses.
--
-- Reverses 0338_applicant_notifications.sql. DEV/STAGING ONLY.
--   * applicant_notifications: dropping discards the applicant inbox; the
--     tenant-mobile notifications surface regresses to a permanently-empty
--     inbox until the table is re-created. dataLoss: true.
--   * rfb_responses: dropping discards landlord responses (incl. accepted
--     ones the sign-delivery settlement loads); the Sign-Lease screen regresses
--     to an honest "no accepted response" empty state. dataLoss: true.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS tenant_isolation_rfb_responses ON rfb_responses;
DROP POLICY IF EXISTS rfb_responses_service_role_bypass ON rfb_responses;
DROP TABLE IF EXISTS rfb_responses;

DROP POLICY IF EXISTS tenant_isolation_applicant_notifications ON applicant_notifications;
DROP POLICY IF EXISTS applicant_notifications_service_role_bypass ON applicant_notifications;
DROP TABLE IF EXISTS applicant_notifications;

COMMIT;
