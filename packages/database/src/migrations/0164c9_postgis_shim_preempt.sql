-- =============================================================================
-- 0164c9: PostGIS SHIM — let the spatial migrations apply on a PLAIN Postgres
--         (pgvector/pgvector:pg15) that has NO PostGIS extension.
--
-- ENVIRONMENT / ORDERING FIX (fresh-DB blocker). Mirrors the author's own
-- graceful-degradation intent in `0186_core_entity.sql` (which already
-- falls back from `geography(GEOMETRY,4326)` to JSONB when PostGIS is
-- absent), extended to the spatial migrations that DID NOT get that
-- treatment: 0164d, 0251, 0252, 0253, 0260.
--
-- ─────────────────────────────────────────────────────────────────────
-- Problem
-- ─────────────────────────────────────────────────────────────────────
-- Five migrations require PostGIS, but NONE of this repo's Postgres
-- images ship it:
--
--   docker-compose.yml             → pgvector/pgvector:pg15   (no PostGIS)
--   docker-compose.production.yml  → pgvector/pgvector:pg16   (no PostGIS)
--   docker-compose.prod.yml        → postgres:15-alpine       (no PostGIS)
--
-- `postgis` is not even in `pg_available_extensions` on these images (no
-- control file installed), so `CREATE EXTENSION postgis` cannot succeed
-- and the `geometry(...)` / `geography(...)` column types do not exist.
-- The spatial migrations therefore abort a from-scratch apply:
--
--   * 0164d_spatial_parcels.sql  — `geometry(MultiPolygon,4326)` columns +
--                                  `USING GIST(...)` indexes → 42704
--                                  "type geometry does not exist".
--   * 0251_postgis_install.sql   — bare `CREATE EXTENSION postgis;` plus a
--                                  `RAISE EXCEPTION` if it is still missing →
--                                  hard abort (no DO/EXCEPTION guard).
--   * 0252 / 0253                 — `geography(POLYGON|POINT,4326)` columns.
--   * 0260_parcel_indexes.sql     — `USING GIST(...)` on those columns.
--
-- (0186 already self-degrades to a JSONB column when PostGIS is absent, so
-- it is NOT a blocker and is intentionally left untouched here. 0023 only
-- mentions geometry in a comment.)
--
-- On Supabase / AWS RDS-15+ / Neon, PostGIS is built-in, so the spatial
-- migrations apply natively and THIS shim must do absolutely nothing.
--
-- ─────────────────────────────────────────────────────────────────────
-- Fix strategy — conditional, fully self-disabling on real PostGIS
-- ─────────────────────────────────────────────────────────────────────
-- IF real PostGIS is present → no-op (the entire body is gated).
--
-- ELSE, on a plain image, provide just enough of PostGIS's surface for the
-- spatial DDL to CREATE successfully (no spatial QUERIES run during
-- migration, only DDL):
--
--   1. `CREATE EXTENSION btree_gist` (present in the pgvector image). It
--      supplies the `gbt_bytea_*` GiST support procedures we reuse below.
--
--   2. Shim base types `public.geometry` and `public.geography`, each:
--        * bytea-backed (INPUT=byteain / OUTPUT=byteaout), so their on-disk
--          varlena layout is byte-identical to `bytea`; and
--        * fitted with a pure-SQL `TYPMOD_IN` that accepts (and discards)
--          PostGIS type-modifier syntax like `(MultiPolygon, 4326)` so
--          `geometry(MultiPolygon,4326)` column declarations parse.
--      They live in `public` (always on search_path) so the migrations'
--      UNQUALIFIED `geometry(...)` / `geography(...)` references resolve.
--
--   3. A DEFAULT GiST operator class for each shim type, reusing
--      btree_gist's `gbt_bytea_*` support functions (legal because the
--      shim storage is bytea-compatible). This lets `CREATE INDEX ...
--      USING GIST(col)` succeed on the shim columns. The index is never
--      queried during migration, so reusing the bytea operators is
--      sufficient and safe.
--
--   4. Record `0251_postgis_install` in the migration ledger so the
--      runner SKIPS it (its bare `CREATE EXTENSION postgis` + `RAISE
--      EXCEPTION` cannot succeed on a plain image and would abort the
--      run). The runner keys the skip on hash = filename-without-`.sql`
--      (see run-migrations.ts). On Supabase this branch never executes,
--      so 0251 runs natively and installs the real extension.
--
-- NET EFFECT: a plain Postgres reaches the final migration; spatial
-- columns exist as opaque bytea-backed placeholders and spatial indexes
-- exist as no-op GiST structures. Real spatial behaviour is unchanged on
-- any PostGIS-enabled deployment, where this file is inert.
--
-- ─────────────────────────────────────────────────────────────────────
-- Idempotency / safety
-- ─────────────────────────────────────────────────────────────────────
--   * The whole body is gated on `postgis` being ABSENT, then each object
--     is created only IF NOT EXISTS (types via catalog guard, opclass via
--     catalog guard, ledger insert via NOT EXISTS). Safe to re-run.
--   * If a real PostGIS is installed LATER, the operator would drop these
--     shim types first (they are bytea placeholders holding no real
--     geometry); this file never blocks that because it self-skips once
--     `pg_extension` shows postgis.
-- =============================================================================

DO $$
DECLARE
  has_postgis boolean := EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'postgis'
  );
BEGIN
  -- On any PostGIS-enabled DB (Supabase / RDS / Neon) do nothing at all.
  IF has_postgis THEN
    RAISE NOTICE '0164c9: PostGIS present — shim skipped (native geometry/geography in use).';
    RETURN;
  END IF;

  RAISE NOTICE '0164c9: PostGIS absent — installing bytea-backed geometry/geography shim for plain Postgres.';

  -- 1. btree_gist supplies the gbt_bytea_* GiST support procs we reuse.
  CREATE EXTENSION IF NOT EXISTS btree_gist;

  -- ---------------------------------------------------------------------
  -- 2a. Shim `public.geometry`
  -- ---------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'geometry' AND n.nspname = 'public'
  ) THEN
    -- shell first so the I/O functions can reference the type
    EXECUTE 'CREATE TYPE public.geometry';

    -- pure-SQL TYPMOD_IN: accept any (…) modifier and collapse it to 0.
    EXECUTE $fn$
      CREATE FUNCTION public.geometry_typmod_in(cstring[])
        RETURNS integer LANGUAGE sql IMMUTABLE STRICT
        AS 'SELECT 0';
    $fn$;

    EXECUTE $fn$
      CREATE FUNCTION public.geometry_in(cstring)
        RETURNS public.geometry LANGUAGE internal IMMUTABLE STRICT
        AS 'byteain';
    $fn$;
    EXECUTE $fn$
      CREATE FUNCTION public.geometry_out(public.geometry)
        RETURNS cstring LANGUAGE internal IMMUTABLE STRICT
        AS 'byteaout';
    $fn$;

    EXECUTE $fn$
      CREATE TYPE public.geometry (
        INPUT          = public.geometry_in,
        OUTPUT         = public.geometry_out,
        TYPMOD_IN      = public.geometry_typmod_in,
        INTERNALLENGTH = VARIABLE,
        STORAGE        = extended,
        ALIGNMENT      = int4
      );
    $fn$;

    COMMENT ON TYPE public.geometry IS
      '0164c9 SHIM (plain-Postgres only) — opaque bytea-backed placeholder '
      'so PostGIS geometry(...) column DDL applies without the postgis '
      'extension. Replaced by the real PostGIS type on any geo-enabled '
      'deployment, where this shim never installs.';
  END IF;

  -- ---------------------------------------------------------------------
  -- 2b. Shim `public.geography`
  -- ---------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'geography' AND n.nspname = 'public'
  ) THEN
    EXECUTE 'CREATE TYPE public.geography';

    EXECUTE $fn$
      CREATE FUNCTION public.geography_typmod_in(cstring[])
        RETURNS integer LANGUAGE sql IMMUTABLE STRICT
        AS 'SELECT 0';
    $fn$;
    EXECUTE $fn$
      CREATE FUNCTION public.geography_in(cstring)
        RETURNS public.geography LANGUAGE internal IMMUTABLE STRICT
        AS 'byteain';
    $fn$;
    EXECUTE $fn$
      CREATE FUNCTION public.geography_out(public.geography)
        RETURNS cstring LANGUAGE internal IMMUTABLE STRICT
        AS 'byteaout';
    $fn$;

    EXECUTE $fn$
      CREATE TYPE public.geography (
        INPUT          = public.geography_in,
        OUTPUT         = public.geography_out,
        TYPMOD_IN      = public.geography_typmod_in,
        INTERNALLENGTH = VARIABLE,
        STORAGE        = extended,
        ALIGNMENT      = int4
      );
    $fn$;

    COMMENT ON TYPE public.geography IS
      '0164c9 SHIM (plain-Postgres only) — opaque bytea-backed placeholder '
      'so PostGIS geography(...) column DDL applies without the postgis '
      'extension. Replaced by the real PostGIS type on any geo-enabled '
      'deployment, where this shim never installs.';
  END IF;

  -- ---------------------------------------------------------------------
  -- 3. Default GiST operator classes (reuse gbt_bytea_* from btree_gist).
  --    Lets `CREATE INDEX ... USING GIST(geomcol)` succeed. Guarded so a
  --    re-run does not attempt a duplicate DEFAULT opclass.
  -- ---------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM pg_opclass oc
    JOIN pg_am am ON am.oid = oc.opcmethod
    WHERE am.amname = 'gist' AND oc.opcintype = 'public.geometry'::regtype
  ) THEN
    EXECUTE $ddl$
      CREATE OPERATOR CLASS public.geometry_gist_ops
        DEFAULT FOR TYPE public.geometry USING gist AS
        FUNCTION 1 (public.geometry, public.geometry)
          gbt_bytea_consistent(internal,bytea,smallint,oid,internal),
        FUNCTION 2 gbt_bytea_union(internal,internal),
        FUNCTION 3 gbt_bytea_compress(internal),
        FUNCTION 4 gbt_var_decompress(internal),
        FUNCTION 5 gbt_bytea_penalty(internal,internal,internal),
        FUNCTION 6 gbt_bytea_picksplit(internal,internal),
        FUNCTION 7 gbt_bytea_same(gbtreekey_var,gbtreekey_var,internal),
        STORAGE gbtreekey_var;
    $ddl$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_opclass oc
    JOIN pg_am am ON am.oid = oc.opcmethod
    WHERE am.amname = 'gist' AND oc.opcintype = 'public.geography'::regtype
  ) THEN
    EXECUTE $ddl$
      CREATE OPERATOR CLASS public.geography_gist_ops
        DEFAULT FOR TYPE public.geography USING gist AS
        FUNCTION 1 (public.geography, public.geography)
          gbt_bytea_consistent(internal,bytea,smallint,oid,internal),
        FUNCTION 2 gbt_bytea_union(internal,internal),
        FUNCTION 3 gbt_bytea_compress(internal),
        FUNCTION 4 gbt_var_decompress(internal),
        FUNCTION 5 gbt_bytea_penalty(internal,internal,internal),
        FUNCTION 6 gbt_bytea_picksplit(internal,internal),
        FUNCTION 7 gbt_bytea_same(gbtreekey_var,gbtreekey_var,internal),
        STORAGE gbtreekey_var;
    $ddl$;
  END IF;

  -- ---------------------------------------------------------------------
  -- 4. Skip 0251 (bare CREATE EXTENSION postgis + RAISE EXCEPTION) on this
  --    plain image. On Supabase this branch is unreached, so 0251 runs.
  -- ---------------------------------------------------------------------
  INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
  SELECT '0251_postgis_install', (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
  WHERE NOT EXISTS (
    SELECT 1 FROM drizzle.__drizzle_migrations
    WHERE hash = '0251_postgis_install'
  );
END
$$;
