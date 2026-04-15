/**
 * HR / Organization Schemas
 *
 * Departments, Teams, Employees, Assignments, and Performance.
 *
 * Design notes:
 *  - `employees` is separate from `users` (in tenant.schema.ts). A user is an
 *    identity; an employee is an HR record. Many employees will have a user
 *    linked, but not all (e.g. caretakers without portal accounts).
 *  - `teams` bind employees together and are the scope of a Junior persona.
 *  - `assignments` are the primary unit of work for the Coworker persona.
 *  - `performance_records` are append-only — every review/observation is a
 *    new row; we do not mutate history.
 *  - All tables are tenant-scoped for RLS. Cascade deletes are explicit and
 *    deliberate.
 */

import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
  numeric,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants, users } from './tenant.schema.js';

// ============================================================================
// Enums
// ============================================================================

export const employmentStatusEnum = pgEnum('employment_status', [
  'active',
  'on_leave',
  'suspended',
  'terminated',
  'pending_onboarding',
]);

export const employmentTypeEnum = pgEnum('employment_type', [
  'full_time',
  'part_time',
  'contract',
  'casual',
  'intern',
  'vendor',
]);

export const teamKindEnum = pgEnum('team_kind', [
  'leasing',
  'maintenance',
  'finance',
  'compliance',
  'communications',
  'operations',
  'security',
  'caretaking',
  'custom',
]);

export const assignmentStatusEnum = pgEnum('assignment_status', [
  'draft',
  'assigned',
  'accepted',
  'in_progress',
  'blocked',
  'completed',
  'cancelled',
]);

export const performanceKindEnum = pgEnum('performance_kind', [
  'observation',
  'weekly_summary',
  'monthly_review',
  'quarterly_review',
  'peer_feedback',
  'tenant_feedback',
  'sla_miss',
  'sla_hit',
  'recognition',
]);

// ============================================================================
// Departments
// ============================================================================

export const departments = pgTable(
  'departments',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    headEmployeeId: text('head_employee_id'),
    isActive: boolean('is_active').notNull().default(true),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    tenantIdx: index('departments_tenant_idx').on(table.tenantId),
    codeIdx: uniqueIndex('departments_code_tenant_idx').on(
      table.tenantId,
      table.code
    ),
  })
);

// ============================================================================
// Teams
// ============================================================================

export const teams = pgTable(
  'teams',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    departmentId: text('department_id').references(() => departments.id, {
      onDelete: 'set null',
    }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    kind: teamKindEnum('kind').notNull(),
    description: text('description'),

    /** Persona id this team binds to (e.g. `junior.leasing`). Tenant may
     *  re-bind a team to a different Junior persona in settings. */
    juniorPersonaId: text('junior_persona_id'),

    /** Team leader — an employee id within this tenant. */
    teamLeaderEmployeeId: text('team_leader_employee_id'),

    isActive: boolean('is_active').notNull().default(true),
    settings: jsonb('settings').default({}),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    tenantIdx: index('teams_tenant_idx').on(table.tenantId),
    codeIdx: uniqueIndex('teams_code_tenant_idx').on(
      table.tenantId,
      table.code
    ),
    departmentIdx: index('teams_department_idx').on(table.departmentId),
    kindIdx: index('teams_kind_idx').on(table.tenantId, table.kind),
  })
);

// ============================================================================
// Employees
// ============================================================================

export const employees = pgTable(
  'employees',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    /** Linked user identity (nullable — not every employee has a portal login). */
    userId: text('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),

    /** Internal employee code / payroll id. */
    employeeCode: text('employee_code').notNull(),

    // Demographics
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    preferredName: text('preferred_name'),
    phone: text('phone'),
    phoneAlt: text('phone_alt'),
    email: text('email'),

    // Employment
    status: employmentStatusEnum('status').notNull().default('pending_onboarding'),
    employmentType: employmentTypeEnum('employment_type')
      .notNull()
      .default('full_time'),
    jobTitle: text('job_title').notNull(),
    departmentId: text('department_id').references(() => departments.id, {
      onDelete: 'set null',
    }),

    // Reporting line
    managerEmployeeId: text('manager_employee_id'),

    hireDate: timestamp('hire_date', { withTimezone: true }),
    terminationDate: timestamp('termination_date', { withTimezone: true }),

    // Skills / capabilities — drives assignment intelligence.
    // JSON shape: { skill: 0..1 competency, skill2: 0..1, ... }
    capabilities: jsonb('capabilities').default({}),

    // Languages (for Communications Junior routing).
    languages: text('languages').array().default([]),

    // Compensation — NEVER surfaced to non-HR personae. Access enforced by RLS
    // policies on top of this schema; the Brain personae cannot read this
    // without explicit HR-level authorization.
    baseSalaryKes: numeric('base_salary_kes', { precision: 14, scale: 2 }),

    // Location / coverage — which properties this employee serves.
    coveredPropertyIds: text('covered_property_ids').array().default([]),

    // Metadata
    notes: text('notes'),
    metadata: jsonb('metadata').default({}),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    tenantIdx: index('employees_tenant_idx').on(table.tenantId),
    codeIdx: uniqueIndex('employees_code_tenant_idx').on(
      table.tenantId,
      table.employeeCode
    ),
    statusIdx: index('employees_status_idx').on(table.tenantId, table.status),
    userIdx: index('employees_user_idx').on(table.userId),
    managerIdx: index('employees_manager_idx').on(table.managerEmployeeId),
    departmentIdx: index('employees_department_idx').on(table.departmentId),
  })
);

// ============================================================================
// Team Memberships (many-to-many: employees <-> teams)
// ============================================================================

export const teamMemberships = pgTable(
  'team_memberships',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    employeeId: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),

    /** Permanent team member vs. temporary/extra loaned in. */
    isTemporary: boolean('is_temporary').notNull().default(false),
    startsAt: timestamp('starts_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    endsAt: timestamp('ends_at', { withTimezone: true }),

    /** Role within the team — e.g. 'member', 'lead', 'specialist'. */
    roleLabel: text('role_label').default('member'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: text('created_by'),
  },
  (table) => ({
    tenantIdx: index('team_memberships_tenant_idx').on(table.tenantId),
    teamIdx: index('team_memberships_team_idx').on(table.teamId),
    employeeIdx: index('team_memberships_employee_idx').on(table.employeeId),
    uniqActive: uniqueIndex('team_memberships_unique_active_idx').on(
      table.teamId,
      table.employeeId
    ),
  })
);

// ============================================================================
// Assignments (the primary unit of work for the Coworker persona)
// ============================================================================

export const assignments = pgTable(
  'assignments',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    /** Team that owns this assignment (source of the Junior persona). */
    teamId: text('team_id').references(() => teams.id, { onDelete: 'set null' }),

    /** Employee assigned to execute the work. */
    assigneeEmployeeId: text('assignee_employee_id').references(
      () => employees.id,
      { onDelete: 'set null' }
    ),

    /** Who (actor id) assigned it — usually the Junior persona. */
    assignedByActorId: text('assigned_by_actor_id'),

    /** Short title for UI. */
    title: text('title').notNull(),
    description: text('description'),

    /** Linked domain entity — e.g. work_order:WO-123, lease:L-42, case:C-7. */
    linkedEntityKind: text('linked_entity_kind'),
    linkedEntityId: text('linked_entity_id'),

    status: assignmentStatusEnum('status').notNull().default('draft'),
    priority: integer('priority').notNull().default(3), // 1 = highest, 5 = lowest
    dueAt: timestamp('due_at', { withTimezone: true }),

    /** Risk level per the Brain classification. Drives review requirements. */
    riskLevel: text('risk_level').default('MEDIUM'),

    /** Estimated effort in minutes — used by assignment intelligence. */
    estimatedEffortMinutes: integer('estimated_effort_minutes'),

    /** Acceptance / completion audit. */
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),

    /** Evidence of completion — before/after photos, signed form ids, etc. */
    completionEvidence: jsonb('completion_evidence').default({}),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
  },
  (table) => ({
    tenantIdx: index('assignments_tenant_idx').on(table.tenantId),
    teamIdx: index('assignments_team_idx').on(table.teamId),
    assigneeIdx: index('assignments_assignee_idx').on(table.assigneeEmployeeId),
    statusIdx: index('assignments_status_idx').on(table.tenantId, table.status),
    dueAtIdx: index('assignments_due_at_idx').on(table.dueAt),
    linkedIdx: index('assignments_linked_idx').on(
      table.linkedEntityKind,
      table.linkedEntityId
    ),
  })
);

// ============================================================================
// Performance Records (append-only)
// ============================================================================

export const performanceRecords = pgTable(
  'performance_records',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    employeeId: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),

    kind: performanceKindEnum('kind').notNull(),

    /** Period covered — for reviews; null for point-in-time observations. */
    periodStart: timestamp('period_start', { withTimezone: true }),
    periodEnd: timestamp('period_end', { withTimezone: true }),

    /** Structured scores: {punctuality: 4.5, quality: 4, ...} */
    scores: jsonb('scores').default({}),

    /** Observer — employee id, user id, or persona id. */
    observerActorId: text('observer_actor_id'),

    /** Free-text body. */
    note: text('note'),

    /** Linked assignment id if this record is tied to a specific job. */
    assignmentId: text('assignment_id').references(() => assignments.id, {
      onDelete: 'set null',
    }),

    /** Visibility scope — same as Brain thread visibility labels. */
    visibilityScope: text('visibility_scope').notNull().default('management'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: text('created_by'),
  },
  (table) => ({
    tenantIdx: index('performance_records_tenant_idx').on(table.tenantId),
    employeeIdx: index('performance_records_employee_idx').on(table.employeeId),
    kindIdx: index('performance_records_kind_idx').on(table.tenantId, table.kind),
    assignmentIdx: index('performance_records_assignment_idx').on(
      table.assignmentId
    ),
  })
);

// ============================================================================
// Relations
// ============================================================================

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [departments.tenantId],
    references: [tenants.id],
  }),
  teams: many(teams),
  employees: many(employees),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  tenant: one(tenants, { fields: [teams.tenantId], references: [tenants.id] }),
  department: one(departments, {
    fields: [teams.departmentId],
    references: [departments.id],
  }),
  memberships: many(teamMemberships),
  assignments: many(assignments),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [employees.tenantId],
    references: [tenants.id],
  }),
  user: one(users, { fields: [employees.userId], references: [users.id] }),
  department: one(departments, {
    fields: [employees.departmentId],
    references: [departments.id],
  }),
  memberships: many(teamMemberships),
  assignments: many(assignments),
  performance: many(performanceRecords),
}));

export const teamMembershipsRelations = relations(teamMemberships, ({ one }) => ({
  tenant: one(tenants, {
    fields: [teamMemberships.tenantId],
    references: [tenants.id],
  }),
  team: one(teams, {
    fields: [teamMemberships.teamId],
    references: [teams.id],
  }),
  employee: one(employees, {
    fields: [teamMemberships.employeeId],
    references: [employees.id],
  }),
}));

export const assignmentsRelations = relations(assignments, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [assignments.tenantId],
    references: [tenants.id],
  }),
  team: one(teams, { fields: [assignments.teamId], references: [teams.id] }),
  assignee: one(employees, {
    fields: [assignments.assigneeEmployeeId],
    references: [employees.id],
  }),
  performance: many(performanceRecords),
}));

export const performanceRecordsRelations = relations(
  performanceRecords,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [performanceRecords.tenantId],
      references: [tenants.id],
    }),
    employee: one(employees, {
      fields: [performanceRecords.employeeId],
      references: [employees.id],
    }),
    assignment: one(assignments, {
      fields: [performanceRecords.assignmentId],
      references: [assignments.id],
    }),
  })
);
