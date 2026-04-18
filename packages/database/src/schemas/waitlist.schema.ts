/**
 * Waitlist Schema
 *
 * Two tables backing auto-outreach on vacancy (NEW 12):
 *  - unit_waitlists           : prospects interested in a unit/listing
 *  - waitlist_outreach_events : append-only audit of outreach messages
 *
 * On `UnitVacatedEvent`, the waitlist-vacancy-handler dispatches a
 * priority-ordered wave of outreach via the NBA queue. Dedup is enforced
 * at the unique index below.
 */

import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenant.schema.js';
import { units } from './property.schema.js';
import { customers } from './customer.schema.js';

// ============================================================================
// Enums
// ============================================================================

export const waitlistStatusEnum = pgEnum('waitlist_status', [
  'active',
  'converted',
  'expired',
  'opted_out',
]);

export const waitlistSourceEnum = pgEnum('waitlist_source', [
  'enquiry',
  'failed_application',
  'manual_add',
  'marketplace_save',
  'ai_recommended',
]);

export const waitlistChannelEnum = pgEnum('waitlist_channel', [
  'sms',
  'whatsapp',
  'email',
  'push',
  'in_app',
]);

export const waitlistOutreachEventTypeEnum = pgEnum(
  'waitlist_outreach_event_type',
  [
    'vacancy_notified',
    'viewed',
    'applied',
    'declined',
    'opted_out',
    'delivery_failed',
  ]
);

// ============================================================================
// Unit Waitlists
// ============================================================================

export const unitWaitlists = pgTable(
  'unit_waitlists',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    unitId: text('unit_id').references(() => units.id),
    listingId: text('listing_id'),

    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id),

    // Lower number = higher priority; 0 = top.
    priority: integer('priority').notNull().default(100),

    source: waitlistSourceEnum('source').notNull().default('enquiry'),

    status: waitlistStatusEnum('status').notNull().default('active'),

    notificationPreferenceId: text('notification_preference_id'),
    preferredChannels: jsonb('preferred_channels').default([]),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    convertedAt: timestamp('converted_at', { withTimezone: true }),
    optedOutAt: timestamp('opted_out_at', { withTimezone: true }),
    optOutReason: text('opt_out_reason'),

    lastNotifiedAt: timestamp('last_notified_at', { withTimezone: true }),
    notificationCount: integer('notification_count').notNull().default(0),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantIdx: index('unit_waitlists_tenant_idx').on(table.tenantId),
    unitIdx: index('unit_waitlists_unit_idx').on(table.unitId),
    customerIdx: index('unit_waitlists_customer_idx').on(table.customerId),
    statusIdx: index('unit_waitlists_status_idx').on(
      table.tenantId,
      table.status
    ),
    // Dedup: one active waitlist row per (customer, unit)
    uniqueActiveIdx: uniqueIndex('unit_waitlists_unique_active_idx').on(
      table.tenantId,
      table.unitId,
      table.customerId
    ),
  })
);

// ============================================================================
// Waitlist Outreach Events (APPEND-ONLY)
// ============================================================================

export const waitlistOutreachEvents = pgTable(
  'waitlist_outreach_events',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    waitlistId: text('waitlist_id')
      .notNull()
      .references(() => unitWaitlists.id, { onDelete: 'cascade' }),

    eventType: waitlistOutreachEventTypeEnum('event_type').notNull(),
    channel: waitlistChannelEnum('channel').notNull(),

    messagePayload: jsonb('message_payload').notNull().default({}),
    correlationId: text('correlation_id'),

    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    // Delivery metadata
    providerMessageId: text('provider_message_id'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
  },
  (table) => ({
    tenantIdx: index('waitlist_outreach_events_tenant_idx').on(table.tenantId),
    waitlistIdx: index('waitlist_outreach_events_waitlist_idx').on(
      table.waitlistId
    ),
    occurredAtIdx: index('waitlist_outreach_events_occurred_at_idx').on(
      table.occurredAt
    ),
    typeIdx: index('waitlist_outreach_events_type_idx').on(
      table.waitlistId,
      table.eventType
    ),
  })
);

// ============================================================================
// Relations
// ============================================================================

export const unitWaitlistsRelations = relations(
  unitWaitlists,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [unitWaitlists.tenantId],
      references: [tenants.id],
    }),
    unit: one(units, {
      fields: [unitWaitlists.unitId],
      references: [units.id],
    }),
    customer: one(customers, {
      fields: [unitWaitlists.customerId],
      references: [customers.id],
    }),
    outreachEvents: many(waitlistOutreachEvents),
  })
);

export const waitlistOutreachEventsRelations = relations(
  waitlistOutreachEvents,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [waitlistOutreachEvents.tenantId],
      references: [tenants.id],
    }),
    waitlist: one(unitWaitlists, {
      fields: [waitlistOutreachEvents.waitlistId],
      references: [unitWaitlists.id],
    }),
  })
);
