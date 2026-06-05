-- =============================================================================
-- 0123b: Pre-empt the `owner_statements` table so 0124 can index it.
--
-- ORDERING-BUG FIX (fresh-DB blocker).
--
-- `0124_wave4_query_indexes.sql` issues:
--
--     CREATE INDEX IF NOT EXISTS owner_statements_tenant_status_period_idx
--       ON owner_statements (tenant_id, status, period_start);
--
-- but no migration before 0124 ever creates the `owner_statements` table
-- (historically it existed only as a Drizzle auto-migration never copied
-- into this canonical tree). On a FRESH database the whole run therefore
-- aborts at 0124 with `ERROR: relation "owner_statements" does not exist`
-- (42P01) — only ~214 of the tables get created and every later migration
-- is skipped.
--
-- `0176_owner_statements_table.sql` was written as the forward-fix, but it
-- sorts AFTER 0124, so the run dies before it can heal anything. `IF NOT
-- EXISTS` on the 0124 index does not help — it guards a duplicate INDEX,
-- not a missing TABLE.
--
-- Both 0124 and 0176 are merged and IMMUTABLE, so the only correct fix is
-- to make the table exist BEFORE 0124 runs. This file sorts between
-- `0123_kernel_agency.sql` and `0124_wave4_query_indexes.sql` using the
-- repo's established letter-suffix insertion convention (cf. 0001b, 0017b,
-- 0018b…).
--
-- The DDL below is the enum + table block of 0176 verbatim. It is fully
-- idempotent (CREATE TYPE guarded, CREATE TABLE IF NOT EXISTS), so when
-- 0176 runs later it is a perfect no-op, and on a Drizzle-managed DB where
-- the table already exists this migration is a no-op too. Indexes stay in
-- their original homes: 0124 creates its composite index (now that the
-- table exists), 0176 creates the rest.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. owner_statement_status enum (matches payment.schema.ts:433-439).
-- ─────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'owner_statement_status'
  ) THEN
    CREATE TYPE owner_statement_status AS ENUM (
      'draft',
      'pending_review',
      'approved',
      'sent',
      'acknowledged'
    );
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 2. owner_statements table (matches payment.schema.ts:672-759).
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.owner_statements (
  id                       text PRIMARY KEY,
  tenant_id                text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id              text NOT NULL,
  owner_id                 text NOT NULL,

  -- Identity
  statement_number         text NOT NULL,

  -- Period
  period_start             timestamptz NOT NULL,
  period_end               timestamptz NOT NULL,

  -- Status
  status                   owner_statement_status NOT NULL DEFAULT 'draft',

  -- Summary (minor-units integers)
  gross_rent_collected     integer NOT NULL DEFAULT 0,
  other_income             integer NOT NULL DEFAULT 0,
  total_income             integer NOT NULL DEFAULT 0,

  management_fee           integer NOT NULL DEFAULT 0,
  maintenance_expenses     integer NOT NULL DEFAULT 0,
  other_expenses           integer NOT NULL DEFAULT 0,
  total_expenses           integer NOT NULL DEFAULT 0,

  net_income               integer NOT NULL DEFAULT 0,

  -- Disbursement
  amount_due               integer NOT NULL DEFAULT 0,
  amount_disbursed         integer NOT NULL DEFAULT 0,
  disbursed_at             timestamptz,
  disbursement_ref         text,

  currency                 text NOT NULL,

  -- Line items
  income_line_items        jsonb DEFAULT '[]'::jsonb,
  expense_line_items       jsonb DEFAULT '[]'::jsonb,

  -- Occupancy summary
  occupancy_summary        jsonb DEFAULT '{}'::jsonb,

  -- Document
  pdf_url                  text,

  -- Approval
  approved_at              timestamptz,
  approved_by              text,

  -- Sending
  sent_at                  timestamptz,
  sent_by                  text,
  delivery_channel         text,

  -- Acknowledgment
  acknowledged_at          timestamptz,

  -- Notes
  internal_notes           text,
  owner_notes              text,

  -- Timestamps
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  created_by               text,
  updated_by               text
);
