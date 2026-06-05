-- =============================================================================
-- 0252b: Resolve the `parcels` table-name COLLISION between the Muzima
--        spatial engine (0164d) and the Piece-N land-subdivision engine
--        (0253+) so the Piece-N parcel cluster can apply on a fresh DB.
--
-- ORDERING + TABLE-COLLISION FIX (fresh-DB blocker). No shipped fix-forward
-- exists for this collision — it is resolved here by renaming the earlier
-- (Muzima) table out of the way.
--
-- ─────────────────────────────────────────────────────────────────────
-- Problem
-- ─────────────────────────────────────────────────────────────────────
-- Two unrelated subsystems both create a table called `parcels`:
--
--   * 0164d_spatial_parcels.sql (Muzima v1) — polygon store with
--     `boundary geometry(MultiPolygon,4326)`, `centroid`, `h3_r10`, plus
--     child tables buildings / floors / parcel_units / rooms / elements.
--
--   * 0253_parcels.sql (Piece N) — land-subdivision tree with
--     `land_area_id`, `parent_parcel_id`, `boundary_polygon geography`,
--     `status`, `color_hex`, … and its own cluster 0254-0260 (parcel
--     metadata, evidence docs, marketplace listings, activity log, color
--     tags, indexes + a marketplace VIEW).
--
-- Because 0164d runs first, its `parcels` already exists when 0253 runs.
-- 0253's `CREATE TABLE IF NOT EXISTS parcels` therefore NO-OPS, and the
-- migration then aborts on
--
--     COMMENT ON COLUMN parcels.parent_parcel_id IS …
--     ERROR:  column "parent_parcel_id" of relation "parcels"
--             does not exist                                   (42703)
--
-- and even if that were skipped, 0254-0260 reference Piece-N-only columns
-- (`land_area_id`, `center_point`, `zoning`, …) that the Muzima `parcels`
-- does not have. The two shapes are fundamentally incompatible and cannot
-- share the name.
--
-- ─────────────────────────────────────────────────────────────────────
-- Fix strategy — rename the Muzima table, let Piece N own `parcels`
-- ─────────────────────────────────────────────────────────────────────
-- The Muzima `parcels` is referenced by NAME only inside 0164d itself
-- (its child tables' `… REFERENCES parcels(id)` FKs were created there and
-- bind by OID, so they survive a rename). NOTHING after 0164d FKs to the
-- Muzima `parcels` or its distinctive columns (verified). The Piece-N
-- cluster (0253-0260) — the newer subsystem, backed by dedicated
-- `packages/geo-parcels` + `services/parcel-service` code — needs to OWN
-- the `parcels` name.
--
-- So we rename the Muzima table `parcels` → `muzima_parcels`. Its child
-- FKs follow automatically (OID-based). 0253 then creates the Piece-N
-- `parcels` fresh, and 0254-0260 build on it cleanly.
--
-- DETECTION (so this only ever renames the MUZIMA table, never Piece-N's,
-- and is safe on Supabase + on already-migrated DBs):
--   * Only act if a `parcels` table exists AND it carries the Muzima
--     marker column `boundary` (Piece-N's column is `boundary_polygon`),
--     AND a `muzima_parcels` table does NOT already exist.
--   * If `parcels` is already the Piece-N shape (prior run), or
--     `muzima_parcels` already exists, this is a no-op.
--
-- NOTE: the Drizzle model `packages/database/src/schemas/parcels.schema.ts`
-- currently maps the *Muzima* shape (boundary/centroid) to `parcels`. After
-- this rename the app's Muzima mapping should point at `muzima_parcels`.
-- That application-layer reconciliation is OUT OF SCOPE for this DB-chain
-- hardening and is flagged separately; this migration only unblocks the
-- from-scratch SQL apply.
--
-- ─────────────────────────────────────────────────────────────────────
-- Idempotency / safety
-- ─────────────────────────────────────────────────────────────────────
-- Fully guarded by the detection above; safe to re-run and a no-op once
-- the rename has happened (or on a DB that never had the Muzima table).
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'parcels'
      )
     AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'parcels'
          AND column_name = 'boundary'        -- Muzima marker (Piece-N has boundary_polygon)
      )
     AND NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'muzima_parcels'
      )
  THEN
    ALTER TABLE public.parcels RENAME TO muzima_parcels;
    RAISE NOTICE '0252b: renamed Muzima spatial parcels -> muzima_parcels so Piece-N (0253) can create its own parcels.';
  ELSE
    RAISE NOTICE '0252b: no Muzima parcels to rename (already renamed, absent, or parcels is already the Piece-N shape) — no-op.';
  END IF;
END
$$;
