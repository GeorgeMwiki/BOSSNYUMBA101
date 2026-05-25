/**
 * Postgres-backed `BookEntryRepository` — adapter over the
 * `@bossnyumba/database` carbon-market book service.
 *
 * The api-gateway composition root constructs a
 * `createCarbonMarketBookService({ db })` (from `@bossnyumba/database`)
 * and hands it to `createPostgresBookRepository(...)`. The result
 * satisfies the P6 `BookEntryRepository` port AND widens it with the
 * operational state-transition methods the desk uses in production
 * (open/symbol scans, settle, cancel).
 *
 * Why a wrapper instead of consuming the database service directly?
 *   - The database service speaks a duck-typed `BookEntryShape` to avoid
 *     a compile-time cycle. This wrapper restates the carbon-market
 *     `BookEntry` type so consumers stay inside the package's public
 *     surface.
 *   - Keeps `@bossnyumba/carbon-market` runtime-detached from drizzle:
 *     callers wire the database, this package never imports it.
 */

import type { BookEntry, BookEntryRepository } from '../types.js';

/**
 * Duck-typed shape of the database-side service. Restated here so the
 * carbon-market package does NOT compile-time-depend on
 * `@bossnyumba/database`.
 */
export interface PostgresBookRepositoryService {
  save(entry: BookEntryLikeShape): Promise<void>;
  findById(entryId: string): Promise<BookEntryLikeShape | null>;
  findByTenant(tenantId: string): Promise<ReadonlyArray<BookEntryLikeShape>>;
  findOpenByTenant(tenantId: string): Promise<ReadonlyArray<BookEntryLikeShape>>;
  findBySymbol(
    tenantId: string,
    symbol: string,
    since?: Date,
  ): Promise<ReadonlyArray<BookEntryLikeShape>>;
  markSettled(entryId: string, settlementDate: Date): Promise<BookEntryLikeShape | null>;
  cancel(entryId: string, reason: string): Promise<BookEntryLikeShape | null>;
}

/**
 * Mirror of `@bossnyumba/database`'s exported `BookEntryShape`. Kept
 * structurally identical so the duck-typed service handoff stays sound.
 */
interface BookEntryLikeShape {
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

/**
 * Production `BookEntryRepository` widened with the operational
 * transitions. Composition roots that need only the P6 surface assign
 * the result to `BookEntryRepository`; consumers that need
 * settle/cancel/etc. assign to this richer type.
 */
export interface PostgresBookEntryRepository extends BookEntryRepository {
  findOpenByTenant(tenantId: string): Promise<ReadonlyArray<BookEntry>>;
  findBySymbol(
    tenantId: string,
    symbol: string,
    since?: Date,
  ): Promise<ReadonlyArray<BookEntry>>;
  markSettled(entryId: string, settlementDate: Date): Promise<BookEntry | null>;
  cancel(entryId: string, reason: string): Promise<BookEntry | null>;
}

export interface CreatePostgresBookRepositoryOpts {
  /**
   * Database-side service from `@bossnyumba/database`:
   * `createCarbonMarketBookService({ db })`.
   */
  readonly service: PostgresBookRepositoryService;
}

export function createPostgresBookRepository(
  opts: CreatePostgresBookRepositoryOpts,
): PostgresBookEntryRepository {
  const { service } = opts;

  function toBookEntry(s: BookEntryLikeShape | null): BookEntry | null {
    if (!s) return null;
    return Object.freeze({
      id: s.id,
      tenantId: s.tenantId,
      side: s.side,
      symbol: s.symbol,
      qty: s.qty,
      priceUsdPerTonne: s.priceUsdPerTonne,
      tenor: s.tenor,
      counterparty: s.counterparty,
      tradeDate: s.tradeDate,
      status: s.status,
    });
  }

  function toBookEntries(
    list: ReadonlyArray<BookEntryLikeShape>,
  ): ReadonlyArray<BookEntry> {
    return Object.freeze(list.map((s) => toBookEntry(s)!));
  }

  return {
    async save(entry) {
      await service.save({
        id: entry.id,
        tenantId: entry.tenantId,
        side: entry.side,
        symbol: entry.symbol,
        qty: entry.qty,
        priceUsdPerTonne: entry.priceUsdPerTonne,
        tenor: entry.tenor,
        counterparty: entry.counterparty,
        tradeDate: entry.tradeDate,
        status: entry.status,
      });
    },
    async findById(id) {
      return toBookEntry(await service.findById(id));
    },
    async findByTenant(tenantId) {
      return toBookEntries(await service.findByTenant(tenantId));
    },
    async findOpenByTenant(tenantId) {
      return toBookEntries(await service.findOpenByTenant(tenantId));
    },
    async findBySymbol(tenantId, symbol, since) {
      return toBookEntries(await service.findBySymbol(tenantId, symbol, since));
    },
    async markSettled(entryId, settlementDate) {
      return toBookEntry(await service.markSettled(entryId, settlementDate));
    },
    async cancel(entryId, reason) {
      return toBookEntry(await service.cancel(entryId, reason));
    },
  };
}
