-- BOSSNYUMBA User Region + Memberships Migration
-- 1. Adds region + language columns to users for onboarding personalization
-- 2. Creates memberships table to support cross-tenant invites (pending until signup)

-- ============================================================================
-- Users - Add region + language columns
-- ============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS region TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS language TEXT;

CREATE INDEX IF NOT EXISTS users_region_idx ON users(region);
CREATE INDEX IF NOT EXISTS users_language_idx ON users(language);

-- ============================================================================
-- Enums
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE membership_status AS ENUM ('pending', 'active', 'revoked', 'expired');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- Memberships Table
-- ============================================================================
--
-- A membership links a user (or a not-yet-registered email) to a tenant with
-- a role. When the invited user signs up or signs in for the first time with
-- the invite email, the membership is auto-activated (user_id is populated).

CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Target user: user_id is NULL when membership is a pending invite
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  invite_email TEXT,

  -- Role assigned when the membership activates
  role TEXT NOT NULL DEFAULT 'member',

  -- Invitation state
  status membership_status NOT NULL DEFAULT 'pending',
  invite_token TEXT,
  invite_expires_at TIMESTAMPTZ,
  invited_by TEXT,

  -- Lifecycle timestamps
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT,

  CONSTRAINT memberships_user_or_email CHECK (user_id IS NOT NULL OR invite_email IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS memberships_tenant_idx ON memberships(tenant_id);
CREATE INDEX IF NOT EXISTS memberships_user_idx ON memberships(user_id);
CREATE INDEX IF NOT EXISTS memberships_invite_email_idx ON memberships(LOWER(invite_email));
CREATE INDEX IF NOT EXISTS memberships_status_idx ON memberships(status);
CREATE UNIQUE INDEX IF NOT EXISTS memberships_invite_token_idx ON memberships(invite_token) WHERE invite_token IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS memberships_tenant_user_idx ON memberships(tenant_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS memberships_tenant_pending_email_idx
  ON memberships(tenant_id, LOWER(invite_email))
  WHERE status = 'pending' AND invite_email IS NOT NULL;
