-- ─────────────────────────────────────────────────────────────────────
-- Migration 0170 — Temporal Knowledge Graph (Zep / Cognee-style).
--
-- Phase K-D — Brain Quality Cluster (R3 #2).
--
-- Persistent third-tier memory: a knowledge graph whose edges carry
-- time-validity columns so the brain can answer "as of date X, what
-- did we know about subject Y?" queries.
--
-- Backs the TypeScript `TemporalKG` reference impl in
-- packages/brain-quality/src/memory/temporal-kg.ts — same column
-- semantics. Jurisdiction- and currency-neutral (no KE / TZ / USD / KES
-- assumptions). RLS-aware via tenant_id.
--
-- Idempotent. Append-only for facts (use UPDATE to set valid_to /
-- invalidated_at on closure — never DELETE; history is the point).
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS temporal_kg_nodes (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT REFERENCES tenants(id) ON DELETE CASCADE,
  /** Entity type — e.g. 'tenant', 'building', 'unit', 'lease', 'vendor', 'ticket'. */
  entity_type         TEXT NOT NULL,
  /** Structured properties; schema is per-entity_type. */
  properties          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_temporal_kg_nodes_tenant_type
  ON temporal_kg_nodes (tenant_id, entity_type);

CREATE INDEX IF NOT EXISTS idx_temporal_kg_nodes_properties_gin
  ON temporal_kg_nodes USING GIN (properties);

COMMENT ON TABLE temporal_kg_nodes IS
  'Nodes in the brain-quality temporal knowledge graph (Phase K-D, R3 #2).';

CREATE TABLE IF NOT EXISTS temporal_kg_edges (
  id                    TEXT PRIMARY KEY,
  tenant_id             TEXT REFERENCES tenants(id) ON DELETE CASCADE,
  subject_id            TEXT NOT NULL REFERENCES temporal_kg_nodes(id) ON DELETE CASCADE,
  /** Predicate string — e.g. 'pays_rent_to', 'occupies', 'manages', 'reported'. */
  predicate             TEXT NOT NULL,
  object_id             TEXT NOT NULL REFERENCES temporal_kg_nodes(id) ON DELETE CASCADE,
  properties            JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Time-validity columns — the heart of "as-of date X" queries.
  valid_from            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  /** NULL means "currently true". */
  valid_to              TIMESTAMPTZ,
  /** Set when the edge is closed before its natural expiry. */
  invalidated_at        TIMESTAMPTZ,
  invalidation_reason   TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- A fact cannot end before it began.
  CONSTRAINT chk_temporal_kg_edges_validity
    CHECK (valid_to IS NULL OR valid_to >= valid_from),

  -- An invalidated edge must have invalidated_at + reason.
  CONSTRAINT chk_temporal_kg_edges_invalidation
    CHECK (
      (invalidated_at IS NULL AND invalidation_reason IS NULL)
      OR (invalidated_at IS NOT NULL AND invalidation_reason IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_temporal_kg_edges_subject
  ON temporal_kg_edges (subject_id, predicate);

CREATE INDEX IF NOT EXISTS idx_temporal_kg_edges_object
  ON temporal_kg_edges (object_id, predicate);

CREATE INDEX IF NOT EXISTS idx_temporal_kg_edges_validity
  ON temporal_kg_edges (valid_from, valid_to);

CREATE INDEX IF NOT EXISTS idx_temporal_kg_edges_tenant_predicate
  ON temporal_kg_edges (tenant_id, predicate, valid_from DESC);

-- Open-edges fast-path: only rows where valid_to IS NULL.
CREATE INDEX IF NOT EXISTS idx_temporal_kg_edges_open
  ON temporal_kg_edges (subject_id, predicate)
  WHERE valid_to IS NULL;

COMMENT ON TABLE temporal_kg_edges IS
  'Edges in the brain-quality temporal knowledge graph with Zep-style time-validity columns (Phase K-D, R3 #2).';

COMMENT ON COLUMN temporal_kg_edges.valid_from IS
  'Inclusive start of the period during which this fact is considered true.';
COMMENT ON COLUMN temporal_kg_edges.valid_to IS
  'Exclusive end of validity. NULL = currently true.';
COMMENT ON COLUMN temporal_kg_edges.invalidated_at IS
  'Timestamp at which this edge was administratively closed (vs. natural expiry).';
