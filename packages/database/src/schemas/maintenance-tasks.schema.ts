/**
 * maintenance_tasks + maintenance_toolbox_talks — property-maintenance
 * crew task queue + pre-shift safety briefings.
 *
 * Companion to migration 0283. Ported from Borjie 0080 — adapted from
 * mining tasks to property-maintenance crew. Categories cover
 * plumbing/electrical/hvac/roofing/painting/landscaping/pest_control
 * /cleaning/safety/inspection/other.
 *
 * Bilingual sw/en titles. RLS FORCE tenant-isolated.
 */

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  uuid,
  date,
  index,
} from 'drizzle-orm/pg-core';

export const MAINTENANCE_TASK_PRIORITIES = [
  'low',
  'normal',
  'high',
  'urgent',
] as const;
export type MaintenanceTaskPriority =
  (typeof MAINTENANCE_TASK_PRIORITIES)[number];

export const MAINTENANCE_TASK_STATUSES = [
  'pending',
  'in_progress',
  'done',
  'blocked',
  'cancelled',
] as const;
export type MaintenanceTaskStatus = (typeof MAINTENANCE_TASK_STATUSES)[number];

export const MAINTENANCE_TASK_CATEGORIES = [
  'plumbing',
  'electrical',
  'hvac',
  'roofing',
  'painting',
  'landscaping',
  'pest_control',
  'cleaning',
  'safety',
  'inspection',
  'other',
] as const;
export type MaintenanceTaskCategory =
  (typeof MAINTENANCE_TASK_CATEGORIES)[number];

export const maintenanceTasks = pgTable(
  'maintenance_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    buildingId: uuid('building_id'),
    assignedToUserId: uuid('assigned_to_user_id'),
    assignedByUserId: uuid('assigned_by_user_id'),
    titleSw: text('title_sw').notNull(),
    titleEn: text('title_en'),
    descriptionSw: text('description_sw'),
    descriptionEn: text('description_en'),
    priority: text('priority')
      .$type<MaintenanceTaskPriority>()
      .notNull()
      .default('normal'),
    status: text('status')
      .$type<MaintenanceTaskStatus>()
      .notNull()
      .default('pending'),
    category: text('category')
      .$type<MaintenanceTaskCategory>()
      .notNull()
      .default('other'),
    sequencedAfterTaskId: uuid('sequenced_after_task_id'),
    dueAt: timestamp('due_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    blockedReason: text('blocked_reason'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    hashChainId: uuid('hash_chain_id'),
  },
  (t) => ({
    tenantAssigneeStatusIdx: index(
      'idx_maintenance_tasks_tenant_assignee_status',
    ).on(t.tenantId, t.assignedToUserId, t.status),
    tenantBuildingStatusIdx: index(
      'idx_maintenance_tasks_tenant_building_status',
    ).on(t.tenantId, t.buildingId, t.status),
    tenantCreatedIdx: index('idx_maintenance_tasks_tenant_created').on(
      t.tenantId,
      t.createdAt,
    ),
    tenantCategoryStatusIdx: index(
      'idx_maintenance_tasks_tenant_category_status',
    ).on(t.tenantId, t.category, t.status),
  }),
);

export const maintenanceToolboxTalks = pgTable(
  'maintenance_toolbox_talks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    buildingId: uuid('building_id').notNull(),
    topicSw: text('topic_sw').notNull(),
    topicEn: text('topic_en'),
    scheduledFor: date('scheduled_for').notNull(),
    ledByUserId: uuid('led_by_user_id'),
    acknowledgedByUserIds: jsonb('acknowledged_by_user_ids')
      .notNull()
      .default([]),
    briefingNotesSw: text('briefing_notes_sw'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tenantBuildingDateIdx: index(
      'idx_maintenance_toolbox_talks_tenant_building_date',
    ).on(t.tenantId, t.buildingId, t.scheduledFor),
    tenantDateIdx: index('idx_maintenance_toolbox_talks_tenant_date').on(
      t.tenantId,
      t.scheduledFor,
    ),
  }),
);

export type MaintenanceTaskRow = typeof maintenanceTasks.$inferSelect;
export type NewMaintenanceTaskRow = typeof maintenanceTasks.$inferInsert;
export type MaintenanceToolboxTalkRow =
  typeof maintenanceToolboxTalks.$inferSelect;
export type NewMaintenanceToolboxTalkRow =
  typeof maintenanceToolboxTalks.$inferInsert;
