/**
 * Org / team-management schema (Wave ORG-ADMIN-TOOLS).
 *
 * BossNyumba's CLAUDE.md lists "portfolio managers, leasing agents,
 * housing cooperatives" running teams of on-the-ground staff. This
 * schema models that staff lifecycle: hire a staff member, assign a KPI,
 * schedule a task, raise an escalation — all reachable from Mr. Mwikila
 * chat via the `staff.*` brain tools.
 *
 * Companion to:
 *   - packages/database/src/migrations/0305_org_team_management.sql
 *   - services/api-gateway/src/composition/org-team-repository.ts
 *   - services/api-gateway/src/routes/org-admin.hono.ts
 *   - services/api-gateway/src/composition/brain-tools/org-admin-tools.ts
 *
 * Four tables:
 *   - staff_members     one row per staff member (caretaker /
 *                       leasing_assistant / groundskeeper / accountant)
 *   - staff_kpis        KPI targets assigned to a staff member
 *   - org_tasks         tasks scheduled to (optionally) a staff member
 *                       (e.g. "move-out inspection scheduling")
 *   - org_escalations   escalations for a human to act on
 *                       (compliance_breach / payment_default /
 *                       maintenance_incident / other)
 *
 * Tenant scope (CLAUDE.md hard rule): `app.current_tenant_id` GUC RLS,
 * FORCE-enabled, bound by the api-gateway database middleware. Every
 * query the repository runs is also tenant-filtered defensively.
 *
 * Multi-currency (CLAUDE.md hard rule): NOTHING here hard-codes a
 * jurisdiction currency. A money-denominated KPI uses
 * `metricUnit = 'currency'`; the display surface formats with
 * formatCurrency at render time.
 *
 * Ported from LitFin's iter-27..31 org-management tables and retargeted
 * lending → real estate: employee → staff_member · employee_kpis →
 * staff_kpis. Names retargeted so this never collides with the existing
 * `employees` HR table (migration 0241 / hr.schema.ts).
 */

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  uuid,
  numeric,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ── enum value catalogs (mirrored as CHECK constraints in mig 0305) ────

/** Staff member lifecycle. */
export const STAFF_MEMBER_STATUSES = [
  'active',
  'suspended',
  'terminated',
] as const;
export type StaffMemberStatus = (typeof STAFF_MEMBER_STATUSES)[number];

/** Domain-neutral KPI metric units (currency-neutral — never a code). */
export const STAFF_KPI_METRIC_UNITS = [
  'count',
  'currency',
  'percent',
  'days',
  'hours',
  'ratio',
] as const;
export type StaffKpiMetricUnit = (typeof STAFF_KPI_METRIC_UNITS)[number];

/** KPI assessment periods. */
export const STAFF_KPI_PERIODS = [
  'week',
  'month',
  'quarter',
  'half',
  'year',
] as const;
export type StaffKpiPeriod = (typeof STAFF_KPI_PERIODS)[number];

/** KPI lifecycle. */
export const STAFF_KPI_STATUSES = [
  'active',
  'paused',
  'achieved',
  'missed',
  'cancelled',
] as const;
export type StaffKpiStatus = (typeof STAFF_KPI_STATUSES)[number];

/** Task lifecycle. */
export const ORG_TASK_STATUSES = [
  'open',
  'in_progress',
  'done',
  'cancelled',
] as const;
export type OrgTaskStatus = (typeof ORG_TASK_STATUSES)[number];

/** Task priority. */
export const ORG_TASK_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type OrgTaskPriority = (typeof ORG_TASK_PRIORITIES)[number];

/** Escalation severity. */
export const ORG_ESCALATION_SEVERITIES = [
  'low',
  'normal',
  'high',
  'critical',
] as const;
export type OrgEscalationSeverity = (typeof ORG_ESCALATION_SEVERITIES)[number];

/** Escalation lifecycle. */
export const ORG_ESCALATION_STATUSES = [
  'open',
  'acknowledged',
  'in_progress',
  'resolved',
  'cancelled',
] as const;
export type OrgEscalationStatus = (typeof ORG_ESCALATION_STATUSES)[number];

/** Escalation category — real-estate retargeted from LitFin. */
export const ORG_ESCALATION_CATEGORIES = [
  'compliance_breach',
  'payment_default',
  'maintenance_incident',
  'other',
] as const;
export type OrgEscalationCategory = (typeof ORG_ESCALATION_CATEGORIES)[number];

// ── staff_members ──────────────────────────────────────────────────────

export const staffMembers = pgTable(
  'staff_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    fullName: text('full_name').notNull(),
    /** Free-form role label (caretaker / leasing_assistant / …). */
    role: text('role').notNull(),
    hireDate: timestamp('hire_date', { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Self-FK: the staff member this person reports to. */
    managerId: uuid('manager_id'),
    status: text('status').notNull().default('active'),
    /** Contact info (whatsapp / phone / email) + free-form notes. */
    metadata: jsonb('metadata').notNull().default({}),
    provenance: jsonb('provenance').notNull().default({ via: 'unknown' }),
    auditHashId: text('audit_hash_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantStatusIdx: index('staff_members_tenant_status').on(
      table.tenantId,
      table.status,
      table.createdAt,
    ),
    tenantNameActiveUq: uniqueIndex('staff_members_tenant_name_active_uq').on(
      table.tenantId,
      table.fullName,
    ),
  }),
);

export type StaffMember = typeof staffMembers.$inferSelect;
export type NewStaffMember = typeof staffMembers.$inferInsert;

// ── staff_kpis ─────────────────────────────────────────────────────────

export const staffKpis = pgTable(
  'staff_kpis',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    staffMemberId: uuid('staff_member_id')
      .notNull()
      .references(() => staffMembers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    metricUnit: text('metric_unit').notNull().default('count'),
    targetValue: numeric('target_value', { precision: 18, scale: 4 }).notNull(),
    currentValue: numeric('current_value', { precision: 18, scale: 4 })
      .notNull()
      .default('0'),
    period: text('period').notNull().default('quarter'),
    periodEnd: timestamp('period_end', { withTimezone: true }),
    status: text('status').notNull().default('active'),
    assignedByUserId: uuid('assigned_by_user_id'),
    originSessionId: text('origin_session_id'),
    provenance: jsonb('provenance').notNull().default({ via: 'unknown' }),
    auditHashId: text('audit_hash_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantMemberIdx: index('staff_kpis_tenant_member').on(
      table.tenantId,
      table.staffMemberId,
      table.status,
    ),
  }),
);

export type StaffKpi = typeof staffKpis.$inferSelect;
export type NewStaffKpi = typeof staffKpis.$inferInsert;

// ── org_tasks ──────────────────────────────────────────────────────────

export const orgTasks = pgTable(
  'org_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    /** Optional assignee (ON DELETE SET NULL in the migration). */
    assignedTo: uuid('assigned_to'),
    assignedByUserId: uuid('assigned_by_user_id'),
    status: text('status').notNull().default('open'),
    priority: text('priority').notNull().default('normal'),
    dueAt: timestamp('due_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    originSessionId: text('origin_session_id'),
    metadata: jsonb('metadata').notNull().default({}),
    provenance: jsonb('provenance').notNull().default({ via: 'unknown' }),
    auditHashId: text('audit_hash_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantStatusIdx: index('org_tasks_tenant_status').on(
      table.tenantId,
      table.status,
      table.dueAt,
    ),
    tenantAssignedIdx: index('org_tasks_tenant_assigned').on(
      table.tenantId,
      table.assignedTo,
    ),
  }),
);

export type OrgTask = typeof orgTasks.$inferSelect;
export type NewOrgTask = typeof orgTasks.$inferInsert;

// ── org_escalations ────────────────────────────────────────────────────

export const orgEscalations = pgTable(
  'org_escalations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    title: text('title').notNull(),
    reason: text('reason').notNull(),
    category: text('category').notNull().default('other'),
    severity: text('severity').notNull().default('normal'),
    status: text('status').notNull().default('open'),
    /** Optional human target (ON DELETE SET NULL). */
    escalatedToStaffId: uuid('escalated_to_staff_id'),
    /** Optional task this escalation relates to (ON DELETE SET NULL). */
    relatedTaskId: uuid('related_task_id'),
    relatedSubject: text('related_subject'),
    raisedByUserId: uuid('raised_by_user_id'),
    originSessionId: text('origin_session_id'),
    metadata: jsonb('metadata').notNull().default({}),
    provenance: jsonb('provenance').notNull().default({ via: 'unknown' }),
    auditHashId: text('audit_hash_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantStatusIdx: index('org_escalations_tenant_status').on(
      table.tenantId,
      table.status,
      table.severity,
    ),
  }),
);

export type OrgEscalation = typeof orgEscalations.$inferSelect;
export type NewOrgEscalation = typeof orgEscalations.$inferInsert;
