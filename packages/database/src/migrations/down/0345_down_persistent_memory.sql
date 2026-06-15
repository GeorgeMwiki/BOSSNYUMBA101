-- =============================================================================
-- DOWN 0345 — drop persistent-memory + skill-library tables.
--
-- Reverses 0345_persistent_memory.sql. DEV/STAGING ONLY — dropping discards
-- Mr. Mwikila's temporal-continuity substrate (session memory, learned skills,
-- pending-thread checkpoints, thread summaries); after a down he regresses to
-- amnesiac in-memory-only continuity until the tables are re-created.
-- dataLoss: true.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS session_memory_tenant_isolation     ON session_memory;
DROP POLICY IF EXISTS session_memory_service_role_bypass  ON session_memory;
DROP POLICY IF EXISTS skills_tenant_isolation             ON skills;
DROP POLICY IF EXISTS skills_service_role_bypass          ON skills;
DROP POLICY IF EXISTS pending_threads_tenant_isolation    ON pending_threads;
DROP POLICY IF EXISTS pending_threads_service_role_bypass ON pending_threads;
DROP POLICY IF EXISTS thread_summaries_tenant_isolation   ON thread_summaries;
DROP POLICY IF EXISTS thread_summaries_service_role_bypass ON thread_summaries;

DROP TABLE IF EXISTS session_memory;
DROP TABLE IF EXISTS skills;
DROP TABLE IF EXISTS pending_threads;
DROP TABLE IF EXISTS thread_summaries;

COMMIT;
