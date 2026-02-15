/**
 * Scheduling Schemas
 * Scheduled events and availability
 */

import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  date,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenant.schema.js';
import { users } from './tenant.schema.js';
import { properties, units } from './property.schema.js';
import { vendors } from './maintenance.schema.js';

// ============================================================================
// Enums
// ============================================================================

export const scheduledEventTypeEnum = pgEnum('scheduled_event_type', [
  'inspection',
  'maintenance',
  'viewing',
  'meeting',
  'reminder',
  'move_in',
  'move_out',
  'delivery',
  'other',
]);

export const attendeeStatusEnum = pgEnum('attendee_status', [
  'pending',
  'accepted',
  'declined',
  'tentative',
  'no_show',
]);

export const availabilityRecurrenceEnum = pgEnum('availability_recurrence', [
  'daily',
  'weekly',
  'monthly',
  'none',
]);

// ============================================================================
// Scheduled Events Table
// ============================================================================

export const scheduledEvents = pgTable(
  'scheduled_events',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    type: scheduledEventTypeEnum('type').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    allDay: boolean('all_day').notNull().default(false),
    timezone: text('timezone').default('Africa/Nairobi'),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    location: text('location'),
    propertyId: text('property_id').references(() => properties.id),
    unitId: text('unit_id').references(() => units.id),
    assignedTo: text('assigned_to'),
    assignedVendorId: text('assigned_vendor_id').references(() => vendors.id),
    reminderMinutes: integer('reminder_minutes'),
    reminderSent: boolean('reminder_sent').notNull().default(false),
    status: text('status').notNull().default('scheduled'),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedBy: text('updated_by'),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledBy: text('cancelled_by'),
  },
  (table) => ({
    tenantIdx: index('scheduled_events_tenant_idx').on(table.tenantId),
    typeIdx: index('scheduled_events_type_idx').on(table.type),
    startAtIdx: index('scheduled_events_start_at_idx').on(table.startAt),
    endAtIdx: index('scheduled_events_end_at_idx').on(table.endAt),
    entityIdx: index('scheduled_events_entity_idx').on(table.entityType, table.entityId),
    assignedIdx: index('scheduled_events_assigned_idx').on(table.assignedTo),
    propertyIdx: index('scheduled_events_property_idx').on(table.propertyId),
    unitIdx: index('scheduled_events_unit_idx').on(table.unitId),
    dateRangeIdx: index('scheduled_events_date_range_idx').on(table.tenantId, table.startAt, table.endAt),
  })
);

// ============================================================================
// Availability Table
// ============================================================================

export const availability = pgTable(
  'availability',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id').notNull(),
    dayOfWeek: integer('day_of_week'),
    startTime: text('start_time'), // PostgreSQL TIME as text for compatibility
    endTime: text('end_time'),
    startDate: date('start_date'),
    endDate: date('end_date'),
    recurrence: availabilityRecurrenceEnum('recurrence').notNull().default('none'),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }),
    effectiveTo: timestamp('effective_to', { withTimezone: true }),
    isAvailable: boolean('is_available').notNull().default(true),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('availability_tenant_idx').on(table.tenantId),
    resourceIdx: index('availability_resource_idx').on(table.resourceType, table.resourceId),
    dayIdx: index('availability_day_idx').on(table.dayOfWeek),
    effectiveIdx: index('availability_effective_idx').on(table.effectiveFrom, table.effectiveTo),
  })
);

// ============================================================================
// Event Attendees Table
// ============================================================================

export const eventAttendees = pgTable(
  'event_attendees',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id').notNull().references(() => scheduledEvents.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),

    // Status
    status: attendeeStatusEnum('status').notNull().default('pending'),

    // Response
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    responseNote: text('response_note'),

    // Timestamps
    invitedAt: timestamp('invited_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    eventIdx: index('event_attendees_event_idx').on(table.eventId),
    userIdx: index('event_attendees_user_idx').on(table.userId),
    statusIdx: index('event_attendees_status_idx').on(table.status),
    eventUserIdx: uniqueIndex('event_attendees_event_user_idx').on(table.eventId, table.userId),
  })
);

// ============================================================================
// Availability Slots Table
// ============================================================================

export const availabilitySlots = pgTable(
  'availability_slots',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

    // Schedule
    dayOfWeek: integer('day_of_week').notNull(), // 0=Sunday, 6=Saturday
    startTime: text('start_time').notNull(), // e.g. "09:00"
    endTime: text('end_time').notNull(), // e.g. "17:00"

    // Override for specific dates
    effectiveFrom: timestamp('effective_from', { withTimezone: true }),
    effectiveTo: timestamp('effective_to', { withTimezone: true }),

    // Status
    isActive: boolean('is_active').notNull().default(true),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('availability_slots_tenant_idx').on(table.tenantId),
    userIdx: index('availability_slots_user_idx').on(table.userId),
    dayOfWeekIdx: index('availability_slots_day_of_week_idx').on(table.userId, table.dayOfWeek),
  })
);

// ============================================================================
// Relations
// ============================================================================

export const scheduledEventsRelations = relations(scheduledEvents, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [scheduledEvents.tenantId],
    references: [tenants.id],
  }),
  property: one(properties, {
    fields: [scheduledEvents.propertyId],
    references: [properties.id],
  }),
  unit: one(units, {
    fields: [scheduledEvents.unitId],
    references: [units.id],
  }),
  attendees: many(eventAttendees),
}));

export const eventAttendeesRelations = relations(eventAttendees, ({ one }) => ({
  event: one(scheduledEvents, {
    fields: [eventAttendees.eventId],
    references: [scheduledEvents.id],
  }),
  user: one(users, {
    fields: [eventAttendees.userId],
    references: [users.id],
  }),
}));

export const availabilityRelations = relations(availability, ({ one }) => ({
  tenant: one(tenants, {
    fields: [availability.tenantId],
    references: [tenants.id],
  }),
}));

export const availabilitySlotsRelations = relations(availabilitySlots, ({ one }) => ({
  tenant: one(tenants, {
    fields: [availabilitySlots.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [availabilitySlots.userId],
    references: [users.id],
  }),
}));
