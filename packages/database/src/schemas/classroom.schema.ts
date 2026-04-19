/**
 * AI Classroom schema (Wave 11).
 *
 * Drizzle definitions that mirror `0045_ai_classroom.sql`.
 */

import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  doublePrecision,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenant.schema.js';

export const classroomSessions = pgTable(
  'classroom_sessions',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    createdBy: text('created_by').notNull(),
    state: text('state').notNull().default('idle'),
    language: text('language').notNull().default('mixed'),
    targetConceptIds: jsonb('target_concept_ids').notNull().default([]),
    coveredConceptIds: jsonb('covered_concept_ids').notNull().default([]),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (t) => ({
    tenantIdx: index('idx_classroom_sessions_tenant').on(
      t.tenantId,
      t.createdAt
    ),
  })
);

export const classroomParticipants = pgTable(
  'classroom_participants',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => classroomSessions.id, { onDelete: 'cascade' }),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    displayName: text('display_name').notNull(),
    role: text('role').notNull().default('learner'),
    isPresent: boolean('is_present').notNull().default(true),
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    leftAt: timestamp('left_at', { withTimezone: true }),
    correctAnswers: integer('correct_answers').notNull().default(0),
    totalAnswers: integer('total_answers').notNull().default(0),
    lastAnswerAt: timestamp('last_answer_at', { withTimezone: true }),
    metadata: jsonb('metadata').notNull().default({}),
  },
  (t) => ({
    tenantIdx: index('idx_classroom_participants_tenant').on(t.tenantId),
    userIdx: index('idx_classroom_participants_user').on(t.tenantId, t.userId),
    sessionUserUniq: uniqueIndex('uniq_classroom_participants_session_user').on(
      t.sessionId,
      t.userId
    ),
  })
);

export const classroomQuizzes = pgTable(
  'classroom_quizzes',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => classroomSessions.id, { onDelete: 'cascade' }),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    conceptId: text('concept_id').notNull(),
    questionText: text('question_text').notNull(),
    choices: jsonb('choices').notNull().default([]),
    correctIndex: integer('correct_index'),
    rationale: text('rationale'),
    difficulty: text('difficulty').notNull().default('medium'),
    bloomLevel: text('bloom_level').notNull().default('apply'),
    language: text('language').notNull().default('en'),
    generatedBy: text('generated_by'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    sessionIdx: index('idx_classroom_quizzes_session').on(
      t.tenantId,
      t.sessionId,
      t.createdAt
    ),
  })
);

export const classroomQuizResponses = pgTable(
  'classroom_quiz_responses',
  {
    id: text('id').primaryKey(),
    quizId: text('quiz_id')
      .notNull()
      .references(() => classroomQuizzes.id, { onDelete: 'cascade' }),
    sessionId: text('session_id')
      .notNull()
      .references(() => classroomSessions.id, { onDelete: 'cascade' }),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    conceptId: text('concept_id').notNull(),
    answerText: text('answer_text'),
    answerIndex: integer('answer_index'),
    isCorrect: boolean('is_correct').notNull(),
    latencyMs: integer('latency_ms'),
    answeredAt: timestamp('answered_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    sessionIdx: index('idx_classroom_quiz_responses_session').on(
      t.tenantId,
      t.sessionId,
      t.answeredAt
    ),
    userIdx: index('idx_classroom_quiz_responses_user').on(
      t.tenantId,
      t.userId,
      t.conceptId
    ),
  })
);

export const bktMastery = pgTable(
  'bkt_mastery',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    conceptId: text('concept_id').notNull(),
    pKnow: doublePrecision('p_know').notNull().default(0.1),
    pLearn: doublePrecision('p_learn').notNull().default(0.2),
    pSlip: doublePrecision('p_slip').notNull().default(0.1),
    pGuess: doublePrecision('p_guess').notNull().default(0.2),
    observations: integer('observations').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userConceptIdx: index('idx_bkt_mastery_user_concept').on(
      t.tenantId,
      t.userId,
      t.conceptId
    ),
    tenantConceptIdx: index('idx_bkt_mastery_tenant_concept').on(
      t.tenantId,
      t.conceptId
    ),
    uniqueUserConcept: uniqueIndex('uniq_bkt_mastery_user_concept').on(
      t.tenantId,
      t.userId,
      t.conceptId
    ),
  })
);
