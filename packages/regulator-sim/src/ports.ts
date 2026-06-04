/**
 * Regulator simulation — injected ports.
 *
 * Every side effect this package touches is an injected interface. The replay,
 * PDPA, and supervision-pack logic are pure; the host (the api-gateway
 * composition root) supplies real adapters backed by Drizzle / Supabase, while
 * tests supply the in-memory reference adapters. There is NO
 * pg / drizzle / @supabase / axios / fetch / process.env / console import
 * anywhere in this package.
 *
 * Port contracts:
 *   - {@link RegulatorAuditStore}: async get/create/update/end of a replay run;
 *     `update` returns a fresh immutable object (never mutates in place).
 *   - {@link SubjectArtefactResolver}: resolves a subject to their artefacts;
 *     NEVER throws — an unknown subject degrades to an empty array.
 *   - {@link PdpaDataPort}: read-only redaction + erasure side effects on
 *     artefacts; a thrown error is caught by the package's private safeFetch
 *     so the three outcomes (data / empty / error) stay type-distinct.
 *   - {@link RegulatorAuditSink}: fire-and-forget, wrapped in try/catch, never
 *     awaited on the hot path.
 *   - {@link RegulatorClock}: { now(): Date } with {@link systemClock} default
 *     so tests are deterministic.
 *
 * @module @bossnyumba/regulator-sim/ports
 */

import type {
  AuditReplayResult,
  PdpaResult,
  SubjectAccessRequest,
} from './types.js';

/** A subject's data artefact, as surfaced for a PDPA drill. */
export type SubjectArtefactKind =
  | 'lease_application'
  | 'document'
  | 'decision'
  | 'communication'
  | 'audit_event';

export interface SubjectArtefact {
  readonly subjectId: string;
  readonly kind: SubjectArtefactKind;
  readonly id: string;
  readonly contents: string;
  readonly thirdPartyPiiFields?: ReadonlyArray<string>;
  readonly legalHoldUntilIso?: string;
}

/** A persisted audit-replay run, returned by the store. */
export interface AuditRunRecord {
  readonly runId: string;
  readonly status: 'pending' | 'complete';
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly result?: AuditReplayResult;
}

/**
 * Persistence port for audit-replay runs. The host backs this with an
 * `audit_replay_runs` table (RLS service-role) or an in-memory map in tests.
 * All methods are async and immutable — `update` returns a fresh run record.
 */
export interface RegulatorAuditStore {
  get(runId: string): Promise<AuditRunRecord | null>;
  create(run: AuditRunRecord): Promise<AuditRunRecord>;
  update(
    runId: string,
    updates: {
      readonly status?: AuditRunRecord['status'];
      readonly completedAt?: string;
      readonly result?: AuditReplayResult;
    },
  ): Promise<AuditRunRecord>;
  /** Mark a run ended/archived. */
  end(runId: string): Promise<void>;
}

/**
 * Resolves a data-subject id to the artefacts the operator holds about them.
 * The host queries the per-subject artefact index; an unknown subject returns
 * an empty array so the access drill still produces a (failing) report.
 *
 * NEVER throws — an unresolved subject is a normal empty-state path, not an
 * error. The package treats a thrown resolver as a generic error via its
 * private safeFetch wrapper.
 */
export interface SubjectArtefactResolver {
  fetchArtefacts(subjectId: string): Promise<ReadonlyArray<SubjectArtefact>>;
}

/**
 * Read-only-ish data port for the PDPA drill side effects.
 *
 * `redact` returns a NEW artefact with third-party PII masked (never mutates
 * the input). `erase` removes an artefact by id. Both may be backed by the
 * operator's data store; a throw is caught by the package and surfaced as a
 * generic error rather than crashing the drill.
 */
export interface PdpaDataPort {
  redact(artefact: SubjectArtefact): SubjectArtefact;
  erase(artefactId: string): Promise<void>;
}

/**
 * Optional audit sink for regulator-sim runs. Fire-and-forget; the package
 * wraps every call in try/catch and never awaits it on the hot path.
 */
export interface RegulatorAuditSink {
  log(entry: {
    readonly kind: 'audit_replay' | 'pdpa_access' | 'pdpa_erasure' | 'supervision_pack';
    readonly subjectId?: string;
    readonly passed?: boolean;
    readonly detail: string;
  }): void;
}

/** Injectable clock so tests are deterministic. */
export interface RegulatorClock {
  now(): Date;
}

/** Default wall-clock implementation. */
export const systemClock: RegulatorClock = { now: () => new Date() };

/**
 * Re-export of the PDPA result shape for adapters that persist outcomes.
 * (Kept here so a host adapter can import the port surface alone.)
 */
export type { PdpaResult, SubjectAccessRequest };
