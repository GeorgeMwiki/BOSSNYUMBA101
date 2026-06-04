/**
 * In-memory reconciliation store.
 *
 * Reference {@link ReconciliationStore} backed by a Map. Used by tests and by
 * single-replica dev. Production hosts inject a Drizzle/Supabase-backed store
 * (the `document_reconciliations` table) instead — this package has no DB
 * dependency.
 *
 * @module @bossnyumba/document-reconciliation/in-memory-store
 */

import {
  systemClock,
  type ReconciliationClock,
  type ReconciliationStore,
  type StoredReconciliation,
} from './ports.js';
import type { ReconciliationReport } from './types.js';

export interface InMemoryStoreOptions {
  readonly clock?: ReconciliationClock;
}

export function createInMemoryReconciliationStore(
  options: InMemoryStoreOptions = {},
): ReconciliationStore {
  const clock = options.clock ?? systemClock;
  const records = new Map<string, StoredReconciliation>();

  const get = async (matterId: string): Promise<StoredReconciliation | null> =>
    records.get(matterId) ?? null;

  const create = async (record: StoredReconciliation): Promise<StoredReconciliation> => {
    records.set(record.matterId, record);
    return record;
  };

  const update = async (
    matterId: string,
    updates: {
      readonly report?: ReconciliationReport;
      readonly resolved?: boolean;
    },
  ): Promise<StoredReconciliation> => {
    const current = records.get(matterId);
    if (!current) {
      throw new Error(`reconciliation matter not found: ${matterId}`);
    }
    const next: StoredReconciliation = {
      ...current,
      ...(updates.report !== undefined ? { report: updates.report } : {}),
      ...(updates.resolved !== undefined ? { resolved: updates.resolved } : {}),
      updatedAt: clock.now().toISOString(),
    };
    records.set(matterId, next);
    return next;
  };

  const end = async (matterId: string): Promise<void> => {
    records.delete(matterId);
  };

  return { get, create, update, end };
}
