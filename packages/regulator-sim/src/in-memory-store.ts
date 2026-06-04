/**
 * In-memory reference adapters.
 *
 * Map-backed implementations of the regulator-sim ports, for tests and
 * single-replica dev only. Production hosts inject Drizzle / Supabase-backed
 * adapters instead — this package has no DB dependency.
 *
 *   - {@link createInMemoryPdpaSurface}: satisfies both
 *     {@link SubjectArtefactResolver} and {@link PdpaDataPort} over one Map,
 *     and exposes a `snapshot()` so tests can assert erasure.
 *   - {@link createInMemoryAuditStore}: satisfies {@link RegulatorAuditStore}
 *     with immutable `update` semantics (returns a fresh run record).
 *
 * @module @bossnyumba/regulator-sim/in-memory-store
 */

import type { AuditReplayResult } from './types';
import {
  systemClock,
  type AuditRunRecord,
  type PdpaDataPort,
  type RegulatorAuditStore,
  type RegulatorClock,
  type SubjectArtefact,
  type SubjectArtefactResolver,
} from './ports';

/**
 * A unified in-memory PDPA surface. Implements the read side
 * ({@link SubjectArtefactResolver}) and the write side ({@link PdpaDataPort})
 * over a single artefact map, plus a `snapshot()` for test assertions.
 */
export type InMemoryPdpaSurface = SubjectArtefactResolver &
  PdpaDataPort & {
    readonly snapshot: () => ReadonlyArray<SubjectArtefact>;
  };

export function createInMemoryPdpaSurface(
  initial: ReadonlyArray<SubjectArtefact>,
): InMemoryPdpaSurface {
  let store: ReadonlyArray<SubjectArtefact> = [...initial];

  return {
    fetchArtefacts: async (subjectId: string) =>
      store.filter((a) => a.subjectId === subjectId),

    redact(a: SubjectArtefact): SubjectArtefact {
      if (!a.thirdPartyPiiFields || a.thirdPartyPiiFields.length === 0) {
        return a;
      }
      let redacted = a.contents;
      for (const field of a.thirdPartyPiiFields) {
        redacted = redacted.replaceAll(field, '[REDACTED]');
      }
      return { ...a, contents: redacted };
    },

    erase: async (artefactId: string) => {
      store = store.filter((a) => a.id !== artefactId);
    },

    snapshot: () => [...store],
  };
}

export interface InMemoryAuditStoreOptions {
  readonly clock?: RegulatorClock;
}

export function createInMemoryAuditStore(
  options: InMemoryAuditStoreOptions = {},
): RegulatorAuditStore {
  const clock = options.clock ?? systemClock;
  const runs = new Map<string, AuditRunRecord>();

  const get = async (runId: string): Promise<AuditRunRecord | null> =>
    runs.get(runId) ?? null;

  const create = async (run: AuditRunRecord): Promise<AuditRunRecord> => {
    runs.set(run.runId, run);
    return run;
  };

  const update = async (
    runId: string,
    updates: {
      readonly status?: AuditRunRecord['status'];
      readonly completedAt?: string;
      readonly result?: AuditReplayResult;
    },
  ): Promise<AuditRunRecord> => {
    const current = runs.get(runId);
    if (!current) {
      throw new Error(`audit run not found: ${runId}`);
    }
    const next: AuditRunRecord = {
      ...current,
      ...(updates.status !== undefined ? { status: updates.status } : {}),
      ...(updates.completedAt !== undefined
        ? { completedAt: updates.completedAt }
        : {}),
      ...(updates.result !== undefined ? { result: updates.result } : {}),
    };
    runs.set(runId, next);
    return next;
  };

  const end = async (runId: string): Promise<void> => {
    runs.delete(runId);
  };

  // `clock` is retained for hosts that want to stamp run lifecycle times; the
  // reference store keeps timestamps caller-supplied to stay deterministic.
  void clock;

  return { get, create, update, end };
}
