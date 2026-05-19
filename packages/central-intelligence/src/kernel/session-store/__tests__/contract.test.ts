/**
 * SessionStore shared contract suite — Phase K-A.
 *
 * Every adapter (InMemory / Redis / Postgres) MUST pass the same
 * contract suite so the orchestrator can swap backends without
 * caring about which one is wired. Tests use `describe.each` so the
 * same scenarios run against every adapter.
 *
 * The Redis + Postgres adapters use in-test STUBS for the underlying
 * client (so the test doesn't need a live Redis or Postgres). The
 * production adapters delegate to a real client; the stubs implement
 * the minimal narrow surface the adapter expects.
 *
 * Production callers wire the real client via the factory:
 *
 *   import { sessionStore } from '@bossnyumba/central-intelligence';
 *   const store = sessionStore.createSessionStore({
 *     kind: 'redis',
 *     redis: { redis: new Redis(process.env.REDIS_URL!) },
 *   });
 */

import { describe, it, expect } from 'vitest';
import {
  createInMemorySessionStore,
  createPostgresSessionStore,
  createRedisSessionStore,
  type PgQueryResult,
  type SessionListEntry,
  type SessionSnapshot,
  type SessionStore,
  type SessionStorePgLike,
  type SessionStoreRedisLike,
} from '../index.js';

// ─────────────────────────────────────────────────────────────────────
// Redis stub — implements the SessionStoreRedisLike surface using an
// in-process Map. Sufficient for the contract suite.
// ─────────────────────────────────────────────────────────────────────

function createRedisStub(): SessionStoreRedisLike {
  const kv = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  // Trivial expiry: a Map of key → wallclock-ms expiry. Lazy sweep on
  // every operation so a `pexpire(k, 1)` followed by a future read
  // returns null.
  const expiries = new Map<string, number>();
  function sweep(key: string): boolean {
    const e = expiries.get(key);
    if (e !== undefined && Date.now() >= e) {
      kv.delete(key);
      expiries.delete(key);
      return true;
    }
    return false;
  }
  return {
    async set(key, value): Promise<unknown> {
      sweep(key);
      kv.set(key, value);
      return 'OK';
    },
    async get(key): Promise<string | null> {
      sweep(key);
      return kv.has(key) ? (kv.get(key) as string) : null;
    },
    async del(...keys): Promise<number> {
      let n = 0;
      for (const k of keys) {
        if (kv.delete(k)) n += 1;
        expiries.delete(k);
      }
      return n;
    },
    async pexpire(key, ms): Promise<number> {
      if (!kv.has(key)) return 0;
      expiries.set(key, Date.now() + ms);
      return 1;
    },
    async sadd(key, ...members): Promise<number> {
      const set = sets.get(key) ?? new Set<string>();
      let added = 0;
      for (const m of members) {
        if (!set.has(m)) added += 1;
        set.add(m);
      }
      sets.set(key, set);
      return added;
    },
    async srem(key, ...members): Promise<number> {
      const set = sets.get(key);
      if (!set) return 0;
      let removed = 0;
      for (const m of members) {
        if (set.delete(m)) removed += 1;
      }
      return removed;
    },
    async smembers(key): Promise<string[]> {
      const set = sets.get(key);
      return set ? [...set] : [];
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Postgres stub — implements SessionStorePgLike using an in-process
// Map of rows. Sufficient for the contract suite; we ONLY parse the
// shape of the SQL well enough to dispatch INSERT/SELECT/DELETE.
// ─────────────────────────────────────────────────────────────────────

interface StubRow {
  session_id: string;
  tenant_id: string | null;
  persona_id: string;
  captured_at: string;
  expires_at: string | null;
  payload: Record<string, unknown>;
  resume_token: string | null;
  ttl_ms: number | null;
}

function createPgStub(): SessionStorePgLike & {
  rows(): ReadonlyArray<StubRow>;
} {
  const rows = new Map<string, StubRow>();

  function nowIso(): string {
    return new Date().toISOString();
  }

  // Lazy-sweep expired rows so SELECT honours TTL.
  function sweep(): void {
    const cutoff = Date.now();
    for (const [id, row] of rows.entries()) {
      if (row.expires_at && Date.parse(row.expires_at) <= cutoff) {
        rows.delete(id);
      }
    }
  }

  return {
    async query<T = unknown>(
      sql: string,
      params?: ReadonlyArray<unknown>,
    ): Promise<PgQueryResult<T>> {
      const s = sql.trim();
      sweep();

      if (s.startsWith('INSERT INTO')) {
        const [
          sessionId,
          tenantId,
          personaId,
          ttlMs,
          payloadJson,
          resumeToken,
        ] = params ?? [];
        const captured = nowIso();
        const expires =
          ttlMs === null
            ? null
            : new Date(Date.now() + Number(ttlMs as number)).toISOString();
        const row: StubRow = {
          session_id: sessionId as string,
          tenant_id: (tenantId as string | null) ?? null,
          persona_id: personaId as string,
          captured_at: captured,
          expires_at: expires,
          payload: JSON.parse(payloadJson as string) as Record<string, unknown>,
          resume_token: (resumeToken as string | null) ?? null,
          ttl_ms: ttlMs === null ? null : Number(ttlMs as number),
        };
        rows.set(row.session_id, row);
        return { rows: [row as unknown as T], rowCount: 1 };
      }

      if (s.startsWith('SELECT') && s.includes('WHERE session_id =')) {
        const [sessionId] = params ?? [];
        const row = rows.get(sessionId as string);
        if (!row) return { rows: [], rowCount: 0 };
        if (row.expires_at && Date.parse(row.expires_at) <= Date.now()) {
          return { rows: [], rowCount: 0 };
        }
        return { rows: [row as unknown as T], rowCount: 1 };
      }

      if (s.startsWith('SELECT') && s.includes('ORDER BY captured_at')) {
        const filterTenant =
          s.includes('tenant_id IS NULL') ? null : (params?.[0] as string | undefined);
        const filterPersona =
          s.includes('persona_id = $')
            ? (params?.[s.includes('tenant_id IS NULL') ? 0 : 1] as string)
            : undefined;
        const limit =
          s.toLowerCase().includes('limit')
            ? Number(params?.[(params?.length ?? 0) - 1])
            : undefined;
        let out = [...rows.values()].filter((r) => {
          if (filterTenant !== undefined && r.tenant_id !== filterTenant) {
            return false;
          }
          if (filterPersona !== undefined && r.persona_id !== filterPersona) {
            return false;
          }
          return true;
        });
        out.sort((a, b) => (a.captured_at < b.captured_at ? 1 : -1));
        if (limit !== undefined) out = out.slice(0, limit);
        return { rows: out as unknown as ReadonlyArray<T>, rowCount: out.length };
      }

      if (s.startsWith('DELETE')) {
        const [sessionId] = params ?? [];
        const removed = rows.delete(sessionId as string) ? 1 : 0;
        return { rows: [], rowCount: removed };
      }

      throw new Error(`pg-stub: unhandled SQL ${s.slice(0, 80)}`);
    },
    rows(): ReadonlyArray<StubRow> {
      return [...rows.values()];
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Adapter factories under test
// ─────────────────────────────────────────────────────────────────────

const adapters: ReadonlyArray<{ name: string; create: () => SessionStore }> = [
  {
    name: 'InMemorySessionStore',
    create: (): SessionStore => createInMemorySessionStore(),
  },
  {
    name: 'RedisSessionStore',
    create: (): SessionStore => createRedisSessionStore({ redis: createRedisStub() }),
  },
  {
    name: 'PostgresSessionStore',
    create: (): SessionStore => createPostgresSessionStore({ pg: createPgStub() }),
  },
];

const sampleSnapshot = (
  overrides: Partial<SessionSnapshot> = {},
): SessionSnapshot => ({
  sessionId: 'sess_1',
  tenantId: 't_1',
  personaId: 'tenant-resident',
  capturedAt: new Date('2026-05-19T10:00:00Z').toISOString(),
  payload: { foo: 'bar' },
  ...overrides,
});

describe.each(adapters)(
  'SessionStore contract — $name',
  ({ create }: { name: string; create: () => SessionStore }) => {
    it('write + read round-trips a snapshot', async () => {
      const store = create();
      await store.write(sampleSnapshot());
      const back = await store.read('sess_1');
      expect(back).not.toBeNull();
      expect(back?.sessionId).toBe('sess_1');
      expect(back?.tenantId).toBe('t_1');
      expect((back?.payload as { foo: string }).foo).toBe('bar');
    });

    it('read returns null for an unknown id', async () => {
      const store = create();
      const r = await store.read('nope');
      expect(r).toBeNull();
    });

    it('write upserts (overwrites by sessionId)', async () => {
      const store = create();
      await store.write(sampleSnapshot({ payload: { v: 1 } }));
      await store.write(sampleSnapshot({ payload: { v: 2 } }));
      const back = await store.read('sess_1');
      expect((back?.payload as { v: number }).v).toBe(2);
    });

    it('delete removes a snapshot and returns true', async () => {
      const store = create();
      await store.write(sampleSnapshot());
      const removed = await store.delete('sess_1');
      expect(removed).toBe(true);
      expect(await store.read('sess_1')).toBeNull();
    });

    it('delete returns false when the id was not present', async () => {
      const store = create();
      expect(await store.delete('ghost')).toBe(false);
    });

    it('list filters by tenantId', async () => {
      const store = create();
      await store.write(sampleSnapshot({ sessionId: 's_a', tenantId: 't_1' }));
      await store.write(sampleSnapshot({ sessionId: 's_b', tenantId: 't_2' }));
      await store.write(sampleSnapshot({ sessionId: 's_c', tenantId: 't_1' }));
      const rows = await store.list({ tenantId: 't_1' });
      const ids = new Set(rows.map((r: SessionListEntry) => r.sessionId));
      expect(ids.has('s_a')).toBe(true);
      expect(ids.has('s_c')).toBe(true);
      expect(ids.has('s_b')).toBe(false);
    });

    it('list filters by personaId', async () => {
      const store = create();
      await store.write(
        sampleSnapshot({ sessionId: 's_x', personaId: 'tenant-resident' }),
      );
      await store.write(
        sampleSnapshot({ sessionId: 's_y', personaId: 'owner-advisor' }),
      );
      const rows = await store.list({
        tenantId: 't_1',
        personaId: 'owner-advisor',
      });
      expect(rows.length).toBe(1);
      expect(rows[0]?.sessionId).toBe('s_y');
    });

    it('list honours limit', async () => {
      const store = create();
      for (let i = 0; i < 5; i++) {
        await store.write(sampleSnapshot({ sessionId: `s_${i}`, tenantId: 't_1' }));
        // Add a tiny delay so capturedAt monotonically advances per write
        // (in-memory clock granularity is ms — without this two writes
        // can land on the same millisecond).
        await new Promise((res) => setTimeout(res, 2));
      }
      const rows = await store.list({ tenantId: 't_1', limit: 2 });
      expect(rows.length).toBe(2);
    });

    it('list returns DESC by capturedAt', async () => {
      const store = create();
      await store.write(sampleSnapshot({ sessionId: 's_a' }));
      await new Promise((res) => setTimeout(res, 5));
      await store.write(sampleSnapshot({ sessionId: 's_b' }));
      await new Promise((res) => setTimeout(res, 5));
      await store.write(sampleSnapshot({ sessionId: 's_c' }));
      const rows = await store.list({ tenantId: 't_1' });
      expect(rows[0]?.sessionId).toBe('s_c');
      expect(rows[rows.length - 1]?.sessionId).toBe('s_a');
    });

    it('resumeToken can be set and looked up on read', async () => {
      const store = create();
      await store.write(sampleSnapshot({ resumeToken: 'rt_cfo_42' }));
      const back = await store.read('sess_1');
      expect(back?.resumeToken).toBe('rt_cfo_42');
    });

    it('TTL expires a snapshot on subsequent read', async () => {
      const store = create();
      await store.write(sampleSnapshot({ ttlMs: 5 }));
      await new Promise((res) => setTimeout(res, 25));
      const back = await store.read('sess_1');
      expect(back).toBeNull();
    });

    it('platform-tier rows are listable with tenantId: null', async () => {
      const store = create();
      await store.write(sampleSnapshot({ sessionId: 's_plat', tenantId: null }));
      await store.write(sampleSnapshot({ sessionId: 's_tenant', tenantId: 't_1' }));
      const platRows = await store.list({ tenantId: null });
      expect(platRows.map((r: SessionListEntry) => r.sessionId)).toContain(
        's_plat',
      );
      expect(platRows.map((r: SessionListEntry) => r.sessionId)).not.toContain(
        's_tenant',
      );
    });
  },
);

// ─────────────────────────────────────────────────────────────────────
// Adapter-specific cross-tenant safety: Redis + Postgres MUST require
// an explicit tenantId on list() (the InMemory store is permissive for
// dev ergonomics).
// ─────────────────────────────────────────────────────────────────────

describe('cross-tenant safety on list (Redis + Postgres)', () => {
  it('RedisSessionStore.list throws when tenantId is omitted', async () => {
    const store = createRedisSessionStore({ redis: createRedisStub() });
    await expect(store.list({} as never)).rejects.toThrow(
      /requires an explicit tenantId/,
    );
  });

  it('PostgresSessionStore.list throws when tenantId is omitted', async () => {
    const store = createPostgresSessionStore({ pg: createPgStub() });
    await expect(store.list({} as never)).rejects.toThrow(
      /requires an explicit tenantId/,
    );
  });
});
