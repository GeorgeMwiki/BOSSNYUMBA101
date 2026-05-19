-- Migration 0164 — RLS drawdown batch 1 (am2 allowlist drawdown to zero).
--
-- Closes 32 of the 126 pre-Phase-D11 tracked-gap tenant tables listed in
-- `scripts/__allowlists__/rls-coverage-allowlist.mjs`. The scanner
-- (audit-rls-coverage.mjs) flagged every one of these as missing
--   * `ENABLE ROW LEVEL SECURITY`
--   * `CREATE POLICY ... tenant_isolation_*`
--   * `FORCE ROW LEVEL SECURITY`
--
-- All 32 tables in this batch are scoped by a `tenant_id text/uuid`
-- column (the scanner regex confirms this — see `findTenantTables`
-- in audit-rls-coverage.mjs).
--
-- Strategy: mirror migrations 0155 / 0156 — single DO-block, gated on
-- information_schema.tables existence so the migration is idempotent
-- on shards where a feature-flag table hasn't been created yet.
-- Uses the same `public.current_app_tenant_id()` helper that 0155
-- defined and that the GUC-bind invariant test pins.
--
-- For each table:
--   1. ALTER TABLE ... ENABLE ROW LEVEL SECURITY
--   2. ALTER TABLE ... FORCE ROW LEVEL SECURITY
--   3. DROP + CREATE POLICY tenant_isolation_select (TO authenticated)
--   4. DROP + CREATE POLICY tenant_isolation_modify (TO authenticated)
--   5. REVOKE ALL ... FROM anon
--
-- Closes 32/126 — drawdown progress logged in the matching allowlist
-- diff. Remaining batches: 0165 (32), 0166 (32), 0167 (30) — all four
-- together close the full 126 entries.

DO $$
DECLARE
  tbl text;
  tenant_tables_batch1 text[] := ARRAY[
    'access_handover_records',
    'ai_cost_entries',
    'ai_decision_feedback',
    'ai_proactive_alerts',
    'ai_semantic_memories',
    'approval_policies',
    'approval_policy_actions',
    'arrears_case_projections',
    'arrears_cases',
    'arrears_line_proposals',
    'autonomous_action_audit',
    'autonomy_policies',
    'availability_slots',
    'bids',
    'bkt_mastery',
    'bottlenecks',
    'classroom_participants',
    'classroom_quiz_responses',
    'classroom_quizzes',
    'classroom_sessions',
    'communication_consents',
    'complaint_records',
    'consolidation_emissions',
    'core_memory_blocks',
    'credit_rating_promises',
    'credit_rating_sharing_opt_ins',
    'credit_rating_snapshots',
    'credit_rating_weights',
    'delivery_receipts',
    'disbursements',
    'document_access_logs',
    'document_render_jobs'
  ];
BEGIN
  FOREACH tbl IN ARRAY tenant_tables_batch1 LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = tbl
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
      EXECUTE format('ALTER TABLE public.%I FORCE  ROW LEVEL SECURITY;', tbl);

      EXECUTE format(
        'DROP POLICY IF EXISTS tenant_isolation_select ON public.%I;', tbl
      );
      EXECUTE format(
        'DROP POLICY IF EXISTS tenant_isolation_modify ON public.%I;', tbl
      );

      EXECUTE format($pol$
        CREATE POLICY tenant_isolation_select ON public.%I
        FOR SELECT
        TO authenticated
        USING (tenant_id::text = public.current_app_tenant_id());
      $pol$, tbl);

      EXECUTE format($pol$
        CREATE POLICY tenant_isolation_modify ON public.%I
        FOR ALL
        TO authenticated
        USING (tenant_id::text = public.current_app_tenant_id())
        WITH CHECK (tenant_id::text = public.current_app_tenant_id());
      $pol$, tbl);

      EXECUTE format('REVOKE ALL ON public.%I FROM anon;', tbl);
    END IF;
  END LOOP;
END
$$;
