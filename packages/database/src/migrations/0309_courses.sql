-- =============================================================================
-- Migration 0309 - AI-generated courses (coworker create-course flow).
--
-- Wave COURSE-GEN. Ported from LitFin's borrower learning-generator and
-- retargeted financial-literacy -> estate management. An employee describes a
-- scenario, picks a domain (rent affordability / tenancy law / compliance /
-- repairs / portfolio ops / investment strategy), optionally attaches
-- documents, and the brain (or the deterministic ESTATE_CONCEPTS sequencer)
-- generates a 5-to-8 lesson course.
--
-- Tables:
--   * courses            - one row per generated course. The validated
--                          curriculum snapshot lives in
--                          ai_generated_curriculum jsonb. A `draft` row with
--                          lesson_count 0 and NULL generation_error is "still
--                          generating"; a `draft` row WITH generation_error is
--                          "failed" (the status CHECK has no failed value).
--   * course_lessons     - normalised per-lesson rows for per-lesson progress.
--   * course_documents   - the documents the learner attached as grounding.
--
-- Tenant scope (CLAUDE.md hard rule): FORCE row-level security on
--   tenant_id::text = current_setting('app.current_tenant_id', true)
-- bound by the api-gateway database middleware. Every row also carries
-- created_by_user_id so the route can defend-in-depth scope to the signed-in
-- employee (no IDOR across coworkers).
--
-- Honest-degrade (CLAUDE.md spirit): generated_via records whether the brain
-- ('llm') or the deterministic catalog sequencer ('deterministic') produced the
-- curriculum, so the UI can be transparent. Content is never silently
-- fabricated.
--
-- IDEMPOTENT + FORWARD-ONLY (CLAUDE.md hard rule: migrations are immutable).
-- Every object uses IF NOT EXISTS / guarded DO-blocks so a fresh DB and a
-- re-run both converge. References ONLY already-shipped objects (no cross-
-- migration FK is added beyond the in-file course_id FK), so this file never
-- depends on a later migration.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- courses
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS courses (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid        NOT NULL,
  created_by_user_id       uuid        NOT NULL,
  domain                   text        NOT NULL,
  scenario_description     text        NOT NULL DEFAULT '',
  status                   text        NOT NULL DEFAULT 'draft',
  difficulty               text        NOT NULL DEFAULT 'beginner',
  language                 text        NOT NULL DEFAULT 'en',
  ai_generated_curriculum  jsonb       NOT NULL DEFAULT '{}'::jsonb,
  lesson_count             integer     NOT NULL DEFAULT 0,
  generated_via            text,
  generation_error         text,
  document_ids             jsonb       NOT NULL DEFAULT '[]'::jsonb,
  completed_at             timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'courses_status_chk'
  ) THEN
    ALTER TABLE courses
      ADD CONSTRAINT courses_status_chk
      CHECK (status IN ('draft', 'in_progress', 'completed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'courses_difficulty_chk'
  ) THEN
    ALTER TABLE courses
      ADD CONSTRAINT courses_difficulty_chk
      CHECK (difficulty IN ('beginner', 'intermediate', 'advanced'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'courses_language_chk'
  ) THEN
    ALTER TABLE courses
      ADD CONSTRAINT courses_language_chk
      CHECK (language IN ('en', 'sw'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'courses_generated_via_chk'
  ) THEN
    ALTER TABLE courses
      ADD CONSTRAINT courses_generated_via_chk
      CHECK (generated_via IS NULL OR generated_via IN ('llm', 'deterministic'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'courses_lesson_count_chk'
  ) THEN
    ALTER TABLE courses
      ADD CONSTRAINT courses_lesson_count_chk
      CHECK (lesson_count >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS courses_tenant_owner_created
  ON courses (tenant_id, created_by_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS courses_tenant_status
  ON courses (tenant_id, status);

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses FORCE  ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'courses'
       AND policyname = 'courses_tenant_isolation'
  ) THEN
    CREATE POLICY courses_tenant_isolation
      ON courses
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- course_lessons
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS course_lessons (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL,
  course_id           uuid        NOT NULL
                        REFERENCES courses(id) ON DELETE CASCADE,
  created_by_user_id  uuid        NOT NULL,
  lesson_number       integer     NOT NULL,
  lesson_title        text        NOT NULL DEFAULT '',
  lesson_content      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  status              text        NOT NULL DEFAULT 'not_started',
  quiz_score          integer,
  completed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'course_lessons_status_chk'
  ) THEN
    ALTER TABLE course_lessons
      ADD CONSTRAINT course_lessons_status_chk
      CHECK (status IN ('not_started', 'in_progress', 'completed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'course_lessons_quiz_score_chk'
  ) THEN
    ALTER TABLE course_lessons
      ADD CONSTRAINT course_lessons_quiz_score_chk
      CHECK (quiz_score IS NULL OR (quiz_score >= 0 AND quiz_score <= 100));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'course_lessons_course_number_uq'
  ) THEN
    ALTER TABLE course_lessons
      ADD CONSTRAINT course_lessons_course_number_uq
      UNIQUE (course_id, lesson_number);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS course_lessons_tenant_course
  ON course_lessons (tenant_id, course_id);

ALTER TABLE course_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_lessons FORCE  ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'course_lessons'
       AND policyname = 'course_lessons_tenant_isolation'
  ) THEN
    CREATE POLICY course_lessons_tenant_isolation
      ON course_lessons
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- course_documents
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS course_documents (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL,
  course_id           uuid        NOT NULL
                        REFERENCES courses(id) ON DELETE CASCADE,
  created_by_user_id  uuid        NOT NULL,
  document_id         text        NOT NULL,
  document_name       text        NOT NULL DEFAULT '',
  document_type       text        NOT NULL DEFAULT '',
  extracted_data      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS course_documents_tenant_course
  ON course_documents (tenant_id, course_id);

ALTER TABLE course_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_documents FORCE  ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'course_documents'
       AND policyname = 'course_documents_tenant_isolation'
  ) THEN
    CREATE POLICY course_documents_tenant_isolation
      ON course_documents
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));
  END IF;
END $$;

COMMIT;
