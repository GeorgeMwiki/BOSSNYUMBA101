/**
 * Cross-Tenant Memberships Schema
 *
 * Allows a single user identity to be a tenant/manager in N different
 * landlord orgs. Mirrors packages/domain-models/src/identity/membership.ts.
 */

import {
  pgTable,
  text,
  timestamp,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';

export const membershipStatusEnum = pgEnum('membership_status', [
  'ACTIVE',
  'SUSPENDED',
  'REVOKED',
]);

export const crossTenantMemberships = pgTable(
  'cross_tenant_memberships',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    tenantId: text('tenant_id').notNull(),
    organizationId: text('organization_id'),
    role: text('role').notNull().default('CUSTOMER'),
    status: membershipStatusEnum('status').notNull().default('ACTIVE'),
    displayLabel: text('display_label'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    lastActivatedAt: timestamp('last_activated_at', { withTimezone: true }),
  },
  (table) => ({
    userIdx: index('ctm_user_id_idx').on(table.userId),
    tenantIdx: index('ctm_tenant_id_idx').on(table.tenantId),
    userStatusIdx: index('ctm_user_status_idx').on(table.userId, table.status),
  })
);

export type CrossTenantMembership = typeof crossTenantMemberships.$inferSelect;
export type NewCrossTenantMembership = typeof crossTenantMemberships.$inferInsert;
