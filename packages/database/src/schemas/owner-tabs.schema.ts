/**
 * Owner Tabs - server-side tab persistence (migration 0300).
 *
 * Closes commit a935776e's deliberate localStorage-only deferral.
 *
 * One row per (tenantId, userId). The jsonb `state` document is opaque
 * to the gateway; the FE owns the shape so client-side iteration does
 * not require DDL. Real-estate entity vocabulary the FE typically pins
 * into `context`:
 *
 *   - lease           : { leaseId, propertyId }
 *   - unit            : { unitId, propertyId }
 *   - maintenance_case: { caseId, propertyId }
 *   - tenant          : { tenantId, propertyId }
 *   - property        : { propertyId }
 *
 * Tenant-scoped via `app.current_tenant_id` GUC; FORCE RLS per CLAUDE.md.
 *
 * Companion files:
 *   - packages/database/src/migrations/0300_owner_tabs.sql
 *   - services/api-gateway/src/routes/owner/tabs.hono.ts
 *   - apps/owner-portal/src/state/useOwnerTabs.ts
 */

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  primaryKey,
  index,
} from 'drizzle-orm/pg-core';

export const ownerTabs = pgTable(
  'owner_tabs',
  {
    tenantId: text('tenant_id').notNull(),
    /** Supabase user id of the owner whose tab layout this row holds. */
    userId: text('user_id').notNull(),
    /** Free-form jsonb. FE owns shape. Default = empty strip. */
    state: jsonb('state')
      .notNull()
      .default({ tabs: [], activeTabId: null }),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.tenantId, t.userId] }),
    updatedIdx: index('owner_tabs_updated_idx').on(
      t.tenantId,
      t.userId,
      t.updatedAt,
    ),
  }),
);

export type OwnerTabsRow = typeof ownerTabs.$inferSelect;
export type OwnerTabsInsert = typeof ownerTabs.$inferInsert;
