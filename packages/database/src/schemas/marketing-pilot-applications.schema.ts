/**
 * marketing_pilot_applications — inbound landlord / property-manager
 * pilot applications persisted from
 * `POST /api/v1/marketing/pilot-application`.
 *
 * Public-write, SUPER_ADMIN-read via RLS policy
 * (`pilot_app_insert` / `pilot_app_select_super_admin`).
 *
 * Migration 0275. Ported from Borjie 0146 with property_focus
 * replacing mineral_focus.
 */

import {
  pgTable,
  text,
  integer,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

export const PROPERTY_FOCUS_VALUES = [
  'residential',
  'commercial',
  'mixed',
  'industrial',
  'student_housing',
  'vacation_rental',
  'other',
] as const;
export type PropertyFocus = (typeof PROPERTY_FOCUS_VALUES)[number];

export const marketingPilotApplications = pgTable(
  'marketing_pilot_applications',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    company: text('company').notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull(),
    /** Number of units / properties the prospect manages. */
    portfolioSize: integer('portfolio_size').notNull(),
    /** Real-estate property focus — see PROPERTY_FOCUS_VALUES. */
    propertyFocus: text('property_focus').$type<PropertyFocus>().notNull(),
    sourceIp: text('source_ip'),
    userAgent: text('user_agent'),
    metadata: jsonb('metadata').notNull().default({}),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    acknowledgedBy: text('acknowledged_by'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    createdAtIdx: index('idx_marketing_pilot_applications_created_at').on(
      t.createdAt,
    ),
  }),
);

export type MarketingPilotApplication =
  typeof marketingPilotApplications.$inferSelect;
export type NewMarketingPilotApplication =
  typeof marketingPilotApplications.$inferInsert;
