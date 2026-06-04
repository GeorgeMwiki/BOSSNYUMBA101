/**
 * In-memory blind-review run store.
 *
 * Reference {@link BlindReviewStore} backed by a Map. Used by tests and by
 * single-replica dev. Production hosts inject a Drizzle/Supabase-backed
 * store (the `blind_review_runs` table) instead — this package has no DB
 * dependency. `update` returns a fresh immutable run.
 *
 * @module @bossnyumba/blind-review/in-memory-store
 */

import {
  systemClock,
  type BlindReviewClock,
  type BlindReviewRun,
  type BlindReviewRunStatus,
  type BlindReviewStore,
} from './ports';
import type { BlindReviewReport } from './types';

export interface InMemoryStoreOptions {
  readonly clock?: BlindReviewClock;
}

export function createInMemoryBlindReviewStore(
  options: InMemoryStoreOptions = {},
): BlindReviewStore {
  // The clock is injectable for parity with the production adapter, even
  // though the in-memory run carries its own createdAtMs from the caller.
  const _clock = options.clock ?? systemClock;
  void _clock;
  const runs = new Map<string, BlindReviewRun>();

  const get = async (runId: string): Promise<BlindReviewRun | null> =>
    runs.get(runId) ?? null;

  const create = async (run: BlindReviewRun): Promise<BlindReviewRun> => {
    runs.set(run.id, run);
    return run;
  };

  const update = async (
    runId: string,
    updates: {
      readonly report?: BlindReviewReport;
      readonly status?: BlindReviewRunStatus;
    },
  ): Promise<BlindReviewRun> => {
    const current = runs.get(runId);
    if (!current) {
      throw new Error(`blind-review run not found: ${runId}`);
    }
    const next: BlindReviewRun = {
      ...current,
      ...(updates.status !== undefined ? { status: updates.status } : {}),
      ...(updates.report !== undefined ? { report: updates.report } : {}),
    };
    runs.set(runId, next);
    return next;
  };

  const end = async (runId: string): Promise<void> => {
    runs.delete(runId);
  };

  return { get, create, update, end };
}
