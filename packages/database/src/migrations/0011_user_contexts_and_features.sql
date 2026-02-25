-- =============================================================================
-- Migration 0011: User Contexts & Progressive Feature Discovery
-- =============================================================================
-- Enables the dynamic role system where anyone can be owner AND tenant
-- simultaneously. Users have multiple "contexts" they can switch between.
-- Progressive UI expands based on actual usage patterns.
-- =============================================================================

-- Context type enum
DO $$ BEGIN
  CREATE TYPE context_type AS ENUM ('owner', 'tenant', 'technician', 'manager', 'admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Entity type enum
DO $$ BEGIN
  CREATE TYPE entity_type AS ENUM ('individual', 'company');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- user_contexts: The core of the dynamic role system
-- A single auth user can have multiple contexts:
--   - "I am a tenant at Sunset Apartments" (context_type = tenant)
--   - "I am the owner of 3 properties" (context_type = owner)
--   - "I am a technician for Masanja Plumbing" (context_type = technician)
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_contexts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Links to Supabase auth.users.id
  auth_uid TEXT NOT NULL,

  -- Links to internal users table (optional, for legacy compat)
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,

  -- What role this context represents
  context_type context_type NOT NULL,

  -- Which tenant org this context belongs to (null for platform admins)
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_primary BOOLEAN NOT NULL DEFAULT false,

  -- Display
  display_name TEXT,

  -- Entity info (individual vs company)
  entity_type entity_type NOT NULL DEFAULT 'individual',
  company_name TEXT,
  company_reg_number TEXT,

  -- Progressive feature discovery
  -- Only features the user has actually needed/enabled appear in their UI
  enabled_features TEXT[] NOT NULL DEFAULT '{}',
  feature_usage JSONB NOT NULL DEFAULT '{}',

  -- Onboarding state per context
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  onboarding_step TEXT,

  -- Flexible metadata
  metadata JSONB NOT NULL DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_contexts_auth_uid ON user_contexts(auth_uid);
CREATE INDEX IF NOT EXISTS idx_user_contexts_tenant ON user_contexts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_contexts_type ON user_contexts(context_type);
CREATE INDEX IF NOT EXISTS idx_user_contexts_active ON user_contexts(auth_uid, is_active) WHERE is_active = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_contexts_primary ON user_contexts(auth_uid, is_primary) WHERE is_primary = true;

-- =============================================================================
-- feature_discovery: Tracks which features each context has discovered/used
-- Powers the progressive UI that expands based on user needs
-- =============================================================================

CREATE TABLE IF NOT EXISTS feature_discovery (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_context_id TEXT NOT NULL REFERENCES user_contexts(id) ON DELETE CASCADE,

  -- Feature identifier (e.g., 'payments.plans', 'maintenance.voice_report')
  feature_key TEXT NOT NULL,

  -- When was it first discovered/shown to user
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Is it currently enabled in their UI
  enabled BOOLEAN NOT NULL DEFAULT true,

  -- Usage tracking for intelligence
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  UNIQUE(user_context_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_feature_discovery_context ON feature_discovery(user_context_id);
CREATE INDEX IF NOT EXISTS idx_feature_discovery_key ON feature_discovery(feature_key);

-- =============================================================================
-- auth_profiles: Links Supabase auth.users to our system
-- =============================================================================

CREATE TABLE IF NOT EXISTS auth_profiles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Supabase auth.users.id
  auth_uid TEXT NOT NULL UNIQUE,

  -- Profile data (synced from Supabase auth or manually set)
  email TEXT,
  phone TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,

  -- The currently active context (what the user is "acting as" right now)
  active_context_id TEXT REFERENCES user_contexts(id),

  -- Preferences
  preferred_locale TEXT NOT NULL DEFAULT 'en',
  preferred_timezone TEXT NOT NULL DEFAULT 'Africa/Dar_es_Salaam',
  preferred_currency TEXT NOT NULL DEFAULT 'TZS',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_auth_profiles_email ON auth_profiles(email);
CREATE INDEX IF NOT EXISTS idx_auth_profiles_phone ON auth_profiles(phone);

-- =============================================================================
-- RLS Policies (Row Level Security)
-- =============================================================================

ALTER TABLE user_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_discovery ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_profiles ENABLE ROW LEVEL SECURITY;

-- Users can see their own contexts
CREATE POLICY user_contexts_own_read ON user_contexts
  FOR SELECT USING (auth_uid = auth.uid()::text);

-- Users can update their own contexts
CREATE POLICY user_contexts_own_update ON user_contexts
  FOR UPDATE USING (auth_uid = auth.uid()::text);

-- Users can insert their own contexts
CREATE POLICY user_contexts_own_insert ON user_contexts
  FOR INSERT WITH CHECK (auth_uid = auth.uid()::text);

-- Feature discovery follows context ownership
CREATE POLICY feature_discovery_own_read ON feature_discovery
  FOR SELECT USING (
    user_context_id IN (
      SELECT id FROM user_contexts WHERE auth_uid = auth.uid()::text
    )
  );

CREATE POLICY feature_discovery_own_write ON feature_discovery
  FOR ALL USING (
    user_context_id IN (
      SELECT id FROM user_contexts WHERE auth_uid = auth.uid()::text
    )
  );

-- Auth profiles: users see their own
CREATE POLICY auth_profiles_own ON auth_profiles
  FOR ALL USING (auth_uid = auth.uid()::text);

-- Service role bypasses RLS (for API gateway)
-- This is automatic in Supabase when using service_role key

-- =============================================================================
-- Functions
-- =============================================================================

-- Get all contexts for a user
CREATE OR REPLACE FUNCTION get_user_contexts(p_auth_uid TEXT)
RETURNS SETOF user_contexts
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT * FROM user_contexts
  WHERE auth_uid = p_auth_uid AND is_active = true
  ORDER BY is_primary DESC, created_at ASC;
$$;

-- Switch active context
CREATE OR REPLACE FUNCTION switch_context(p_auth_uid TEXT, p_context_id TEXT)
RETURNS user_contexts
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_context user_contexts;
BEGIN
  -- Verify ownership
  SELECT * INTO v_context
  FROM user_contexts
  WHERE id = p_context_id AND auth_uid = p_auth_uid AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Context not found or not owned by user';
  END IF;

  -- Update auth_profiles active context
  UPDATE auth_profiles
  SET active_context_id = p_context_id, updated_at = now()
  WHERE auth_uid = p_auth_uid;

  RETURN v_context;
END;
$$;

-- Auto-create auth profile on first login
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO auth_profiles (auth_uid, email, phone, first_name, last_name)
  VALUES (
    NEW.id::text,
    NEW.email,
    NEW.phone,
    COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(COALESCE(NEW.email, ''), '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  )
  ON CONFLICT (auth_uid) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Trigger: auto-create profile when user signs up via Supabase Auth
-- Note: This trigger fires on auth.users inserts (Supabase Auth)
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION handle_new_user();
--
-- Uncomment the above after confirming Supabase project setup.
-- In the meantime, the API gateway handles profile creation.

-- =============================================================================
-- Updated at trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_contexts_updated_at
  BEFORE UPDATE ON user_contexts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER feature_discovery_updated_at
  BEFORE UPDATE ON feature_discovery
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER auth_profiles_updated_at
  BEFORE UPDATE ON auth_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
