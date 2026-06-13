/**
 * portal_tab_records — the generic record store that makes a GENERATED tab ACT.
 *
 * Companion to migration 0320. The brain mints dynamic tabs
 * (`@bossnyumba/portal-genui`; migration 0319 stores the tab DOCUMENT in
 * portal_tabs). A generated tab was render-only until this store: it had no
 * place for the records the tab collects. Every record from every generated tab
 * lands here as a JSONB `payload`, tenant-scoped and keyed by `tab_id` /
 * `tab_key`. There is NO per-tab table — a brand-new domain needs ZERO new
 * migrations (composition, not new code).
 *
 * The payload SHAPE is enforced at write time by the OWNING tab's own
 * PortalTabField[] (the engine's record validator). The money path is
 * UNTOUCHED: this store never posts accounting truth (LedgerService.post() owns
 * the immutable double-entry ledger); a tab record is application data, never a
 * ledger entry.
 *
 * Source-of-truth note: the portal-genui record store speaks plain
 * parameterised SQL against these exact column names. This schema exists for
 * type-safe consumers inside `@bossnyumba/database` + migration tests; the
 * column set MUST stay in lockstep with migration 0320.
 *
 * Tenant-isolation: RLS FORCE-enabled in migration 0320 on the canonical
 * `current_setting('app.current_tenant_id', true)` GUC + a service-role bypass.
 * A TENANT can NEVER read ANOTHER tenant's tab records.
 */

import {
  pgTable,
  text,
  jsonb,
  uuid,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

// ============================================================================
// portal_tab_records — generic schema-on-read record store for generated tabs
// ============================================================================

export const tabRecords = pgTable(
  'portal_tab_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** RLS isolation key (the owning tenant). No FK — text tenant id. */
    tenantId: text('tenant_id').notNull(),
    /** The owning portal_tabs row. */
    tabId: uuid('tab_id').notNull(),
    /** Denormalised stable tab key (routing / filter without a join). */
    tabKey: text('tab_key').notNull(),
    /** The validated submission. Shape enforced at write time by tab fields. */
    payload: jsonb('payload').notNull(),
    /** The submitting user (audit / created_by). */
    createdByUserId: text('created_by_user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    /** Hot read path: list a tab's records within a tenant. */
    tenantTabIdx: index('portal_tab_records_tenant_tab_idx').on(
      t.tenantId,
      t.tabId,
    ),
  }),
);

export type TabRecordRow = typeof tabRecords.$inferSelect;
export type TabRecordInsert = typeof tabRecords.$inferInsert;
