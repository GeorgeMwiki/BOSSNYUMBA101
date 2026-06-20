-- =============================================================================
-- Migration 0338 — applicant_notifications + rfb_responses.
--
-- WHY THIS MIGRATION EXISTS (Mode-C R2 counterparty highs)
-- --------------------------------------------------------
-- The tenant-mobile (counterparty) app has two dead L7/L8 loops:
--
-- (a) Notifications inbox always empty + mark-read 404s. The app's
--     apps/tenant-mobile/src/api/notifications.ts expects an APPLICANT-scoped
--     inbox row shape (applicant_user_id, bilingual title/body, read_at) under
--     GET /api/v1/notifications returning { data: { notifications, nextCursor } }
--     plus POST /api/v1/notifications/:id/read. The gateway instead read the
--     operator-side notification_dispatch_log (no applicant_user_id, no read_at,
--     bare-array shape) so the inbox was permanently empty and every mark-read
--     404'd. This migration adds the dedicated applicant inbox the FE contract
--     needs.
--
-- (b) Sign-Lease (sign-delivery) posts to a nonexistent route. The accepted
--     landlord response to an applicant's rfb_requests row had no durable store,
--     so /marketplace/rfb/:id could not resolve an accepted-response id and the
--     settlement orchestrator had nothing to load. This migration adds
--     rfb_responses — the landlord's response to an applicant request, with the
--     settlement linkage (rent/term/deposit/landlord) the L8 orchestrator runs
--     against — keyed so exactly one response per request can be 'accepted'.
--
-- TWO TABLES
--   * applicant_notifications — one row per applicant-facing notification. DOUBLE
--     scoped: tenant_id (RLS isolation) AND applicant_user_id (per-applicant
--     ownership; the route filters every read by applicant_user_id so one renter
--     can never see/mark another renter's notification — anti-IDOR on RLS).
--   * rfb_responses — landlord response to an rfb_requests row. Tenant-scoped
--     (RLS). Carries the settlement fields (rent_amount, lease_term_months,
--     deposit_amount, currency_code, landlord_user_id) and a lifecycle status;
--     a partial unique index enforces at most ONE accepted response per request.
--
-- BILINGUAL (CLAUDE.md hard rule — complete EN + SW; single-locale render):
--   applicant_notifications carries title_sw/title_en/body_sw/body_en. The
--   route renders exactly one locale per the active user language; no mixing.
--
-- CURRENCY (CLAUDE.md hard rule — multi-currency, never hard-code TZS):
--   rfb_responses.currency_code is an ISO-4217 code (DB default 'TZS' only as a
--   column fallback; the producer always writes the tenant-resolved code).
--
-- TENANT SCOPE (CLAUDE.md hard rule): both tables tenant-scoped (tenant_id TEXT,
--   matching the platform tenant_id-as-text convention used by 0331). FORCE RLS
--   with a tenant-isolation policy on the canonical app.current_tenant_id GUC
--   plus a service-role bypass + guarded anon REVOKE. Mirrors the 0331 shape.
--
-- FRESH-DB SAFETY / IDEMPOTENCY (CLAUDE.md hard rule): every object uses
--   CREATE ... IF NOT EXISTS + guarded DO-blocks + a pg_roles guard around the
--   anon REVOKE. On a fully-migrated DB this is a pure no-op.
--
-- Companion files:
--   * services/api-gateway/src/routes/notifications.ts        (applicant inbox)
--   * services/api-gateway/src/routes/marketplace.hono.ts     (rfb/:id + sign)
--   * apps/tenant-mobile/src/api/notifications.ts             (FE inbox client)
--   * apps/tenant-mobile/app/rfb/[id]/sign-delivery.tsx       (FE sign screen)
--   * packages/database/src/migrations/down/0338_down_applicant_notifications.sql
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- applicant_notifications — applicant-facing L7 inbox.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS applicant_notifications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- RLS isolation scope: the APPLICANT's own tenant (the renting counterparty).
  tenant_id           text NOT NULL,
  -- Per-applicant ownership key. ALWAYS resolved from the JWT (auth.userId) by
  -- the route layer and used as the predicate on every read/mark-read so one
  -- renter can never see/mark another's notification — anti-IDOR on top of RLS.
  applicant_user_id   text NOT NULL,
  -- Convenience mirror of tenant_id for the FE row contract.
  applicant_tenant_id text NOT NULL,
  -- The listing side (the landlord's tenant) for cross-side context. Nullable —
  -- platform/system notifications have no landlord side.
  landlord_tenant_id  text,

  -- Source linkage (all optional — a notification need not have all three).
  rfb_id              uuid,
  response_id         uuid,
  task_id             uuid,

  -- Notification kind — drives the FE deep-link resolver.
  kind                text NOT NULL,

  -- Bilingual copy (CLAUDE.md hard rule — complete EN + SW; single-locale render).
  title_sw            text NOT NULL,
  title_en            text NOT NULL,
  body_sw             text NOT NULL,
  body_en             text NOT NULL,

  payload             jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Per-recipient read state. NULL = unread; set to now() on mark-read.
  read_at             timestamptz,

  created_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT applicant_notifications_kind_chk
    CHECK (kind IN ('rfb_fulfilled', 'rfb_response_received', 'settlement_paid'))
);

-- Hot path: the applicant's own inbox, newest first.
CREATE INDEX IF NOT EXISTS idx_applicant_notifications_tenant_applicant
  ON applicant_notifications (tenant_id, applicant_user_id, created_at DESC);

-- Unread filter / unread-count.
CREATE INDEX IF NOT EXISTS idx_applicant_notifications_unread
  ON applicant_notifications (tenant_id, applicant_user_id, created_at DESC)
  WHERE read_at IS NULL;

-- -----------------------------------------------------------------------------
-- rfb_responses — landlord response to an applicant rfb_requests row.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS rfb_responses (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           text NOT NULL,
  rfb_id              uuid NOT NULL REFERENCES rfb_requests(id) ON DELETE CASCADE,
  -- The landlord/property-manager user who responded; the settlement payout pays
  -- this user.
  landlord_user_id    text NOT NULL,

  -- Settlement linkage the L8 orchestrator computes math from.
  rent_amount         numeric(18, 2) NOT NULL,
  lease_term_months   integer NOT NULL DEFAULT 12,
  deposit_amount      numeric(18, 2) NOT NULL DEFAULT 0,
  -- ISO-4217 code (never DB-pinned TZS in a business branch; producer writes the
  -- tenant-resolved code; column default is a fallback only).
  currency_code       text NOT NULL DEFAULT 'TZS',

  -- Lifecycle: pending -> accepted | rejected | withdrawn. Exactly one accepted
  -- response per request (partial unique index below).
  status              text NOT NULL DEFAULT 'pending',
  notes               text,

  accepted_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT rfb_responses_status_chk
    CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  CONSTRAINT rfb_responses_rent_chk
    CHECK (rent_amount > 0),
  CONSTRAINT rfb_responses_deposit_chk
    CHECK (deposit_amount >= 0),
  CONSTRAINT rfb_responses_term_chk
    CHECK (lease_term_months > 0 AND lease_term_months <= 360),
  CONSTRAINT rfb_responses_currency_chk
    CHECK (currency_code IN ('TZS', 'USD', 'KES', 'UGX', 'NGN', 'EUR',
                             'ZAR', 'GBP', 'AUD'))
);

-- Responses for a request, newest first.
CREATE INDEX IF NOT EXISTS idx_rfb_responses_tenant_rfb
  ON rfb_responses (tenant_id, rfb_id, created_at DESC);

-- At most ONE accepted response per request — the accepted-response lookup the
-- sign-delivery surface relies on is unambiguous.
CREATE UNIQUE INDEX IF NOT EXISTS uq_rfb_responses_accepted_per_request
  ON rfb_responses (rfb_id)
  WHERE status = 'accepted';

-- -----------------------------------------------------------------------------
-- RLS — FORCE + tenant isolation on the canonical GUC + service-role bypass +
-- guarded anon REVOKE. Mirrors the 0331 shape.
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  tbl text;
  tenant_tables text[] := ARRAY[
    'applicant_notifications',
    'rfb_responses'
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

COMMENT ON TABLE applicant_notifications IS
  'Applicant-facing L7 notification inbox for the tenant-mobile counterparty '
  'app. DOUBLE-scoped — tenant_id (RLS) + applicant_user_id (per-applicant '
  'ownership; the route filters every read/mark-read by it, anti-IDOR). '
  'Bilingual title_sw/en + body_sw/en (single-locale render). read_at NULL = '
  'unread. Added in 0338.';

COMMENT ON COLUMN applicant_notifications.applicant_user_id IS
  'The renter the notification is for. ALWAYS resolved from the JWT by the route '
  'layer (never client input) and used as the per-applicant predicate on every '
  'read so one renter can never see/mark another''s notification.';

COMMENT ON TABLE rfb_responses IS
  'Landlord response to an applicant rfb_requests row. Tenant-scoped (RLS). '
  'Carries the settlement linkage (rent_amount, lease_term_months, '
  'deposit_amount, currency_code, landlord_user_id) the L8 SettlementOrchestrator '
  'runs against. At most ONE accepted response per request (partial unique '
  'index). currency_code is an ISO-4217 code, never DB-pinned TZS in a business '
  'branch. Added in 0338.';

COMMIT;
