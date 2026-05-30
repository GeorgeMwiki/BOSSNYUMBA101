-- =============================================================================
-- Migration 0296 — Federated Personal Knowledge Base (PKB).
--
-- Closes BN "memory persistence" superpower #11 (PARTIAL → REAL). Today
-- `core_memory_blocks` and `ai_semantic_memories` are tenant-scoped — a
-- landlord who manages buildings under two separate tenants (own estate
-- + family-trust estate) loses every preference, calibration, and life-
-- event the moment she switches tenancy. This migration introduces three
-- platform-level tables that live ABOVE the tenant boundary so a single
-- human can be recognised across every BossNyumba surface she touches.
--
-- Ported from Borjie's PKB design (see Borjie
-- `packages/database/src/schemas/persons.schema.ts` +
-- `personal-memory.schema.ts`). Mining-domain language ("Asha owns Mine
-- A, manages Mine B, …") translated to real-estate: one human can be
-- landlord at Tenant A, estate-manager at Tenant B, accountant at
-- Tenant C, and renter at Tenant D.
--
-- Tables created:
--   - persons                  : canonical human identity (one row per
--                                real human; opt-in unified KB flag).
--   - person_links             : (person × tenant × supabase_user × role)
--                                join. Many hats per human.
--   - personal_memory_cells    : federated personal cells. NO RLS by
--                                design — gated by `app.current_person_id`
--                                GUC bound at the api-gateway middleware.
--
-- RLS posture:
--   - `persons` / `person_links` : NO RLS (platform identity registries
--     mirroring `platform_memory_cells`). Reads use the service-role
--     connection from identity resolution paths only.
--   - `personal_memory_cells`    : NO RLS by design. The Chinese-wall
--     boundary-tagger (`packages/ai-copilot/src/memory/boundary-tagger.ts`)
--     enforces cross-tenant numeric-leak prevention at the brain
--     orchestrator layer — fail-LOUD via `assertChineseWall()` that
--     throws `PersonalKbBoundaryViolation` on leak.
--
-- `source_tenant_id` / `source_thread_id` on `personal_memory_cells`
-- carry PROVENANCE only — they are never used to filter access. They
-- power the audit chain and the "where did this fact come from?"
-- introspection in the persona-runtime debug UI.
--
-- Idempotent (IF NOT EXISTS + DO blocks). Forward-only. Append-only.
-- IMMUTABLE: per CLAUDE.md "Migrations are immutable" — never edit this
-- file after merge; append a new numbered file instead.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- persons — canonical human identity (one row per real human)
-- ============================================================================

CREATE TABLE IF NOT EXISTS persons (
  id                            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ITU-T E.164 phone with leading '+'. Deterministic identity-resolution
  -- primary signal — every onboarding flow (customer-app, estate-manager-
  -- app, owner-portal, marketing CTAs) captures this.
  primary_phone_e164            text          NOT NULL UNIQUE,
  primary_email                 text,
  display_name                  text          NOT NULL,
  -- sw|en|fr|... ISO-639-1. Default keeps Swahili-first posture in
  -- East-Africa pilots; per-region rollout will switch this default to
  -- the jurisdiction's primary language.
  preferred_language            text          NOT NULL DEFAULT 'sw',
  -- Affirmative opt-in timestamp for cross-tenant federation. NULL
  -- means the person has NOT opted in; tenant memories remain fully
  -- siloed. Set when the user confirms the multi-tenancy onboarding
  -- modal. Revocation drops to `consent_unified_kb_revoked_at`.
  consent_unified_kb_at         timestamptz,
  consent_unified_kb_revoked_at timestamptz,
  created_at                    timestamptz   NOT NULL DEFAULT now(),
  updated_at                    timestamptz   NOT NULL DEFAULT now(),
  -- Hash-chained audit-trail link (mirrors workforce_invitations).
  hash_chain_id                 uuid
);

CREATE INDEX IF NOT EXISTS persons_phone_idx ON persons (primary_phone_e164);

-- ============================================================================
-- person_links — (person × tenant × supabase_user × role) join
-- ============================================================================

CREATE TABLE IF NOT EXISTS person_links (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id          uuid        NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  -- `tenants.id` is text in BN (not uuid). The join is logical only —
  -- no FK because we do not want a person-link delete to cascade from
  -- a tenant delete (the person row outlives any single tenancy).
  tenant_id          text        NOT NULL,
  -- Supabase auth.users.id for this hat.
  supabase_user_id   text        NOT NULL,
  -- landlord|estate_manager|accountant|maintenance_lead|renter|admin.
  role_in_tenant     text        NOT NULL,
  linked_at          timestamptz NOT NULL DEFAULT now(),
  -- Set on un-link; the row is KEPT for audit replay.
  unlinked_at        timestamptz,
  -- phone-match|manual|sso|sso-merge|tenant-onboarding.
  link_method        text        NOT NULL DEFAULT 'phone-match'
);

CREATE INDEX IF NOT EXISTS person_links_person_idx
  ON person_links (person_id);
CREATE INDEX IF NOT EXISTS person_links_tenant_user_idx
  ON person_links (tenant_id, supabase_user_id);

-- One (person, tenant, supabase_user) triple per row. A human cannot be
-- linked to the same tenant twice under the same auth principal.
CREATE UNIQUE INDEX IF NOT EXISTS person_links_person_tenant_user_uniq
  ON person_links (person_id, tenant_id, supabase_user_id);

-- ============================================================================
-- personal_memory_cells — federated personal memory (NO RLS, no tenant_id)
-- ============================================================================

CREATE TABLE IF NOT EXISTS personal_memory_cells (
  id                 uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id          uuid           NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  -- preference     — durable likes/dislikes ("address me as Bibi Asha").
  -- context        — current state ("recovering from flu this week").
  -- recurring-fact — stable life facts ("my mother passed in Aug 2024").
  -- calibration    — per-user model calibration ("prefers conservative
  --                  pricing thresholds when listing vacancies").
  -- sentiment      — recent emotional snapshot ("stressed about the
  --                  rent-arrears letter sent on Friday").
  cell_kind          text           NOT NULL,
  -- Cell key — domain identifier inside its `cell_kind` family.
  key                text           NOT NULL,
  -- Structured value payload. Numeric data inside this jsonb triggers
  -- the boundary-tagger's Chinese-wall block when surfaced cross-tenant.
  value              jsonb          NOT NULL,
  -- [0,1] confidence dial. Default 1.0 (user-stated).
  confidence         numeric(3, 2)  NOT NULL DEFAULT 1.0,
  -- Provenance only — which tenant context produced this cell. NEVER
  -- used to filter access. NULL when the cell came from a person-level
  -- interaction (e.g. unified settings, voice intro, marketing-funnel
  -- preference capture before any tenant link existed).
  source_tenant_id   text,
  source_thread_id   uuid,
  captured_at        timestamptz    NOT NULL DEFAULT now(),
  -- Optional TTL; NULL means the cell does not expire.
  expires_at         timestamptz,
  CONSTRAINT personal_memory_cells_confidence_chk
    CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE INDEX IF NOT EXISTS personal_memory_cells_person_kind_idx
  ON personal_memory_cells (person_id, cell_kind);

-- One cell per (person, kind, key) triple. Upserts replace value +
-- confidence + captured_at when the same key fires again. Matches the
-- ON CONFLICT clause in `person-layer.ts → upsertPersonalFact()`.
CREATE UNIQUE INDEX IF NOT EXISTS personal_memory_cells_person_kind_key_uniq
  ON personal_memory_cells (person_id, cell_kind, key);

COMMIT;
