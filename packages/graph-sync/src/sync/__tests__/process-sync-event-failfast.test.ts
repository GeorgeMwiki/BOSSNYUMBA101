/**
 * M8 closure (round-3 audit): processSyncEvent must support a
 * `throwOnError: true` opt-in that rethrows the handler error after
 * populating `result.errors[]`. The default (swallow into errors[])
 * stays unchanged for outbox-drainer semantics.
 */

import { describe, it, expect } from 'vitest';
import { GraphSyncEngine, type SyncEvent } from '../graph-sync-engine.js';
import type { Neo4jClient } from '../../client/neo4j-client.js';

function makeFailingClient(message: string): Neo4jClient {
  const client = {
    async writeQuery(): Promise<never> {
      throw new Error(message);
    },
    async readQuery(): Promise<never> {
      throw new Error(message);
    },
    async close(): Promise<void> {
      /* no-op */
    },
  } as unknown as Neo4jClient;
  return client;
}

const SAMPLE_EVENT: SyncEvent = {
  eventType: 'GenericCreated',
  entityType: 'Widget',
  entityId: 'w-1',
  tenantId: 't-1',
  data: { name: 'demo' },
  timestamp: '2026-05-19T00:00:00.000Z',
};

describe('GraphSyncEngine.processSyncEvent (M8)', () => {
  it('defaults to swallowing errors into result.errors[]', async () => {
    const engine = new GraphSyncEngine(makeFailingClient('neo down'));
    const result = await engine.processSyncEvent(SAMPLE_EVENT);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain('neo down');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('rethrows when throwOnError is true (M8)', async () => {
    const engine = new GraphSyncEngine(makeFailingClient('neo down'));
    await expect(
      engine.processSyncEvent(SAMPLE_EVENT, { throwOnError: true }),
    ).rejects.toThrow(/neo down/);
  });

  it('throwOnError=false matches the default swallow behaviour', async () => {
    const engine = new GraphSyncEngine(makeFailingClient('neo down'));
    const result = await engine.processSyncEvent(SAMPLE_EVENT, {
      throwOnError: false,
    });
    expect(result.errors.length).toBe(1);
  });
});
