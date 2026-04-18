/**
 * Messaging Schemas
 */

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenant.schema.js';
import { users } from './tenant.schema.js';
import { customers } from './customer.schema.js';

// ============================================================================
// Enums
// ============================================================================

export const conversationTypeEnum = pgEnum('conversation_type', [
  'support',
  'maintenance',
  'general',
  'lease',
  'payment',
  'other',
]);

export const conversationStatusEnum = pgEnum('conversation_status', [
  'open',
  'in_progress',
  'resolved',
  'closed',
  'archived',
]);

// ============================================================================
// Conversations Table
// ============================================================================

export const conversations = pgTable(
  'conversations',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    customerId: text('customer_id').references(() => customers.id, { onDelete: 'set null' }),

    // Classification
    type: conversationTypeEnum('type').notNull().default('general'),
    status: conversationStatusEnum('status').notNull().default('open'),
    title: text('title'),

    // Metadata
    metadata: jsonb('metadata').default({}),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    closedBy: text('closed_by'),
  },
  (table) => ({
    tenantIdx: index('conversations_tenant_idx').on(table.tenantId),
    customerIdx: index('conversations_customer_idx').on(table.customerId),
    typeIdx: index('conversations_type_idx').on(table.type),
    statusIdx: index('conversations_status_idx').on(table.status),
    lastMessageAtIdx: index('conversations_last_message_at_idx').on(table.lastMessageAt),
  })
);

// ============================================================================
// Messages Table
// ============================================================================

export const messages = pgTable(
  'messages',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    senderId: text('sender_id').notNull(),

    // Content
    content: text('content').notNull(),
    attachments: jsonb('attachments').default([]),

    // Read tracking
    readAt: timestamp('read_at', { withTimezone: true }),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: text('deleted_by'),
  },
  (table) => ({
    conversationIdx: index('messages_conversation_idx').on(table.conversationId),
    senderIdx: index('messages_sender_idx').on(table.senderId),
    createdAtIdx: index('messages_created_at_idx').on(table.conversationId, table.createdAt),
  })
);

// ============================================================================
// Conversation Participants Table
// ============================================================================

export const conversationParticipants = pgTable(
  'conversation_participants',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    customerId: text('customer_id').references(() => customers.id, { onDelete: 'cascade' }),

    // Participation
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    leftAt: timestamp('left_at', { withTimezone: true }),
    lastReadAt: timestamp('last_read_at', { withTimezone: true }),
  },
  (table) => ({
    conversationIdx: index('conversation_participants_conversation_idx').on(table.conversationId),
    userIdx: index('conversation_participants_user_idx').on(table.userId),
    customerIdx: index('conversation_participants_customer_idx').on(table.customerId),
    convUserIdx: uniqueIndex('conversation_participants_conv_user_idx').on(table.conversationId, table.userId),
    convCustomerIdx: uniqueIndex('conversation_participants_conv_customer_idx').on(table.conversationId, table.customerId),
  })
);

// ============================================================================
// Notifications Dispatch Log (SMS/WhatsApp/Email unified delivery tracking)
// ============================================================================
//
// Per-attempt record for outbound notifications dispatched by the
// notifications service. Separate from `messages` (inbound/outbound
// conversation messages) — this table captures the transactional
// lifecycle of a send, including retries and provider-reported status.

export const notificationDeliveryStatusEnum = pgEnum('notification_delivery_status', [
  'pending',
  'queued',
  'sending',
  'sent',
  'delivered',
  'read',
  'failed',
  'bounced',
  'blocked',
  'expired',
  'unknown',
]);

export const notificationDispatchLog = pgTable(
  'notification_dispatch_log',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

    // Recipient context
    userId: text('user_id'),
    customerId: text('customer_id'),

    // Target + template
    channel: text('channel').notNull(), // 'sms' | 'whatsapp' | 'email' | 'push' | 'in_app'
    recipientAddress: text('recipient_address').notNull(),
    templateKey: text('template_key').notNull(),
    locale: text('locale').default('en'),
    payload: jsonb('payload').default({}),

    // Correlation
    correlationId: text('correlation_id'),
    idempotencyKey: text('idempotency_key'),

    // Attempt tracking (per NEW 21 spec)
    attemptCount: integer('attempt_count').notNull().default(0),

    // Delivery status lifecycle (per NEW 21 spec)
    deliveryStatus: notificationDeliveryStatusEnum('delivery_status')
      .notNull()
      .default('pending'),
    deliveryReportedAt: timestamp('delivery_reported_at', { withTimezone: true }),

    // Provider
    provider: text('provider'),
    providerMessageId: text('provider_message_id'),
    providerResponse: jsonb('provider_response').default({}),
    providerErrorCode: text('provider_error_code'),
    providerErrorMessage: text('provider_error_message'),

    // Retry scheduling
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),

    // Dead-letter
    deadLetteredAt: timestamp('dead_lettered_at', { withTimezone: true }),
    deadLetterReason: text('dead_letter_reason'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('notification_dispatch_log_tenant_idx').on(table.tenantId),
    statusIdx: index('notification_dispatch_log_status_idx').on(table.deliveryStatus),
    userIdx: index('notification_dispatch_log_user_idx').on(table.userId),
    customerIdx: index('notification_dispatch_log_customer_idx').on(table.customerId),
    providerMsgIdx: index('notification_dispatch_log_provider_msg_idx').on(
      table.provider,
      table.providerMessageId
    ),
    nextRetryIdx: index('notification_dispatch_log_next_retry_idx').on(table.nextRetryAt),
    idempotencyIdx: uniqueIndex('notification_dispatch_log_idempotency_idx').on(
      table.tenantId,
      table.idempotencyKey
    ),
    correlationIdx: index('notification_dispatch_log_correlation_idx').on(table.correlationId),
  })
);

// ============================================================================
// Relations
// ============================================================================

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [conversations.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [conversations.customerId],
    references: [customers.id],
  }),
  messages: many(messages),
  participants: many(conversationParticipants),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
    relationName: 'messageSender',
  }),
}));

export const conversationParticipantsRelations = relations(conversationParticipants, ({ one }) => ({
  conversation: one(conversations, {
    fields: [conversationParticipants.conversationId],
    references: [conversations.id],
  }),
  user: one(users, {
    fields: [conversationParticipants.userId],
    references: [users.id],
  }),
  customer: one(customers, {
    fields: [conversationParticipants.customerId],
    references: [customers.id],
  }),
}));
