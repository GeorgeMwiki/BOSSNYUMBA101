-- =============================================================================
-- 0173: attribute_history — append-only per-(entity, attribute) change log
--
-- The PI-A (Progressive Intelligence + Auto-Fill) substrate writes every
-- applied change to this table. The journal is append-only at the DB layer:
-- a BEFORE UPDATE / BEFORE DELETE trigger rejects modification (a correction
-- is recorded as a new row that carries `supersedes` pointing at the prior).
--
-- BOSSNYUMBA only — LITFIN has its own ledger.
--
-- Tenant isolation:
--   * tenant_id NOT NULL, FK → tenants(id) ON DELETE CASCADE
--   * ENABLE ROW LEVEL SECURITY + FORCE ROW LEVEL SECURITY
--   * tenant_isolation_select policy (FOR SELECT TO authenticated)
--   * tenant_isolation_modify policy (FOR INSERT TO authenticated;
--     UPDATE + DELETE are blocked by the trigger, so this policy only
--     needs to allow INSERT)
--   * REVOKE ALL FROM anon
--
-- Idempotent: gated on table existence + DROP IF EXISTS for policies +
-- CREATE OR REPLACE for the function.
-- =============================================================================

CREATE TABLE IF NOT EXISTS attribute_history (
  id              UUID         PRIMARY KEY,
  tenant_id       TEXT         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_id       TEXT         NOT NULL,
  entity_kind     TEXT         NOT NULL,
  attribute_key   TEXT         NOT NULL,
  from_value      JSONB,
  to_value        JSONB,
  actor_kind      TEXT         NOT NULL CHECK (actor_kind IN ('owner','employee','agent','system','connector')),
  actor_id        TEXT         NOT NULL,
  actor_label     TEXT,
  reason          TEXT         NOT NULL,
  source_kind     TEXT         NOT NULL CHECK (source_kind IN ('chat-text','chat-attachment','ingest-file','connector-api','subagent-research','manual-edit')),
  source_ref      TEXT         NOT NULL,
  evidence        JSONB        NOT NULL,
  observed_at     TIMESTAMPTZ  NOT NULL,
  recorded_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  supersedes      UUID         REFERENCES attribute_history(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS attribute_history_tenant_idx
  ON attribute_history(tenant_id);
CREATE INDEX IF NOT EXISTS attribute_history_entity_idx
  ON attribute_history(tenant_id, entity_id, attribute_key);
CREATE INDEX IF NOT EXISTS attribute_history_recorded_at_idx
  ON attribute_history(tenant_id, recorded_at);

-- ---------------------------------------------------------------------------
-- Append-only enforcement: no UPDATE, no DELETE on attribute_history.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION attribute_history_block_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'attribute_history is append-only — % rejected (id=%)',
    TG_OP,
    COALESCE(OLD.id::text, 'unknown');
END;
$$;

DROP TRIGGER IF EXISTS attribute_history_block_update ON attribute_history;
CREATE TRIGGER attribute_history_block_update
  BEFORE UPDATE ON attribute_history
  FOR EACH ROW EXECUTE FUNCTION attribute_history_block_mutation();

DROP TRIGGER IF EXISTS attribute_history_block_delete ON attribute_history;
CREATE TRIGGER attribute_history_block_delete
  BEFORE DELETE ON attribute_history
  FOR EACH ROW EXECUTE FUNCTION attribute_history_block_mutation();

-- ---------------------------------------------------------------------------
-- Row-level security (tenant isolation).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  tbl text;
  tenant_tables text[] := ARRAY['attribute_history'];
BEGIN
  FOREACH tbl IN ARRAY tenant_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', tbl);

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
        USING (tenant_id = public.current_app_tenant_id());
      $pol$, tbl);

      -- INSERT-only — UPDATE + DELETE are blocked by triggers anyway.
      EXECUTE format($pol$
        CREATE POLICY tenant_isolation_modify ON public.%I
        FOR INSERT
        TO authenticated
        WITH CHECK (tenant_id = public.current_app_tenant_id());
      $pol$, tbl);

      EXECUTE format('REVOKE ALL ON public.%I FROM anon;', tbl);
    END IF;
  END LOOP;
END;
$$;
