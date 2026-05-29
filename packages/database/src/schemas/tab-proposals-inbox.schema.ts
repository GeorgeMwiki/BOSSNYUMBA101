/**
 * tab_proposals_inbox — autonomous tab-suggester proposals.
 *
 * Companion to migration 0279. Ported from Borjie 0142 — Mr. Mwikila
 * branding stripped, bilingual sw/en titles + reasons preserved.
 *
 * Detectors: drill_down_repeat | navigation_loop | persona_escalation
 * | manual.
 *
 * Evidence chain: ≥1 evidence_id per row (LMBM observation, decision,
 * ui_navigate trail, persona action). Auditor agent rejects empties.
 */

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  uuid,
  doublePrecision,
  index,
} from 'drizzle-orm/pg-core';

export const TAB_PROPOSAL_DETECTORS = [
  'drill_down_repeat',
  'navigation_loop',
  'persona_escalation',
  'manual',
] as const;
export type TabProposalDetector = (typeof TAB_PROPOSAL_DETECTORS)[number];

export const tabProposalsInbox = pgTable(
  'tab_proposals_inbox',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: text('tenant_id').notNull(),
    userId: text('user_id').notNull(),
    tabType: text('tab_type').notNull(),
    titleEn: text('title_en').notNull(),
    titleSw: text('title_sw'),
    reasonEn: text('reason_en').notNull(),
    reasonSw: text('reason_sw'),
    config: jsonb('config').notNull().default({}),
    confidence: doublePrecision('confidence'),
    evidenceIds: jsonb('evidence_ids').notNull(),
    detector: text('detector').$type<TabProposalDetector>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
    lastSurfacedAt: timestamp('last_surfaced_at', { withTimezone: true }),
  },
  (t) => ({
    openIdx: index('tab_proposals_inbox_open_idx').on(
      t.tenantId,
      t.userId,
      t.createdAt,
    ),
    dedupIdx: index('tab_proposals_inbox_dedup_idx').on(
      t.tenantId,
      t.userId,
      t.tabType,
      t.detector,
      t.createdAt,
    ),
  }),
);

export type TabProposalRow = typeof tabProposalsInbox.$inferSelect;
export type NewTabProposalRow = typeof tabProposalsInbox.$inferInsert;
