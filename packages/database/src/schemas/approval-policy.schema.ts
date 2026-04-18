/**
 * Approval Policy Schema
 *
 * Stores per-tenant overrides of the default approval policies defined in
 * services/domain-services/src/approvals/default-policies.ts. When no row
 * exists for a (tenantId, type) pair, the service falls back to the hardcoded
 * defaults. This table is purely additive — defaults remain the source of truth
 * floor.
 */

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  primaryKey,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenant.schema.js';

export const approvalPolicies = pgTable(
  'approval_policies',
  {
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    // One of: 'maintenance_cost' | 'refund' | 'discount' | 'lease_exception' | 'payment_flexibility'
    type: text('type').notNull(),
    // Full ApprovalPolicy shape (thresholds, autoApproveRules, approvalChain,
    // defaultTimeoutHours, autoEscalateToRole) serialized as JSON.
    policyJson: jsonb('policy_json').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: text('updated_by'),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.tenantId, table.type] }),
    tenantIdx: index('approval_policies_tenant_idx').on(table.tenantId),
  })
);

export const approvalPoliciesRelations = relations(approvalPolicies, ({ one }) => ({
  tenant: one(tenants, {
    fields: [approvalPolicies.tenantId],
    references: [tenants.id],
  }),
}));
