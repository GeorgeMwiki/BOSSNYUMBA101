-- =============================================================================
-- Migration 0327 — applicant_kyc + applicant_profile: the renter-applicant
-- identity surface for the tenant (counterparty) mobile app.
--
-- WHY THIS MIGRATION EXISTS
-- -------------------------
-- The tenant mobile app's `apps/tenant-mobile/src/api/applicants.ts` drives a
-- renter's own identity flow against the estate-manager operator router:
--   POST /api/v1/manager/applicants/kyc                  submit KYC
--   GET  /api/v1/manager/applicants/kyc/:id/status       poll one KYC record
--   PUT/POST /api/v1/manager/applicants/profile          update profile
--   PUT  /api/v1/manager/applicants/profile/notifications update notif prefs
-- None of those routes (or their backing tables) existed. These two tables are
-- the durable, tenant-scoped substrate the new routes read/write. A renter
-- sees ONLY their own record (uniform-404 anti-IDOR enforced at the API layer).
--
-- TWO TABLES, ONE OWNER ROW EACH
-- ------------------------------
--   * applicant_kyc — one row per KYC SUBMISSION (an applicant may resubmit
--     after rejection, so this is NOT unique per applicant; it is keyed by id
--     and indexed by applicant). Carries the four KYC sections as JSONB
--     (personal / nida / company / aml — zod-validated at the API layer) plus
--     a `stage` lifecycle column and a nullable `rejection_reason`. PII-heavy
--     (NIDA images, TIN, source-of-funds) — strictly tenant-isolated.
--   * applicant_profile — one row per applicant (UNIQUE(tenant_id, applicant_id)),
--     holds the editable profile (company name, phone) + persisted
--     `preferred_lang` (sw|en — NEVER hard-coded; persisted and hydrated per the
--     bilingual hard rule) + the notification-preference booleans. PUT/POST
--     upserts this single row.
--
-- `applicant_id` is the Supabase user id of the renter (the authenticated
-- principal). The API derives it from the JWT, never from the request body, so
-- one renter can never write another's identity row.
--
-- NO money columns — identity + preferences only. Any money the renter later
-- moves flows through the gated verbs + LedgerService (CLAUDE.md hard rule).
--
-- HARD RULES HONOURED
-- -------------------
--   * Both tables tenant-scoped -> ENABLE + FORCE RLS + canonical
--     tenant_isolation (select/modify) + service_role_bypass policies on
--     current_setting('app.current_tenant_id'/'app.is_service_role', true)
--     (mirrors 0316). REVOKE anon (guarded for vanilla PG).
--   * tenant_id is TEXT -> bare `tenant_id = current_setting(...)` predicate.
--
-- IDEMPOTENT / FORWARD-ONLY: IF NOT EXISTS + DROP POLICY IF EXISTS before each
-- CREATE POLICY + pg_roles anon guard. Safe to re-run. Append-only per CLAUDE.md.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- §1 — applicant_kyc (one row per submission)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS applicant_kyc (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  applicant_id      TEXT NOT NULL,
  stage             TEXT NOT NULL DEFAULT 'submitted'
                      CHECK (stage IN ('submitted','reviewing','approved','rejected')),
  personal          JSONB NOT NULL DEFAULT '{}'::jsonb,
  nida              JSONB NOT NULL DEFAULT '{}'::jsonb,
  company           JSONB NOT NULL DEFAULT '{}'::jsonb,
  aml               JSONB NOT NULL DEFAULT '{}'::jsonb,
  rejection_reason  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- "this applicant's KYC submissions, newest first" + the per-id status poll.
CREATE INDEX IF NOT EXISTS applicant_kyc_tenant_applicant_idx
  ON applicant_kyc(tenant_id, applicant_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- §2 — applicant_profile (one row per applicant)
--
-- `preferred_lang` is persisted (sw|en) and hydrated on read — the bilingual
-- toggle is ABSOLUTE per CLAUDE.md, so it must never be hard-coded in code.
-- The four notification booleans mirror the tenant-app NotificationPrefs shape.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS applicant_profile (
  id                    TEXT PRIMARY KEY,
  tenant_id             TEXT NOT NULL,
  applicant_id          TEXT NOT NULL,
  company_name          TEXT,
  phone                 TEXT,
  preferred_lang        TEXT NOT NULL DEFAULT 'en'
                          CHECK (preferred_lang IN ('sw','en')),
  notif_new_listings    BOOLEAN NOT NULL DEFAULT TRUE,
  notif_bid_updates     BOOLEAN NOT NULL DEFAULT TRUE,
  notif_document_ready  BOOLEAN NOT NULL DEFAULT TRUE,
  notif_price_alerts    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One profile per applicant per tenant; the PUT/POST upsert arbiter.
CREATE UNIQUE INDEX IF NOT EXISTS applicant_profile_tenant_applicant_uq
  ON applicant_profile(tenant_id, applicant_id);

-- -----------------------------------------------------------------------------
-- §3 — FORCE RLS + canonical policies for BOTH tables. Idempotent.
-- -----------------------------------------------------------------------------

DO $do_applicant_identity$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['applicant_kyc','applicant_profile'] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', tbl);

      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_select ON public.%I;', tbl);
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_modify ON public.%I;', tbl);
      EXECUTE format('DROP POLICY IF EXISTS service_role_bypass ON public.%I;', tbl);

      EXECUTE format(
        'CREATE POLICY tenant_isolation_select ON public.%I
          FOR SELECT TO authenticated
          USING (tenant_id = current_setting(''app.current_tenant_id'', true));', tbl);

      EXECUTE format(
        'CREATE POLICY tenant_isolation_modify ON public.%I
          FOR ALL TO authenticated
          USING (tenant_id = current_setting(''app.current_tenant_id'', true))
          WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true));', tbl);

      EXECUTE format(
        'CREATE POLICY service_role_bypass ON public.%I
          FOR ALL
          USING (current_setting(''app.is_service_role'', true) = ''true'')
          WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');', tbl);

      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        EXECUTE format('REVOKE ALL ON public.%I FROM anon;', tbl);
      END IF;
    END IF;
  END LOOP;
END
$do_applicant_identity$;

COMMENT ON TABLE applicant_kyc IS
  'Renter-applicant KYC submissions (tenant-mobile). One row per submission; '
  'personal/nida/company/aml are zod-validated JSONB; stage lifecycle '
  '(submitted/reviewing/approved/rejected). applicant_id = Supabase user id from '
  'the JWT (never the body). Uniform-404 anti-IDOR at the API. NO money columns. '
  'RLS FORCE on app.current_tenant_id. Added in 0327.';

COMMENT ON TABLE applicant_profile IS
  'Renter-applicant editable profile + notification prefs (tenant-mobile). One '
  'row per applicant (UNIQUE tenant_id, applicant_id). preferred_lang (sw|en) is '
  'PERSISTED + hydrated — never hard-coded (bilingual hard rule). NO money '
  'columns. RLS FORCE on app.current_tenant_id. Added in 0327.';

COMMIT;
