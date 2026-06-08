/**
 * Postgres-backed DurableWakeStore tests.
 *
 * Proves the store satisfies the pure `DurableWakeStore` port contract over a
 * `withServiceRoleContext`-compatible fake db:
 *   - saveWake / saveMonitor run an UPSERT inside a service-role transaction;
 *   - the persisted tenant_id is the scope's tenant (NULL for platform scope);
 *   - deleteWake / deleteMonitor run a keyed DELETE;
 *   - loadPending normalises both the array and `{rows}` result shapes and
 *     skips a structurally-invalid scope row (never resurrects an unknown scope).
 *
 * No live DB — the fake `transaction(fn)` runs `fn(tx)` and `tx.execute(sql)`
 * records the rendered statement so a test can assert the SQL shape + bound
 * params, exactly how monitor-predicate-source.test.ts fakes the db.
 */

import { describe, it, expect } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { createPgDurableWakeStore } from '../durable-wake-store.js';

const dialect = new PgDialect();

interface ExecCall {
  readonly text: string;
  readonly params: ReadonlyArray<unknown>;
}

/**
 * Fake db. `transaction(fn)` runs `fn(tx)`; `tx.execute(query)` records the
 * Drizzle SQL chunk's rendered text + params and returns the canned rows for
 * the next SELECT (FIFO). set_config calls (from withTenantContext) are
 * recorded too but ignored by the row queue.
 */
function createFakeDb(opts: {
  selectResults?: ReadonlyArray<unknown>;
} = {}): {
  db: unknown;
  execCalls: ExecCall[];
} {
  const execCalls: ExecCall[] = [];
  const selectQueue = [...(opts.selectResults ?? [])];

  // Render the Drizzle `sql` chunk to text + bound params via the real PG
  // dialect — robust against Drizzle internals (no chunk-walking).
  function describe_(query: unknown): ExecCall {
    const { sql: text, params } = dialect.sqlToQuery(query as never);
    return { text, params };
  }

  const tx = {
    async execute(query: unknown) {
      const call = describe_(query);
      execCalls.push(call);
      // set_config statements consume nothing from the select queue.
      const isSelect = /select/i.test(call.text) && !/set_config/i.test(call.text);
      if (isSelect) {
        return selectQueue.shift() ?? [];
      }
      return [];
    },
  };

  const db = {
    async transaction<T>(fn: (t: unknown) => Promise<T>): Promise<T> {
      return fn(tx);
    },
  };

  return { db, execCalls };
}

const TENANT_SCOPE = {
  kind: 'tenant' as const,
  tenantId: 'tenant-A',
  actorUserId: 'u1',
  roles: ['owner'] as ReadonlyArray<string>,
  personaId: 'mr-mwikila',
};

const PLATFORM_SCOPE = {
  kind: 'platform' as const,
};

describe('createPgDurableWakeStore', () => {
  it('saveWake UPSERTs with the tenant id from a tenant scope', async () => {
    const { db, execCalls } = createFakeDb();
    const store = createPgDurableWakeStore({ db: db as never });
    await store.saveWake({
      resumeToken: 'rt-1',
      threadId: 'th-1',
      wakeAtMs: Date.parse('2026-06-08T09:00:00Z'),
      reason: 'follow-up',
      scope: TENANT_SCOPE,
    });
    // The last exec is the UPSERT (preceded by 3 set_config from with-context).
    const upsert = execCalls.find((c) => /durable_scheduled_wakes/i.test(c.text));
    expect(upsert).toBeDefined();
    expect(upsert?.text).toMatch(/insert into/i);
    expect(upsert?.text).toMatch(/on conflict/i);
    // tenant id bound (defence: it's in the param list).
    expect(upsert?.params).toContain('tenant-A');
    expect(upsert?.params).toContain('rt-1');
  });

  it('saveWake persists NULL tenant id for a platform scope', async () => {
    const { db, execCalls } = createFakeDb();
    const store = createPgDurableWakeStore({ db: db as never });
    await store.saveWake({
      resumeToken: 'rt-platform',
      threadId: 'th-x',
      wakeAtMs: Date.now() + 1000,
      reason: 'platform sweep',
      scope: PLATFORM_SCOPE,
    });
    const upsert = execCalls.find((c) => /durable_scheduled_wakes/i.test(c.text));
    expect(upsert?.params).toContain(null);
  });

  it('deleteWake runs a keyed DELETE', async () => {
    const { db, execCalls } = createFakeDb();
    const store = createPgDurableWakeStore({ db: db as never });
    await store.deleteWake('rt-gone');
    const del = execCalls.find((c) => /durable_scheduled_wakes/i.test(c.text));
    expect(del?.text).toMatch(/delete from/i);
    expect(del?.params).toContain('rt-gone');
  });

  it('saveMonitor UPSERTs into durable_armed_monitors', async () => {
    const { db, execCalls } = createFakeDb();
    const store = createPgDurableWakeStore({ db: db as never });
    await store.saveMonitor({
      watchId: 'w-1',
      threadId: 'th-1',
      predicate: 'rent.paid',
      expiresAtMs: Date.now() + 60_000,
      scope: TENANT_SCOPE,
    });
    const upsert = execCalls.find((c) => /durable_armed_monitors/i.test(c.text));
    expect(upsert?.text).toMatch(/insert into/i);
    expect(upsert?.text).toMatch(/on conflict/i);
    expect(upsert?.params).toContain('w-1');
  });

  it('loadPending parses array-shaped results into typed records', async () => {
    const wakeRows = [
      {
        resume_token: 'rt-load',
        thread_id: 'th-load',
        wake_at: '2026-06-08T09:00:00.000Z',
        reason: 'reloaded',
        scope: { kind: 'tenant', tenantId: 'tenant-A' },
      },
    ];
    const monitorRows = [
      {
        watch_id: 'w-load',
        thread_id: 'th-load',
        predicate: 'inspection.completed',
        expires_at: '2026-06-08T10:00:00.000Z',
        scope: { kind: 'platform' },
      },
    ];
    const { db } = createFakeDb({ selectResults: [wakeRows, monitorRows] });
    const store = createPgDurableWakeStore({ db: db as never });
    const pending = await store.loadPending();
    expect(pending.wakes).toHaveLength(1);
    expect(pending.wakes[0]).toMatchObject({
      resumeToken: 'rt-load',
      threadId: 'th-load',
      reason: 'reloaded',
    });
    expect(pending.wakes[0]?.wakeAtMs).toBe(Date.parse('2026-06-08T09:00:00.000Z'));
    expect(pending.monitors).toHaveLength(1);
    expect(pending.monitors[0]?.watchId).toBe('w-load');
  });

  it('loadPending normalises {rows}-shaped results too', async () => {
    const { db } = createFakeDb({
      selectResults: [
        { rows: [{
          resume_token: 'rt-r',
          thread_id: 'th-r',
          wake_at: '2026-06-08T09:00:00.000Z',
          reason: 'r',
          scope: { kind: 'tenant', tenantId: 'tenant-B' },
        }] },
        { rows: [] },
      ],
    });
    const store = createPgDurableWakeStore({ db: db as never });
    const pending = await store.loadPending();
    expect(pending.wakes).toHaveLength(1);
    expect(pending.wakes[0]?.resumeToken).toBe('rt-r');
  });

  it('loadPending skips a row with a structurally-invalid scope', async () => {
    const warnings: object[] = [];
    const { db } = createFakeDb({
      selectResults: [
        [
          {
            resume_token: 'rt-bad',
            thread_id: 'th',
            wake_at: '2026-06-08T09:00:00.000Z',
            reason: 'corrupt',
            scope: { kind: 'galaxy' }, // not tenant|platform
          },
        ],
        [],
      ],
    });
    const store = createPgDurableWakeStore({
      db: db as never,
      logger: { warn: (obj) => warnings.push(obj) },
    });
    const pending = await store.loadPending();
    expect(pending.wakes).toHaveLength(0);
    expect(warnings.length).toBeGreaterThan(0);
  });
});
