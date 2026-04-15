-- BOSSNYUMBA Cross-Tenant Memberships Migration
-- Creates cross_tenant_memberships table enabling one user identity to
-- belong to N landlord orgs (tenant/manager/customer) with its own role
-- and status per tenant.
--
-- Mirrors packages/domain-models/src/identity/membership.ts and the
-- drizzle schema at packages/database/src/schemas/cross-tenant-memberships.schema.ts.

-- ============================================================================
-- Enum: membership_status
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membership_status') THEN
    CREATE TYPE membership_status AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');
  END IF;
END$$;

-- ============================================================================
-- Table: cross_tenant_memberships
-- ============================================================================

CREATE TABLE IF NOT EXISTS cross_tenant_memberships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  organization_id TEXT,
  role TEXT NOT NULL DEFAULT 'CUSTOMER',
  status membership_status NOT NULL DEFAULT 'ACTIVE',
  display_label TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activated_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS ctm_user_id_idx           ON cross_tenant_memberships(user_id);
CREATE INDEX IF NOT EXISTS ctm_tenant_id_idx         ON cross_tenant_memberships(tenant_id);
CREATE INDEX IF NOT EXISTS ctm_user_status_idx       ON cross_tenant_memberships(user_id, status);

-- ============================================================================
-- Down (kept as comment for reference / manual rollback)
-- ============================================================================
-- DROP TABLE IF EXISTS cross_tenant_memberships;
-- DROP TYPE  IF EXISTS membership_status;
