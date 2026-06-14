-- =============================================================================
-- Migration 0331 — rfb_requests: applicant-initiated Request-For-Application
-- (RFB) for the marketplace.
--
-- WHY THIS MIGRATION EXISTS
-- -------------------------
-- The tenant-mobile app (apps/tenant-mobile/src/api/rfb.ts) lets a renter post
-- an OPEN request for a property matching their criteria (unit type, grade,
-- floor area, budget, delivery-by date, search radius). Landlords later browse
-- nearby open requests and respond. The applicant-side surface (create /
-- list_mine / cancel) hits POST /marketplace/rfb, GET /marketplace/rfb/mine,
-- and POST /marketplace/rfb/:id/cancel (PATCH /marketplace/rfb/:id alias) with
-- ZERO backend until this table existed — every call 404'd. This migration
-- creates the durable store those routes read and write.
--
-- ONE TABLE
--   * rfb_requests — one row per applicant request. DOUBLE-scoped: tenant_id
--     (RLS isolation) AND applicant_user_id (per-applicant ownership; the route
--     layer filters every read by applicant_user_id so one renter can NEVER see
--     or cancel another renter's request — anti-IDOR on top of RLS).
--
-- CURRENCY (CLAUDE.md hard rule — multi-currency, never hard-code TZS/KES):
--   `unit_price` is a bare numeric BUDGET ceiling; `currency` is an ISO-4217
--   code stored alongside it. The mobile client's field is historically named
--   `unitPriceTzs`, but the column is currency-agnostic and the route persists
--   whatever `currency` the tenant resolves (defaulting to the tenant region
--   config at the app layer, NOT a DB-pinned TZS). No money is ever rendered in
--   the DB.
--
-- STATUS LIFECYCLE
--   open → cancelled        (applicant cancels)
--   open → filled           (a landlord response is accepted; future surface)
--   open → expired          (expires_at passes; swept by future job / lazily)
--
-- TENANT SCOPE (CLAUDE.md hard rule): tenant-scoped (`tenant_id` TEXT; no FK,
-- matching the platform's tenant_id-as-text convention used by 0316/0317/0322).
-- FORCE-enables RLS with a tenant-isolation policy on the canonical
-- `app.current_tenant_id` GUC (bare compare, no cast; NEVER the legacy
-- `app.tenant_id`) plus a service-role bypass mirroring 0316/0317/0322. A
-- TENANT can NEVER read ANOTHER tenant's requests; the route layer adds the
-- per-applicant predicate so a tenant member cannot read a co-tenant's request.
--
-- FRESH-DB SAFETY / IDEMPOTENCY (CLAUDE.md hard rule): every object uses
-- CREATE ... IF NOT EXISTS + guarded DO-blocks + a pg_roles guard around the
-- anon REVOKE. On a fully-migrated DB this is a pure no-op. Every NOT NULL is in
-- the CREATE TABLE WITH a DEFAULT or a non-null literal the route always writes.
--
-- Companion files:
--   * services/api-gateway/src/routes/marketplace.hono.ts  (RFB routes)
--   * apps/tenant-mobile/src/api/rfb.ts                     (mobile client)
--   * packages/database/src/migrations/down/0331_down_rfb_requests.sql
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- rfb_requests — applicant-initiated request-for-application.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS rfb_requests (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          text NOT NULL,
  -- The renter who posted the request. The route layer ALWAYS resolves this
  -- from the JWT (auth.userId) and filters every read by it — never client
  -- input — so it is the anti-IDOR ownership key on top of RLS.
  applicant_user_id  text NOT NULL,

  -- Matching criteria.
  unit_type          text NOT NULL,
  grade_min          text,
  floor_area_min     numeric(12, 2) NOT NULL,
  floor_area_max     numeric(12, 2),
  unit_price         numeric(18, 2) NOT NULL,
  -- ISO-4217 currency for unit_price. Currency-agnostic: the route persists the
  -- tenant-resolved code; the column NEVER hard-pins TZS/KES.
  currency           text NOT NULL DEFAULT 'TZS',
  delivery_by        date NOT NULL,
  location_lat       numeric(9, 6),
  location_lon       numeric(9, 6),
  radius_km          numeric(8, 2) NOT NULL,
  notes              text,

  -- Lifecycle.
  status             text NOT NULL DEFAULT 'open',

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  -- Default 30-day TTL; the route overrides via the column default when not
  -- supplied. A swept/lazy check flips status to 'expired' once passed.
  expires_at         timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  cancelled_at       timestamptz,

  CONSTRAINT rfb_requests_status_chk
    CHECK (status IN ('open', 'filled', 'expired', 'cancelled')),
  CONSTRAINT rfb_requests_area_chk
    CHECK (floor_area_max IS NULL OR floor_area_max >= floor_area_min),
  CONSTRAINT rfb_requests_radius_chk
    CHECK (radius_km > 0),
  CONSTRAINT rfb_requests_price_chk
    CHECK (unit_price > 0)
);

-- Hot path: the applicant's own list, newest first, filtered by status.
CREATE INDEX IF NOT EXISTS idx_rfb_requests_tenant_applicant
  ON rfb_requests (tenant_id, applicant_user_id, created_at DESC);

-- Landlord "nearby open requests" browse (future surface) + expiry sweep.
CREATE INDEX IF NOT EXISTS idx_rfb_requests_tenant_status
  ON rfb_requests (tenant_id, status, expires_at);

-- -----------------------------------------------------------------------------
-- RLS — FORCE + tenant isolation on the canonical GUC + service-role bypass +
-- guarded anon REVOKE. Mirrors the 0316/0317/0322 shape.
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  tbl text;
  tenant_tables text[] := ARRAY[
    'rfb_requests'
  ];
BEGIN
  FOREACH tbl IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('ALTER TABLE %I FORCE  ROW LEVEL SECURITY;', tbl);

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename  = tbl
         AND policyname = 'tenant_isolation_' || tbl
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL '
        || 'USING (tenant_id = current_setting(''app.current_tenant_id'', true)) '
        || 'WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true));',
        'tenant_isolation_' || tbl, tbl
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename  = tbl
         AND policyname = tbl || '_service_role_bypass'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL '
        || 'USING (current_setting(''app.is_service_role'', true) = ''true'') '
        || 'WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');',
        tbl || '_service_role_bypass', tbl
      );
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon;', tbl);
    END IF;
  END LOOP;
END $$;

COMMENT ON TABLE rfb_requests IS
  'Applicant-initiated Request-For-Application (RFB): a renter''s open request '
  'for a property matching criteria. DOUBLE-scoped — tenant_id (RLS) + '
  'applicant_user_id (per-applicant ownership; the route filters every read by '
  'it, anti-IDOR). unit_price is a currency-agnostic budget ceiling paired with '
  'an ISO-4217 currency column (never DB-pinned TZS). RLS FORCE on '
  'app.current_tenant_id + service-role bypass. Added in 0331.';

COMMENT ON COLUMN rfb_requests.applicant_user_id IS
  'The renter who posted the request. ALWAYS resolved from the JWT by the route '
  'layer (never client input) and used as the per-applicant ownership predicate '
  'on every read so one renter can never see/cancel another''s request.';

COMMENT ON COLUMN rfb_requests.unit_price IS
  'Budget ceiling. Currency-agnostic numeric paired with the currency column. '
  'The mobile field is named unitPriceTzs for legacy reasons but the value is '
  'stored under whatever currency the tenant resolves — never hard-pinned TZS.';

COMMIT;
