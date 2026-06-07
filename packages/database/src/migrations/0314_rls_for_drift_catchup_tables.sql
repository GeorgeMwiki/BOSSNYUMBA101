-- ============================================================================
-- Migration 0314 — RLS for the 25 drift catch-up tables created in 0313.
--
-- WHY
-- ───
-- 0313_schema_drift_catchup.sql creates 25 tables the Drizzle schema declared
-- but no migration had created. 23 of them carry a `tenant_id` column and are
-- therefore tenant-scoped; creating them WITHOUT row-level security would open
-- exactly the cross-tenant isolation hole that 0179b and 0311 were written to
-- close. This migration is the RLS catch-up for that set — identical contract
-- to 0311_rls_catchup_post_0179b.sql.
--
-- WHAT IT DOES (identical to 0179b / 0311)
-- ────────────────────────────────────────
-- For each tenant_id-bearing table:
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
-- CHILD TABLES WITHOUT a tenant_id (conversation_participants, event_attendees)
-- ────────────────────────────────────────────────────────────────────────────
-- These two have no tenant_id of their own; like `messages`/`participants` in
-- 0005_messaging.sql they are isolated through their parent's tenant_id via a
-- subquery policy (conversation_participants → conversations.tenant_id,
-- event_attendees → scheduled_events.tenant_id). This matches the established
-- in-repo idiom for child tables; the auto-generated tenant_id sweeps
-- (0179b / 0311) only ever covered tables with a direct tenant_id column.
--
-- Replayable: table-existence guard + ENABLE (idempotent) +
-- DROP POLICY IF EXISTS before each CREATE POLICY. Safe to re-run.
-- ============================================================================


-- ---- notices (tenant_id; created in 0313) ----
DO $do_notices$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notices'
  ) THEN
    EXECUTE 'ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE public.notices FORCE ROW LEVEL SECURITY;';

    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.notices;';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_modify ON public.notices;';
    EXECUTE 'DROP POLICY IF EXISTS service_role_bypass ON public.notices;';

    EXECUTE 'CREATE POLICY tenant_isolation_select ON public.notices
              FOR SELECT TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY tenant_isolation_modify ON public.notices
              FOR ALL TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true))
              WITH CHECK (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY service_role_bypass ON public.notices
              FOR ALL
              USING (current_setting(''app.is_service_role'', true) = ''true'')
              WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');';

    EXECUTE 'REVOKE ALL ON public.notices FROM anon;';
  END IF;
END
$do_notices$;

-- ---- legal_cases (tenant_id; created in 0313) ----
DO $do_legal_cases$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'legal_cases'
  ) THEN
    EXECUTE 'ALTER TABLE public.legal_cases ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE public.legal_cases FORCE ROW LEVEL SECURITY;';

    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.legal_cases;';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_modify ON public.legal_cases;';
    EXECUTE 'DROP POLICY IF EXISTS service_role_bypass ON public.legal_cases;';

    EXECUTE 'CREATE POLICY tenant_isolation_select ON public.legal_cases
              FOR SELECT TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY tenant_isolation_modify ON public.legal_cases
              FOR ALL TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true))
              WITH CHECK (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY service_role_bypass ON public.legal_cases
              FOR ALL
              USING (current_setting(''app.is_service_role'', true) = ''true'')
              WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');';

    EXECUTE 'REVOKE ALL ON public.legal_cases FROM anon;';
  END IF;
END
$do_legal_cases$;

-- ---- payment_plans (tenant_id; created in 0313) ----
DO $do_payment_plans$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payment_plans'
  ) THEN
    EXECUTE 'ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE public.payment_plans FORCE ROW LEVEL SECURITY;';

    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.payment_plans;';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_modify ON public.payment_plans;';
    EXECUTE 'DROP POLICY IF EXISTS service_role_bypass ON public.payment_plans;';

    EXECUTE 'CREATE POLICY tenant_isolation_select ON public.payment_plans
              FOR SELECT TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY tenant_isolation_modify ON public.payment_plans
              FOR ALL TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true))
              WITH CHECK (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY service_role_bypass ON public.payment_plans
              FOR ALL
              USING (current_setting(''app.is_service_role'', true) = ''true'')
              WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');';

    EXECUTE 'REVOKE ALL ON public.payment_plans FROM anon;';
  END IF;
END
$do_payment_plans$;

-- ---- payment_intents (tenant_id; created in 0313) ----
DO $do_payment_intents$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payment_intents'
  ) THEN
    EXECUTE 'ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE public.payment_intents FORCE ROW LEVEL SECURITY;';

    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.payment_intents;';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_modify ON public.payment_intents;';
    EXECUTE 'DROP POLICY IF EXISTS service_role_bypass ON public.payment_intents;';

    EXECUTE 'CREATE POLICY tenant_isolation_select ON public.payment_intents
              FOR SELECT TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY tenant_isolation_modify ON public.payment_intents
              FOR ALL TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true))
              WITH CHECK (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY service_role_bypass ON public.payment_intents
              FOR ALL
              USING (current_setting(''app.is_service_role'', true) = ''true'')
              WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');';

    EXECUTE 'REVOKE ALL ON public.payment_intents FROM anon;';
  END IF;
END
$do_payment_intents$;

-- ---- receipts (tenant_id; created in 0313) ----
DO $do_receipts$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'receipts'
  ) THEN
    EXECUTE 'ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE public.receipts FORCE ROW LEVEL SECURITY;';

    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.receipts;';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_modify ON public.receipts;';
    EXECUTE 'DROP POLICY IF EXISTS service_role_bypass ON public.receipts;';

    EXECUTE 'CREATE POLICY tenant_isolation_select ON public.receipts
              FOR SELECT TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY tenant_isolation_modify ON public.receipts
              FOR ALL TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true))
              WITH CHECK (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY service_role_bypass ON public.receipts
              FOR ALL
              USING (current_setting(''app.is_service_role'', true) = ''true'')
              WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');';

    EXECUTE 'REVOKE ALL ON public.receipts FROM anon;';
  END IF;
END
$do_receipts$;

-- ---- occupancies (tenant_id; created in 0313) ----
DO $do_occupancies$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'occupancies'
  ) THEN
    EXECUTE 'ALTER TABLE public.occupancies ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE public.occupancies FORCE ROW LEVEL SECURITY;';

    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.occupancies;';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_modify ON public.occupancies;';
    EXECUTE 'DROP POLICY IF EXISTS service_role_bypass ON public.occupancies;';

    EXECUTE 'CREATE POLICY tenant_isolation_select ON public.occupancies
              FOR SELECT TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY tenant_isolation_modify ON public.occupancies
              FOR ALL TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true))
              WITH CHECK (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY service_role_bypass ON public.occupancies
              FOR ALL
              USING (current_setting(''app.is_service_role'', true) = ''true'')
              WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');';

    EXECUTE 'REVOKE ALL ON public.occupancies FROM anon;';
  END IF;
END
$do_occupancies$;

-- ---- access_handover_records (tenant_id; created in 0313) ----
DO $do_access_handover_records$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'access_handover_records'
  ) THEN
    EXECUTE 'ALTER TABLE public.access_handover_records ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE public.access_handover_records FORCE ROW LEVEL SECURITY;';

    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.access_handover_records;';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_modify ON public.access_handover_records;';
    EXECUTE 'DROP POLICY IF EXISTS service_role_bypass ON public.access_handover_records;';

    EXECUTE 'CREATE POLICY tenant_isolation_select ON public.access_handover_records
              FOR SELECT TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY tenant_isolation_modify ON public.access_handover_records
              FOR ALL TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true))
              WITH CHECK (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY service_role_bypass ON public.access_handover_records
              FOR ALL
              USING (current_setting(''app.is_service_role'', true) = ''true'')
              WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');';

    EXECUTE 'REVOKE ALL ON public.access_handover_records FROM anon;';
  END IF;
END
$do_access_handover_records$;

-- ---- procedure_completion_logs (tenant_id; created in 0313) ----
DO $do_procedure_completion_logs$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'procedure_completion_logs'
  ) THEN
    EXECUTE 'ALTER TABLE public.procedure_completion_logs ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE public.procedure_completion_logs FORCE ROW LEVEL SECURITY;';

    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.procedure_completion_logs;';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_modify ON public.procedure_completion_logs;';
    EXECUTE 'DROP POLICY IF EXISTS service_role_bypass ON public.procedure_completion_logs;';

    EXECUTE 'CREATE POLICY tenant_isolation_select ON public.procedure_completion_logs
              FOR SELECT TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY tenant_isolation_modify ON public.procedure_completion_logs
              FOR ALL TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true))
              WITH CHECK (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY service_role_bypass ON public.procedure_completion_logs
              FOR ALL
              USING (current_setting(''app.is_service_role'', true) = ''true'')
              WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');';

    EXECUTE 'REVOKE ALL ON public.procedure_completion_logs FROM anon;';
  END IF;
END
$do_procedure_completion_logs$;

-- ---- availability_slots (tenant_id; created in 0313) ----
DO $do_availability_slots$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'availability_slots'
  ) THEN
    EXECUTE 'ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE public.availability_slots FORCE ROW LEVEL SECURITY;';

    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.availability_slots;';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_modify ON public.availability_slots;';
    EXECUTE 'DROP POLICY IF EXISTS service_role_bypass ON public.availability_slots;';

    EXECUTE 'CREATE POLICY tenant_isolation_select ON public.availability_slots
              FOR SELECT TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY tenant_isolation_modify ON public.availability_slots
              FOR ALL TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true))
              WITH CHECK (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY service_role_bypass ON public.availability_slots
              FOR ALL
              USING (current_setting(''app.is_service_role'', true) = ''true'')
              WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');';

    EXECUTE 'REVOKE ALL ON public.availability_slots FROM anon;';
  END IF;
END
$do_availability_slots$;

-- ---- document_access_logs (tenant_id; created in 0313) ----
DO $do_document_access_logs$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'document_access_logs'
  ) THEN
    EXECUTE 'ALTER TABLE public.document_access_logs ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE public.document_access_logs FORCE ROW LEVEL SECURITY;';

    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.document_access_logs;';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_modify ON public.document_access_logs;';
    EXECUTE 'DROP POLICY IF EXISTS service_role_bypass ON public.document_access_logs;';

    EXECUTE 'CREATE POLICY tenant_isolation_select ON public.document_access_logs
              FOR SELECT TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY tenant_isolation_modify ON public.document_access_logs
              FOR ALL TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true))
              WITH CHECK (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY service_role_bypass ON public.document_access_logs
              FOR ALL
              USING (current_setting(''app.is_service_role'', true) = ''true'')
              WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');';

    EXECUTE 'REVOKE ALL ON public.document_access_logs FROM anon;';
  END IF;
END
$do_document_access_logs$;

-- ---- communication_consents (tenant_id; created in 0313) ----
DO $do_communication_consents$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'communication_consents'
  ) THEN
    EXECUTE 'ALTER TABLE public.communication_consents ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE public.communication_consents FORCE ROW LEVEL SECURITY;';

    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.communication_consents;';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_modify ON public.communication_consents;';
    EXECUTE 'DROP POLICY IF EXISTS service_role_bypass ON public.communication_consents;';

    EXECUTE 'CREATE POLICY tenant_isolation_select ON public.communication_consents
              FOR SELECT TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY tenant_isolation_modify ON public.communication_consents
              FOR ALL TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true))
              WITH CHECK (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY service_role_bypass ON public.communication_consents
              FOR ALL
              USING (current_setting(''app.is_service_role'', true) = ''true'')
              WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');';

    EXECUTE 'REVOKE ALL ON public.communication_consents FROM anon;';
  END IF;
END
$do_communication_consents$;

-- ---- delivery_receipts (tenant_id; created in 0313) ----
DO $do_delivery_receipts$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'delivery_receipts'
  ) THEN
    EXECUTE 'ALTER TABLE public.delivery_receipts ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE public.delivery_receipts FORCE ROW LEVEL SECURITY;';

    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.delivery_receipts;';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_modify ON public.delivery_receipts;';
    EXECUTE 'DROP POLICY IF EXISTS service_role_bypass ON public.delivery_receipts;';

    EXECUTE 'CREATE POLICY tenant_isolation_select ON public.delivery_receipts
              FOR SELECT TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY tenant_isolation_modify ON public.delivery_receipts
              FOR ALL TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true))
              WITH CHECK (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY service_role_bypass ON public.delivery_receipts
              FOR ALL
              USING (current_setting(''app.is_service_role'', true) = ''true'')
              WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');';

    EXECUTE 'REVOKE ALL ON public.delivery_receipts FROM anon;';
  END IF;
END
$do_delivery_receipts$;

-- ---- escalation_chain_runs (tenant_id; created in 0313) ----
DO $do_escalation_chain_runs$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'escalation_chain_runs'
  ) THEN
    EXECUTE 'ALTER TABLE public.escalation_chain_runs ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE public.escalation_chain_runs FORCE ROW LEVEL SECURITY;';

    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.escalation_chain_runs;';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_modify ON public.escalation_chain_runs;';
    EXECUTE 'DROP POLICY IF EXISTS service_role_bypass ON public.escalation_chain_runs;';

    EXECUTE 'CREATE POLICY tenant_isolation_select ON public.escalation_chain_runs
              FOR SELECT TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY tenant_isolation_modify ON public.escalation_chain_runs
              FOR ALL TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true))
              WITH CHECK (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY service_role_bypass ON public.escalation_chain_runs
              FOR ALL
              USING (current_setting(''app.is_service_role'', true) = ''true'')
              WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');';

    EXECUTE 'REVOKE ALL ON public.escalation_chain_runs FROM anon;';
  END IF;
END
$do_escalation_chain_runs$;

-- ---- message_templates (tenant_id; created in 0313) ----
DO $do_message_templates$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'message_templates'
  ) THEN
    EXECUTE 'ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE public.message_templates FORCE ROW LEVEL SECURITY;';

    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.message_templates;';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_modify ON public.message_templates;';
    EXECUTE 'DROP POLICY IF EXISTS service_role_bypass ON public.message_templates;';

    EXECUTE 'CREATE POLICY tenant_isolation_select ON public.message_templates
              FOR SELECT TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY tenant_isolation_modify ON public.message_templates
              FOR ALL TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true))
              WITH CHECK (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY service_role_bypass ON public.message_templates
              FOR ALL
              USING (current_setting(''app.is_service_role'', true) = ''true'')
              WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');';

    EXECUTE 'REVOKE ALL ON public.message_templates FROM anon;';
  END IF;
END
$do_message_templates$;

-- ---- message_instances (tenant_id; created in 0313) ----
DO $do_message_instances$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'message_instances'
  ) THEN
    EXECUTE 'ALTER TABLE public.message_instances ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE public.message_instances FORCE ROW LEVEL SECURITY;';

    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.message_instances;';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_modify ON public.message_instances;';
    EXECUTE 'DROP POLICY IF EXISTS service_role_bypass ON public.message_instances;';

    EXECUTE 'CREATE POLICY tenant_isolation_select ON public.message_instances
              FOR SELECT TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY tenant_isolation_modify ON public.message_instances
              FOR ALL TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true))
              WITH CHECK (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY service_role_bypass ON public.message_instances
              FOR ALL
              USING (current_setting(''app.is_service_role'', true) = ''true'')
              WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');';

    EXECUTE 'REVOKE ALL ON public.message_instances FROM anon;';
  END IF;
END
$do_message_instances$;

-- ---- document_render_jobs (tenant_id; created in 0313) ----
DO $do_document_render_jobs$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'document_render_jobs'
  ) THEN
    EXECUTE 'ALTER TABLE public.document_render_jobs ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE public.document_render_jobs FORCE ROW LEVEL SECURITY;';

    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.document_render_jobs;';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_modify ON public.document_render_jobs;';
    EXECUTE 'DROP POLICY IF EXISTS service_role_bypass ON public.document_render_jobs;';

    EXECUTE 'CREATE POLICY tenant_isolation_select ON public.document_render_jobs
              FOR SELECT TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY tenant_isolation_modify ON public.document_render_jobs
              FOR ALL TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true))
              WITH CHECK (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY service_role_bypass ON public.document_render_jobs
              FOR ALL
              USING (current_setting(''app.is_service_role'', true) = ''true'')
              WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');';

    EXECUTE 'REVOKE ALL ON public.document_render_jobs FROM anon;';
  END IF;
END
$do_document_render_jobs$;

-- ---- letter_requests (tenant_id; created in 0313) ----
DO $do_letter_requests$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'letter_requests'
  ) THEN
    EXECUTE 'ALTER TABLE public.letter_requests ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE public.letter_requests FORCE ROW LEVEL SECURITY;';

    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.letter_requests;';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_modify ON public.letter_requests;';
    EXECUTE 'DROP POLICY IF EXISTS service_role_bypass ON public.letter_requests;';

    EXECUTE 'CREATE POLICY tenant_isolation_select ON public.letter_requests
              FOR SELECT TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY tenant_isolation_modify ON public.letter_requests
              FOR ALL TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true))
              WITH CHECK (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY service_role_bypass ON public.letter_requests
              FOR ALL
              USING (current_setting(''app.is_service_role'', true) = ''true'')
              WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');';

    EXECUTE 'REVOKE ALL ON public.letter_requests FROM anon;';
  END IF;
END
$do_letter_requests$;

-- ---- scan_bundles (tenant_id; created in 0313) ----
DO $do_scan_bundles$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'scan_bundles'
  ) THEN
    EXECUTE 'ALTER TABLE public.scan_bundles ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE public.scan_bundles FORCE ROW LEVEL SECURITY;';

    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.scan_bundles;';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_modify ON public.scan_bundles;';
    EXECUTE 'DROP POLICY IF EXISTS service_role_bypass ON public.scan_bundles;';

    EXECUTE 'CREATE POLICY tenant_isolation_select ON public.scan_bundles
              FOR SELECT TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY tenant_isolation_modify ON public.scan_bundles
              FOR ALL TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true))
              WITH CHECK (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY service_role_bypass ON public.scan_bundles
              FOR ALL
              USING (current_setting(''app.is_service_role'', true) = ''true'')
              WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');';

    EXECUTE 'REVOKE ALL ON public.scan_bundles FROM anon;';
  END IF;
END
$do_scan_bundles$;

-- ---- scan_bundle_pages (tenant_id; created in 0313) ----
DO $do_scan_bundle_pages$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'scan_bundle_pages'
  ) THEN
    EXECUTE 'ALTER TABLE public.scan_bundle_pages ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE public.scan_bundle_pages FORCE ROW LEVEL SECURITY;';

    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.scan_bundle_pages;';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_modify ON public.scan_bundle_pages;';
    EXECUTE 'DROP POLICY IF EXISTS service_role_bypass ON public.scan_bundle_pages;';

    EXECUTE 'CREATE POLICY tenant_isolation_select ON public.scan_bundle_pages
              FOR SELECT TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY tenant_isolation_modify ON public.scan_bundle_pages
              FOR ALL TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true))
              WITH CHECK (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY service_role_bypass ON public.scan_bundle_pages
              FOR ALL
              USING (current_setting(''app.is_service_role'', true) = ''true'')
              WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');';

    EXECUTE 'REVOKE ALL ON public.scan_bundle_pages FROM anon;';
  END IF;
END
$do_scan_bundle_pages$;

-- ---- document_embeddings (tenant_id; created in 0313) ----
DO $do_document_embeddings$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'document_embeddings'
  ) THEN
    EXECUTE 'ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE public.document_embeddings FORCE ROW LEVEL SECURITY;';

    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.document_embeddings;';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_modify ON public.document_embeddings;';
    EXECUTE 'DROP POLICY IF EXISTS service_role_bypass ON public.document_embeddings;';

    EXECUTE 'CREATE POLICY tenant_isolation_select ON public.document_embeddings
              FOR SELECT TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY tenant_isolation_modify ON public.document_embeddings
              FOR ALL TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true))
              WITH CHECK (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY service_role_bypass ON public.document_embeddings
              FOR ALL
              USING (current_setting(''app.is_service_role'', true) = ''true'')
              WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');';

    EXECUTE 'REVOKE ALL ON public.document_embeddings FROM anon;';
  END IF;
END
$do_document_embeddings$;

-- ---- doc_chat_sessions (tenant_id; created in 0313) ----
DO $do_doc_chat_sessions$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'doc_chat_sessions'
  ) THEN
    EXECUTE 'ALTER TABLE public.doc_chat_sessions ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE public.doc_chat_sessions FORCE ROW LEVEL SECURITY;';

    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.doc_chat_sessions;';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_modify ON public.doc_chat_sessions;';
    EXECUTE 'DROP POLICY IF EXISTS service_role_bypass ON public.doc_chat_sessions;';

    EXECUTE 'CREATE POLICY tenant_isolation_select ON public.doc_chat_sessions
              FOR SELECT TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY tenant_isolation_modify ON public.doc_chat_sessions
              FOR ALL TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true))
              WITH CHECK (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY service_role_bypass ON public.doc_chat_sessions
              FOR ALL
              USING (current_setting(''app.is_service_role'', true) = ''true'')
              WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');';

    EXECUTE 'REVOKE ALL ON public.doc_chat_sessions FROM anon;';
  END IF;
END
$do_doc_chat_sessions$;

-- ---- doc_chat_messages (tenant_id; created in 0313) ----
DO $do_doc_chat_messages$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'doc_chat_messages'
  ) THEN
    EXECUTE 'ALTER TABLE public.doc_chat_messages ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE public.doc_chat_messages FORCE ROW LEVEL SECURITY;';

    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.doc_chat_messages;';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_modify ON public.doc_chat_messages;';
    EXECUTE 'DROP POLICY IF EXISTS service_role_bypass ON public.doc_chat_messages;';

    EXECUTE 'CREATE POLICY tenant_isolation_select ON public.doc_chat_messages
              FOR SELECT TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY tenant_isolation_modify ON public.doc_chat_messages
              FOR ALL TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true))
              WITH CHECK (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY service_role_bypass ON public.doc_chat_messages
              FOR ALL
              USING (current_setting(''app.is_service_role'', true) = ''true'')
              WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');';

    EXECUTE 'REVOKE ALL ON public.doc_chat_messages FROM anon;';
  END IF;
END
$do_doc_chat_messages$;

-- ---- audit_events (tenant_id; created in 0313) ----
DO $do_audit_events$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_events'
  ) THEN
    EXECUTE 'ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE public.audit_events FORCE ROW LEVEL SECURITY;';

    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.audit_events;';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_modify ON public.audit_events;';
    EXECUTE 'DROP POLICY IF EXISTS service_role_bypass ON public.audit_events;';

    EXECUTE 'CREATE POLICY tenant_isolation_select ON public.audit_events
              FOR SELECT TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY tenant_isolation_modify ON public.audit_events
              FOR ALL TO authenticated
              USING (tenant_id::text = current_setting(''app.current_tenant_id'', true))
              WITH CHECK (tenant_id::text = current_setting(''app.current_tenant_id'', true));';

    EXECUTE 'CREATE POLICY service_role_bypass ON public.audit_events
              FOR ALL
              USING (current_setting(''app.is_service_role'', true) = ''true'')
              WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');';

    EXECUTE 'REVOKE ALL ON public.audit_events FROM anon;';
  END IF;
END
$do_audit_events$;

-- ---- conversation_participants (NO tenant_id; isolated via conversations.tenant_id; created in 0313) ----
DO $do_conversation_participants$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'conversation_participants'
  ) THEN
    EXECUTE 'ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE public.conversation_participants FORCE ROW LEVEL SECURITY;';

    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.conversation_participants;';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_modify ON public.conversation_participants;';
    EXECUTE 'DROP POLICY IF EXISTS service_role_bypass ON public.conversation_participants;';

    EXECUTE 'CREATE POLICY tenant_isolation_select ON public.conversation_participants
              FOR SELECT TO authenticated
              USING (conversation_id IN (
                SELECT id FROM public.conversations
                WHERE tenant_id::text = current_setting(''app.current_tenant_id'', true)
              ));';

    EXECUTE 'CREATE POLICY tenant_isolation_modify ON public.conversation_participants
              FOR ALL TO authenticated
              USING (conversation_id IN (
                SELECT id FROM public.conversations
                WHERE tenant_id::text = current_setting(''app.current_tenant_id'', true)
              ))
              WITH CHECK (conversation_id IN (
                SELECT id FROM public.conversations
                WHERE tenant_id::text = current_setting(''app.current_tenant_id'', true)
              ));';

    EXECUTE 'CREATE POLICY service_role_bypass ON public.conversation_participants
              FOR ALL
              USING (current_setting(''app.is_service_role'', true) = ''true'')
              WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');';

    EXECUTE 'REVOKE ALL ON public.conversation_participants FROM anon;';
  END IF;
END
$do_conversation_participants$;

-- ---- event_attendees (NO tenant_id; isolated via scheduled_events.tenant_id; created in 0313) ----
DO $do_event_attendees$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'event_attendees'
  ) THEN
    EXECUTE 'ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'ALTER TABLE public.event_attendees FORCE ROW LEVEL SECURITY;';

    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_select ON public.event_attendees;';
    EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_modify ON public.event_attendees;';
    EXECUTE 'DROP POLICY IF EXISTS service_role_bypass ON public.event_attendees;';

    EXECUTE 'CREATE POLICY tenant_isolation_select ON public.event_attendees
              FOR SELECT TO authenticated
              USING (event_id IN (
                SELECT id FROM public.scheduled_events
                WHERE tenant_id::text = current_setting(''app.current_tenant_id'', true)
              ));';

    EXECUTE 'CREATE POLICY tenant_isolation_modify ON public.event_attendees
              FOR ALL TO authenticated
              USING (event_id IN (
                SELECT id FROM public.scheduled_events
                WHERE tenant_id::text = current_setting(''app.current_tenant_id'', true)
              ))
              WITH CHECK (event_id IN (
                SELECT id FROM public.scheduled_events
                WHERE tenant_id::text = current_setting(''app.current_tenant_id'', true)
              ));';

    EXECUTE 'CREATE POLICY service_role_bypass ON public.event_attendees
              FOR ALL
              USING (current_setting(''app.is_service_role'', true) = ''true'')
              WITH CHECK (current_setting(''app.is_service_role'', true) = ''true'');';

    EXECUTE 'REVOKE ALL ON public.event_attendees FROM anon;';
  END IF;
END
$do_event_attendees$;
