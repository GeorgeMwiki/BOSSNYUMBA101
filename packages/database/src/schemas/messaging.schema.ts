/**
 * Messaging Schemas
 */

import {
  pgTable,
  text,
  timestamp,
  jsonb,
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
