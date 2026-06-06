-- =============================================================================
-- Migration 0312 — Case photos (maintenance evidence).
--
-- The tenant maintenance-intake flow (apps/customer-app → POST /api/v1/cases)
-- attaches photos when a resident reports an issue, but the `cases` create
-- path had nowhere to persist them, so the photos were silently dropped.
--
-- This adds a lightweight `photos` column on `cases` to hold the inline
-- evidence references submitted at create time. Each element is a small
-- object `{ "name": string, "url": string }` (the client may send a remote
-- URL or an inline data: URL). This is intentionally distinct from the
-- richer normalized `evidence_attachments` table (file_size / mime_type /
-- checksum / verification workflow): intake photos arrive as bare
-- references with no server-known size/mime, so forcing them through the
-- NOT-NULL `evidence_attachments` columns would mean fabricating data. A
-- case-management workflow can later promote a photo into a verified
-- `evidence_attachments` row when it gains that metadata.
--
-- BACKWARDS COMPATIBLE: defaults to '[]' for every existing case. No
-- existing row breaks; no read path is forced to change.
--
-- Idempotent (ADD COLUMN IF NOT EXISTS). Append-only. Forward-only.
-- IMMUTABLE: per CLAUDE.md "Migrations are immutable" — never edit this
-- file after merge; append a new numbered file instead.
-- =============================================================================

BEGIN;

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS photos jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMIT;
