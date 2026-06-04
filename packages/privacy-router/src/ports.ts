/**
 * Privacy-router — injected ports (the ports-and-adapters seam).
 *
 * The routing core is pure decision logic; everything with a side effect is a
 * port the host wires at boot. There is NO Supabase / Drizzle / HTTP / fetch /
 * env / console import in this package — the api-gateway composition root
 * supplies real adapters; tests and dev supply in-memory fakes.
 *
 * Contracts:
 *   - {@link PiiStripperPort}        pure transform (the host's data-protection
 *                                    stripper); no I/O.
 *   - {@link LocalEndpointHealthPort} degrades to a SAFE default — a throw or a
 *                                    timeout is treated as "unhealthy", which
 *                                    fails RESTRICTED routing CLOSED (deny).
 *   - {@link FieldClassifierPort}    read-only lookup that NEVER throws; on any
 *                                    internal failure it returns the safest
 *                                    tier the host can prove, falling back to
 *                                    'PUBLIC' so the restricted-prefix list
 *                                    still governs.
 *   - {@link AuditEntryStore}        async, immutable: `append` returns the
 *                                    fresh entry; `list` returns a snapshot;
 *                                    no method mutates a value in place.
 *   - {@link PrivacyAuditSink}       optional fire-and-forget sink; never
 *                                    awaited on the hot path, wrapped in
 *                                    try/catch by the core.
 *   - {@link PrivacyClock}           `now(): Date`, with {@link systemClock}
 *                                    as the wall-clock default for tests.
 *
 * @module @bossnyumba/privacy-router/ports
 */

import type {
  DataClassification,
  PrivacyAuditEntry,
  StripResult,
} from './types';

/**
 * Injected PII-stripping port. The composition root wires the real
 * data-protection stripper; tests wire a deterministic stub. Pure: no I/O.
 */
export interface PiiStripperPort {
  /** Strip PII, returning the redacted text plus reversible token mappings. */
  readonly stripPii: (
    text: string,
    knownNames?: ReadonlyArray<string>,
  ) => StripResult;
  /** Cheap content scan: does the text contain any PII pattern? */
  readonly containsPii: (text: string) => boolean;
}

/**
 * Injected local-endpoint health port. Returns true when the on-prem model
 * (Ollama or compatible) is reachable. The router calls this ONLY for
 * RESTRICTED routing; everything else stays synchronous.
 *
 * Fail-closed by contract: the router treats a thrown error or a rejected
 * promise as "unhealthy", denying the RESTRICTED request rather than leaking
 * it to the cloud. The adapter SHOULD nonetheless resolve `false` rather than
 * throw.
 */
export interface LocalEndpointHealthPort {
  readonly isHealthy: () => Promise<boolean>;
}

/**
 * Field-classification lookup port (maps a field path to its tier). NEVER
 * throws — degrades to a safe default. Absent => field paths escalate only via
 * the policy's restricted-prefix list.
 */
export interface FieldClassifierPort {
  readonly classifyField: (fieldPath: string) => DataClassification;
}

/**
 * Persistence port for routing-decision audit entries. The host backs this
 * with an append-only audit table (or the in-memory reference adapter in
 * tests). All methods are async and immutable — `append` returns the stored
 * entry, `list` returns a fresh snapshot array, and no method mutates an
 * existing entry. Raw PII is never written here (the core only ever passes a
 * {@link PrivacyAuditEntry}, which carries counts and reasons, never payloads).
 */
export interface AuditEntryStore {
  /** Append one entry; returns the stored (immutable) entry. */
  append(entry: PrivacyAuditEntry): Promise<PrivacyAuditEntry>;
  /**
   * Return up to `limit` most-recent entries, newest first. The store is
   * responsible for any ring-buffer capacity bound.
   */
  list(limit: number): Promise<ReadonlyArray<PrivacyAuditEntry>>;
  /** Return every retained entry (newest first) for stats aggregation. */
  all(): Promise<ReadonlyArray<PrivacyAuditEntry>>;
  /** Clear the audit log. */
  clear(): Promise<void>;
}

/**
 * Optional fire-and-forget audit sink for streaming decisions to an external
 * observability pipe. The core wraps each call in try/catch and never awaits
 * it on the hot path, so a slow or failing sink cannot stall or break routing.
 */
export interface PrivacyAuditSink {
  log(entry: PrivacyAuditEntry): void;
}

/** Injectable clock so audit timestamps are deterministic in tests. */
export interface PrivacyClock {
  now(): Date;
}

/** Default wall-clock implementation. */
export const systemClock: PrivacyClock = { now: () => new Date() };
