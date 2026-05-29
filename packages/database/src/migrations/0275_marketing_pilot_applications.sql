-- =============================================================================
-- Migration 0275 — Marketing pilot applications (real-estate landlord/PM
-- inbound leads).
--
-- Ported from Borjie 0146. Generalised for the real-estate domain: stores
-- inbound pilot applications from landlords / property managers visiting
-- the marketing site. Surfaced via:
--   - POST /api/v1/marketing/pilot-application  (write)
--   - admin-web pilot-applications list page    (read, future)
--
-- The shape is distinct from `marketing_leads` (0075) — that table tracks
-- ad-funnel / brochure-download leads. This table tracks structured
-- "I want to onboard my portfolio" applications with portfolio size +
-- property type focus.
--
-- Public-write surface — RLS intentionally permissive on INSERT (no
-- tenant scoping because the prospect has no tenant yet). SELECT/UPDATE
-- gated to SUPER_ADMIN via `app.is_super_admin` GUC.
-- =============================================================================

CREATE TABLE IF NOT EXISTS marketing_pilot_applications (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  company         TEXT NOT NULL,
  email           TEXT NOT NULL,
  phone           TEXT NOT NULL,
  /** Number of units / properties the prospect manages. */
  portfolio_size  INTEGER NOT NULL,
  /**
   * Property-type focus — `residential`, `commercial`, `mixed`,
   * `industrial`, `student_housing`, `vacation_rental`, `other`.
   * Free text — application layer validates against canonical list.
   */
  property_focus  TEXT NOT NULL,
  source_ip       TEXT,
  user_agent      TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_pilot_applications_created_at
  ON marketing_pilot_applications (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_pilot_applications_company
  ON marketing_pilot_applications (lower(company));

CREATE INDEX IF NOT EXISTS idx_marketing_pilot_applications_email
  ON marketing_pilot_applications (lower(email));

ALTER TABLE marketing_pilot_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_pilot_applications FORCE ROW LEVEL SECURITY;

-- Public-write (no tenant binding); reads require SUPER_ADMIN context
-- gated by application middleware (`requireRole`). Insert is unbound so
-- the marketing site can POST without a session.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'marketing_pilot_applications'
       AND policyname = 'pilot_app_insert'
  ) THEN
    CREATE POLICY pilot_app_insert
      ON marketing_pilot_applications
      FOR INSERT
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'marketing_pilot_applications'
       AND policyname = 'pilot_app_select_super_admin'
  ) THEN
    CREATE POLICY pilot_app_select_super_admin
      ON marketing_pilot_applications
      FOR SELECT
      USING (current_setting('app.is_super_admin', true) = 'true');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'marketing_pilot_applications'
       AND policyname = 'pilot_app_update_super_admin'
  ) THEN
    CREATE POLICY pilot_app_update_super_admin
      ON marketing_pilot_applications
      FOR UPDATE
      USING (current_setting('app.is_super_admin', true) = 'true')
      WITH CHECK (current_setting('app.is_super_admin', true) = 'true');
  END IF;
END
$$;
