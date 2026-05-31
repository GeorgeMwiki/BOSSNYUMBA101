/**
 * Admin Superpower Pending Approvals - four-eye gate (migration 0301).
 *
 * Wave OWNER-OS / admin-platform-portal parity. Holds the pending half
 * of the two-phase admin superpower ledger:
 *
 *   Phase 1 (POST /admin/superpowers/bulk-action HIGH verb):
 *     Insert row(s) with status='pending'. Proposing admin pinned.
 *
 *   Phase 2 (POST /admin/superpowers/approve/:journalId):
 *     Second distinct admin approves. Transitions to status='applied'
 *     and the entity-side mutation fires. SAME_ACTOR rejected.
 *
 * The DB CHECK constraint `admin_four_eye_distinct_actors_chk` is the
 * canonical invariant; the route handler enforces it earlier with a
 * structured 409 FOUR_EYE_SAME_ACTOR error so the FE can surface the
 * exact reason to the approver.
 *
 * Admin-scope (NOT tenant-scoped). RLS-FORCE per CLAUDE.md hard rule;
 * visibility gated by `app.admin_scope` session GUC bound by the
 * `requireRole(SUPER_ADMIN|ADMIN|SUPPORT)` middleware.
 *
 * Companion files:
 *   - packages/database/src/migrations/0301_admin_four_eye_pending.sql
 *   - services/api-gateway/src/routes/admin/superpowers.hono.ts
 *   - services/api-gateway/src/composition/brain-tools/
 *     admin-superpowers-tools.ts
 */

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  uuid,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Admin HIGH-risk verbs that require four-eye approval. These verbs
 * land as pending_approval rows; the second admin's POST
 * /admin/superpowers/approve/:journalId fires the actual mutation.
 */
export const ADMIN_HIGH_RISK_ACTIONS = [
  'suspend_tenant_org',
  'reactivate_tenant_org',
  'export_regulator_pack',
  'force_lease_termination',
  'force_password_reset',
  'bulk_archive_maintenance_cases',
] as const;
export type AdminHighRiskAction = (typeof ADMIN_HIGH_RISK_ACTIONS)[number];

/**
 * Admin MEDIUM-risk verbs that audit-log but do NOT require four-eye.
 * These verbs append directly to undo_journal with status='applied'
 * and bypass this table entirely.
 */
export const ADMIN_MEDIUM_RISK_ACTIONS = [
  'bulk_send_announcement',
  'bulk_archive_old_invoices',
  'bulk_re_tag_units',
] as const;
export type AdminMediumRiskAction = (typeof ADMIN_MEDIUM_RISK_ACTIONS)[number];

export type AdminSuperpowerAction =
  | AdminHighRiskAction
  | AdminMediumRiskAction;

export const ADMIN_ALL_ACTIONS: ReadonlyArray<AdminSuperpowerAction> = [
  ...ADMIN_HIGH_RISK_ACTIONS,
  ...ADMIN_MEDIUM_RISK_ACTIONS,
];

/** Threshold above which bulk_archive_maintenance_cases is HIGH-risk. */
export const ADMIN_BULK_ARCHIVE_HIGH_THRESHOLD = 50;

export const ADMIN_PENDING_STATUSES = [
  'pending',
  'applied',
  'rejected',
  'expired',
] as const;
export type AdminPendingStatus = (typeof ADMIN_PENDING_STATUSES)[number];

export const adminSuperpowerPendingApprovals = pgTable(
  'admin_superpower_pending_approvals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    journalId: uuid('journal_id').notNull(),
    targetTenantId: text('target_tenant_id'),
    targetEntityRef: text('target_entity_ref').notNull(),
    action: text('action').notNull(),
    payload: jsonb('payload').notNull().default({}),
    reason: text('reason').notNull(),
    status: text('status').notNull().default('pending'),
    proposedByActorId: text('proposed_by_actor_id').notNull(),
    proposedByRole: text('proposed_by_role').notNull(),
    approvedByActorId: text('approved_by_actor_id'),
    approvedByRole: text('approved_by_role'),
    approverNote: text('approver_note'),
    rejectedByActorId: text('rejected_by_actor_id'),
    rejectedByRole: text('rejected_by_role'),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    auditChainIds: jsonb('audit_chain_ids').notNull().default([]),
  },
  (t) => ({
    statusCreatedIdx: index('admin_four_eye_status_created_idx').on(
      t.status,
      t.createdAt,
    ),
    journalIdx: index('admin_four_eye_journal_idx').on(t.journalId),
    expiresIdx: index('admin_four_eye_expires_idx').on(t.expiresAt),
  }),
);

export type AdminPendingApprovalRow =
  typeof adminSuperpowerPendingApprovals.$inferSelect;
export type AdminPendingApprovalInsert =
  typeof adminSuperpowerPendingApprovals.$inferInsert;
