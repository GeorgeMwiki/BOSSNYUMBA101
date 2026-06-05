-- =============================================================================
-- Down-migration 0304 - reverse housing-cooperative settlement workflow.
--
-- Dev/staging only. Dropping these tables loses every drafted /
-- calculated / approved / distributed cooperative settlement period and
-- its per-member-household distribution rows. Distributed periods carry
-- `payment_ref` handles into the ledger; a production rollback must be
-- coordinated so those ledger postings are reconciled out-of-band first.
--
-- Reverses migration 0304_cooperative_settlement.sql.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS cooperative_member_distributions_tenant_isolation
  ON cooperative_member_distributions;
DROP POLICY IF EXISTS cooperative_settlement_periods_tenant_isolation
  ON cooperative_settlement_periods;

DROP INDEX IF EXISTS cooperative_member_distributions_tenant_period;
DROP INDEX IF EXISTS cooperative_settlement_periods_tenant_status;

-- member distributions FK-cascade off periods; drop child first.
DROP TABLE IF EXISTS cooperative_member_distributions;
DROP TABLE IF EXISTS cooperative_settlement_periods;

COMMIT;
