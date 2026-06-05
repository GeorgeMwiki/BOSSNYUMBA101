-- =============================================================================
-- Down-migration 0307 - reverse owner-style learned communication profile.
--
-- Dev/staging only. Dropping this table loses every owner's learned
-- communication style (verbosity / detail / language / formality / posture)
-- and its Dirichlet posterior. The profile is rebuildable from subsequent
-- chat turns (the feedback loop re-learns from a neutral default), so loss is
-- recoverable over time but costs the owner their personalised voice until it
-- re-converges.
--
-- Reverses migration 0307_owner_style_profiles.sql.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS owner_style_profiles_tenant_isolation
  ON owner_style_profiles;

DROP INDEX IF EXISTS owner_style_profiles_tenant_updated;

DROP TABLE IF EXISTS owner_style_profiles;

COMMIT;
