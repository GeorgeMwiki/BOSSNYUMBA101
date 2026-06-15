-- =============================================================================
-- Migration 0339 — make org_memberships uniqueness PARTIAL on status='ACTIVE'.
--
-- WHY THIS MIGRATION EXISTS (Mode-C R2 identity highs)
-- ---------------------------------------------------
-- 0024_identity_tables.sql created `org_memberships_identity_org_idx` as a
-- NON-PARTIAL unique index over (tenant_identity_id, organization_id). The
-- schema mirror (identity.schema.ts) and the leave/block flow both ASSUME the
-- uniqueness only applies to the live (ACTIVE) row — historical LEFT/BLOCKED
-- rows are retained for audit and are meant to coexist. Because the index was
-- not partial, that assumption was false:
--
--   1. A member joins  -> INSERT row #1 (ACTIVE).
--   2. The member leaves -> row #1 flips to status='LEFT' (retained, not deleted).
--   3. The member re-redeems an invite -> redeem INSERTs row #2.
--      The non-partial unique index sees (identity, org) already present on the
--      retained LEFT row and throws a unique-violation, which the gateway
--      surfaces as an OPAQUE 500.
--
-- Re-joining after leaving is a legitimate, expected lifecycle. This migration
-- makes the constraint match the documented intent: AT MOST ONE *ACTIVE*
-- membership per (identity, org), while any number of historical LEFT/BLOCKED
-- rows coexist. The schema mirror in identity.schema.ts is updated in lockstep
-- with `.where(sql\`status = 'ACTIVE'\`)`.
--
-- SAFETY
--   * The new partial index is created BEFORE the old one is dropped, inside a
--     single transaction, so the (identity, org) ACTIVE-uniqueness guarantee is
--     never momentarily absent.
--   * If any (tenant_identity_id, organization_id) currently has more than one
--     ACTIVE row (which the old index already forbade, so there should be none),
--     the CREATE UNIQUE INDEX will fail loudly and the transaction rolls back —
--     it never silently drops the guarantee.
-- =============================================================================

BEGIN;

-- New PARTIAL unique index: one ACTIVE membership per (identity, org).
CREATE UNIQUE INDEX IF NOT EXISTS org_memberships_identity_org_active_idx
  ON org_memberships (tenant_identity_id, organization_id)
  WHERE status = 'ACTIVE';

-- Old non-partial unique index that blocked re-join after LEFT/BLOCKED.
DROP INDEX IF EXISTS org_memberships_identity_org_idx;

COMMIT;
