/**
 * In-memory implementation of `BookEntryRepository`.
 *
 * Pure default for tests + early integration — production wires a
 * Postgres / KV repo behind the same interface. Mutation happens once
 * inside `save()`; everything we hand back is a frozen copy so consumers
 * can't reach in and corrupt the book.
 */

import type { BookEntry, BookEntryRepository } from '../types.js';

export function createInMemoryBookRepository(
  seed: ReadonlyArray<BookEntry> = [],
): BookEntryRepository {
  // Keep deep-frozen copies — consumers receive these unchanged.
  const store = new Map<string, BookEntry>();
  for (const e of seed) {
    store.set(e.id, Object.freeze({ ...e }));
  }
  return {
    async save(entry) {
      store.set(entry.id, Object.freeze({ ...entry }));
    },
    async findByTenant(tenantId) {
      return Array.from(store.values()).filter((e) => e.tenantId === tenantId);
    },
    async findById(id) {
      return store.get(id) ?? null;
    },
  };
}
