/**
 * In-memory audit-entry store.
 *
 * Reference {@link AuditEntryStore} backed by an immutable array held in
 * closure. Used by tests and by single-replica dev. Production hosts inject a
 * Drizzle/Supabase-backed append-only store instead — this package has no DB
 * dependency.
 *
 * The buffer is an immutable ring: every `append` replaces the array reference
 * rather than mutating in place, and the capacity bound drops the oldest entry
 * once exceeded.
 *
 * @module @bossnyumba/privacy-router/in-memory-store
 */

import type { AuditEntryStore } from './ports.js';
import type { PrivacyAuditEntry } from './types.js';

export interface InMemoryAuditStoreOptions {
  /** Ring-buffer capacity. Default 1000. */
  readonly bufferSize?: number;
}

const DEFAULT_AUDIT_BUFFER_SIZE = 1000;

export function createInMemoryAuditStore(
  options: InMemoryAuditStoreOptions = {},
): AuditEntryStore {
  const bufferSize = options.bufferSize ?? DEFAULT_AUDIT_BUFFER_SIZE;

  // Oldest first; each append replaces the reference (no in-place mutation).
  let entries: ReadonlyArray<PrivacyAuditEntry> = [];

  const append = async (
    entry: PrivacyAuditEntry,
  ): Promise<PrivacyAuditEntry> => {
    const next = [...entries, entry];
    entries = next.length > bufferSize ? next.slice(next.length - bufferSize) : next;
    return entry;
  };

  const list = async (
    limit: number,
  ): Promise<ReadonlyArray<PrivacyAuditEntry>> => {
    const newestFirst = [...entries].reverse();
    const bounded = Math.max(0, Math.min(limit, bufferSize));
    return newestFirst.slice(0, bounded);
  };

  const all = async (): Promise<ReadonlyArray<PrivacyAuditEntry>> =>
    [...entries].reverse();

  const clear = async (): Promise<void> => {
    entries = [];
  };

  return { append, list, all, clear };
}
