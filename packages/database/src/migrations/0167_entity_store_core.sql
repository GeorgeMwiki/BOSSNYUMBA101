-- =============================================================================
-- 0167: Universal Entity Store substrate — Phase J1 core tables.
--
-- Substrate the Jarvis-class MD writes any new entity type into at runtime
-- WITHOUT a migration:
--
--   * entity_types       — registry of allowed types + Zod schema handle
--                          (built-in OR runtime-defined)
--   * entities           — header rows; one per entity
--   * entity_attributes  — versioned JSONB attribute bag (one row per
--                          (entity_id, key, version))
--   * entity_relations   — typed edges between entities
--
-- Scope model (read CLAUDE.md):
--   scope_owner_type ∈ {'platform', 'tenant'}
--     - platform : BOSSNYUMBA-as-software-company's own entities
--                  (internal-staff, platform-leads, platform-vendors).
--                  Only the internal-admin role can read/write.
--     - tenant   : owner-customer's portfolio entities (their employees,
--                  their leases, their tickets). tenant_id REQUIRED.
--
--   RLS + FORCE ROW LEVEL SECURITY is enabled on entities, entity_attributes,
--   and entity_relations so even table-owner cannot bypass.
--
-- Backward-compat layer:
--   Read-only VIEWs `v_entities_property`, `v_entities_lease`,
--   `v_entities_maintenance` UNION the legacy property/lease/maintenance_requests
--   tables into the new attribute-bag shape. Legacy WRITES stay through the
--   existing repositories until CL-B3/CL-B4 cuts them over. Decision
--   rationale: views are lighter-touch than INSTEAD-OF triggers — no risk
--   of write-amplification, no dual-write race window, instantly reversible.
--
-- Idempotent: every CREATE uses IF NOT EXISTS; every CREATE POLICY is
-- preceded by DROP POLICY IF EXISTS.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. entity_types — registry of allowed types + schema handles.
--    NOT tenant-scoped — types are platform-wide (shared dictionary).
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS entity_types (
  name                TEXT PRIMARY KEY,
  schema_zod          TEXT NOT NULL, -- 'built-in:<name>' OR raw zod expression
  jurisdiction_aware  BOOLEAN NOT NULL DEFAULT FALSE,
  /** 'platform' | 'tenant' | 'both' */
  scope               TEXT NOT NULL CHECK (scope IN ('platform','tenant','both')),
  description         TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE entity_types IS
  'Universal entity-store registry — defines the allowed `type` strings for the entities table. Built-in types live here; the MD writes runtime-invented types here too.';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. entities — header rows.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS entities (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type                TEXT NOT NULL REFERENCES entity_types(name) ON UPDATE CASCADE,
  scope_owner_type    TEXT NOT NULL CHECK (scope_owner_type IN ('platform','tenant')),
  /** For platform scope: a sentinel constant (zero-uuid). For tenant scope: the tenant id. */
  scope_owner_id      UUID NOT NULL,
  /** REQUIRED when scope_owner_type = 'tenant'. NULL for platform scope. */
  tenant_id           UUID,
  created_by          UUID NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_provenance   JSONB NOT NULL,
  deleted_at          TIMESTAMPTZ,
  -- Tenant-scope rows MUST carry tenant_id = scope_owner_id.
  CONSTRAINT entities_tenant_consistency CHECK (
    (scope_owner_type = 'platform' AND tenant_id IS NULL) OR
    (scope_owner_type = 'tenant' AND tenant_id IS NOT NULL AND tenant_id = scope_owner_id)
  )
);

CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
CREATE INDEX IF NOT EXISTS idx_entities_tenant_id ON entities(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entities_scope_owner ON entities(scope_owner_type, scope_owner_id);
CREATE INDEX IF NOT EXISTS idx_entities_type_tenant ON entities(type, tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_entities_active ON entities(type) WHERE deleted_at IS NULL;

COMMENT ON TABLE entities IS
  'Universal entity store header. Every "thing" the MD knows about (employee, lease, ticket, ...) lives here keyed by id. Attribute bag is in entity_attributes; typed edges in entity_relations.';
COMMENT ON COLUMN entities.scope_owner_type IS
  'platform = BOSSNYUMBA-as-software-company; tenant = owner-customer.';
COMMENT ON COLUMN entities.source_provenance IS
  'JSONB envelope: {conversationId?, messageId?, fileHash?, rowIdx?, llmInferredSchemaVersion?, manual?, llmResearch?, timestamp}. At least one origin signal required.';

-- ─────────────────────────────────────────────────────────────────────────
-- 3. entity_attributes — versioned attribute bag.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS entity_attributes (
  entity_id           UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  key                 TEXT NOT NULL,
  value               JSONB NOT NULL,
  version             INTEGER NOT NULL CHECK (version > 0),
  source              JSONB NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID NOT NULL,
  PRIMARY KEY (entity_id, key, version)
);

CREATE INDEX IF NOT EXISTS idx_entity_attributes_entity ON entity_attributes(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_attributes_key ON entity_attributes(key);
-- For "current attributes" queries we ride on (entity_id, key, version DESC).
CREATE INDEX IF NOT EXISTS idx_entity_attributes_current
  ON entity_attributes(entity_id, key, version DESC);

COMMENT ON TABLE entity_attributes IS
  'Versioned attributes for an entity. The CURRENT value is the row with MAX(version) per (entity_id, key); older rows retained for audit. Source envelope is required.';

-- ─────────────────────────────────────────────────────────────────────────
-- 4. entity_relations — typed edges.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS entity_relations (
  from_id             UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  type                TEXT NOT NULL,
  to_id               UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          UUID NOT NULL,
  PRIMARY KEY (from_id, type, to_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_relations_from ON entity_relations(from_id);
CREATE INDEX IF NOT EXISTS idx_entity_relations_to ON entity_relations(to_id);
CREATE INDEX IF NOT EXISTS idx_entity_relations_type ON entity_relations(type);

COMMENT ON TABLE entity_relations IS
  'Typed edges between entities. (from_id, type, to_id) is unique. metadata JSONB carries weights/labels/percentages.';

-- ─────────────────────────────────────────────────────────────────────────
-- 5. RLS — enable + FORCE + tenant-isolation policies.
--    Pattern matches migrations 0155, 0156, 0166.
--
--    For tenant-scope rows: tenant_id = current_app_tenant_id() OR the
--    caller is the service_role (which bypasses RLS by Supabase convention).
--
--    For platform-scope rows: tenant_id IS NULL. These rows are NOT readable
--    by `authenticated`; only the service_role + internal-admin path
--    (api-gateway middleware that sets `app.tenant_id` to the platform
--    sentinel) can touch them. Policy allows when tenant_id IS NULL AND
--    current_setting('app.platform_admin', TRUE) = 'true'.
-- ─────────────────────────────────────────────────────────────────────────

-- Helper: platform-admin reader (parallel to current_app_tenant_id).
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(current_setting('app.platform_admin', TRUE) = 'true', FALSE);
$$;

COMMENT ON FUNCTION public.is_platform_admin IS
  'Returns TRUE iff the api-gateway middleware set `app.platform_admin = true` for this transaction. Used by entity-store RLS to gate platform-scope reads/writes to the internal-admin role.';

-- ----- entities -----
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS entities_tenant_select ON entities;
DROP POLICY IF EXISTS entities_tenant_modify ON entities;
DROP POLICY IF EXISTS entities_platform_select ON entities;
DROP POLICY IF EXISTS entities_platform_modify ON entities;

-- Tenant-scoped read.
CREATE POLICY entities_tenant_select ON entities
  FOR SELECT
  TO authenticated
  USING (
    scope_owner_type = 'tenant'
    AND tenant_id = public.current_app_tenant_id()
  );

-- Tenant-scoped modify (INSERT / UPDATE / DELETE).
CREATE POLICY entities_tenant_modify ON entities
  FOR ALL
  TO authenticated
  USING (
    scope_owner_type = 'tenant'
    AND tenant_id = public.current_app_tenant_id()
  )
  WITH CHECK (
    scope_owner_type = 'tenant'
    AND tenant_id = public.current_app_tenant_id()
  );

-- Platform-scoped read (internal-admin only — `app.platform_admin = true`).
CREATE POLICY entities_platform_select ON entities
  FOR SELECT
  TO authenticated
  USING (
    scope_owner_type = 'platform'
    AND public.is_platform_admin()
  );

-- Platform-scoped modify (internal-admin only).
CREATE POLICY entities_platform_modify ON entities
  FOR ALL
  TO authenticated
  USING (
    scope_owner_type = 'platform'
    AND public.is_platform_admin()
  )
  WITH CHECK (
    scope_owner_type = 'platform'
    AND public.is_platform_admin()
  );

REVOKE ALL ON entities FROM anon;

-- ----- entity_attributes (gated by parent entity's scope) -----
ALTER TABLE entity_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_attributes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS entity_attributes_tenant_select ON entity_attributes;
DROP POLICY IF EXISTS entity_attributes_tenant_modify ON entity_attributes;
DROP POLICY IF EXISTS entity_attributes_platform_select ON entity_attributes;
DROP POLICY IF EXISTS entity_attributes_platform_modify ON entity_attributes;

CREATE POLICY entity_attributes_tenant_select ON entity_attributes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entities e
      WHERE e.id = entity_attributes.entity_id
        AND e.scope_owner_type = 'tenant'
        AND e.tenant_id = public.current_app_tenant_id()
    )
  );

CREATE POLICY entity_attributes_tenant_modify ON entity_attributes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entities e
      WHERE e.id = entity_attributes.entity_id
        AND e.scope_owner_type = 'tenant'
        AND e.tenant_id = public.current_app_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM entities e
      WHERE e.id = entity_attributes.entity_id
        AND e.scope_owner_type = 'tenant'
        AND e.tenant_id = public.current_app_tenant_id()
    )
  );

CREATE POLICY entity_attributes_platform_select ON entity_attributes
  FOR SELECT
  TO authenticated
  USING (
    public.is_platform_admin()
    AND EXISTS (
      SELECT 1 FROM entities e
      WHERE e.id = entity_attributes.entity_id
        AND e.scope_owner_type = 'platform'
    )
  );

CREATE POLICY entity_attributes_platform_modify ON entity_attributes
  FOR ALL
  TO authenticated
  USING (
    public.is_platform_admin()
    AND EXISTS (
      SELECT 1 FROM entities e
      WHERE e.id = entity_attributes.entity_id
        AND e.scope_owner_type = 'platform'
    )
  )
  WITH CHECK (
    public.is_platform_admin()
    AND EXISTS (
      SELECT 1 FROM entities e
      WHERE e.id = entity_attributes.entity_id
        AND e.scope_owner_type = 'platform'
    )
  );

REVOKE ALL ON entity_attributes FROM anon;

-- ----- entity_relations (gated by both endpoints' scope) -----
ALTER TABLE entity_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_relations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS entity_relations_tenant_select ON entity_relations;
DROP POLICY IF EXISTS entity_relations_tenant_modify ON entity_relations;
DROP POLICY IF EXISTS entity_relations_platform_select ON entity_relations;
DROP POLICY IF EXISTS entity_relations_platform_modify ON entity_relations;

-- Tenant can see edges where AT LEAST ONE endpoint is its tenant-scoped entity.
-- (Platform → tenant cross-scope edges remain visible to the owning tenant.)
CREATE POLICY entity_relations_tenant_select ON entity_relations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entities e
      WHERE (e.id = entity_relations.from_id OR e.id = entity_relations.to_id)
        AND e.scope_owner_type = 'tenant'
        AND e.tenant_id = public.current_app_tenant_id()
    )
  );

-- For modifications: BOTH endpoints must be in the caller's tenant (cross-
-- scope edges are created only via the service-role path).
CREATE POLICY entity_relations_tenant_modify ON entity_relations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entities e1
      WHERE e1.id = entity_relations.from_id
        AND e1.scope_owner_type = 'tenant'
        AND e1.tenant_id = public.current_app_tenant_id()
    )
    AND EXISTS (
      SELECT 1 FROM entities e2
      WHERE e2.id = entity_relations.to_id
        AND e2.scope_owner_type = 'tenant'
        AND e2.tenant_id = public.current_app_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM entities e1
      WHERE e1.id = entity_relations.from_id
        AND e1.scope_owner_type = 'tenant'
        AND e1.tenant_id = public.current_app_tenant_id()
    )
    AND EXISTS (
      SELECT 1 FROM entities e2
      WHERE e2.id = entity_relations.to_id
        AND e2.scope_owner_type = 'tenant'
        AND e2.tenant_id = public.current_app_tenant_id()
    )
  );

-- Platform-admin can see + modify any edge where BOTH endpoints are
-- platform-scope. Cross-scope edges (platform-customer-owner -[owns]->
-- tenant-property) are minted via service-role only.
CREATE POLICY entity_relations_platform_select ON entity_relations
  FOR SELECT
  TO authenticated
  USING (
    public.is_platform_admin()
    AND EXISTS (
      SELECT 1 FROM entities e1
      WHERE e1.id = entity_relations.from_id
        AND e1.scope_owner_type = 'platform'
    )
    AND EXISTS (
      SELECT 1 FROM entities e2
      WHERE e2.id = entity_relations.to_id
        AND e2.scope_owner_type = 'platform'
    )
  );

CREATE POLICY entity_relations_platform_modify ON entity_relations
  FOR ALL
  TO authenticated
  USING (
    public.is_platform_admin()
    AND EXISTS (
      SELECT 1 FROM entities e1
      WHERE e1.id = entity_relations.from_id
        AND e1.scope_owner_type = 'platform'
    )
    AND EXISTS (
      SELECT 1 FROM entities e2
      WHERE e2.id = entity_relations.to_id
        AND e2.scope_owner_type = 'platform'
    )
  )
  WITH CHECK (
    public.is_platform_admin()
    AND EXISTS (
      SELECT 1 FROM entities e1
      WHERE e1.id = entity_relations.from_id
        AND e1.scope_owner_type = 'platform'
    )
    AND EXISTS (
      SELECT 1 FROM entities e2
      WHERE e2.id = entity_relations.to_id
        AND e2.scope_owner_type = 'platform'
    )
  );

REVOKE ALL ON entity_relations FROM anon;

-- entity_types is platform-wide read; only service_role writes.
ALTER TABLE entity_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS entity_types_read ON entity_types;
CREATE POLICY entity_types_read ON entity_types
  FOR SELECT
  TO authenticated
  USING (TRUE);
REVOKE ALL ON entity_types FROM anon;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. BACKWARD-COMPAT VIEWS — legacy property/lease/maintenance tables
--    surfaced through the entity-store shape.
--
--    DECISION: read-only views (lighter-touch than INSTEAD-OF triggers).
--    Rationale:
--      - No write-amplification: legacy repositories keep writing to their
--        tables and only their tables. No risk of half-applied dual-writes.
--      - Instantly reversible: dropping a view is a no-op at the legacy
--        table layer. A trigger leaves DDL we'd need to roll back.
--      - Read-shape only: the MD can query "what employees exist in this
--        tenant?" and get a unified answer including legacy-table rows.
--        New entity-creation by the MD still flows through entities/
--        entity_attributes; legacy paths still flow through their tables.
--
--    Cut-over plan: CL-B3 (lease) and CL-B4 (maintenance) backfill the
--    legacy table contents into the entity-store, then we drop the legacy
--    tables and replace the views with direct queries.
-- ─────────────────────────────────────────────────────────────────────────

-- Properties → entity-store shape. Emits ONE row per property with the
-- core attributes flattened into the "current snapshot" projection.
CREATE OR REPLACE VIEW v_entities_property AS
SELECT
  p.id::text                                    AS id,
  'property'::text                              AS type,
  'tenant'::text                                AS scope_owner_type,
  p.tenant_id::text                             AS scope_owner_id,
  p.tenant_id::text                             AS tenant_id,
  COALESCE(p.created_by, p.owner_id)::text      AS created_by,
  p.created_at                                  AS created_at,
  jsonb_build_object(
    'manual', TRUE,
    'timestamp', to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'legacy_table', 'properties'
  )                                             AS source_provenance,
  CASE WHEN p.deleted_at IS NULL THEN NULL::timestamptz ELSE p.deleted_at END AS deleted_at,
  jsonb_build_object(
    'propertyCode', p.property_code,
    'name', p.name,
    'type', p.type::text,
    'status', p.status::text,
    'address', jsonb_build_object(
      'line1', p.address_line1,
      'line2', p.address_line2,
      'city', p.city,
      'state', p.state,
      'postalCode', p.postal_code,
      'country', p.country
    ),
    'totalUnits', p.total_units
  )                                             AS attributes_snapshot
FROM properties p;

COMMENT ON VIEW v_entities_property IS
  'Phase J1 backward-compat: legacy `properties` rows surfaced as entity-store snapshots. READ-ONLY. Writes continue to flow through PropertyRepository until CL-B3 cuts over.';

-- Leases → entity-store shape.
-- Column mapping: rent_amount → monthlyRent.amountMinor;
--                 rent_currency → monthlyRent.currency.
-- The DB still uses TEXT ids on legacy tables, so `id::text` is a no-op
-- here but harmless and explicit.
CREATE OR REPLACE VIEW v_entities_lease AS
SELECT
  l.id::text                                    AS id,
  'lease'::text                                 AS type,
  'tenant'::text                                AS scope_owner_type,
  l.tenant_id::text                             AS scope_owner_id,
  l.tenant_id::text                             AS tenant_id,
  COALESCE(l.created_by, '')::text              AS created_by,
  l.created_at                                  AS created_at,
  jsonb_build_object(
    'manual', TRUE,
    'timestamp', to_char(l.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'legacy_table', 'leases'
  )                                             AS source_provenance,
  CASE WHEN l.deleted_at IS NULL THEN NULL::timestamptz ELSE l.deleted_at END AS deleted_at,
  jsonb_build_object(
    'unitId', l.unit_id,
    'tenantPersonId', l.customer_id,
    'startDate', to_char(l.start_date, 'YYYY-MM-DD'),
    'endDate', CASE WHEN l.end_date IS NULL THEN NULL ELSE to_char(l.end_date, 'YYYY-MM-DD') END,
    'monthlyRent', jsonb_build_object(
      'amountMinor', l.rent_amount,
      'currency', l.rent_currency
    ),
    'status', l.status::text
  )                                             AS attributes_snapshot
FROM leases l;

COMMENT ON VIEW v_entities_lease IS
  'Phase J1 backward-compat: legacy `leases` rows surfaced as entity-store snapshots. READ-ONLY. Writes continue through LeaseRepository until CL-B3 cuts over.';

-- Maintenance requests → entity-store shape (as `ticket` type).
-- maintenance_requests has no direct `assignee` column; the assignment
-- lives on the linked work_order's vendor_id. We surface it via the LEFT
-- JOIN below so the view stays a true projection of the legacy row.
CREATE OR REPLACE VIEW v_entities_maintenance AS
SELECT
  m.id::text                                    AS id,
  'ticket'::text                                AS type,
  'tenant'::text                                AS scope_owner_type,
  m.tenant_id::text                             AS scope_owner_id,
  m.tenant_id::text                             AS tenant_id,
  COALESCE(m.created_by, '')::text              AS created_by,
  m.created_at                                  AS created_at,
  jsonb_build_object(
    'manual', TRUE,
    'timestamp', to_char(m.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'legacy_table', 'maintenance_requests'
  )                                             AS source_provenance,
  CASE WHEN m.deleted_at IS NULL THEN NULL::timestamptz ELSE m.deleted_at END AS deleted_at,
  jsonb_build_object(
    'subject', m.title,
    'description', m.description,
    'priority', m.priority::text,
    'status', m.status::text,
    'assignee', wo.vendor_id
  )                                             AS attributes_snapshot
FROM maintenance_requests m
LEFT JOIN work_orders wo ON wo.id = m.work_order_id;

COMMENT ON VIEW v_entities_maintenance IS
  'Phase J1 backward-compat: legacy `maintenance_requests` rows surfaced as entity-store snapshots (typed as `ticket`). READ-ONLY. Writes continue through MaintenanceRepository until CL-B4 cuts over.';

-- Unified VIEW that UNIONs the new entities table with the three backward-
-- compat views — the MD reads this when answering "what entities exist?"
-- without caring which world they live in.
--
-- Type-cast contract: entities uses UUID for id/tenant_id; legacy tables
-- use TEXT. The UNION normalises everything to TEXT so consumers see a
-- single schema. The deleted_at column is TIMESTAMPTZ in both worlds.
CREATE OR REPLACE VIEW v_entities_unified AS
SELECT
  e.id::text                                    AS id,
  e.type,
  e.scope_owner_type,
  e.scope_owner_id::text                        AS scope_owner_id,
  e.tenant_id::text                             AS tenant_id,
  e.created_by::text                            AS created_by,
  e.created_at,
  e.source_provenance,
  e.deleted_at,
  (
    SELECT jsonb_object_agg(a.key, a.value)
    FROM (
      SELECT DISTINCT ON (ea.key) ea.key, ea.value
      FROM entity_attributes ea
      WHERE ea.entity_id = e.id
      ORDER BY ea.key, ea.version DESC
    ) a
  )                                             AS attributes_snapshot
FROM entities e
UNION ALL
SELECT id, type, scope_owner_type, scope_owner_id, tenant_id, created_by, created_at, source_provenance, deleted_at, attributes_snapshot FROM v_entities_property
UNION ALL
SELECT id, type, scope_owner_type, scope_owner_id, tenant_id, created_by, created_at, source_provenance, deleted_at, attributes_snapshot FROM v_entities_lease
UNION ALL
SELECT id, type, scope_owner_type, scope_owner_id, tenant_id, created_by, created_at, source_provenance, deleted_at, attributes_snapshot FROM v_entities_maintenance;

COMMENT ON VIEW v_entities_unified IS
  'Phase J1: unified read-only window over the new entity-store + legacy property/lease/maintenance tables. The MD queries this when answering "what entities exist?" — single surface, two worlds.';
