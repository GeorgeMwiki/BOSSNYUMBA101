-- =============================================================================
-- Migration 0281 — Request for Applications (RFA) — vacancy listings +
-- tenant-applicant pipeline.
--
-- Ported from Borjie 0127 (request_for_bids) — domain-shifted from
-- mineral marketplace to real-estate vacancy / tenancy applications.
--
-- Landlords post "I have an N-bedroom unit in neighbourhood X at TZS Y
-- per month available from date D". Prospective tenants in the radius
-- see the row in their nearby feed, then post applications via the
-- responses sidecar.
--
-- Also supports the inverse flow — tenant posts "I'm looking for an
-- N-bedroom unit in X at TZS Y" (provenance.via='tenant_search') and
-- landlords reply with available properties.
--
-- Tenant scope:
--   RLS FORCE per the CLAUDE.md hard rule. The landlord's tenant_id is
--   stamped at insert by the route handler reading auth.tenantId.
--   The nearby-feed prospective-tenant endpoint joins ON the prospect's
--   search radius vs the RFA's lat/lon, so cross-tenant visibility is
--   the deliberate design and is gated by the geo predicate.
--
-- Status lifecycle:
--   open       landlord just posted; visible to prospects in radius
--   filled     landlord accepted an applicant, RFA closed
--   expired    expires_at passed without resolution
--   cancelled  landlord pulled the listing before any acceptance
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS request_for_applications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  /** The landlord / property-manager user posting the listing. */
  landlord_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  /** Property type — residential / commercial / mixed / industrial / student_housing. */
  property_type       TEXT NOT NULL,
  /** Number of bedrooms (NULL for commercial / non-residential). */
  bedrooms_min        INTEGER,
  bedrooms_max        INTEGER,
  /** Optional area in square metres for commercial listings. */
  area_sqm_min        NUMERIC(10,2),
  area_sqm_max        NUMERIC(10,2),
  /** Monthly rent in tenant's primary_currency. The application layer
   *  converts via currency-preferences for cross-currency feeds. */
  rent_per_month      NUMERIC(15,2) NOT NULL,
  /** Currency code matches tenant.primary_currency (TZS default). */
  currency_code       TEXT NOT NULL DEFAULT 'TZS',
  available_from      DATE NOT NULL,
  /** Lease term in months (12 default; commercial may be 36/60). */
  lease_term_months   INTEGER NOT NULL DEFAULT 12,
  location_lat        NUMERIC(9,6),
  location_lon        NUMERIC(9,6),
  /** Neighbourhood / district name — free text for now. */
  neighbourhood       TEXT,
  /** Search radius for nearby-feed visibility. */
  radius_km           INTEGER NOT NULL DEFAULT 25,
  status              TEXT NOT NULL DEFAULT 'open',
  /** Free-text description of the property — bilingual sw/en in
   *  the application layer; stored as raw text here. */
  notes               TEXT,
  /** Provenance jsonb so the brain can trace whether the RFA came
   *  from chat (via=chat + sessionId/turnId), the landlord mobile
   *  form (via=owner_mobile), or a manual operator action. */
  provenance          JSONB NOT NULL DEFAULT '{"via":"unknown"}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',

  CONSTRAINT rfa_status_check CHECK (
    status IN ('open', 'filled', 'expired', 'cancelled')
  ),
  CONSTRAINT rfa_rent_positive CHECK (rent_per_month > 0),
  CONSTRAINT rfa_currency_check CHECK (
    currency_code IN ('TZS', 'USD', 'KES', 'UGX', 'NGN', 'EUR',
                      'ZAR', 'GBP', 'AUD')
  ),
  CONSTRAINT rfa_radius_range CHECK (
    radius_km > 0 AND radius_km <= 500
  ),
  CONSTRAINT rfa_lease_term_positive CHECK (
    lease_term_months > 0 AND lease_term_months <= 360
  ),
  CONSTRAINT rfa_bedrooms_range CHECK (
    bedrooms_min IS NULL OR (bedrooms_min >= 0 AND bedrooms_min <= 20)
  ),
  CONSTRAINT rfa_bedrooms_max_check CHECK (
    bedrooms_max IS NULL OR (bedrooms_min IS NULL OR bedrooms_max >= bedrooms_min)
  ),
  CONSTRAINT rfa_area_range CHECK (
    area_sqm_min IS NULL OR area_sqm_min > 0
  ),
  CONSTRAINT rfa_area_max_check CHECK (
    area_sqm_max IS NULL OR (area_sqm_min IS NULL OR area_sqm_max >= area_sqm_min)
  )
);

-- Tenant-scoped lookups for landlord's own RFAs.
CREATE INDEX IF NOT EXISTS rfa_tenant_status_type_idx
  ON request_for_applications (tenant_id, status, property_type);

-- Geo predicate for the prospect nearby feed. Partial index keeps the
-- working set tight — once an RFA is filled / expired / cancelled
-- the planner ignores it.
CREATE INDEX IF NOT EXISTS rfa_open_geo_idx
  ON request_for_applications (location_lat, location_lon)
  WHERE status = 'open';

-- Provenance jsonb path index (gin) so the brain audit trail can
-- query RFAs by their via=… origin.
CREATE INDEX IF NOT EXISTS rfa_provenance_gin_idx
  ON request_for_applications USING gin (provenance);

-- Time-to-live sweep query (expire RFAs whose expires_at has passed).
CREATE INDEX IF NOT EXISTS rfa_expires_at_idx
  ON request_for_applications (expires_at)
  WHERE status = 'open';

-- =============================================================================
-- Applicant responses sidecar — one-to-many. We keep responses in a
-- separate table so the landlord's RFA row stays compact and the
-- nearby-feed query never has to aggregate responses.
-- =============================================================================

CREATE TABLE IF NOT EXISTS request_for_application_responses (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfa_id               UUID NOT NULL REFERENCES request_for_applications(id) ON DELETE CASCADE,
  tenant_id            UUID NOT NULL,
  /** The prospective tenant applying. */
  applicant_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  /** Offered monthly rent (may differ from listing — negotiation). */
  offered_rent         NUMERIC(15,2) NOT NULL,
  currency_code        TEXT NOT NULL DEFAULT 'TZS',
  /** Desired move-in date. */
  move_in_by           DATE NOT NULL,
  /** Optional lease term (negotiable). */
  lease_term_months    INTEGER,
  /** Cover note in landlord's preferred language. */
  notes                TEXT,
  status               TEXT NOT NULL DEFAULT 'pending',
  provenance           JSONB NOT NULL DEFAULT '{"via":"unknown"}'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT rfa_responses_status_check CHECK (
    status IN ('pending', 'accepted', 'rejected', 'withdrawn')
  ),
  CONSTRAINT rfa_responses_rent_positive CHECK (offered_rent > 0),
  CONSTRAINT rfa_responses_currency_check CHECK (
    currency_code IN ('TZS', 'USD', 'KES', 'UGX', 'NGN', 'EUR',
                      'ZAR', 'GBP', 'AUD')
  ),
  CONSTRAINT rfa_responses_lease_term_check CHECK (
    lease_term_months IS NULL OR (lease_term_months > 0 AND lease_term_months <= 360)
  )
);

CREATE INDEX IF NOT EXISTS rfa_responses_rfa_status_idx
  ON request_for_application_responses (rfa_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS rfa_responses_tenant_applicant_idx
  ON request_for_application_responses (tenant_id, applicant_id, created_at DESC);

-- =============================================================================
-- Row-level security: per-tenant isolation FORCE-enabled on both tables.
-- =============================================================================

ALTER TABLE request_for_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_for_applications FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rfa_tenant_isolation ON request_for_applications;

CREATE POLICY rfa_tenant_isolation ON request_for_applications
  USING (tenant_id::text = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

ALTER TABLE request_for_application_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_for_application_responses FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rfa_responses_tenant_isolation ON request_for_application_responses;

CREATE POLICY rfa_responses_tenant_isolation ON request_for_application_responses
  USING (tenant_id::text = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

COMMENT ON TABLE request_for_applications IS
  'Landlord-initiated vacancy listing. Landlord posts requirement '
  '(property_type, bedrooms, rent, move-in date, radius); prospective '
  'tenants within the geo predicate apply via request_for_application_responses.';

COMMENT ON TABLE request_for_application_responses IS
  'Prospective-tenant applications to landlord-posted vacancies. Each '
  'row is one application; the landlord accepts ONE which flips the '
  'parent RFA to status=filled.';

COMMIT;
