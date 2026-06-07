/**
 * Dead-letter drainer — re-processes dead-lettered notifications through the
 * full failover + cross-channel chain, with backoff + a hard redrain cap and
 * cross-replica lock gating.
 */

import { describe, it, expect } from 'vitest';
import { createDlqDrainer } from '../dlq-drainer.js';
import type {
  DeadLetterRecord,
  DispatchResult,
  DrainableDeadLetterSource,
  EnqueueNotificationInput,
} from '../dispatcher.js';
import type { TenantId } from '../types/index.js';

const silentLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

function makeRecord(over: Partial<DeadLetterRecord> = {}): DeadLetterRecord {
  return {
    tenantId: 'tenant-1' as TenantId,
    userId: 'user-a',
    channel: 'sms',
    templateId: 'rent_due',
    recipient: '+254700000000',
    body: 'Hello',
    attempts: 3,
    lastError: 'all channels exhausted',
    deadLetteredAt: new Date(),
    ...over,
  };
}

/** Minimal array-backed source implementing the drainable contract. */
function makeSource(initial: DeadLetterRecord[] = []): DrainableDeadLetterSource & {
  readonly records: DeadLetterRecord[];
  size(): number;
} {
  const records = [...initial];
  return {
    records,
    drain(max = 50) {
      return records.splice(0, max);
    },
    push(record) {
      records.push(record);
    },
    size() {
      return records.length;
    },
  };
}

describe('createDlqDrainer', () => {
  it('redelivers a dead-lettered record and removes it from the queue', async () => {
    const source = makeSource([makeRecord()]);
    const seen: EnqueueNotificationInput[] = [];
    const drainer = createDlqDrainer({
      source,
      logger: silentLogger,
      enqueue: async (input): Promise<DispatchResult> => {
        seen.push(input);
        return { accepted: true, externalId: 'ok-1', attempts: 1 };
      },
    });

    const result = await drainer.drainOnce();
    expect(result.claimed).toBe(1);
    expect(result.redelivered).toBe(1);
    expect(result.requeued).toBe(0);
    expect(source.size()).toBe(0);
    // The redelivery dropped the drainer bookkeeping fields.
    expect(seen[0]).not.toHaveProperty('deadLetteredAt');
    expect(seen[0]?.channel).toBe('sms');
  });

  it('requeues with an incremented attempt + backoff when redelivery still fails', async () => {
    const source = makeSource([makeRecord()]);
    const drainer = createDlqDrainer({
      source,
      logger: silentLogger,
      now: () => 1_000_000,
      enqueue: async (): Promise<DispatchResult> => ({
        accepted: false,
        deadLettered: true,
        attempts: 3,
        lastError: 'still down',
      }),
    });

    const result = await drainer.drainOnce();
    expect(result.redelivered).toBe(0);
    expect(result.requeued).toBe(1);
    expect(source.size()).toBe(1);
    const requeued = source.records[0] as DeadLetterRecord & {
      redrainAttempts?: number;
      notBefore?: number;
    };
    expect(requeued.redrainAttempts).toBe(1);
    expect(requeued.notBefore).toBeGreaterThan(1_000_000);
  });

  it('does not re-attempt a record whose backoff window has not elapsed', async () => {
    const source = makeSource([
      makeRecord({
        ...({ redrainAttempts: 1, notBefore: 2_000_000 } as Partial<DeadLetterRecord>),
      }),
    ]);
    let enqueueCalls = 0;
    const drainer = createDlqDrainer({
      source,
      logger: silentLogger,
      now: () => 1_000_000, // before notBefore
      enqueue: async (): Promise<DispatchResult> => {
        enqueueCalls += 1;
        return { accepted: true, attempts: 1 };
      },
    });

    const result = await drainer.drainOnce();
    expect(enqueueCalls).toBe(0);
    expect(result.requeued).toBe(1);
    expect(source.size()).toBe(1);
  });

  it('marks a record exhausted after the max redrain attempts (never silently dropped)', async () => {
    const source = makeSource([
      makeRecord({
        ...({ redrainAttempts: 4 } as Partial<DeadLetterRecord>),
      }),
    ]);
    const drainer = createDlqDrainer({
      source,
      logger: silentLogger,
      maxRedrainAttempts: 5,
      now: () => 1_000_000,
      enqueue: async (): Promise<DispatchResult> => ({
        accepted: false,
        deadLettered: true,
        attempts: 0,
        lastError: 'permanently down',
      }),
    });

    const result = await drainer.drainOnce();
    expect(result.exhausted).toBe(1);
    expect(result.requeued).toBe(0);
    // Still present (not dropped), but parked so it is never auto-retried.
    expect(source.size()).toBe(1);
    const parked = source.records[0] as DeadLetterRecord & {
      redrainAttempts?: number;
      notBefore?: number;
    };
    expect(parked.redrainAttempts).toBe(5);
    expect(parked.notBefore).toBe(Number.MAX_SAFE_INTEGER);
    expect(String(parked.lastError)).toContain('redrain exhausted');
  });

  it('does nothing when the cross-replica lock is not held', async () => {
    const source = makeSource([makeRecord()]);
    let enqueueCalls = 0;
    const drainer = createDlqDrainer({
      source,
      logger: silentLogger,
      withLock: async () => ({ ran: false }),
      enqueue: async (): Promise<DispatchResult> => {
        enqueueCalls += 1;
        return { accepted: true, attempts: 1 };
      },
    });

    const result = await drainer.drainOnce();
    expect(enqueueCalls).toBe(0);
    expect(result.claimed).toBe(0);
    // Records untouched because the critical section never ran.
    expect(source.size()).toBe(1);
  });

  it('treats an enqueue throw as a failed redelivery (requeue, not crash)', async () => {
    const source = makeSource([makeRecord()]);
    const drainer = createDlqDrainer({
      source,
      logger: silentLogger,
      now: () => 1_000_000,
      enqueue: async (): Promise<DispatchResult> => {
        throw new Error('dispatcher blew up');
      },
    });

    const result = await drainer.drainOnce();
    expect(result.requeued).toBe(1);
    expect(source.size()).toBe(1);
  });
});
