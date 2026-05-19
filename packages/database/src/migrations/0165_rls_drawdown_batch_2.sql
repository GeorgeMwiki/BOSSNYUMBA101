-- Migration 0165 — RLS drawdown batch 2 (am2 allowlist drawdown to zero).
--
-- Closes a further 32 of the 126 tracked-gap tenant tables. See 0164 for
-- the strategy header. Includes BOTH `tenant_id`-scoped tables AND five
-- `organization_id`-scoped tables (`geo_assignments`, `geo_label_types`,
-- `geo_nodes`, `invite_codes`, `org_memberships`). For the
-- `organization_id` group the policy gates via a subquery on
-- `public.organizations.tenant_id = public.current_app_tenant_id()`.

-- ============================================================================
-- Part A — tenant_id-scoped tables (27 in this batch).
-- ============================================================================

DO $$
DECLARE
  tbl text;
  tenant_tables_batch2a text[] := ARRAY[
    'escalation_chain_runs',
    'exception_inbox',
    'executive_briefings',
    'feedback_submissions',
    'field_encryption_audit',
    'gdpr_deletion_requests',
    'gepg_control_numbers',
    'gepg_reconciliation_events',
    'implicit_feedback_signals',
    'improvement_snapshots',
    'interactive_report_action_acks',
    'interactive_report_versions',
    'iot_anomalies',
    'iot_observations',
    'iot_sensors',
    'kernel_action_audit',
    'kernel_feedback',
    'kernel_goals',
    'kernel_persona_drift_events',
    'kernel_provenance',
    'legal_cases',
    'letter_requests',
    'maintenance_problem_categories',
    'maintenance_problems',
    'market_rate_snapshots',
    'marketplace_listings',
    'mdr_plan_items'
  ];
BEGIN
  FOREACH tbl IN ARRAY tenant_tables_batch2a LOOP
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

-- ============================================================================
-- Part B — organization_id-scoped tables.
-- These resolve to a tenant via a JOIN on public.organizations.tenant_id.
-- ============================================================================

DO $$
DECLARE
  tbl text;
  org_tables_batch2 text[] := ARRAY[
    'geo_assignments',
    'geo_label_types',
    'geo_nodes',
    'invite_codes',
    'org_memberships'
  ];
BEGIN
  FOREACH tbl IN ARRAY org_tables_batch2 LOOP
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

      -- org_memberships and invite_codes carry an explicit
      -- `platform_tenant_id` shortcut column; the others gate via a
      -- subquery on the parent organizations row.
      IF tbl IN ('org_memberships', 'invite_codes') THEN
        EXECUTE format($pol$
          CREATE POLICY tenant_isolation_select ON public.%I
          FOR SELECT
          TO authenticated
          USING (platform_tenant_id::text = public.current_app_tenant_id());
        $pol$, tbl);

        EXECUTE format($pol$
          CREATE POLICY tenant_isolation_modify ON public.%I
          FOR ALL
          TO authenticated
          USING (platform_tenant_id::text = public.current_app_tenant_id())
          WITH CHECK (platform_tenant_id::text = public.current_app_tenant_id());
        $pol$, tbl);
      ELSE
        EXECUTE format($pol$
          CREATE POLICY tenant_isolation_select ON public.%I
          FOR SELECT
          TO authenticated
          USING (
            organization_id IN (
              SELECT id FROM public.organizations
              WHERE tenant_id::text = public.current_app_tenant_id()
            )
          );
        $pol$, tbl);

        EXECUTE format($pol$
          CREATE POLICY tenant_isolation_modify ON public.%I
          FOR ALL
          TO authenticated
          USING (
            organization_id IN (
              SELECT id FROM public.organizations
              WHERE tenant_id::text = public.current_app_tenant_id()
            )
          )
          WITH CHECK (
            organization_id IN (
              SELECT id FROM public.organizations
              WHERE tenant_id::text = public.current_app_tenant_id()
            )
          );
        $pol$, tbl);
      END IF;

      EXECUTE format('REVOKE ALL ON public.%I FROM anon;', tbl);
    END IF;
  END LOOP;
END
$$;
