-- Migration 0166 — RLS drawdown batch 3 (am2 allowlist drawdown to zero).
--
-- Closes a further 32 of the 126 tracked-gap tenant tables. See 0164
-- for the strategy header. All tables in this batch are scoped by
-- `tenant_id`.

DO $$
DECLARE
  tbl text;
  tenant_tables_batch3 text[] := ARRAY[
    'message_instances',
    'message_templates',
    'migration_runs',
    'monthly_close_run_steps',
    'monthly_close_runs',
    'negotiation_policies',
    'negotiation_turns',
    'negotiations',
    'notices',
    'notification_dispatch_log',
    'occupancies',
    'owner_statements',
    'payment_intents',
    'payment_plan_agreements',
    'payment_plans',
    'persona_branding',
    'persona_registry',
    'predictive_intervention_opportunities',
    'privacy_budget_ledger',
    'privacy_budget_spend',
    'procedure_completion_logs',
    'process_observations',
    'progressive_context_snapshots',
    'property_grade_snapshots',
    'property_valuations',
    'receipts',
    'reward_events',
    'reward_policies',
    'risk_scores',
    'scan_bundle_pages',
    'scan_bundles',
    'semantic_cache_log'
  ];
BEGIN
  FOREACH tbl IN ARRAY tenant_tables_batch3 LOOP
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
