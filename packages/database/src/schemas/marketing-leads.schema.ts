/**
 * Marketing Leads Schema
 *
 * Post-chat handoff profiles created when a prospect clears the
 * engagement threshold. Idempotent per session_id so re-entering the
 * chat within 24h resumes the same lead rather than creating duplicates.
 */

import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenant.schema.js';

export const marketingLeads = pgTable(
  'marketing_leads',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id').notNull(),

    role: text('role'),
    portfolioSize: text('portfolio_size'),
    country: text('country'),
    primaryPain: text('primary_pain'),
    summary: text('summary').notNull(),

    turnCount: integer('turn_count').notNull().default(0),
    explicitSignupIntent: boolean('explicit_signup_intent').notNull().default(false),

    contactName: text('contact_name'),
    contactMethod: text('contact_method'),
    contactValue: text('contact_value'),

    convertedToTenantId: text('converted_to_tenant_id').references(
      () => tenants.id,
      { onDelete: 'set null' }
    ),
    convertedAt: timestamp('converted_at', { withTimezone: true }),

    idempotencyKey: text('idempotency_key').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    sessionIdx: uniqueIndex('uq_marketing_leads_session').on(table.sessionId),
    idempotencyIdx: uniqueIndex('uq_marketing_leads_idempotency').on(
      table.idempotencyKey
    ),
    countryIdx: index('idx_marketing_leads_country').on(
      table.country,
      table.createdAt
    ),
    roleIdx: index('idx_marketing_leads_role').on(table.role, table.createdAt),
  })
);
