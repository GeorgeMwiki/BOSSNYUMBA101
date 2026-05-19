-- =============================================================================
-- 0174: soft_delete_columns — add deleted_at + deleted_by + delete_reason to
-- every tenant-scoped entity table so PI-A's soft-delete + retention +
-- purgeExpired() loop has a uniform schema to target.
--
-- The loop is gated on table existence + tenant_id presence so it is safe
-- to run on partial schemas (test envs, slim deployments).
--
-- A row is "alive" iff deleted_at IS NULL. Application code (PI-A
-- soft-delete module + downstream queries) MUST filter for that.
-- =============================================================================

DO $$
DECLARE
  tbl text;
  -- The tenant-scoped entity tables that need soft-delete columns.
  -- Selected: every table with a `tenant_id` column today (idempotent
  -- — already-added columns are skipped via IF NOT EXISTS).
  tenant_tables text[] := ARRAY[
    'organizations',
    'users',
    'roles',
    'user_roles',
    'sessions',
    'properties',
    'units',
    'customers',
    'vendors',
    'leases',
    'invoices',
    'payments',
    'transactions',
    'documents',
    'maintenance_orders',
    'messaging_threads',
    'notifications',
    'compliance_filings'
  ];
BEGIN
  FOREACH tbl IN ARRAY tenant_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      -- Add columns if not present.
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;',
        tbl
      );
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_by TEXT;',
        tbl
      );
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS delete_reason TEXT;',
        tbl
      );

      -- Index for the "alive rows" query path — partial index keeps it cheap.
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I (tenant_id) WHERE deleted_at IS NULL;',
        tbl || '_alive_idx',
        tbl
      );

      -- Index for the purgeExpired() cron — finds rows due for physical removal.
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I (tenant_id, deleted_at) WHERE deleted_at IS NOT NULL;',
        tbl || '_deleted_at_idx',
        tbl
      );
    END IF;
  END LOOP;
END;
$$;
