/**
 * postgres-book-repository tests — adapter over the duck-typed
 * `PostgresBookRepositoryService` from `@bossnyumba/database`.
 *
 * Strategy:
 *   - We stub the database service (NOT drizzle itself) — that keeps
 *     this test focused on the carbon-market side of the boundary.
 *     The drizzle-level round-trip is exercised by the
 *     `packages/database` test suite (which is the right place — it
 *     owns the schema and the mock pattern).
 *   - The stub records every call so we can assert the adapter wires
 *     args + return shapes correctly.
 *
 * Coverage (≥ 10 tests):
 *   - save round-trips through the service with all BookEntry fields
 *   - findById delegates and translates `null` correctly
 *   - findByTenant returns frozen arrays
 *   - findOpenByTenant filters by status
 *   - findBySymbol forwards the optional `since` cutoff
 *   - findBySymbol omits `since` when undefined
 *   - markSettled forwards the settlementDate
 *   - markSettled returns null when service returns null
 *   - cancel forwards the reason
 *   - cancel returns the updated entry
 *   - the resulting repo satisfies the P6 BookEntryRepository surface
 *   - returned entries are frozen (immutability invariant)
 */

import { describe, expect, it, vi } from 'vitest';
import {
  createPostgresBookRepository,
  type PostgresBookRepositoryService,
} from '../postgres-book-repository.js';
import type { BookEntry, BookEntryRepository } from '../../types.js';

interface ServiceShape {
  readonly id: string;
  readonly tenantId: string;
  readonly side: 'BUY' | 'SELL';
  readonly symbol: string;
  readonly qty: number;
  readonly priceUsdPerTonne: number;
  readonly tenor: string;
  readonly counterparty: string;
  readonly tradeDate: string;
  readonly status: 'OPEN' | 'SETTLED' | 'CANCELLED';
  readonly settlementDate?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

function makeShape(over: Partial<ServiceShape> = {}): ServiceShape {
  return {
    id: 'BE-test-1',
    tenantId: 't-1',
    side: 'BUY',
    symbol: 'CIX-NBS-2024',
    qty: 100,
    priceUsdPerTonne: 7.5,
    tenor: 'Dec-26',
    counterparty: 'CIX-DEALER-01',
    tradeDate: '2026-05-23T00:00:00.000Z',
    status: 'OPEN',
    ...over,
  };
}

function makeStubService(): {
  service: PostgresBookRepositoryService;
  saved: ServiceShape[];
  calls: {
    save: number;
    findById: number;
    findByTenant: number;
    findOpenByTenant: number;
    findBySymbol: Array<{ tenantId: string; symbol: string; since: Date | undefined }>;
    markSettled: Array<{ entryId: string; settlementDate: Date }>;
    cancel: Array<{ entryId: string; reason: string }>;
  };
} {
  const saved: ServiceShape[] = [];
  const calls = {
    save: 0,
    findById: 0,
    findByTenant: 0,
    findOpenByTenant: 0,
    findBySymbol: [] as Array<{ tenantId: string; symbol: string; since: Date | undefined }>,
    markSettled: [] as Array<{ entryId: string; settlementDate: Date }>,
    cancel: [] as Array<{ entryId: string; reason: string }>,
  };
  const service: PostgresBookRepositoryService = {
    async save(entry) {
      calls.save += 1;
      saved.push(entry as ServiceShape);
    },
    async findById(entryId) {
      calls.findById += 1;
      return saved.find((s) => s.id === entryId) ?? null;
    },
    async findByTenant(tenantId) {
      calls.findByTenant += 1;
      return saved.filter((s) => s.tenantId === tenantId);
    },
    async findOpenByTenant(tenantId) {
      calls.findOpenByTenant += 1;
      return saved.filter((s) => s.tenantId === tenantId && s.status === 'OPEN');
    },
    async findBySymbol(tenantId, symbol, since) {
      calls.findBySymbol.push({ tenantId, symbol, since });
      const all = saved.filter((s) => s.tenantId === tenantId && s.symbol === symbol);
      if (since) {
        const cutoff = since.getTime();
        return all.filter((s) => new Date(s.tradeDate).getTime() >= cutoff);
      }
      return all;
    },
    async markSettled(entryId, settlementDate) {
      calls.markSettled.push({ entryId, settlementDate });
      const idx = saved.findIndex((s) => s.id === entryId);
      if (idx === -1) return null;
      const updated: ServiceShape = {
        ...saved[idx]!,
        status: 'SETTLED',
        settlementDate: settlementDate.toISOString(),
      };
      saved[idx] = updated;
      return updated;
    },
    async cancel(entryId, reason) {
      calls.cancel.push({ entryId, reason });
      const idx = saved.findIndex((s) => s.id === entryId);
      if (idx === -1) return null;
      const updated: ServiceShape = {
        ...saved[idx]!,
        status: 'CANCELLED',
        metadata: { ...(saved[idx]!.metadata ?? {}), cancellationReason: reason },
      };
      saved[idx] = updated;
      return updated;
    },
  };
  return { service, saved, calls };
}

describe('createPostgresBookRepository — save + read', () => {
  it('round-trips a BookEntry through save + findById', async () => {
    const stub = makeStubService();
    const repo = createPostgresBookRepository({ service: stub.service });
    const entry: BookEntry = {
      id: 'BE-001',
      tenantId: 't-1',
      side: 'BUY',
      symbol: 'CIX-NBS-2024',
      qty: 250,
      priceUsdPerTonne: 8.25,
      tenor: 'Dec-26',
      counterparty: 'CIX-DEALER-01',
      tradeDate: '2026-05-23T10:00:00.000Z',
      status: 'OPEN',
    };
    await repo.save(entry);
    expect(stub.calls.save).toBe(1);
    const found = await repo.findById('BE-001');
    expect(found).not.toBeNull();
    expect(found!).toEqual(entry);
  });

  it('save forwards every BookEntry field unchanged', async () => {
    const stub = makeStubService();
    const repo = createPostgresBookRepository({ service: stub.service });
    const entry: BookEntry = {
      id: 'BE-002',
      tenantId: 't-2',
      side: 'SELL',
      symbol: 'EUA-DEC26',
      qty: 1_000,
      priceUsdPerTonne: 65.5,
      tenor: 'Mar-27',
      counterparty: 'EEX-DEALER',
      tradeDate: '2026-05-22T15:30:00.000Z',
      status: 'OPEN',
    };
    await repo.save(entry);
    const stored = stub.saved[0]!;
    expect(stored.side).toBe('SELL');
    expect(stored.symbol).toBe('EUA-DEC26');
    expect(stored.priceUsdPerTonne).toBe(65.5);
    expect(stored.qty).toBe(1_000);
    expect(stored.counterparty).toBe('EEX-DEALER');
  });

  it('findById returns null when the service has nothing', async () => {
    const stub = makeStubService();
    const repo = createPostgresBookRepository({ service: stub.service });
    const result = await repo.findById('NOPE');
    expect(result).toBeNull();
    expect(stub.calls.findById).toBe(1);
  });
});

describe('createPostgresBookRepository — findByTenant + findOpenByTenant', () => {
  it('findByTenant returns every entry for the tenant', async () => {
    const stub = makeStubService();
    stub.saved.push(makeShape({ id: 'A', tenantId: 't-1', status: 'OPEN' }));
    stub.saved.push(makeShape({ id: 'B', tenantId: 't-1', status: 'SETTLED' }));
    stub.saved.push(makeShape({ id: 'C', tenantId: 't-2', status: 'OPEN' }));
    const repo = createPostgresBookRepository({ service: stub.service });
    const result = await repo.findByTenant('t-1');
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id).sort()).toEqual(['A', 'B']);
  });

  it('findOpenByTenant filters out non-open rows', async () => {
    const stub = makeStubService();
    stub.saved.push(makeShape({ id: 'A', tenantId: 't-1', status: 'OPEN' }));
    stub.saved.push(makeShape({ id: 'B', tenantId: 't-1', status: 'SETTLED' }));
    stub.saved.push(makeShape({ id: 'C', tenantId: 't-1', status: 'CANCELLED' }));
    const repo = createPostgresBookRepository({ service: stub.service });
    const result = await repo.findOpenByTenant('t-1');
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('A');
    expect(stub.calls.findOpenByTenant).toBe(1);
  });

  it('returns frozen arrays from list reads', async () => {
    const stub = makeStubService();
    stub.saved.push(makeShape({ id: 'A', tenantId: 't-1', status: 'OPEN' }));
    const repo = createPostgresBookRepository({ service: stub.service });
    const result = await repo.findByTenant('t-1');
    expect(Object.isFrozen(result)).toBe(true);
  });
});

describe('createPostgresBookRepository — findBySymbol', () => {
  it('forwards the `since` cutoff to the service', async () => {
    const stub = makeStubService();
    const repo = createPostgresBookRepository({ service: stub.service });
    const cutoff = new Date('2026-05-20T00:00:00Z');
    await repo.findBySymbol('t-1', 'CIX-NBS-2024', cutoff);
    expect(stub.calls.findBySymbol).toHaveLength(1);
    expect(stub.calls.findBySymbol[0]!.tenantId).toBe('t-1');
    expect(stub.calls.findBySymbol[0]!.symbol).toBe('CIX-NBS-2024');
    expect(stub.calls.findBySymbol[0]!.since).toBe(cutoff);
  });

  it('omits the `since` argument when undefined', async () => {
    const stub = makeStubService();
    const repo = createPostgresBookRepository({ service: stub.service });
    await repo.findBySymbol('t-1', 'CIX-NBS-2024');
    expect(stub.calls.findBySymbol[0]!.since).toBeUndefined();
  });

  it('respects the `since` cutoff at the stub layer too', async () => {
    const stub = makeStubService();
    stub.saved.push(makeShape({ id: 'OLD', tradeDate: '2026-05-01T00:00:00Z' }));
    stub.saved.push(makeShape({ id: 'NEW', tradeDate: '2026-05-23T00:00:00Z' }));
    const repo = createPostgresBookRepository({ service: stub.service });
    const result = await repo.findBySymbol('t-1', 'CIX-NBS-2024', new Date('2026-05-20T00:00:00Z'));
    expect(result.map((e) => e.id)).toEqual(['NEW']);
  });
});

describe('createPostgresBookRepository — state transitions', () => {
  it('markSettled forwards the settlementDate to the service', async () => {
    const stub = makeStubService();
    stub.saved.push(makeShape({ id: 'BE-001' }));
    const repo = createPostgresBookRepository({ service: stub.service });
    const settledAt = new Date('2026-06-01T12:00:00Z');
    const result = await repo.markSettled('BE-001', settledAt);
    expect(stub.calls.markSettled[0]!.entryId).toBe('BE-001');
    expect(stub.calls.markSettled[0]!.settlementDate).toBe(settledAt);
    expect(result!.status).toBe('SETTLED');
  });

  it('markSettled returns null when the entry is missing', async () => {
    const stub = makeStubService();
    const repo = createPostgresBookRepository({ service: stub.service });
    const result = await repo.markSettled('NOPE', new Date());
    expect(result).toBeNull();
  });

  it('cancel forwards the reason and updates status', async () => {
    const stub = makeStubService();
    stub.saved.push(makeShape({ id: 'BE-002' }));
    const repo = createPostgresBookRepository({ service: stub.service });
    const result = await repo.cancel('BE-002', 'price moved against us');
    expect(stub.calls.cancel[0]!.reason).toBe('price moved against us');
    expect(result!.status).toBe('CANCELLED');
  });

  it('cancel returns null when the entry is missing', async () => {
    const stub = makeStubService();
    const repo = createPostgresBookRepository({ service: stub.service });
    const result = await repo.cancel('NOPE', 'whatever');
    expect(result).toBeNull();
  });

  it('returned entries are frozen', async () => {
    const stub = makeStubService();
    stub.saved.push(makeShape({ id: 'FREEZE' }));
    const repo = createPostgresBookRepository({ service: stub.service });
    const found = await repo.findById('FREEZE');
    expect(found).not.toBeNull();
    expect(Object.isFrozen(found)).toBe(true);
  });
});

describe('createPostgresBookRepository — port compatibility', () => {
  it('satisfies the P6 BookEntryRepository surface', () => {
    const stub = makeStubService();
    const repo: BookEntryRepository = createPostgresBookRepository({ service: stub.service });
    // Type-only compile assertion — if the surface drifts, this line breaks tsc.
    expect(typeof repo.save).toBe('function');
    expect(typeof repo.findById).toBe('function');
    expect(typeof repo.findByTenant).toBe('function');
  });

  it('the adapter does NOT mutate the supplied BookEntry on save', async () => {
    const stub = makeStubService();
    const repo = createPostgresBookRepository({ service: stub.service });
    const entry: BookEntry = {
      id: 'IMMUT',
      tenantId: 't-1',
      side: 'BUY',
      symbol: 'X',
      qty: 1,
      priceUsdPerTonne: 1.0,
      tenor: 'M+1',
      counterparty: 'CP',
      tradeDate: '2026-05-23T00:00:00Z',
      status: 'OPEN',
    };
    const beforeKeys = Object.keys(entry).sort();
    await repo.save(entry);
    expect(Object.keys(entry).sort()).toEqual(beforeKeys);
  });
});

// Stub-coverage sanity check — ensures the test stub itself stays
// honest. Drops the chance of a green test from a hollow stub.
describe('test stub self-check', () => {
  it('records every interaction', async () => {
    const stub = makeStubService();
    const repo = createPostgresBookRepository({ service: stub.service });
    await repo.save(makeShape({ id: 'A' }) as unknown as BookEntry);
    await repo.findById('A');
    await repo.findByTenant('t-1');
    await repo.findOpenByTenant('t-1');
    await repo.findBySymbol('t-1', 'CIX-NBS-2024');
    await repo.markSettled('A', new Date());
    await repo.cancel('A', 'test');
    expect(stub.calls.save).toBe(1);
    expect(stub.calls.findById).toBeGreaterThan(0);
    expect(stub.calls.findByTenant).toBe(1);
    expect(stub.calls.findOpenByTenant).toBe(1);
    expect(stub.calls.findBySymbol).toHaveLength(1);
    expect(stub.calls.markSettled).toHaveLength(1);
    expect(stub.calls.cancel).toHaveLength(1);
    // Silence vi unused.
    void vi;
  });
});
