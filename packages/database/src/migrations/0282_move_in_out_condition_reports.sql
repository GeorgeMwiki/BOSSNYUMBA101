-- =============================================================================
-- Migration 0282 — move_in_out_condition_reports
--
-- Ported from Borjie 0136 (inspection_narratives) — adapted for the
-- real-estate domain.
--
-- One row per move-in / move-out / mid-lease inspection that has had a
-- condition narrative drafted by the persona (LLM), reviewed by the
-- property manager, signed by the landlord + tenant, and submitted to
-- the relevant authority where applicable (deposit-protection scheme
-- for UK / NSW Tenancy Tribunal for AU / Rental Housing Tribunal for
-- ZA / housing authority for TZ).
--
-- Companion to (future):
--   - services/api-gateway/src/routes/compliance/condition-reports.hono.ts
--   - services/api-gateway/src/services/condition-narrative/generator.ts
--   - packages/database/src/schemas/move-in-out-condition-reports.schema.ts
--   - apps/workforce-mobile/app/(manager)/inspection/[id]/narrative.tsx
--
-- The narrative is Markdown (sw + en) plus a structured frontmatter
-- block. C2PA-signed photo references are stapled via the inspection_id
-- back-reference.
--
-- Report kinds:
--   move_in     — tenant takes possession; baseline condition
--   move_out    — tenant returns keys; comparison for deposit return
--   mid_lease   — scheduled inspection during tenancy
--   damage      — incident-triggered post-damage assessment
--   safety      — fire / electrical / gas safety inspection
--   other       — fallback
--
-- State machine:
--   draft         — LLM generated; manager has not approved
--   manager_ok    — manager approved; awaiting landlord sig
--   landlord_signed — landlord signed; awaiting tenant counter-sig
--   tenant_signed — tenant counter-signed; ready to submit
--   submitted     — sent to authority / deposit scheme
--   delivered     — authority acknowledged
--   superseded    — re-run; a newer report exists
--
-- Tenant scope: tenant_id::text = current_setting('app.current_tenant_id', true)
-- RLS FORCE-enabled.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS move_in_out_condition_reports (
  id                    text         PRIMARY KEY,
  tenant_id             text         NOT NULL,
  /** FK to inspection_id (or any inspection-event table). */
  inspection_id         text         NOT NULL,
  /** move_in | move_out | mid_lease | damage | safety | other. */
  report_kind           text         NOT NULL DEFAULT 'move_in',
  /** draft | manager_ok | landlord_signed | tenant_signed | submitted | delivered | superseded. */
  status                text         NOT NULL DEFAULT 'draft',
  /** Swahili-first Markdown narrative — primary output. */
  draft_md_sw           text         NOT NULL,
  /** English Markdown — generated alongside. */
  draft_md_en           text         NOT NULL,
  /** anthropic | openai | google | local — provenance of generation. */
  llm_provider          text,
  /** Model id (e.g. claude-opus-4-7, gpt-4-turbo). */
  llm_model             text,
  /** Prompt template version — for regression-test reproducibility. */
  prompt_version        text         NOT NULL DEFAULT 'v1',
  /** Token + USD cost of the generation. */
  cost_usd              numeric(12, 4),
  generated_at          timestamptz  NOT NULL DEFAULT now(),
  manager_ok_at         timestamptz,
  manager_ok_by         text,
  landlord_signed_at    timestamptz,
  landlord_signed_by    text,
  /** SHA-256 of the canonical PDF the landlord signed. */
  landlord_sig_sha256   text,
  tenant_signed_at      timestamptz,
  tenant_signed_by      text,
  tenant_sig_sha256     text,
  authority_sent_at     timestamptz,
  /** rht-za | tpos-uk | nsw-tribunal-au | deposit-scheme-uk | housing-tz | none. */
  authority             text,
  /** Reference returned by the authority on delivery. */
  authority_ref         text,
  /** ai_audit_chain.sequenceNumber — anchored on first submit. */
  audit_chain_seq       bigint,
  /** Free-form notes captured by the manager during review. */
  manager_notes         text,
  superseded_by_id      text,
  created_by            text,
  created_at            timestamptz  NOT NULL DEFAULT now(),
  updated_at            timestamptz  NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'condition_reports_kind_chk'
  ) THEN
    ALTER TABLE move_in_out_condition_reports
      ADD CONSTRAINT condition_reports_kind_chk
      CHECK (report_kind IN (
        'move_in', 'move_out', 'mid_lease', 'damage', 'safety', 'other'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'condition_reports_status_chk'
  ) THEN
    ALTER TABLE move_in_out_condition_reports
      ADD CONSTRAINT condition_reports_status_chk
      CHECK (status IN (
        'draft', 'manager_ok', 'landlord_signed', 'tenant_signed',
        'submitted', 'delivered', 'superseded'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'condition_reports_authority_chk'
  ) THEN
    ALTER TABLE move_in_out_condition_reports
      ADD CONSTRAINT condition_reports_authority_chk
      CHECK (authority IS NULL OR authority IN (
        'rht-za', 'tpos-uk', 'nsw-tribunal-au', 'deposit-scheme-uk',
        'housing-tz', 'rent-tribunal-ke', 'lands-ministry-ug', 'none'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS condition_reports_tenant_idx
  ON move_in_out_condition_reports (tenant_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS condition_reports_inspection_idx
  ON move_in_out_condition_reports (tenant_id, inspection_id);

CREATE INDEX IF NOT EXISTS condition_reports_status_idx
  ON move_in_out_condition_reports (tenant_id, status);

ALTER TABLE move_in_out_condition_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE move_in_out_condition_reports FORCE  ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'move_in_out_condition_reports'
       AND policyname = 'condition_reports_tenant_isolation'
  ) THEN
    CREATE POLICY condition_reports_tenant_isolation
      ON move_in_out_condition_reports
      FOR ALL
      USING (tenant_id = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
  END IF;
END $$;

COMMIT;
