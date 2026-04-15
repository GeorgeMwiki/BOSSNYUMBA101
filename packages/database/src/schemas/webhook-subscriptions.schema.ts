/**
 * Webhook Subscriptions Schema - BOSSNYUMBA Platform
 *
 * Persistent store for webhook subscriptions. Backs
 * DatabaseWebhookStore in services/webhooks when WEBHOOKS_STORE=database.
 *
 * URL http(s) validation is enforced in application code, not via a DB
 * check constraint, so the webhook service can return a clear 400 to the
 * API caller rather than a generic DB error.
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';

export const webhookSubscriptions = pgTable(
  'webhook_subscriptions',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    url: text('url').notNull(),
    // WebhookEventType[] — typed in the webhooks service
    events: jsonb('events').notNull(),
    // Nullable HMAC signing secret
    secret: text('secret'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantActiveIdx: index('webhook_subscriptions_tenant_active_idx').on(
      table.tenantId,
      table.active
    ),
  })
);

export type WebhookSubscriptionRecord = typeof webhookSubscriptions.$inferSelect;
export type NewWebhookSubscriptionRecord = typeof webhookSubscriptions.$inferInsert;
