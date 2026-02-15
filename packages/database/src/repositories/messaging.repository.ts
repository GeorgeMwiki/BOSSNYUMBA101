/**
 * Messaging Repository
 * PostgreSQL implementation for Conversation, Message, and Participant persistence
 */

import {
  eq,
  and,
  desc,
  isNull,
  count,
  sql,
} from 'drizzle-orm';
import type { DatabaseClient } from '../client.js';
import {
  conversations,
  messages,
  conversationParticipants,
} from '../schemas/index.js';
import type { TenantId } from '@bossnyumba/domain-models';
import { buildPaginatedResult } from './base.repository.js';

export class MessagingRepository {
  constructor(private db: DatabaseClient) {}

  async createConversation(data: typeof conversations.$inferInsert) {
    const [row] = await this.db.insert(conversations).values(data).returning();
    return row!;
  }

  async getConversation(id: string, tenantId: TenantId) {
    const rows = await this.db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.tenantId, tenantId)));
    return rows[0] ?? null;
  }

  async getConversations(
    tenantId: TenantId,
    options?: { type?: string; status?: string; limit?: number; offset?: number }
  ) {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const conditions = [eq(conversations.tenantId, tenantId)];

    if (options?.type) {
      conditions.push(eq(conversations.type, options.type));
    }
    if (options?.status) {
      conditions.push(eq(conversations.status, options.status));
    }

    const rows = await this.db
      .select()
      .from(conversations)
      .where(and(...conditions))
      .orderBy(desc(conversations.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(conversations)
      .where(and(...conditions));

    return buildPaginatedResult(rows, total, { limit, offset });
  }

  async createMessage(data: typeof messages.$inferInsert) {
    const [row] = await this.db.insert(messages).values(data).returning();
    return row!;
  }

  async getMessages(
    conversationId: string,
    options?: { limit?: number; offset?: number }
  ) {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    return this.db
      .select()
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), isNull(messages.deletedAt)))
      .orderBy(desc(messages.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async markAsRead(
    conversationId: string,
    participant: { userId?: string; customerId?: string }
  ) {
    const conditions = [eq(conversationParticipants.conversationId, conversationId)];
    if (participant.userId) {
      conditions.push(eq(conversationParticipants.userId, participant.userId));
    } else if (participant.customerId) {
      conditions.push(eq(conversationParticipants.customerId, participant.customerId));
    } else {
      return null;
    }
    const [row] = await this.db
      .update(conversationParticipants)
      .set({ lastReadAt: new Date() })
      .where(and(...conditions, isNull(conversationParticipants.leftAt)))
      .returning();
    return row ?? null;
  }

  async addParticipant(data: typeof conversationParticipants.$inferInsert) {
    const [row] = await this.db
      .insert(conversationParticipants)
      .values(data)
      .returning();
    return row!;
  }

  async removeParticipant(
    conversationId: string,
    participant: { userId?: string; customerId?: string }
  ) {
    const conditions = [eq(conversationParticipants.conversationId, conversationId)];
    if (participant.userId) {
      conditions.push(eq(conversationParticipants.userId, participant.userId));
    } else if (participant.customerId) {
      conditions.push(eq(conversationParticipants.customerId, participant.customerId));
    } else {
      return null;
    }
    const [row] = await this.db
      .update(conversationParticipants)
      .set({ leftAt: new Date() })
      .where(and(...conditions))
      .returning();
    return row ?? null;
  }

  async getUnreadCount(
    participant: { userId?: string; customerId?: string },
    tenantId: TenantId
  ) {
    const participantConditions = [
      eq(conversationParticipants.conversationId, messages.conversationId),
      isNull(conversationParticipants.leftAt),
    ];
    if (participant.userId) {
      participantConditions.push(eq(conversationParticipants.userId, participant.userId));
    } else if (participant.customerId) {
      participantConditions.push(eq(conversationParticipants.customerId, participant.customerId));
    } else {
      return 0;
    }
    const result = await this.db
      .select({ count: count() })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .innerJoin(
        conversationParticipants,
        and(...participantConditions)
      )
      .where(
        and(
          eq(conversations.tenantId, tenantId),
          isNull(messages.deletedAt),
          sql`${messages.createdAt} > COALESCE(${conversationParticipants.lastReadAt}, '1970-01-01'::timestamptz)`
        )
      );
    return Number(result[0]?.count ?? 0);
  }
}
