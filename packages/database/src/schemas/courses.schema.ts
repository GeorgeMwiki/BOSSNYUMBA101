/**
 * AI-generated courses schema (Wave COURSE-GEN, migration 0309).
 *
 * Backs the coworker create-course flow: an employee describes an
 * estate-management scenario, picks a domain, optionally attaches documents,
 * and the brain (or the deterministic catalog sequencer) generates a course.
 *
 * Companion to:
 *   - packages/database/src/migrations/0309_courses.sql
 *   - packages/ai-copilot/src/courses/ (generator + deterministic fallback)
 *   - services/api-gateway/src/routes/courses.hono.ts
 *   - apps/estate-manager-app/src/app/coworker/training/create-course/
 *
 * Three tables (all tenant-scoped, FORCE-RLS on
 * `app.current_tenant_id`):
 *   - courses           : one row per generated course; the validated
 *                         curriculum snapshot lives in `ai_generated_curriculum`
 *                         jsonb. A `draft` row with lesson_count 0 and no
 *                         generation_error is "still generating"; a `draft`
 *                         row WITH generation_error is "failed" (the status
 *                         CHECK has no dedicated failed value).
 *   - course_lessons    : normalised per-lesson rows for per-lesson progress.
 *   - course_documents  : the documents the learner attached as grounding.
 *
 * Owner scope: every row also carries `created_by_user_id` so the route can
 * defend-in-depth scope to the signed-in employee on top of tenant RLS (no
 * IDOR across coworkers).
 *
 * Multi-currency / locale (CLAUDE.md): no money columns here; `language` is the
 * single-locale marker ('en' | 'sw') so a course is never mixed-language.
 *
 * Ported from LitFin's borrower_courses / borrower_course_lessons /
 * borrower_course_documents and retargeted financial-literacy → estate
 * management (+ tenant scoping, which the single-tenant LitFin tables lacked).
 */

import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  uuid,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/** Course lifecycle. A failed generation stays `draft` + sets generationError. */
export const COURSE_STATUSES = ['draft', 'in_progress', 'completed'] as const;
export type CourseRowStatus = (typeof COURSE_STATUSES)[number];

export const COURSE_LESSON_STATUSES = [
  'not_started',
  'in_progress',
  'completed',
] as const;
export type CourseLessonRowStatus = (typeof COURSE_LESSON_STATUSES)[number];

export const COURSE_LANGUAGES = ['en', 'sw'] as const;
export const COURSE_DIFFICULTIES = [
  'beginner',
  'intermediate',
  'advanced',
] as const;

/** How the curriculum was produced — honest-degrade provenance. */
export const COURSE_GENERATION_SOURCES = ['llm', 'deterministic'] as const;
export type CourseGenerationSourceRow =
  (typeof COURSE_GENERATION_SOURCES)[number];

export const courses = pgTable(
  'courses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    /** Defence-in-depth owner scope on top of tenant RLS. */
    createdByUserId: uuid('created_by_user_id').notNull(),
    /** Selected domain id (see COURSE_DOMAINS in ai-copilot/courses). */
    domain: text('domain').notNull(),
    /** Learner's free-text scenario the course was tailored to. */
    scenarioDescription: text('scenario_description').notNull().default(''),
    status: text('status').notNull().default('draft'),
    difficulty: text('difficulty').notNull().default('beginner'),
    /** Single-locale marker; a course is never mixed EN/SW. */
    language: text('language').notNull().default('en'),
    /** Validated GeneratedCourse snapshot, or {} placeholder, or
     *  { generationError } marker. */
    aiGeneratedCurriculum: jsonb('ai_generated_curriculum')
      .notNull()
      .default({}),
    lessonCount: integer('lesson_count').notNull().default(0),
    /** 'llm' | 'deterministic' once generation settles; null while drafting. */
    generatedVia: text('generated_via'),
    /** Background-generation failure message (status stays 'draft'). */
    generationError: text('generation_error'),
    /** Document ids attached at kickoff (mirrors course_documents rows). */
    documentIds: jsonb('document_ids').notNull().default([]),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantOwnerIdx: index('courses_tenant_owner_created').on(
      table.tenantId,
      table.createdByUserId,
      table.createdAt,
    ),
    tenantStatusIdx: index('courses_tenant_status').on(
      table.tenantId,
      table.status,
    ),
  }),
);

export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;

export const courseLessons = pgTable(
  'course_lessons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    createdByUserId: uuid('created_by_user_id').notNull(),
    lessonNumber: integer('lesson_number').notNull(),
    lessonTitle: text('lesson_title').notNull().default(''),
    /** Full GeneratedLesson payload (objectives, content, quiz, takeaways). */
    lessonContent: jsonb('lesson_content').notNull().default({}),
    status: text('status').notNull().default('not_started'),
    /** 0..100 once the learner takes the quiz; null before. */
    quizScore: integer('quiz_score'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantCourseIdx: index('course_lessons_tenant_course').on(
      table.tenantId,
      table.courseId,
    ),
    courseLessonUq: uniqueIndex('course_lessons_course_number_uq').on(
      table.courseId,
      table.lessonNumber,
    ),
  }),
);

export type CourseLesson = typeof courseLessons.$inferSelect;
export type NewCourseLesson = typeof courseLessons.$inferInsert;

export const courseDocuments = pgTable(
  'course_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    createdByUserId: uuid('created_by_user_id').notNull(),
    documentId: text('document_id').notNull(),
    documentName: text('document_name').notNull().default(''),
    documentType: text('document_type').notNull().default(''),
    /** Extract the model may ground examples in (best-effort, non-fatal). */
    extractedData: jsonb('extracted_data').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantCourseIdx: index('course_documents_tenant_course').on(
      table.tenantId,
      table.courseId,
    ),
  }),
);

export type CourseDocument = typeof courseDocuments.$inferSelect;
export type NewCourseDocument = typeof courseDocuments.$inferInsert;
