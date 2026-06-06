/**
 * Drizzle-backed transactional outbox repository (M1).
 *
 * Persists domain events to the `event_outbox` table so the durable
 * publisher's writes survive restarts and a relay/worker can deliver
 * them at-least-once. Implements the `IOutboxRepository` contract
 * declared alongside the publisher.
 *
 * Notes:
 *   - `event_outbox.sequence_number` is NOT NULL and globally ordered.
 *     We assign it per row as `coalesce(max(sequence_number),0)+offset`
 *     computed INSIDE each INSERT (a single `INSERT … SELECT …` form)
 *     rather than a separate SELECT-MAX-then-INSERT, so there is no
 *     read-then-write race window between the max read and the insert.
 *     There is no unique constraint on it, so a rare tie under extreme
 *     concurrency just yields equal ordering — the relay also orders by
 *     `created_at`.
 *   - `status` defaults to 'pending'; the relay flips it to 'published'
 *     via {@link markPublished}. `recordFailure` bumps retry tracking.
 *   - Tenant id may be null (some platform-level events are not tenant
 *     scoped); the column is nullable in the schema.
 */
import { and, eq, isNull, lt, sql, type SQL } from 'drizzle-orm';
import {
  eventOutbox,
  type DatabaseClient,
  type EventOutboxRecord,
} from '@bossnyumba/database';
import type { TenantId } from '@bossnyumba/domain-models';
import type {
  IOutboxRepository,
  OutboxEntry,
} from '../events/event-publisher';
import type { RepoTx } from './transaction';

function rowToEntry(row: EventOutboxRecord): OutboxEntry {
  return {
    id: row.id,
    aggregateType: row.aggregateType,
    aggregateId: row.aggregateId,
    eventType: row.eventType,
    payload:
      typeof row.payload === 'string'
        ? row.payload
        : JSON.stringify(row.payload),
    tenantId: (row.tenantId ?? '') as TenantId,
    createdAt: row.createdAt,
    publishedAt: row.publishedAt ?? undefined,
    retryCount: row.retryCount,
    lastError: row.lastError ?? undefined,
  };
}

export class DrizzleOutboxRepository implements IOutboxRepository {
  constructor(private readonly db: DatabaseClient) {}

  async addToOutbox(entries: OutboxEntry[], tx?: RepoTx): Promise<void> {
    if (entries.length === 0) return;

    // Co-commit on the caller's transaction when supplied (MUST-FIX 3a),
    // else use the top-level client. Both expose the same query surface.
    const writer = (tx ?? this.db) as DatabaseClient;

    const values = entries.map((e, idx) => {
      const payloadJson = (() => {
        try {
          return JSON.parse(e.payload) as unknown;
        } catch {
          // Defensive: store the raw string under a wrapper if it is not
          // valid JSON (should never happen — publisher serialises it).
          return { raw: e.payload };
        }
      })();
      return {
        id: e.id,
        tenantId: e.tenantId ? String(e.tenantId) : null,
        eventType: e.eventType,
        aggregateType: e.aggregateType,
        aggregateId: e.aggregateId,
        payload: payloadJson,
        // SHOULD-FIX: assign the sequence number INSIDE the INSERT via a
        // correlated subquery instead of SELECT-MAX-then-INSERT, removing
        // the read-then-write race. Each row in the batch gets a distinct,
        // increasing value (+1, +2, …) computed at insert time. Drizzle
        // `.values()` accepts a `SQL` expression for a column even though
        // the inferred-insert type narrows `sequenceNumber` to `number`,
        // so we annotate the row as the insert type with this one field
        // widened to allow the subquery.
        sequenceNumber: sql<number>`(SELECT COALESCE(MAX(${eventOutbox.sequenceNumber}), 0) FROM ${eventOutbox}) + ${idx + 1}`,
        retryCount: e.retryCount,
        lastError: e.lastError ?? null,
        createdAt: e.createdAt,
      } satisfies Omit<typeof eventOutbox.$inferInsert, 'sequenceNumber'> & {
        sequenceNumber: SQL<number>;
      };
    });

    await writer.insert(eventOutbox).values(values);
  }

  async getUnpublished(limit: number): Promise<OutboxEntry[]> {
    const rows = await this.db
      .select()
      .from(eventOutbox)
      .where(isNull(eventOutbox.publishedAt))
      .orderBy(eventOutbox.sequenceNumber)
      .limit(Math.max(1, Math.min(1000, Math.floor(limit))));
    return rows.map(rowToEntry);
  }

  async markPublished(id: string): Promise<void> {
    await this.db
      .update(eventOutbox)
      .set({ status: 'published', publishedAt: new Date() })
      .where(eq(eventOutbox.id, id));
  }

  async recordFailure(id: string, error: string): Promise<void> {
    await this.db
      .update(eventOutbox)
      .set({
        status: 'failed',
        lastError: error,
        retryCount: sql`${eventOutbox.retryCount} + 1`,
      })
      .where(eq(eventOutbox.id, id));
  }

  async cleanup(olderThan: Date): Promise<number> {
    const deleted = await this.db
      .delete(eventOutbox)
      .where(
        and(
          eq(eventOutbox.status, 'published'),
          lt(eventOutbox.createdAt, olderThan),
        ),
      )
      .returning({ id: eventOutbox.id });
    return deleted.length;
  }
}
