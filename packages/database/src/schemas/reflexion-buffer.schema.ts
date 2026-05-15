/**
 * Reflexion buffer — Reflexion (Shinn et al., NeurIPS 2023) pattern.
 *
 * At session end the kernel writes a short verbal reflection
 * ("Last time I assumed Unit 4B but the user said 4F — ask before
 * fuzzy-matching") so the NEXT session for the same (tenant, user)
 * can read it and avoid the same failure mode.
 *
 * Pure prompt-layer memory — never touches model weights. Stored as
 * plain text; the kernel just injects the last N reflections into the
 * system prompt at session start.
 */

import {
  pgTable,
  text,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenant.schema.js';

export const reflexionBuffer = pgTable(
  'reflexion_buffer',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    sessionId: text('session_id').notNull(),
    /** The verbal reflection — capped at 4 000 chars by the writer. */
    reflection: text('reflection').notNull(),
    /** 'success' | 'failure' | 'mixed' */
    outcome: text('outcome').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Telemetry — bumped every time the retriever surfaces this row. */
    retrievedCount: integer('retrieved_count').notNull().default(0),
  },
  (t) => ({
    perUserTimeIdx: index('idx_reflexion_per_user').on(
      t.tenantId,
      t.userId,
      t.recordedAt,
    ),
  }),
);
