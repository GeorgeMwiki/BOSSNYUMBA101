-- =============================================================================
-- Down-migration 0309 - reverse AI-generated courses.
--
-- Dev/staging only. Dropping these tables loses every generated course, its
-- normalised lessons, and the attached-document join rows. Generated courses
-- are rebuildable from the same domain + scenario inputs, but learner quiz
-- progress (course_lessons.quiz_score / status / completed_at) is lost.
--
-- Reverses migration 0309_courses.sql. Children (course_lessons,
-- course_documents) FK-cascade off courses; drop them first regardless.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS course_documents_tenant_isolation ON course_documents;
DROP POLICY IF EXISTS course_lessons_tenant_isolation   ON course_lessons;
DROP POLICY IF EXISTS courses_tenant_isolation          ON courses;

DROP INDEX IF EXISTS course_documents_tenant_course;
DROP INDEX IF EXISTS course_lessons_tenant_course;
DROP INDEX IF EXISTS courses_tenant_status;
DROP INDEX IF EXISTS courses_tenant_owner_created;

DROP TABLE IF EXISTS course_documents;
DROP TABLE IF EXISTS course_lessons;
DROP TABLE IF EXISTS courses;

COMMIT;
