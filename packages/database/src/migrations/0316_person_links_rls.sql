-- ============================================================================
-- Migration 0316 — RLS for person_links + atomic-claim unique index on
-- disbursements.
--
-- WHY (person_links — audit fix #16, HIGH)
-- ────────────────────────────────────────
-- `person_links` (packages/database/src/schemas/persons.schema.ts) is the
-- (person × tenant × supabase_user) join from the federated Personal-KB.
-- Every row carries a `tenant_id` (text, NOT NULL) plus the PII linkage of
-- which real human wears which hat at which tenant under which Supabase auth
-- principal. The companion `persons` table is a tenant-orthogonal platform
-- registry with NO tenant_id — correctly exempt from RLS — but `person_links`
-- IS tenant-scoped and shipped (migration 0296) WITHOUT row-level security
-- and is NOT in scripts/__allowlists__/rls-coverage-allowlist.mjs. The
-- universal RLS-coverage scanner (scripts/audit-rls-coverage.mjs) therefore
-- FAILs: a tenant_id-bearing table with neither an ENABLE ROW LEVEL SECURITY
-- migration nor an allowlist entry is a live cross-tenant isolation hole —
-- one tenant's identity-resolution reads could leak another tenant's
-- person→user linkages.
--
-- The fix is to give person_links real RLS (not to allowlist it): enabling +
-- forcing RLS and installing the canonical tenant_isolation + service_role
-- policies satisfies both `tableHasRlsEnabled` and `tableHasPolicy` in the
-- scanner and closes the leak. The cross-tenant identity-resolution lookups
-- that legitimately span tenants run under the service-role connection
-- (app.is_service_role = 'true'), which the bypass policy permits.
--
-- WHAT IT DOES (identical contract to 0311 / 0314 — the canonical shape)
-- ─────────────────────────────────────────────────────────────────────
--   1. ENABLE ROW LEVEL SECURITY  (idempotent)
--   2. FORCE ROW LEVEL SECURITY   (closes the table-owner bypass loophole)
--   3. CREATE POLICY tenant_isolation_select  (SELECT gated on GUC)
--   4. CREATE POLICY tenant_isolation_modify  (INSERT/UPDATE/DELETE)
--   5. CREATE POLICY service_role_bypass       (cross-tenant identity jobs)
--   6. REVOKE ALL ... FROM anon                (no anonymous Supabase access)
--
-- Reads the same GUCs (app.current_tenant_id / app.is_service_role) bound by
-- the api-gateway tenant-context middleware and
-- packages/database/src/rls/with-tenant-context.ts. `person_links.tenant_id`
-- is `text`, so the predicate uses the canonical `tenant_id::text =
-- current_setting(...)` form (never `current_setting(...)::uuid` — that is the
-- text=uuid mismatch 0175_fix_rls_type_coercion.sql had to repair).
--
-- WHY (disbursements unique index — money-agent atomic-claim)
-- ──────────────────────────────────────────────────────────
-- The disbursements money path moves to an atomic-claim insert
-- (`INSERT ... ON CONFLICT (tenant_id, idempotency_key) DO NOTHING`) to make
-- the idempotency guard race-free. 0174 already shipped a PARTIAL unique index
-- `disbursements_idempotency_idx (tenant_id, idempotency_key) WHERE
-- idempotency_key IS NOT NULL`; a partial index is only a valid ON CONFLICT
-- arbiter when the INSERT provably satisfies its predicate. To give the claim
-- a guaranteed arbiter without depending on that proof, this adds a NON-partial
-- unique index `disbursements_tenant_idempotency_uq (tenant_id,
-- idempotency_key)`. In practice idempotency_key is always populated
-- (disbursement.service.ts defaults it to the disbursement id), so the new
-- index never rejects a legitimate row the partial index would have allowed.
--
-- Replayable: table-existence guard + ENABLE (idempotent) +
-- DROP POLICY IF EXISTS before each CREATE POLICY + index name-existence
-- guard. Safe to re-run.
-- ============================================================================


-- ---- person_links (tenant_id text NOT NULL; created in 0296_personal_knowledge_base.sql) ----
DO $do_person_links$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'person_links'
  ) THEN
    EXECUTE 'ALTER TABLE public.person_links ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE public.person_links FORCE ROW LEVEL SECURITY;';

    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.person_links;';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_modify ON public.person_links;';
    EXECUTE 'DROP POLICY IF EXISTS service_role_bypass ON public.person_links;';

    EXECUTE 'CREATE POLICY tenant_isolation_select ON public.person_links
              FOR SELECT TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY tenant_isolation_modify ON public.person_links
              FOR ALL TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true))
              WITH CHECK (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY service_role_bypass ON public.person_links
              FOR ALL
              USING (current_setting(''app.is_service_role'', true) = ''true'')
              WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');';

    EXECUTE 'REVOKE ALL ON public.person_links FROM anon;';
  END IF;
END
$do_person_links$;


-- ---- disbursements atomic-claim arbiter (non-partial unique index) ----
DO $do_disbursements_claim_idx$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'disbursements'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'disbursements'
      AND column_name = 'idempotency_key'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'disbursements_tenant_idempotency_uq'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS disbursements_tenant_idempotency_uq
              ON public.disbursements (tenant_id, idempotency_key);';
  END IF;
END
$do_disbursements_claim_idx$;
