-- =============================================================================
-- 0186b: Pre-empt `0187_entity_type_definition.sql`, which is UNPARSEABLE.
--
-- ORDERING + UNPARSEABLE-FILE FIX (fresh-DB blocker). Mirrors §1 of the
-- shipped fix-forward `0216_fix_entity_type_def_and_piecek_unify.sql`,
-- hoisted to run BEFORE 0187.
--
-- ─────────────────────────────────────────────────────────────────────
-- Problem
-- ─────────────────────────────────────────────────────────────────────
-- 0187 declares:
--
--     CREATE TABLE IF NOT EXISTS entity_type_definition (
--       slug TEXT NOT NULL,
--       tenant_id TEXT ...,
--       ...
--       PRIMARY KEY (slug, COALESCE(tenant_id, ''))      -- line 53
--     );
--
-- PostgreSQL forbids function calls / expressions in a PRIMARY KEY (or
-- UNIQUE constraint) column list — they are only legal in a UNIQUE INDEX
-- expression. So the statement fails to PARSE:
--
--     ERROR:  syntax error at or near "("   (SQLSTATE 42601)
--     -- at the `(` of COALESCE(...) on line 53.
--
-- As with 0160, this is a PARSE-time error inside an immutable file, so it
-- cannot be sidestepped by pre-creating the table (CREATE TABLE IF NOT
-- EXISTS is parsed before the existence check). 0187's own follow-on
-- DO-blocks (which DROP the bogus PK and add a surrogate `id` PK) never
-- run because the file dies on line 53.
--
-- The repo SHIPS `0216_fix_entity_type_def_and_piecek_unify.sql` §1 as the
-- forward-fix: it creates `entity_type_definition` with a proper surrogate
-- `id` PRIMARY KEY + a `COALESCE`-based UNIQUE INDEX (legal there), RLS,
-- grants, and the 17 platform built-in seed rows. But 0216 sorts ~30
-- migrations AFTER 0187, so on a fresh DB the run dies at 0187 first.
--
-- ─────────────────────────────────────────────────────────────────────
-- Fix strategy
-- ─────────────────────────────────────────────────────────────────────
--   1. Create `entity_type_definition` exactly as 0216 §1 does (correct
--      PK, unique index, RLS, grants, 17 seeds). Nothing between 0187 and
--      0216 references this table other than 0216 itself, so this single
--      pre-creation satisfies the whole window.
--   2. Record `0187_entity_type_definition` in the ledger so the runner
--      SKIPS its unparseable body (runner keys skip on hash = filename
--      without `.sql`).
--
-- When 0216 runs later, its §1 `CREATE TABLE IF NOT EXISTS` + `ON CONFLICT
-- (id) DO NOTHING` seeds are perfect no-ops, and §2 (the core_entity →
-- entity_type_definition FK) + §3-4 (Piece K documents) run normally.
--
-- 0187 ALSO created a `core_entity_type_check()` BEFORE-INSERT trigger on
-- `core_entity`. That trigger is referenced by NOTHING else in the tree
-- (verified), and 0216 §2 installs a real FK constraint instead — a
-- strictly stronger guarantee — so dropping the trigger by skipping 0187
-- is safe and intentional.
--
-- ─────────────────────────────────────────────────────────────────────
-- Idempotency / safety
-- ─────────────────────────────────────────────────────────────────────
--   * CREATE TABLE / INDEX ... IF NOT EXISTS; policies DROP-then-CREATE;
--     seeds ON CONFLICT (id) DO NOTHING; ledger insert NOT-EXISTS guarded.
--     Safe to re-run and a no-op on a DB where 0216 already built this.
--   * On a real Supabase apply the rows land here first; 0216 later finds
--     them present and is inert for §1. Behaviour is identical.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. entity_type_definition — correct shape (mirror of 0216 §1).
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS entity_type_definition (
  id                    text PRIMARY KEY,
  slug                  text NOT NULL,
  tenant_id             text REFERENCES tenants(id) ON DELETE CASCADE,
  display_name_en       text NOT NULL,
  display_name_sw       text,
  description           text,
  is_built_in           boolean NOT NULL DEFAULT false,
  allowed_parent_types  text[],
  icon                  text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS entity_type_definition_slug_tenant_uniq
  ON entity_type_definition (slug, COALESCE(tenant_id, '__platform__'));

CREATE INDEX IF NOT EXISTS entity_type_definition_tenant_idx
  ON entity_type_definition (tenant_id) WHERE tenant_id IS NOT NULL;

-- Standalone UNIQUE(slug) so the FK that 0216 §2 adds later —
-- `core_entity.entity_type REFERENCES entity_type_definition(slug)` —
-- can resolve. Postgres requires a UNIQUE/PK on the *referenced column set*,
-- and the composite expression index above does NOT satisfy a single-column
-- FK target. 0216 §2 is otherwise unconditionally broken on a fresh DB
-- (`42830 no unique constraint matching given keys`) regardless of these
-- preempts. The 17 seeded built-ins all carry distinct slugs and NO later
-- migration inserts another row (verified), so global slug-uniqueness holds.
-- Added via guarded ALTER (ADD CONSTRAINT is not IF-NOT-EXISTS-able pre-15).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'entity_type_definition_slug_key'
      AND conrelid = 'public.entity_type_definition'::regclass
  ) THEN
    ALTER TABLE public.entity_type_definition
      ADD CONSTRAINT entity_type_definition_slug_key UNIQUE (slug);
  END IF;
END
$$;

ALTER TABLE entity_type_definition ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_type_definition FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS entity_type_definition_select ON entity_type_definition;
CREATE POLICY entity_type_definition_select
  ON entity_type_definition FOR SELECT
  USING (
    tenant_id IS NULL
    OR tenant_id = current_setting('app.current_tenant_id', true)
  );

DROP POLICY IF EXISTS entity_type_definition_modify ON entity_type_definition;
CREATE POLICY entity_type_definition_modify
  ON entity_type_definition FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

REVOKE ALL ON entity_type_definition FROM anon;
GRANT SELECT ON entity_type_definition TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON entity_type_definition TO service_role;

-- Seed 17 built-in entity types (verbatim from 0216 §1).
INSERT INTO entity_type_definition (id, slug, is_built_in, display_name_en, display_name_sw, description, allowed_parent_types, icon)
VALUES
  ('et_land_parcel',  'LAND_PARCEL',  true, 'Land Parcel',          'Kipande cha Ardhi',     'Tract of land, surveyed or unsurveyed',                ARRAY['LAND_PARCEL']::text[],                       'map'),
  ('et_building',     'BUILDING',     true, 'Building',             'Jengo',                 'Built structure (warehouse, hotel, office, etc.)',     ARRAY['LAND_PARCEL']::text[],                       'building'),
  ('et_sub_unit',     'SUB_UNIT',     true, 'Sub-Unit',             'Chumba Cha Kupanga',   'Subdivision of a building or land parcel',             ARRAY['BUILDING','LAND_PARCEL','SUB_UNIT']::text[], 'door-open'),
  ('et_warehouse',    'WAREHOUSE',    true, 'Warehouse',            'Ghala',                 'Storage warehouse',                                    ARRAY['LAND_PARCEL','BUILDING']::text[],            'package'),
  ('et_godown',       'GODOWN',       true, 'Godown',               'Banda La Akiba',       'Open or covered storage area',                         ARRAY['LAND_PARCEL','BUILDING']::text[],            'truck'),
  ('et_hotel',        'HOTEL',        true, 'Hotel',                'Hoteli',                'Hotel or lodging operation',                           ARRAY['LAND_PARCEL','BUILDING']::text[],            'bed'),
  ('et_plot',         'PLOT',         true, 'Plot',                 'Kiwanja',               'Individual plot of land',                              ARRAY['LAND_PARCEL']::text[],                       'grid'),
  ('et_bareland',     'BARELAND',     true, 'Bareland',             'Ardhi Wazi',           'Undeveloped land',                                     ARRAY['LAND_PARCEL']::text[],                       'mountain'),
  ('et_vehicle',      'VEHICLE',      true, 'Vehicle',              'Gari',                  'Road vehicle (car, truck, etc.)',                      NULL,                                                'car'),
  ('et_locomotive',   'LOCOMOTIVE',   true, 'Locomotive',           'Locomoti',              'Rail locomotive',                                      NULL,                                                'train'),
  ('et_machinery',    'MACHINERY',    true, 'Machinery',            'Mashine',               'Heavy machinery / equipment',                          NULL,                                                'cog'),
  ('et_it_asset',     'IT_ASSET',     true, 'IT Asset',             'Mali Ya IT',           'Computer, server, network device, mobile',             NULL,                                                'monitor'),
  ('et_intangible',   'INTANGIBLE',   true, 'Intangible Asset',     'Mali Isiyo Halisi',    'License, trademark, contract right',                   NULL,                                                'file-text'),
  ('et_person',       'PERSON',       true, 'Person',               'Mtu',                   'Individual (employee, customer, vendor contact)',      NULL,                                                'user'),
  ('et_org_unit',     'ORG_UNIT',     true, 'Organizational Unit',  'Kitengo Cha Shirika',  'Department, district, region within a tenant',         ARRAY['ORG_UNIT']::text[],                          'sitemap'),
  ('et_vendor',       'VENDOR',       true, 'Vendor',               'Mzabuni',               'External vendor or contractor',                        NULL,                                                'briefcase'),
  ('et_contract',     'CONTRACT',     true, 'Contract',             'Mkataba',               'Formal contract',                                      NULL,                                                'file-signature')
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE  entity_type_definition IS 'Piece A — polymorphic entity type catalog. Platform built-ins (tenant_id NULL) + tenant-defined types. Pre-created by 0186b (mirror of 0216 §1) so the unparseable 0187 can be skipped on a fresh DB.';
COMMENT ON COLUMN entity_type_definition.slug IS 'Stable slug used by core_entity.entity_type FK reference.';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Skip the unparseable 0187 (its correct end-state is built above and,
--    later, re-asserted idempotently by 0216).
-- ─────────────────────────────────────────────────────────────────────────

INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT '0187_entity_type_definition', (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations
  WHERE hash = '0187_entity_type_definition'
);
