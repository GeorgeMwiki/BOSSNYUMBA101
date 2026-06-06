-- ============================================================================
-- Migration 0311 — RLS catch-up for tenant-scoped tables created AFTER the
-- 0179b auto-generated sweep (2026-06-06 deep-audit pass).
--
-- Why this exists
-- ───────────────
-- The 2026-05-24 sweep (0179b_rls_policies.sql) covered every tenant-scoped
-- table that existed at the time. Four tenant-scoped tables shipped after
-- that sweep (or in the gap between 0173 and 0179b) and never had RLS
-- enabled, leaving a cross-tenant isolation hole:
--
--   • owner_statements          (0176_owner_statements_table.sql)   tenant_id text NOT NULL
--   • strategic_report_history  (0174b_strategic_report_history.sql) tenant_id TEXT NOT NULL
--   • tenant_llm_budgets        (0272_tenant_llm_budgets.sql)        tenant_id text NOT NULL
--   • tenant_llm_budget_caps    (0272_tenant_llm_budgets.sql)        tenant_id text NOT NULL
--
-- owner_statements is the highest-risk of the four: it is read by the
-- monthly-close + payments-ledger statement-generation job and the DSAR
-- exporter, so a missing policy is a direct cross-tenant data-leak path.
--
-- What this migration does (identical contract to 0179b)
-- ──────────────────────────────────────────────────────
-- For each table:
--   1. ENABLE ROW LEVEL SECURITY  (idempotent)
--   2. FORCE ROW LEVEL SECURITY   (closes the table-owner bypass loophole)
--   3. CREATE POLICY tenant_isolation_select  (SELECT gated on GUC)
--   4. CREATE POLICY tenant_isolation_modify  (INSERT/UPDATE/DELETE)
--   5. CREATE POLICY service_role_bypass       (cross-tenant system jobs)
--   6. REVOKE ALL ... FROM anon                (no anonymous Supabase access)
--
-- Reads the same GUCs (app.current_tenant_id / app.is_service_role) bound by
-- the api-gateway tenant-context middleware and
-- packages/database/src/rls/with-tenant-context.ts — no repository changes.
--
-- Replayable: table-existence guard + ENABLE (idempotent) +
-- DROP POLICY IF EXISTS before each CREATE POLICY. Safe to re-run.
-- ============================================================================


-- ---- owner_statements (created in 0176_owner_statements_table.sql) ----
DO $do_owner_statements$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'owner_statements'
  ) THEN
    EXECUTE 'ALTER TABLE public.owner_statements ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE public.owner_statements FORCE ROW LEVEL SECURITY;';

    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.owner_statements;';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_modify ON public.owner_statements;';
    EXECUTE 'DROP POLICY IF EXISTS service_role_bypass ON public.owner_statements;';

    EXECUTE 'CREATE POLICY tenant_isolation_select ON public.owner_statements
              FOR SELECT TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY tenant_isolation_modify ON public.owner_statements
              FOR ALL TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true))
              WITH CHECK (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY service_role_bypass ON public.owner_statements
              FOR ALL
              USING (current_setting(''app.is_service_role'', true) = ''true'')
              WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');';

    EXECUTE 'REVOKE ALL ON public.owner_statements FROM anon;';
  END IF;
END
$do_owner_statements$;


-- ---- strategic_report_history (created in 0174b_strategic_report_history.sql) ----
DO $do_strategic_report_history$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'strategic_report_history'
  ) THEN
    EXECUTE 'ALTER TABLE public.strategic_report_history ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE public.strategic_report_history FORCE ROW LEVEL SECURITY;';

    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.strategic_report_history;';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_modify ON public.strategic_report_history;';
    EXECUTE 'DROP POLICY IF EXISTS service_role_bypass ON public.strategic_report_history;';

    EXECUTE 'CREATE POLICY tenant_isolation_select ON public.strategic_report_history
              FOR SELECT TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY tenant_isolation_modify ON public.strategic_report_history
              FOR ALL TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true))
              WITH CHECK (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY service_role_bypass ON public.strategic_report_history
              FOR ALL
              USING (current_setting(''app.is_service_role'', true) = ''true'')
              WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');';

    EXECUTE 'REVOKE ALL ON public.strategic_report_history FROM anon;';
  END IF;
END
$do_strategic_report_history$;


-- ---- tenant_llm_budgets (created in 0272_tenant_llm_budgets.sql) ----
DO $do_tenant_llm_budgets$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tenant_llm_budgets'
  ) THEN
    EXECUTE 'ALTER TABLE public.tenant_llm_budgets ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE public.tenant_llm_budgets FORCE ROW LEVEL SECURITY;';

    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.tenant_llm_budgets;';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_modify ON public.tenant_llm_budgets;';
    EXECUTE 'DROP POLICY IF EXISTS service_role_bypass ON public.tenant_llm_budgets;';

    EXECUTE 'CREATE POLICY tenant_isolation_select ON public.tenant_llm_budgets
              FOR SELECT TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY tenant_isolation_modify ON public.tenant_llm_budgets
              FOR ALL TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true))
              WITH CHECK (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY service_role_bypass ON public.tenant_llm_budgets
              FOR ALL
              USING (current_setting(''app.is_service_role'', true) = ''true'')
              WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');';

    EXECUTE 'REVOKE ALL ON public.tenant_llm_budgets FROM anon;';
  END IF;
END
$do_tenant_llm_budgets$;


-- ---- tenant_llm_budget_caps (created in 0272_tenant_llm_budgets.sql) ----
DO $do_tenant_llm_budget_caps$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tenant_llm_budget_caps'
  ) THEN
    EXECUTE 'ALTER TABLE public.tenant_llm_budget_caps ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE public.tenant_llm_budget_caps FORCE ROW LEVEL SECURITY;';

    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.tenant_llm_budget_caps;';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_modify ON public.tenant_llm_budget_caps;';
    EXECUTE 'DROP POLICY IF EXISTS service_role_bypass ON public.tenant_llm_budget_caps;';

    EXECUTE 'CREATE POLICY tenant_isolation_select ON public.tenant_llm_budget_caps
              FOR SELECT TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY tenant_isolation_modify ON public.tenant_llm_budget_caps
              FOR ALL TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true))
              WITH CHECK (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY service_role_bypass ON public.tenant_llm_budget_caps
              FOR ALL
              USING (current_setting(''app.is_service_role'', true) = ''true'')
              WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');';

    EXECUTE 'REVOKE ALL ON public.tenant_llm_budget_caps FROM anon;';
  END IF;
END
$do_tenant_llm_budget_caps$;
