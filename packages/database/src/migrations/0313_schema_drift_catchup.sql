-- ============================================================================
-- Migration 0313 — schema/migration drift catch-up (2026-06-07 verification pass)
--
-- WHY
-- ───
-- A full fresh-DB apply of 0001..0312 leaves 25 tables that the Drizzle schema
-- (packages/database/src/schemas/) declares via pgTable() but that NO migration
-- creates. The existing ledger-drift guard only compares migration-PROMISED
-- tables vs the DB, so schema tables with no creating migration are a blind
-- spot — these 25 slipped through and would fail at runtime on a fresh prod DB
-- with relation "<name>" does not exist (KI-001). Heavily-used examples:
-- notices (89 src refs), receipts (52), audit_events (5). DDL below is
-- generated from the canonical Drizzle schema via drizzle-kit, then made
-- idempotent and fully guarded so the file ALWAYS applies cleanly (every
-- statement is wrapped; an unresolved conflict degrades to a NOTICE, never an
-- abort — so it is safe under both psql -f and the run-migrations.ts sql.begin()
-- wrapper).
--
-- RENAME ANALYSIS — all six suspected new-vs-legacy pairs RESOLVED
-- ───────────────────────────────────────────────────────────────
-- Each pair was checked against (a) the canonical Drizzle barrel
-- (schemas/index.ts), (b) which legacy names a shipped migration creates,
-- (c) column structure, and (d) live app references. Result: NONE is a clean
-- rename — every pair is two DISTINCT entities (the codebase actively models
-- both), so every new table below is created fresh. Evidence:
--
--   notices ↔ compliance_notices         DISTINCT. New `notices` (cases.schema,
--     50+ cols, notice_type/notice_status/delivery_method enums, full approval
--     workflow) vs legacy compliance_notices (0009: 16 cols, compliance_notice_type
--     enum, FK→compliance_cases). Different shape + different enum.
--   receipts ↔ notice_service_receipts   DISTINCT. `receipts` = payment receipts
--     (payment.schema: payment_id, invoice_id, receipt_status). notice_service_
--     receipts = notice proof-of-delivery (cases.schema, live + exported:
--     notice_id, attempt_number, delivery_method). Unrelated.
--   payment_plans ↔ payment_plan_agreements  DISTINCT. Both have live, EXPORTED
--     pgTables (payment.schema / payment-plan.schema). Columns differ materially
--     (new: installment_schedule, frequency, missed_payments; legacy 0001b:
--     installments, next_due_date, terms).
--   audit_events ↔ audit_log / audit_trail_entries  FLAGGED (kept as CREATE).
--     The canonical top-level `audit_events` (tenant.schema, the barrel winner)
--     IS the column-for-column successor of the legacy audit_log (0002) — modulo
--     event_type being TEXT in audit_log vs the audit_event_type ENUM here — and
--     audit_log is DEAD (no schema export, no app refs). It looks like a rename.
--     We deliberately do NOT `ALTER TABLE audit_log RENAME TO audit_events`:
--       (1) the ledger-drift guard parses audit_log's CREATE in 0002 and would
--           then report audit_log as MISSING (drift FAIL) after a rename — there
--           is no rename precedent anywhere in the tree and no guard exclusion;
--       (2) event_type TEXT → audit_event_type enum is a real type change; a bare
--           RENAME leaves the wrong type, and a USING-cast can fail on arbitrary
--           legacy text values on an existing DB.
--     So we CREATE audit_events (correct on fresh; app-correct on existing) and
--     leave audit_log untouched. EXISTING-DB follow-up (human, optional): backfill
--     historical rows with a value-mapped, validated cast, then drop audit_log in
--     a dedicated migration. audit_trail_entries (0111) is a different, richer
--     table — not a candidate.
--   message_instances ↔ messages         DISTINCT. message_instances = outbound
--     multi-channel dispatch (communications.schema: channel, recipient_address,
--     provider_message_id, retry_count). messages = in-conversation chat
--     (messaging.schema, live + exported: conversation_id, sender_id, read_at).
--   legal_cases ↔ legal_drafts / cases   DISTINCT. legal_cases = court-case
--     tracking (compliance.schema: court_name, hearing_date, amount_awarded).
--     legal_drafts (0109) = AI-generated document drafts. cases (0001c, live +
--     exported) = general SLA case management. Three different entities.
--
-- ENUM + TYPE-NAME divergences — RESOLVED (not deferred)
-- ─────────────────────────────────────────────────────
--   payment_plan_status: the canonical Drizzle enum (payment.schema) leads with
--     'proposed'; the shipped DB enum (0001b) leads with 'draft' and lacks
--     'proposed'. Companion migration 0312b adds 'proposed' (ADD VALUE IF NOT
--     EXISTS, in its own file so it commits before this one), so payment_plans
--     below safely keeps `status ... DEFAULT 'proposed'`. 'draft' is left in
--     place — the legacy payment_plan_agreements still uses it.
--   onboarding_state: the occupancies column needs an ENUM, but migration 0278
--     already ships a TABLE named onboarding_state (a table occupies its own name
--     in the TYPE namespace, so CREATE TYPE onboarding_state is impossible). The
--     Drizzle enum's PG type name was renamed to `occupancy_onboarding_state`
--     (occupancy.schema.ts, TS symbol + column name unchanged); this file creates
--     that non-colliding enum and the occupancies column uses it (NOT text).
--
-- RLS: tenant isolation for these 25 tables is added by the companion migration
-- 0314_rls_for_drift_catchup_tables.sql (mirrors 0311/0179b). Keep them paired.
--
-- Idempotent + guarded throughout. Safe to re-run.
-- ============================================================================


-- ---- 1. Enum types required by the catch-up tables (guarded; 22 created:
--        the original 21 + occupancy_onboarding_state. payment_plan_status is
--        NOT recreated here — 0001b created it and 0312b adds 'proposed'). ----

DO $enum$ BEGIN
  CREATE TYPE "public"."legal_case_type" AS ENUM('eviction', 'rent_dispute', 'damage_claim', 'breach_of_lease', 'small_claims', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; WHEN unique_violation THEN NULL;
END $enum$;
DO $enum$ BEGIN
  CREATE TYPE "public"."legal_case_status" AS ENUM('open', 'in_progress', 'settled', 'closed', 'dismissed', 'appealed');
EXCEPTION WHEN duplicate_object THEN NULL; WHEN unique_violation THEN NULL;
END $enum$;
DO $enum$ BEGIN
  CREATE TYPE "public"."audit_event_type" AS ENUM('user.created', 'user.updated', 'user.deleted', 'user.login', 'user.logout', 'user.password_changed', 'tenant.created', 'tenant.updated', 'tenant.suspended', 'role.assigned', 'role.revoked', 'permission.granted', 'permission.revoked', 'data.accessed', 'data.modified', 'data.exported');
EXCEPTION WHEN duplicate_object THEN NULL; WHEN unique_violation THEN NULL;
END $enum$;
DO $enum$ BEGIN
  CREATE TYPE "public"."receipt_status" AS ENUM('draft', 'issued', 'voided', 'superseded');
EXCEPTION WHEN duplicate_object THEN NULL; WHEN unique_violation THEN NULL;
END $enum$;
DO $enum$ BEGIN
  CREATE TYPE "public"."attendee_status" AS ENUM('pending', 'accepted', 'declined', 'tentative', 'no_show');
EXCEPTION WHEN duplicate_object THEN NULL; WHEN unique_violation THEN NULL;
END $enum$;
DO $enum$ BEGIN
  CREATE TYPE "public"."occupancy_status" AS ENUM('pending_move_in', 'active', 'notice_given', 'pending_move_out', 'moved_out', 'evicted', 'abandoned');
EXCEPTION WHEN duplicate_object THEN NULL; WHEN unique_violation THEN NULL;
END $enum$;
DO $enum$ BEGIN
  CREATE TYPE "public"."notice_type" AS ENUM('payment_reminder', 'payment_demand', 'late_fee_notice', 'lease_violation', 'noise_warning', 'inspection_notice', 'entry_notice', 'renewal_offer', 'non_renewal', 'termination', 'eviction_warning', 'eviction_notice', 'deposit_deduction', 'move_out_instructions', 'legal_demand', 'court_summons', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; WHEN unique_violation THEN NULL;
END $enum$;
DO $enum$ BEGIN
  CREATE TYPE "public"."notice_status" AS ENUM('draft', 'pending_approval', 'approved', 'scheduled', 'sent', 'delivered', 'acknowledged', 'expired', 'cancelled', 'voided');
EXCEPTION WHEN duplicate_object THEN NULL; WHEN unique_violation THEN NULL;
END $enum$;
DO $enum$ BEGIN
  CREATE TYPE "public"."delivery_method" AS ENUM('email', 'sms', 'whatsapp', 'in_app', 'physical_mail', 'hand_delivery', 'courier', 'posted_on_door');
EXCEPTION WHEN duplicate_object THEN NULL; WHEN unique_violation THEN NULL;
END $enum$;
DO $enum$ BEGIN
  CREATE TYPE "public"."message_channel" AS ENUM('whatsapp', 'sms', 'email', 'app_push', 'voice_call', 'in_app');
EXCEPTION WHEN duplicate_object THEN NULL; WHEN unique_violation THEN NULL;
END $enum$;
DO $enum$ BEGIN
  CREATE TYPE "public"."template_category" AS ENUM('payment_reminder', 'payment_confirmation', 'maintenance_update', 'lease_notification', 'onboarding', 'renewal', 'legal_notice', 'emergency', 'announcement', 'marketing', 'feedback_request', 'check_in', 'welcome', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; WHEN unique_violation THEN NULL;
END $enum$;
DO $enum$ BEGIN
  CREATE TYPE "public"."delivery_status" AS ENUM('pending', 'sent', 'delivered', 'read', 'failed', 'bounced', 'blocked', 'expired', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL; WHEN unique_violation THEN NULL;
END $enum$;
DO $enum$ BEGIN
  CREATE TYPE "public"."message_status" AS ENUM('queued', 'pending', 'sent', 'delivered', 'read', 'failed', 'bounced', 'blocked', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; WHEN unique_violation THEN NULL;
END $enum$;
DO $enum$ BEGIN
  CREATE TYPE "public"."template_status" AS ENUM('draft', 'pending_approval', 'approved', 'active', 'deprecated', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; WHEN unique_violation THEN NULL;
END $enum$;
DO $enum$ BEGIN
  CREATE TYPE "public"."renderer_kind" AS ENUM('text', 'docxtemplater', 'react-pdf', 'typst');
EXCEPTION WHEN duplicate_object THEN NULL; WHEN unique_violation THEN NULL;
END $enum$;
DO $enum$ BEGIN
  CREATE TYPE "public"."render_job_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; WHEN unique_violation THEN NULL;
END $enum$;
DO $enum$ BEGIN
  CREATE TYPE "public"."letter_type" AS ENUM('residency_proof', 'tenancy_confirmation', 'payment_confirmation', 'tenant_reference');
EXCEPTION WHEN duplicate_object THEN NULL; WHEN unique_violation THEN NULL;
END $enum$;
DO $enum$ BEGIN
  CREATE TYPE "public"."letter_request_status" AS ENUM('requested', 'drafted', 'pending_approval', 'approved', 'issued', 'rejected', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; WHEN unique_violation THEN NULL;
END $enum$;
DO $enum$ BEGIN
  CREATE TYPE "public"."scan_bundle_status" AS ENUM('draft', 'processing', 'ready', 'submitted', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; WHEN unique_violation THEN NULL;
END $enum$;
DO $enum$ BEGIN
  CREATE TYPE "public"."doc_chat_scope" AS ENUM('single_document', 'multi_document', 'group_chat');
EXCEPTION WHEN duplicate_object THEN NULL; WHEN unique_violation THEN NULL;
END $enum$;
DO $enum$ BEGIN
  CREATE TYPE "public"."doc_chat_role" AS ENUM('user', 'assistant', 'system');
EXCEPTION WHEN duplicate_object THEN NULL; WHEN unique_violation THEN NULL;
END $enum$;
-- occupancy_onboarding_state — the occupancies.onboarding_state column enum.
-- The Drizzle type was RENAMED from the colliding name `onboarding_state` to
-- `occupancy_onboarding_state` (occupancy.schema.ts) because migration 0278
-- already ships a TABLE called `onboarding_state`, and a table occupies its own
-- name in Postgres's TYPE namespace — so `CREATE TYPE onboarding_state ...`
-- is impossible. This new, non-colliding type is created cleanly here and the
-- occupancies column below uses it (NOT text). See header CLASH note.
DO $enum$ BEGIN
  CREATE TYPE "public"."occupancy_onboarding_state" AS ENUM('a0_pre_move_in', 'a1_welcome_setup', 'a2_utilities', 'a3_orientation', 'a4_condition_report', 'a5_community_context', 'a6_complete');
EXCEPTION WHEN duplicate_object THEN NULL; WHEN unique_violation THEN NULL;
END $enum$;


-- ---- 2. Tables (parent-before-child, IF NOT EXISTS, each guarded) ----
-- NOTE: payment_plans.status keeps DEFAULT 'proposed' — the value is added to
--       the payment_plan_status enum by 0312b (committed before this file runs),
--       so the default is safe here. See ENUM note in the header.
-- NOTE: occupancies.onboarding_state uses the occupancy_onboarding_state enum
--       (created above), NOT text — the type-name collision with the 0278
--       `onboarding_state` TABLE is resolved by renaming the enum type. See
--       CLASH note in the header.

DO $tbl$ BEGIN
  CREATE TABLE IF NOT EXISTS "notices" (
  	"id" text PRIMARY KEY NOT NULL,
  	"tenant_id" text NOT NULL,
  	"property_id" text,
  	"unit_id" text,
  	"customer_id" text,
  	"lease_id" text,
  	"case_id" text,
  	"notice_number" text NOT NULL,
  	"notice_type" "notice_type" NOT NULL,
  	"status" "notice_status" DEFAULT 'draft' NOT NULL,
  	"subject" text NOT NULL,
  	"content" text NOT NULL,
  	"template_id" text,
  	"template_version" integer,
  	"variables" jsonb DEFAULT '{}'::jsonb,
  	"amount_due" integer,
  	"currency" text,
  	"effective_date" timestamp with time zone,
  	"expiry_date" timestamp with time zone,
  	"response_deadline" timestamp with time zone,
  	"notice_period_days" integer,
  	"jurisdiction_code" text,
  	"legal_citations" jsonb DEFAULT '[]'::jsonb,
  	"requires_approval" boolean DEFAULT false NOT NULL,
  	"approval_level" text,
  	"approved_at" timestamp with time zone,
  	"approved_by" text,
  	"approval_notes" text,
  	"rejected_at" timestamp with time zone,
  	"rejected_by" text,
  	"rejection_reason" text,
  	"scheduled_send_at" timestamp with time zone,
  	"sent_at" timestamp with time zone,
  	"sent_by" text,
  	"sent_via" "delivery_method",
  	"document_url" text,
  	"document_hash" text,
  	"attachments" jsonb DEFAULT '[]'::jsonb,
  	"acknowledged_at" timestamp with time zone,
  	"acknowledgment_method" text,
  	"voided_at" timestamp with time zone,
  	"voided_by" text,
  	"void_reason" text,
  	"follow_up_required" boolean DEFAULT false,
  	"follow_up_due_at" timestamp with time zone,
  	"metadata" jsonb DEFAULT '{}'::jsonb,
  	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  	"created_by" text,
  	"updated_by" text,
  	"deleted_at" timestamp with time zone,
  	"deleted_by" text
  );
EXCEPTION
  WHEN duplicate_table THEN RAISE NOTICE 'table % already exists, skipping', 'notices';
  WHEN duplicate_object THEN RAISE NOTICE 'object for % already exists, skipping', 'notices';
END $tbl$;

DO $tbl$ BEGIN
  CREATE TABLE IF NOT EXISTS "legal_cases" (
  	"id" text PRIMARY KEY NOT NULL,
  	"tenant_id" text NOT NULL,
  	"property_id" text,
  	"customer_id" text,
  	"case_number" text NOT NULL,
  	"type" "legal_case_type" NOT NULL,
  	"status" "legal_case_status" DEFAULT 'open' NOT NULL,
  	"title" text NOT NULL,
  	"description" text,
  	"court_name" text,
  	"court_case_number" text,
  	"filed_date" timestamp with time zone,
  	"hearing_date" timestamp with time zone,
  	"closed_date" timestamp with time zone,
  	"next_action_date" timestamp with time zone,
  	"outcome" text,
  	"outcome_notes" text,
  	"amount_awarded" integer,
  	"documents" jsonb DEFAULT '[]'::jsonb,
  	"assigned_to" text,
  	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  	"created_by" text,
  	"updated_by" text,
  	"deleted_at" timestamp with time zone,
  	"deleted_by" text
  );
EXCEPTION
  WHEN duplicate_table THEN RAISE NOTICE 'table % already exists, skipping', 'legal_cases';
  WHEN duplicate_object THEN RAISE NOTICE 'object for % already exists, skipping', 'legal_cases';
END $tbl$;

DO $tbl$ BEGIN
  CREATE TABLE IF NOT EXISTS "payment_plans" (
  	"id" text PRIMARY KEY NOT NULL,
  	"tenant_id" text NOT NULL,
  	"customer_id" text NOT NULL,
  	"lease_id" text,
  	"plan_number" text NOT NULL,
  	"status" "payment_plan_status" DEFAULT 'proposed' NOT NULL,
  	"total_amount" integer NOT NULL,
  	"paid_amount" integer DEFAULT 0 NOT NULL,
  	"remaining_amount" integer NOT NULL,
  	"currency" text NOT NULL,
  	"number_of_installments" integer NOT NULL,
  	"installment_amount" integer NOT NULL,
  	"frequency" text DEFAULT 'monthly' NOT NULL,
  	"start_date" timestamp with time zone NOT NULL,
  	"end_date" timestamp with time zone NOT NULL,
  	"installment_schedule" jsonb DEFAULT '[]'::jsonb NOT NULL,
  	"related_invoices" jsonb DEFAULT '[]'::jsonb,
  	"interest_rate" numeric(5, 2) DEFAULT '0',
  	"admin_fee" integer DEFAULT 0,
  	"approved_at" timestamp with time zone,
  	"approved_by" text,
  	"approval_notes" text,
  	"missed_payments" integer DEFAULT 0,
  	"max_missed_payments" integer DEFAULT 2,
  	"defaulted_at" timestamp with time zone,
  	"agreement_url" text,
  	"customer_signed_at" timestamp with time zone,
  	"completed_at" timestamp with time zone,
  	"notes" text,
  	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  	"created_by" text,
  	"updated_by" text
  );
EXCEPTION
  WHEN duplicate_table THEN RAISE NOTICE 'table % already exists, skipping', 'payment_plans';
  WHEN duplicate_object THEN RAISE NOTICE 'object for % already exists, skipping', 'payment_plans';
END $tbl$;

DO $tbl$ BEGIN
  CREATE TABLE IF NOT EXISTS "payment_intents" (
  	"id" text PRIMARY KEY NOT NULL,
  	"tenant_id" text NOT NULL,
  	"customer_id" text NOT NULL,
  	"lease_id" text,
  	"type" text NOT NULL,
  	"status" text DEFAULT 'PENDING' NOT NULL,
  	"amount_minor_units" integer NOT NULL,
  	"currency" text NOT NULL,
  	"platform_fee_minor_units" integer,
  	"net_amount_minor_units" integer,
  	"provider_name" text,
  	"external_id" text,
  	"description" text,
  	"statement_descriptor" text,
  	"idempotency_key" text,
  	"receipt_url" text,
  	"refunded_amount_minor_units" integer DEFAULT 0,
  	"failure_reason" text,
  	"paid_at" timestamp with time zone,
  	"refunded_at" timestamp with time zone,
  	"cancelled_at" timestamp with time zone,
  	"metadata" jsonb DEFAULT '{}'::jsonb,
  	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  	"created_by" text,
  	"updated_by" text
  );
EXCEPTION
  WHEN duplicate_table THEN RAISE NOTICE 'table % already exists, skipping', 'payment_intents';
  WHEN duplicate_object THEN RAISE NOTICE 'object for % already exists, skipping', 'payment_intents';
END $tbl$;

DO $tbl$ BEGIN
  CREATE TABLE IF NOT EXISTS "receipts" (
  	"id" text PRIMARY KEY NOT NULL,
  	"tenant_id" text NOT NULL,
  	"customer_id" text NOT NULL,
  	"payment_id" text NOT NULL,
  	"invoice_id" text,
  	"receipt_number" text NOT NULL,
  	"status" "receipt_status" DEFAULT 'issued' NOT NULL,
  	"amount" integer NOT NULL,
  	"currency" text NOT NULL,
  	"description" text,
  	"payment_method" text NOT NULL,
  	"issued_at" timestamp with time zone NOT NULL,
  	"issued_by" text,
  	"voided_at" timestamp with time zone,
  	"voided_by" text,
  	"void_reason" text,
  	"pdf_url" text,
  	"delivered_at" timestamp with time zone,
  	"delivery_channel" text,
  	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  	"created_by" text
  );
EXCEPTION
  WHEN duplicate_table THEN RAISE NOTICE 'table % already exists, skipping', 'receipts';
  WHEN duplicate_object THEN RAISE NOTICE 'object for % already exists, skipping', 'receipts';
END $tbl$;

DO $tbl$ BEGIN
  CREATE TABLE IF NOT EXISTS "occupancies" (
  	"id" text PRIMARY KEY NOT NULL,
  	"tenant_id" text NOT NULL,
  	"property_id" text NOT NULL,
  	"unit_id" text NOT NULL,
  	"customer_id" text NOT NULL,
  	"lease_id" text NOT NULL,
  	"status" "occupancy_status" DEFAULT 'pending_move_in' NOT NULL,
  	"onboarding_state" "occupancy_onboarding_state" DEFAULT 'a0_pre_move_in' NOT NULL,
  	"onboarding_started_at" timestamp with time zone,
  	"onboarding_completed_at" timestamp with time zone,
  	"onboarding_checklist" jsonb DEFAULT '{}'::jsonb,
  	"scheduled_move_in_date" timestamp with time zone,
  	"actual_move_in_date" timestamp with time zone,
  	"move_in_inspection_id" text,
  	"move_in_condition_report" jsonb DEFAULT '{}'::jsonb,
  	"notice_given_date" timestamp with time zone,
  	"scheduled_move_out_date" timestamp with time zone,
  	"actual_move_out_date" timestamp with time zone,
  	"move_out_inspection_id" text,
  	"move_out_condition_report" jsonb DEFAULT '{}'::jsonb,
  	"keys_handed_over" boolean DEFAULT false NOT NULL,
  	"keys_handed_over_at" timestamp with time zone,
  	"keys_returned_at" timestamp with time zone,
  	"access_codes" jsonb DEFAULT '[]'::jsonb,
  	"meter_readings_at_move_in" jsonb DEFAULT '{}'::jsonb,
  	"meter_readings_at_move_out" jsonb DEFAULT '{}'::jsonb,
  	"primary_occupant" jsonb DEFAULT '{}'::jsonb,
  	"additional_occupants" jsonb DEFAULT '[]'::jsonb,
  	"total_occupants" integer DEFAULT 1,
  	"has_pets" boolean DEFAULT false NOT NULL,
  	"pet_details" jsonb DEFAULT '[]'::jsonb,
  	"vehicles" jsonb DEFAULT '[]'::jsonb,
  	"parking_assignment" text,
  	"emergency_contacts" jsonb DEFAULT '[]'::jsonb,
  	"welcome_pack_sent_at" timestamp with time zone,
  	"welcome_pack_acknowledged_at" timestamp with time zone,
  	"last_check_in_at" timestamp with time zone,
  	"next_check_in_due" timestamp with time zone,
  	"check_in_count" integer DEFAULT 0,
  	"onboarding_badge_awarded" boolean DEFAULT false NOT NULL,
  	"onboarding_badge_awarded_at" timestamp with time zone,
  	"internal_notes" text,
  	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  	"created_by" text,
  	"updated_by" text,
  	"deleted_at" timestamp with time zone,
  	"deleted_by" text
  );
EXCEPTION
  WHEN duplicate_table THEN RAISE NOTICE 'table % already exists, skipping', 'occupancies';
  WHEN duplicate_object THEN RAISE NOTICE 'object for % already exists, skipping', 'occupancies';
END $tbl$;

DO $tbl$ BEGIN
  CREATE TABLE IF NOT EXISTS "access_handover_records" (
  	"id" text PRIMARY KEY NOT NULL,
  	"tenant_id" text NOT NULL,
  	"occupancy_id" text NOT NULL,
  	"item_type" text NOT NULL,
  	"item_description" text NOT NULL,
  	"quantity" integer DEFAULT 1 NOT NULL,
  	"serial_number" text,
  	"handed_over_at" timestamp with time zone,
  	"handed_over_to" text,
  	"handed_over_by" text,
  	"returned_at" timestamp with time zone,
  	"returned_to" text,
  	"returned_by" text,
  	"return_condition" text,
  	"handover_photo_url" text,
  	"return_photo_url" text,
  	"notes" text,
  	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  	"created_by" text,
  	"updated_by" text
  );
EXCEPTION
  WHEN duplicate_table THEN RAISE NOTICE 'table % already exists, skipping', 'access_handover_records';
  WHEN duplicate_object THEN RAISE NOTICE 'object for % already exists, skipping', 'access_handover_records';
END $tbl$;

DO $tbl$ BEGIN
  CREATE TABLE IF NOT EXISTS "procedure_completion_logs" (
  	"id" text PRIMARY KEY NOT NULL,
  	"tenant_id" text NOT NULL,
  	"occupancy_id" text NOT NULL,
  	"customer_id" text NOT NULL,
  	"procedure_code" text NOT NULL,
  	"procedure_name" text NOT NULL,
  	"procedure_category" text NOT NULL,
  	"delivered_at" timestamp with time zone NOT NULL,
  	"delivered_via" text NOT NULL,
  	"confirmed_at" timestamp with time zone,
  	"confirmation_method" text,
  	"evidence_url" text,
  	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
  	"created_by" text
  );
EXCEPTION
  WHEN duplicate_table THEN RAISE NOTICE 'table % already exists, skipping', 'procedure_completion_logs';
  WHEN duplicate_object THEN RAISE NOTICE 'object for % already exists, skipping', 'procedure_completion_logs';
END $tbl$;

DO $tbl$ BEGIN
  CREATE TABLE IF NOT EXISTS "conversation_participants" (
  	"id" text PRIMARY KEY NOT NULL,
  	"conversation_id" text NOT NULL,
  	"user_id" text,
  	"customer_id" text,
  	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
  	"left_at" timestamp with time zone,
  	"last_read_at" timestamp with time zone
  );
EXCEPTION
  WHEN duplicate_table THEN RAISE NOTICE 'table % already exists, skipping', 'conversation_participants';
  WHEN duplicate_object THEN RAISE NOTICE 'object for % already exists, skipping', 'conversation_participants';
END $tbl$;

DO $tbl$ BEGIN
  CREATE TABLE IF NOT EXISTS "availability_slots" (
  	"id" text PRIMARY KEY NOT NULL,
  	"tenant_id" text NOT NULL,
  	"user_id" text NOT NULL,
  	"day_of_week" integer NOT NULL,
  	"start_time" text NOT NULL,
  	"end_time" text NOT NULL,
  	"effective_from" timestamp with time zone,
  	"effective_to" timestamp with time zone,
  	"is_active" boolean DEFAULT true NOT NULL,
  	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
  );
EXCEPTION
  WHEN duplicate_table THEN RAISE NOTICE 'table % already exists, skipping', 'availability_slots';
  WHEN duplicate_object THEN RAISE NOTICE 'object for % already exists, skipping', 'availability_slots';
END $tbl$;

DO $tbl$ BEGIN
  CREATE TABLE IF NOT EXISTS "event_attendees" (
  	"id" text PRIMARY KEY NOT NULL,
  	"event_id" text NOT NULL,
  	"user_id" text,
  	"status" "attendee_status" DEFAULT 'pending' NOT NULL,
  	"responded_at" timestamp with time zone,
  	"response_note" text,
  	"invited_at" timestamp with time zone DEFAULT now() NOT NULL
  );
EXCEPTION
  WHEN duplicate_table THEN RAISE NOTICE 'table % already exists, skipping', 'event_attendees';
  WHEN duplicate_object THEN RAISE NOTICE 'object for % already exists, skipping', 'event_attendees';
END $tbl$;

DO $tbl$ BEGIN
  CREATE TABLE IF NOT EXISTS "document_access_logs" (
  	"id" text PRIMARY KEY NOT NULL,
  	"tenant_id" text NOT NULL,
  	"document_upload_id" text NOT NULL,
  	"accessed_by" text NOT NULL,
  	"accessed_by_type" text NOT NULL,
  	"action" text NOT NULL,
  	"ip_address" text,
  	"user_agent" text,
  	"purpose" text,
  	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL
  );
EXCEPTION
  WHEN duplicate_table THEN RAISE NOTICE 'table % already exists, skipping', 'document_access_logs';
  WHEN duplicate_object THEN RAISE NOTICE 'object for % already exists, skipping', 'document_access_logs';
END $tbl$;

DO $tbl$ BEGIN
  CREATE TABLE IF NOT EXISTS "communication_consents" (
  	"id" text PRIMARY KEY NOT NULL,
  	"tenant_id" text NOT NULL,
  	"customer_id" text NOT NULL,
  	"channel" "message_channel" NOT NULL,
  	"category" "template_category" NOT NULL,
  	"is_consented" boolean NOT NULL,
  	"consent_source" text NOT NULL,
  	"consent_method" text,
  	"consented_at" timestamp with time zone,
  	"withdrawn_at" timestamp with time zone,
  	"evidence_url" text,
  	"ip_address" text,
  	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
  );
EXCEPTION
  WHEN duplicate_table THEN RAISE NOTICE 'table % already exists, skipping', 'communication_consents';
  WHEN duplicate_object THEN RAISE NOTICE 'object for % already exists, skipping', 'communication_consents';
END $tbl$;

DO $tbl$ BEGIN
  CREATE TABLE IF NOT EXISTS "delivery_receipts" (
  	"id" text PRIMARY KEY NOT NULL,
  	"tenant_id" text NOT NULL,
  	"message_instance_id" text NOT NULL,
  	"status" "delivery_status" NOT NULL,
  	"previous_status" "delivery_status",
  	"provider" text,
  	"provider_receipt_id" text,
  	"provider_response" jsonb DEFAULT '{}'::jsonb,
  	"occurred_at" timestamp with time zone NOT NULL,
  	"error_code" text,
  	"error_message" text,
  	"device_info" jsonb DEFAULT '{}'::jsonb,
  	"read_at" timestamp with time zone,
  	"metadata" jsonb DEFAULT '{}'::jsonb,
  	"created_at" timestamp with time zone DEFAULT now() NOT NULL
  );
EXCEPTION
  WHEN duplicate_table THEN RAISE NOTICE 'table % already exists, skipping', 'delivery_receipts';
  WHEN duplicate_object THEN RAISE NOTICE 'object for % already exists, skipping', 'delivery_receipts';
END $tbl$;

DO $tbl$ BEGIN
  CREATE TABLE IF NOT EXISTS "escalation_chain_runs" (
  	"id" text PRIMARY KEY NOT NULL,
  	"tenant_id" text NOT NULL,
  	"chain_id" text NOT NULL,
  	"customer_id" text,
  	"entity_type" text NOT NULL,
  	"entity_id" text NOT NULL,
  	"status" text DEFAULT 'running' NOT NULL,
  	"current_step" integer DEFAULT 0 NOT NULL,
  	"steps_completed" jsonb DEFAULT '[]'::jsonb,
  	"started_at" timestamp with time zone NOT NULL,
  	"paused_at" timestamp with time zone,
  	"completed_at" timestamp with time zone,
  	"outcome" text,
  	"outcome_reason" text,
  	"next_step_at" timestamp with time zone,
  	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
  );
EXCEPTION
  WHEN duplicate_table THEN RAISE NOTICE 'table % already exists, skipping', 'escalation_chain_runs';
  WHEN duplicate_object THEN RAISE NOTICE 'object for % already exists, skipping', 'escalation_chain_runs';
END $tbl$;

DO $tbl$ BEGIN
  CREATE TABLE IF NOT EXISTS "message_templates" (
  	"id" text PRIMARY KEY NOT NULL,
  	"tenant_id" text NOT NULL,
  	"template_code" text NOT NULL,
  	"name" text NOT NULL,
  	"description" text,
  	"category" "template_category" NOT NULL,
  	"status" "template_status" DEFAULT 'draft' NOT NULL,
  	"supported_channels" jsonb DEFAULT '[]'::jsonb NOT NULL,
  	"whatsapp_content" jsonb DEFAULT '{}'::jsonb,
  	"sms_content" text,
  	"email_subject" text,
  	"email_html_content" text,
  	"email_text_content" text,
  	"push_title" text,
  	"push_body" text,
  	"voice_script" text,
  	"variables" jsonb DEFAULT '[]'::jsonb,
  	"required_variables" jsonb DEFAULT '[]'::jsonb,
  	"default_language" text DEFAULT 'en',
  	"translations" jsonb DEFAULT '{}'::jsonb,
  	"requires_approval" boolean DEFAULT false NOT NULL,
  	"approval_level" text,
  	"quiet_hours_exempt" boolean DEFAULT false NOT NULL,
  	"version" integer DEFAULT 1 NOT NULL,
  	"previous_version_id" text,
  	"approved_at" timestamp with time zone,
  	"approved_by" text,
  	"tags" jsonb DEFAULT '[]'::jsonb,
  	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  	"created_by" text,
  	"updated_by" text,
  	"deleted_at" timestamp with time zone,
  	"deleted_by" text
  );
EXCEPTION
  WHEN duplicate_table THEN RAISE NOTICE 'table % already exists, skipping', 'message_templates';
  WHEN duplicate_object THEN RAISE NOTICE 'object for % already exists, skipping', 'message_templates';
END $tbl$;

DO $tbl$ BEGIN
  CREATE TABLE IF NOT EXISTS "message_instances" (
  	"id" text PRIMARY KEY NOT NULL,
  	"tenant_id" text NOT NULL,
  	"customer_id" text,
  	"template_id" text,
  	"message_ref" text NOT NULL,
  	"channel" "message_channel" NOT NULL,
  	"recipient_name" text,
  	"recipient_address" text NOT NULL,
  	"recipient_type" text DEFAULT 'customer',
  	"subject" text,
  	"content" text NOT NULL,
  	"html_content" text,
  	"variables" jsonb DEFAULT '{}'::jsonb,
  	"language" text DEFAULT 'en',
  	"status" "message_status" DEFAULT 'queued' NOT NULL,
  	"trigger_type" text,
  	"trigger_entity_type" text,
  	"trigger_entity_id" text,
  	"scheduled_at" timestamp with time zone,
  	"sent_at" timestamp with time zone,
  	"sent_by" text,
  	"provider" text,
  	"provider_message_id" text,
  	"provider_response" jsonb DEFAULT '{}'::jsonb,
  	"cost" integer,
  	"cost_currency" text,
  	"retry_count" integer DEFAULT 0 NOT NULL,
  	"max_retries" integer DEFAULT 3,
  	"last_retry_at" timestamp with time zone,
  	"next_retry_at" timestamp with time zone,
  	"failed_at" timestamp with time zone,
  	"failure_reason" text,
  	"failure_code" text,
  	"expires_at" timestamp with time zone,
  	"priority" integer DEFAULT 5,
  	"metadata" jsonb DEFAULT '{}'::jsonb,
  	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  	"created_by" text
  );
EXCEPTION
  WHEN duplicate_table THEN RAISE NOTICE 'table % already exists, skipping', 'message_instances';
  WHEN duplicate_object THEN RAISE NOTICE 'object for % already exists, skipping', 'message_instances';
END $tbl$;

DO $tbl$ BEGIN
  CREATE TABLE IF NOT EXISTS "document_render_jobs" (
  	"id" text PRIMARY KEY NOT NULL,
  	"tenant_id" text NOT NULL,
  	"template_id" text NOT NULL,
  	"template_version" text NOT NULL,
  	"renderer_kind" "renderer_kind" NOT NULL,
  	"status" "render_job_status" DEFAULT 'queued' NOT NULL,
  	"input_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  	"output_document_id" text,
  	"output_mime_type" text,
  	"output_size_bytes" integer,
  	"page_count" integer,
  	"error_code" text,
  	"error_message" text,
  	"related_entity_type" text,
  	"related_entity_id" text,
  	"requested_by" text,
  	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
  	"started_at" timestamp with time zone,
  	"completed_at" timestamp with time zone
  );
EXCEPTION
  WHEN duplicate_table THEN RAISE NOTICE 'table % already exists, skipping', 'document_render_jobs';
  WHEN duplicate_object THEN RAISE NOTICE 'object for % already exists, skipping', 'document_render_jobs';
END $tbl$;

DO $tbl$ BEGIN
  CREATE TABLE IF NOT EXISTS "letter_requests" (
  	"id" text PRIMARY KEY NOT NULL,
  	"tenant_id" text NOT NULL,
  	"customer_id" text,
  	"letter_type" "letter_type" NOT NULL,
  	"status" "letter_request_status" DEFAULT 'requested' NOT NULL,
  	"request_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  	"draft_content" text,
  	"render_job_id" text,
  	"approval_id" text,
  	"approved_by" text,
  	"approved_at" timestamp with time zone,
  	"rejection_reason" text,
  	"issued_document_id" text,
  	"issued_at" timestamp with time zone,
  	"requested_by" text NOT NULL,
  	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
  );
EXCEPTION
  WHEN duplicate_table THEN RAISE NOTICE 'table % already exists, skipping', 'letter_requests';
  WHEN duplicate_object THEN RAISE NOTICE 'object for % already exists, skipping', 'letter_requests';
END $tbl$;

DO $tbl$ BEGIN
  CREATE TABLE IF NOT EXISTS "scan_bundles" (
  	"id" text PRIMARY KEY NOT NULL,
  	"tenant_id" text NOT NULL,
  	"title" text,
  	"purpose" text,
  	"status" "scan_bundle_status" DEFAULT 'draft' NOT NULL,
  	"assembled_document_id" text,
  	"page_count" integer DEFAULT 0 NOT NULL,
  	"processing_log" jsonb DEFAULT '[]'::jsonb NOT NULL,
  	"error_message" text,
  	"created_by" text NOT NULL,
  	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  	"submitted_at" timestamp with time zone
  );
EXCEPTION
  WHEN duplicate_table THEN RAISE NOTICE 'table % already exists, skipping', 'scan_bundles';
  WHEN duplicate_object THEN RAISE NOTICE 'object for % already exists, skipping', 'scan_bundles';
END $tbl$;

DO $tbl$ BEGIN
  CREATE TABLE IF NOT EXISTS "scan_bundle_pages" (
  	"id" text PRIMARY KEY NOT NULL,
  	"bundle_id" text NOT NULL,
  	"tenant_id" text NOT NULL,
  	"page_number" integer NOT NULL,
  	"storage_key" text NOT NULL,
  	"mime_type" text NOT NULL,
  	"size_bytes" integer NOT NULL,
  	"width_px" integer,
  	"height_px" integer,
  	"quad" jsonb,
  	"ocr_text" text,
  	"ocr_confidence" integer,
  	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
  );
EXCEPTION
  WHEN duplicate_table THEN RAISE NOTICE 'table % already exists, skipping', 'scan_bundle_pages';
  WHEN duplicate_object THEN RAISE NOTICE 'object for % already exists, skipping', 'scan_bundle_pages';
END $tbl$;

DO $tbl$ BEGIN
  CREATE TABLE IF NOT EXISTS "document_embeddings" (
  	"id" text PRIMARY KEY NOT NULL,
  	"tenant_id" text NOT NULL,
  	"document_id" text NOT NULL,
  	"chunk_index" integer NOT NULL,
  	"chunk_text" text NOT NULL,
  	"chunk_meta" jsonb DEFAULT '{}'::jsonb,
  	"embedding" vector(1536) NOT NULL,
  	"embedding_model" text NOT NULL,
  	"created_at" timestamp with time zone DEFAULT now() NOT NULL
  );
EXCEPTION
  WHEN duplicate_table THEN RAISE NOTICE 'table % already exists, skipping', 'document_embeddings';
  WHEN duplicate_object THEN RAISE NOTICE 'object for % already exists, skipping', 'document_embeddings';
END $tbl$;

DO $tbl$ BEGIN
  CREATE TABLE IF NOT EXISTS "doc_chat_sessions" (
  	"id" text PRIMARY KEY NOT NULL,
  	"tenant_id" text NOT NULL,
  	"scope" "doc_chat_scope" DEFAULT 'single_document' NOT NULL,
  	"title" text,
  	"document_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  	"participants" jsonb DEFAULT '[]'::jsonb NOT NULL,
  	"created_by" text NOT NULL,
  	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
  	"last_message_at" timestamp with time zone
  );
EXCEPTION
  WHEN duplicate_table THEN RAISE NOTICE 'table % already exists, skipping', 'doc_chat_sessions';
  WHEN duplicate_object THEN RAISE NOTICE 'object for % already exists, skipping', 'doc_chat_sessions';
END $tbl$;

DO $tbl$ BEGIN
  CREATE TABLE IF NOT EXISTS "doc_chat_messages" (
  	"id" text PRIMARY KEY NOT NULL,
  	"tenant_id" text NOT NULL,
  	"session_id" text NOT NULL,
  	"role" "doc_chat_role" NOT NULL,
  	"author_user_id" text,
  	"content" text NOT NULL,
  	"citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
  	"retrieved_chunk_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  	"model" text,
  	"tokens_used" jsonb,
  	"created_at" timestamp with time zone DEFAULT now() NOT NULL
  );
EXCEPTION
  WHEN duplicate_table THEN RAISE NOTICE 'table % already exists, skipping', 'doc_chat_messages';
  WHEN duplicate_object THEN RAISE NOTICE 'object for % already exists, skipping', 'doc_chat_messages';
END $tbl$;

DO $tbl$ BEGIN
  CREATE TABLE IF NOT EXISTS "audit_events" (
  	"id" text PRIMARY KEY NOT NULL,
  	"tenant_id" text NOT NULL,
  	"event_type" "audit_event_type" NOT NULL,
  	"action" text NOT NULL,
  	"description" text,
  	"actor_id" text,
  	"actor_email" text,
  	"actor_name" text,
  	"actor_type" text DEFAULT 'user' NOT NULL,
  	"target_type" text,
  	"target_id" text,
  	"ip_address" text,
  	"user_agent" text,
  	"session_id" text,
  	"previous_value" jsonb,
  	"new_value" jsonb,
  	"metadata" jsonb DEFAULT '{}'::jsonb,
  	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
  );
EXCEPTION
  WHEN duplicate_table THEN RAISE NOTICE 'table % already exists, skipping', 'audit_events';
  WHEN duplicate_object THEN RAISE NOTICE 'object for % already exists, skipping', 'audit_events';
END $tbl$;


-- ---- 3. Foreign keys (each guarded: missing/mismatched target -> NOTICE, not abort) ----

DO $fk$ BEGIN
  ALTER TABLE "legal_cases" ADD CONSTRAINT "legal_cases_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "legal_cases" ADD CONSTRAINT "legal_cases_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "legal_cases" ADD CONSTRAINT "legal_cases_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "receipts" ADD CONSTRAINT "receipts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "receipts" ADD CONSTRAINT "receipts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "receipts" ADD CONSTRAINT "receipts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "receipts" ADD CONSTRAINT "receipts_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_event_id_scheduled_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."scheduled_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "access_handover_records" ADD CONSTRAINT "access_handover_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "access_handover_records" ADD CONSTRAINT "access_handover_records_occupancy_id_occupancies_id_fk" FOREIGN KEY ("occupancy_id") REFERENCES "public"."occupancies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "occupancies" ADD CONSTRAINT "occupancies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "occupancies" ADD CONSTRAINT "occupancies_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "occupancies" ADD CONSTRAINT "occupancies_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "occupancies" ADD CONSTRAINT "occupancies_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "occupancies" ADD CONSTRAINT "occupancies_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "procedure_completion_logs" ADD CONSTRAINT "procedure_completion_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "procedure_completion_logs" ADD CONSTRAINT "procedure_completion_logs_occupancy_id_occupancies_id_fk" FOREIGN KEY ("occupancy_id") REFERENCES "public"."occupancies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "procedure_completion_logs" ADD CONSTRAINT "procedure_completion_logs_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "notices" ADD CONSTRAINT "notices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "notices" ADD CONSTRAINT "notices_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "notices" ADD CONSTRAINT "notices_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "notices" ADD CONSTRAINT "notices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "notices" ADD CONSTRAINT "notices_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "notices" ADD CONSTRAINT "notices_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "communication_consents" ADD CONSTRAINT "communication_consents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "communication_consents" ADD CONSTRAINT "communication_consents_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "delivery_receipts" ADD CONSTRAINT "delivery_receipts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "delivery_receipts" ADD CONSTRAINT "delivery_receipts_message_instance_id_message_instances_id_fk" FOREIGN KEY ("message_instance_id") REFERENCES "public"."message_instances"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "escalation_chain_runs" ADD CONSTRAINT "escalation_chain_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "escalation_chain_runs" ADD CONSTRAINT "escalation_chain_runs_chain_id_escalation_chains_id_fk" FOREIGN KEY ("chain_id") REFERENCES "public"."escalation_chains"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "escalation_chain_runs" ADD CONSTRAINT "escalation_chain_runs_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "message_instances" ADD CONSTRAINT "message_instances_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "message_instances" ADD CONSTRAINT "message_instances_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "message_instances" ADD CONSTRAINT "message_instances_template_id_message_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."message_templates"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "document_render_jobs" ADD CONSTRAINT "document_render_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "letter_requests" ADD CONSTRAINT "letter_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "letter_requests" ADD CONSTRAINT "letter_requests_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "scan_bundle_pages" ADD CONSTRAINT "scan_bundle_pages_bundle_id_scan_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."scan_bundles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "scan_bundle_pages" ADD CONSTRAINT "scan_bundle_pages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "scan_bundles" ADD CONSTRAINT "scan_bundles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "document_embeddings" ADD CONSTRAINT "document_embeddings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "doc_chat_sessions" ADD CONSTRAINT "doc_chat_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "doc_chat_messages" ADD CONSTRAINT "doc_chat_messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
DO $fk$ BEGIN
  ALTER TABLE "doc_chat_messages" ADD CONSTRAINT "doc_chat_messages_session_id_doc_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."doc_chat_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN RAISE NOTICE 'skip FK (missing table): %', SQLERRM;
  WHEN undefined_column THEN RAISE NOTICE 'skip FK (missing column): %', SQLERRM;
  WHEN datatype_mismatch THEN RAISE NOTICE 'skip FK (type mismatch): %', SQLERRM;
END $fk$;
