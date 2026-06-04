/**
 * In-memory learning-signal store.
 *
 * Reference {@link SignalStore} backed by a Map. Used by tests and by
 * single-replica dev. Production hosts inject a Drizzle/Supabase-backed store
 * (the append-only `learning_signals` table with a UNIQUE `signal_hash`)
 * instead — this package has no DB dependency.
 *
 * The store honours the immutability contract:
 *   - `create` is idempotent on `signalHash`; a duplicate returns the stored
 *     copy unchanged (no mutation, no throw) so an at-least-once re-emit is a
 *     safe no-op.
 *   - `markRouted` appends to a separate route ledger; the signal body itself
 *     is never mutated.
 *
 * @module @bossnyumba/learning-signal-emitter/in-memory-store
 */

import type { SignalStore } from './ports.js';
import type { LearningSignal, SignalRoute } from './types.js';

export interface InMemoryStoreHandle extends SignalStore {
  /** Test/inspection helper: snapshot of the appended route ledger. */
  readonly routeLedger: ReadonlyMap<string, ReadonlyArray<SignalRoute>>;
  /** Test/inspection helper: how many signals are stored. */
  size(): number;
}

export function createInMemorySignalStore(): InMemoryStoreHandle {
  const signals = new Map<string, LearningSignal>();
  const routes = new Map<string, ReadonlyArray<SignalRoute>>();

  const get = async (signalHash: string): Promise<LearningSignal | null> =>
    signals.get(signalHash) ?? null;

  const create = async (signal: LearningSignal): Promise<LearningSignal> => {
    const existing = signals.get(signal.signalHash);
    if (existing) return existing;
    signals.set(signal.signalHash, signal);
    return signal;
  };

  const markRouted = async (
    signalHash: string,
    routed: ReadonlyArray<SignalRoute>,
  ): Promise<void> => {
    routes.set(signalHash, Object.freeze([...routed]));
  };

  return {
    get,
    create,
    markRouted,
    routeLedger: routes,
    size: () => signals.size,
  };
}
