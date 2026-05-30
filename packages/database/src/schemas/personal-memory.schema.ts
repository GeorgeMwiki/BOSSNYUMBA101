/**
 * Unified Personal Knowledge Base — `personal_memory_cells`.
 *
 * Companion to migration 0296 and the federated-PKB design ported from
 * Borjie. The federated personal-memory store: one row per (person_id,
 * cell_kind, key) triple. Stores a real human's personal preferences,
 * ongoing contexts, recurring life facts, calibration deltas, and
 * sentiment snapshots — the data a multi-tenancy landlord (own estate +
 * family-trust estate) loses today every time she switches tenancy.
 *
 * RLS posture (FEDERATED — NO ROW LEVEL SECURITY):
 *
 *   This table mirrors the precedent of `platform_memory_cells`. NO RLS
 *   is enabled. There is NO `tenant_id` column. Access is gated by
 *   `person_id` only, via the future `app.current_person_id` GUC
 *   predicate bound at the api-gateway middleware layer.
 *
 *   Symmetric isolation between person-memory and tenant-memory is
 *   enforced at the brain orchestrator boundary-tagger layer
 *   (`packages/ai-copilot/src/memory/boundary-tagger.ts`). Tenant
 *   queries cannot see person rows; person queries cannot see tenant
 *   rows. Both are UNION-ALLed at the orchestrator with explicit
 *   `origin` tags so the reply composer can drop cross-tenant numeric
 *   candidate tokens before they reach the LLM — fail-LOUD via
 *   `assertChineseWall()` that throws on attempted leak.
 *
 * `source_tenant_id` and `source_thread_id` are provenance ONLY — they
 * are never used to filter access. They exist to power the audit chain
 * and the "where did this fact come from?" introspection in the
 * persona-runtime debug UI.
 */

import {
  pgTable,
  text,
  timestamp,
  uuid,
  numeric,
  jsonb,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { persons } from './persons.schema.js';

// ============================================================================
// personal_memory_cells — federated personal memory (NO RLS, no tenant_id)
// ============================================================================

export const personalMemoryCells = pgTable(
  'personal_memory_cells',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    personId: uuid('person_id')
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    /**
     * preference     — durable likes/dislikes ("address me as Bibi Asha").
     * context        — current state ("recovering from flu this week").
     * recurring-fact — stable life facts ("my mother passed in Aug 2024").
     * calibration    — per-user model calibration ("prefers conservative
     *                  pricing thresholds when listing vacancies").
     * sentiment      — recent emotional snapshot ("stressed about the
     *                  rent-arrears letter sent on Friday").
     */
    cellKind: text('cell_kind').notNull(),
    /** Cell key — domain identifier inside its `cell_kind` family. */
    key: text('key').notNull(),
    /**
     * Structured value payload. Numeric data inside this jsonb triggers
     * the boundary-tagger's Chinese-wall block when surfaced cross-tenant.
     */
    value: jsonb('value').notNull(),
    /** [0,1] confidence dial. Default 1.0 (user-stated). */
    confidence: numeric('confidence', { precision: 3, scale: 2 })
      .notNull()
      .default('1.0'),
    /**
     * Provenance only — which tenant context produced this cell.
     * NEVER used to filter access. NULL when the cell came from a
     * person-level interaction (e.g. unified settings, voice intro,
     * marketing-funnel preference capture before any tenant link).
     */
    sourceTenantId: text('source_tenant_id'),
    /** Provenance only — origin conversation thread. */
    sourceThreadId: uuid('source_thread_id'),
    capturedAt: timestamp('captured_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Optional TTL; NULL means the cell does not expire. */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (t) => ({
    personKindIdx: index('personal_memory_cells_person_kind_idx').on(
      t.personId,
      t.cellKind,
    ),
    /**
     * One cell per (person, kind, key) triple. Upserts replace the
     * value + confidence + captured_at when the same key fires again.
     */
    personKindKeyUnique: uniqueIndex(
      'personal_memory_cells_person_kind_key_uniq',
    ).on(t.personId, t.cellKind, t.key),
    confidenceChk: check(
      'personal_memory_cells_confidence_chk',
      sql`${t.confidence} >= 0 AND ${t.confidence} <= 1`,
    ),
  }),
);

export type PersonalMemoryCellRow = typeof personalMemoryCells.$inferSelect;
export type PersonalMemoryCellInsert =
  typeof personalMemoryCells.$inferInsert;
