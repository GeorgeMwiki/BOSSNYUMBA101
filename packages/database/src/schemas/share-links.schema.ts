/**
 * Share Links — Wave SUPERPOWERS (migration 0297, ported from Borjie 0111).
 *
 * Companion to:
 *   - packages/database/src/migrations/0297_share_links.sql
 *   - services/api-gateway/src/routes/owner/share-links.hono.ts
 *   - services/api-gateway/src/composition/brain-tools/superpowers-tools.ts
 *
 * One row per generated share link. The chat-callable
 * `bossnyumba.ui.share_view` tool inserts here; the public resolver at
 * `/api/v1/public/share/:token` looks the token up O(1).
 *
 * Real-estate entity vocabulary mirrors the entity types BN routes
 * naturally surface (lease draft, lease, unit listing, invoice,
 * statement, etc.). New types can ship without a migration; the DB
 * column is liberal `text` and the application schema is the canonical
 * enum.
 *
 * Tenant-scoped via the canonical `app.current_tenant_id` GUC RLS
 * predicate. FORCE RLS is enabled per CLAUDE.md hard rule.
 */

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  uuid,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const SHARE_PERMISSIONS = ['read', 'comment', 'edit'] as const;
export type SharePermission = (typeof SHARE_PERMISSIONS)[number];

/**
 * Real-estate share entity types. Owners share these objects with
 * counterparties — CPA, regulator, tenant, co-owner, contractor, buyer.
 */
export const SHARE_ENTITY_TYPES = [
  // Owner-portal surfaces (Wave SUPERPOWERS canon)
  'lease_draft',
  'lease',
  'unit_listing',
  'invoice',
  'statement',
  'inspection',
  'maintenance_case',
  'document',
  'reminder',
  'valuation_report',
  // Staff / tenant mobile surfaces. DB column is liberal text; this
  // enum widening is backwards-compatible (no migration required).
  'maintenance',
  'ticket',
  'photo',
] as const;
export type ShareEntityType = (typeof SHARE_ENTITY_TYPES)[number];

export const shareLinks = pgTable(
  'share_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: text('tenant_id').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    token: text('token').notNull(),
    permission: text('permission').notNull().default('read'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdById: text('created_by_id').notNull(),
    recipients: jsonb('recipients').notNull().default([]),
    usedCount: integer('used_count').notNull().default(0),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedById: text('revoked_by_id'),
    provenance: jsonb('provenance').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tokenIdx: uniqueIndex('share_links_token_idx').on(table.token),
    tenantCreatedIdx: index('share_links_tenant_created_idx').on(
      table.tenantId,
      table.createdAt,
    ),
    tenantEntityIdx: index('share_links_tenant_entity_idx').on(
      table.tenantId,
      table.entityType,
      table.entityId,
    ),
  }),
);

export type ShareLink = typeof shareLinks.$inferSelect;
export type NewShareLink = typeof shareLinks.$inferInsert;
