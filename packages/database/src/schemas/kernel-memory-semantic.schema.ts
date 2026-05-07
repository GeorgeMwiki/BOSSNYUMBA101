/**
 * Kernel memory — semantic store.
 *
 * Extracted facts: "User prefers Swahili greetings." "Property P-12 has
 * 3 vacant units." Has a confidence score (0..1), an optional TTL
 * (default never), the source-turn id that produced the fact, an
 * evidence_count for confirmation tracking, and a `source` channel that
 * records whether the fact was extracted automatically, declared by the
 * user, or written by the consolidation cycle.
 *
 * Per-(tenant, user) AND per-tenant variants share the same table:
 * tenant-scope facts have user_id = NULL.
 *
 * The composite uniqueness on (tenant_id, user_id, key) is enforced
 * with a partial-index pair (because Postgres treats NULLs as distinct
 * inside UNIQUE INDEX), so upserts can safely "on conflict" bump
 * evidence_count + last_seen_at + value.
 */

import {
  pgTable,
  text,
  jsonb,
  timestamp,
  integer,
  real,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenant.schema.js';

export const kernelMemorySemanticSourceEnum = pgEnum(
  'kernel_memory_semantic_source',
  ['extracted', 'declared', 'consolidated'],
);

export const kernelMemorySemantic = pgTable(
  'kernel_memory_semantic',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').references(() => tenants.id, {
      onDelete: 'cascade',
    }),
    /** Null for tenant-scope facts ("our office is in Dar es Salaam"). */
    userId: text('user_id'),
    key: text('key').notNull(),
    value: jsonb('value').notNull(),
    confidence: real('confidence').notNull().default(0.5),
    sourceTurnId: text('source_turn_id'),
    evidenceCount: integer('evidence_count').notNull().default(1),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    source: kernelMemorySemanticSourceEnum('source')
      .notNull()
      .default('extracted'),
  },
  (t) => ({
    tenantUserKeyUserIdx: uniqueIndex(
      'uniq_kernel_mem_semantic_tenant_user_key',
    ).on(t.tenantId, t.userId, t.key),
    tenantTimeIdx: index('idx_kernel_mem_semantic_tenant_time').on(
      t.tenantId,
      t.lastSeenAt,
    ),
  }),
);
