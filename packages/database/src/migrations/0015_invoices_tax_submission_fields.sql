-- BOSSNYUMBA Invoices Tax Submission Fields Migration
-- Adds fiscal-authority submission tracking columns to the invoices table so
-- the platform can record KRA eTIMS / TRA EFD / FIRS / SARS responses and
-- reconcile invoice <-> fiscal receipt state.

-- ============================================================================
-- Enum: tax_submission_status
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tax_submission_status') THEN
    CREATE TYPE tax_submission_status AS ENUM (
      'not_required',
      'pending',
      'submitted',
      'accepted',
      'rejected',
      'failed'
    );
  END IF;
END$$;

-- ============================================================================
-- invoices: add tax-submission tracking columns
-- ============================================================================

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS tax_submission_status tax_submission_status NOT NULL DEFAULT 'not_required';

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS kra_receipt_no        TEXT;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS kra_qr_url            TEXT;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS kra_invoice_number    TEXT;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS tax_submitted_at      TIMESTAMPTZ;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS tax_submission_error  TEXT;

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS invoices_tax_submission_status_idx
  ON invoices(tax_submission_status);

CREATE INDEX IF NOT EXISTS invoices_kra_receipt_no_idx
  ON invoices(kra_receipt_no);

-- ============================================================================
-- Down (reference)
-- ============================================================================
-- DROP INDEX IF EXISTS invoices_kra_receipt_no_idx;
-- DROP INDEX IF EXISTS invoices_tax_submission_status_idx;
-- ALTER TABLE invoices DROP COLUMN IF EXISTS tax_submission_error;
-- ALTER TABLE invoices DROP COLUMN IF EXISTS tax_submitted_at;
-- ALTER TABLE invoices DROP COLUMN IF EXISTS kra_invoice_number;
-- ALTER TABLE invoices DROP COLUMN IF EXISTS kra_qr_url;
-- ALTER TABLE invoices DROP COLUMN IF EXISTS kra_receipt_no;
-- ALTER TABLE invoices DROP COLUMN IF EXISTS tax_submission_status;
-- DROP TYPE IF EXISTS tax_submission_status;
