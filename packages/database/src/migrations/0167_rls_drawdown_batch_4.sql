-- Migration 0167 — RLS drawdown batch 4 (am2 allowlist drawdown to zero).
--
-- Closes the final 30 of the 126 tracked-gap tenant tables. See 0164
-- for the strategy header. All tables in this batch are scoped by
-- `tenant_id`. Once this migration runs, every entry in the previous
-- `scripts/__allowlists__/rls-coverage-allowlist.mjs` tracked-gap list
-- has a matching RLS migration.

DO $$
DECLARE
  tbl text;
  tenant_tables_batch4 text[] := ARRAY[
    'sensorium_event_log',
    'session_replay_chunks',
    'skill_registry',
    'sovereign_approvals',
    'statements',
    'station_master_coverage',
    'sub_md_slo_events',
    'sub_md_slos',
    'task_sensor_routing',
    'temporal_communities',
    'temporal_entities',
    'temporal_relationships',
    'tenant_ai_budgets',
    'tenant_autonomy_caps',
    'tenant_budget_envelopes',
    'tenant_feature_flag_overrides',
    'tenant_gamification_profile',
    'tenant_grading_weights',
    'tenant_predictions',
    'tenant_risk_reports',
    'tenders',
    'training_assignments',
    'training_delivery_events',
    'training_paths',
    'unit_waitlists',
    'vacancy_pipeline_runs',
    'waitlist_outreach_events',
    'warehouse_items',
    'warehouse_movements',
    'worker_tags'
  ];
BEGIN
  FOREACH tbl IN ARRAY tenant_tables_batch4 LOOP
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
