/**
 * Ports-and-adapters seam for the ledger attestor.
 *
 * Every side effect the attestor needs is an injected interface here.
 * The package contains NO pg / drizzle / @supabase / axios / fetch /
 * process.env / console — those belong to the composition root that
 * supplies these ports. The in-memory reference adapters
 * (`in-memory-store.ts`) implement the same shapes for tests + dev.
 *
 * Outcome discipline for the read-only data path:
 *   - a fetcher returning `null`      => empty-state (genesis, nothing to attest)
 *   - a fetcher returning a value     => attest it
 *   - a fetcher *throwing*            => caught by {@link safeFetch}, surfaced
 *                                        as `undefined` so a transient source
 *                                        outage is type-distinct from "nothing
 *                                        to attest" and never crashes the tick.
 *
 * @module @bossnyumba/ledger-attestor/ports
 */

import type {
  ChainSegment,
  ExternalSinkReceipt,
  Signature,
  SignedCheckpoint,
} from './types.js';

// ---------------------------------------------------------------------------
// Clock
// ---------------------------------------------------------------------------

/** Injectable clock so attestation timestamps are deterministic in tests. */
export interface Clock {
  now(): Date;
}

/** Default wall-clock. Swap for a fixed clock in tests. */
export const systemClock: Clock = Object.freeze({
  now: (): Date => new Date(),
});

// ---------------------------------------------------------------------------
// Read-only chain source (Data fetcher)
// ---------------------------------------------------------------------------

/**
 * Reads chain segments to attest. Read-only against the source DB — it
 * MUST NOT write. May return one segment per (tenant, account) or a
 * single global audit segment; the orchestrator is agnostic. Returning
 * an empty array is the empty-state signal (nothing to attest this tick).
 */
export interface ChainSourcePort {
  listSegments(): Promise<ReadonlyArray<ChainSegment>>;
}

/**
 * Run a read-only fetch with the three-outcome contract. A throw is
 * swallowed to `undefined` (transient source error) so it stays
 * type-distinct from an empty result and never poisons the tick. Kept
 * private to the package; callers see `T | undefined`.
 */
export async function safeFetch<T>(
  fetcher: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await fetcher();
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Signer
// ---------------------------------------------------------------------------

/** Signs the canonical checkpoint bytes. Pluggable: local key / KMS / HSM. */
export interface SignerPort {
  /** Stable identifier of the signing key (for the checkpoint + verify). */
  readonly keyId: string;
  /** Algorithm label embedded in the signature. */
  readonly algorithm: string;
  /** Produce a signature over `message` (the canonical checkpoint bytes). */
  sign(message: string): Promise<Signature>;
}

// ---------------------------------------------------------------------------
// External WORM sink
// ---------------------------------------------------------------------------

/**
 * Publishes a signed checkpoint to a tamper-proof external store. The
 * canonical implementation writes an object under object-lock
 * (compliance/governance retention) OR appends to a transparency log.
 * Pluggable so we can fan out to more than one. MUST throw on failure —
 * the attestor treats a sink failure as a failed attestation for that
 * chain (fail-loud).
 */
export interface ExternalSinkPort {
  /** Human label for logs/metrics (e.g. `object-lock`, `transparency-log`). */
  readonly name: string;
  publish(checkpoint: SignedCheckpoint): Promise<ExternalSinkReceipt>;
}

// ---------------------------------------------------------------------------
// Local checkpoint history store (get / append)
// ---------------------------------------------------------------------------

/**
 * Optional local persistence of the checkpoint row. Lets the next
 * attestation tick chain its `prevRoot` and lets a history endpoint
 * serve past checkpoints. Read + append only — checkpoints are
 * immutable (never updated, never deleted).
 */
export interface CheckpointStorePort {
  /** Most recent checkpoint for a chain, or null if none yet. */
  latestFor(chainId: string): Promise<SignedCheckpoint | null>;
  /** Append a freshly-published checkpoint with its sink receipts. */
  append(
    checkpoint: SignedCheckpoint,
    receipts: ReadonlyArray<ExternalSinkReceipt>,
  ): Promise<void>;
}

// ---------------------------------------------------------------------------
// Audit sink (fire-and-forget) + logger
// ---------------------------------------------------------------------------

/**
 * Optional fire-and-forget audit sink. The attestor records each
 * checkpoint event here for the decision-journal / audit trail. It is
 * NEVER awaited on the hot path and a throw is swallowed — a failing
 * audit sink must not break attestation. See {@link emitAudit}.
 */
export interface AuditSinkPort {
  record(event: Readonly<Record<string, unknown>>): void | Promise<void>;
}

/**
 * Fire-and-forget audit emit. Wrapped in try/catch and intentionally
 * not awaited so a slow or throwing audit sink cannot stall or fail a
 * tick. Promise rejections are caught too.
 */
export function emitAudit(
  sink: AuditSinkPort | undefined,
  event: Readonly<Record<string, unknown>>,
): void {
  if (sink === undefined) return;
  try {
    const maybePromise = sink.record(event);
    if (maybePromise && typeof maybePromise.then === 'function') {
      maybePromise.then(undefined, () => undefined);
    }
  } catch {
    // Audit is best-effort — never let it break the attestation tick.
  }
}

/**
 * Minimal structured logger (Pino-shaped). The package never calls
 * `console`; the composition root injects a real logger. A no-op
 * resolver-style default ({@link noopLogger}) keeps the orchestrator
 * pure and crash-free when none is supplied — it degrades to silence
 * rather than throwing.
 */
export interface AttestorLogger {
  info(meta: Readonly<Record<string, unknown>>, msg: string): void;
  warn(meta: Readonly<Record<string, unknown>>, msg: string): void;
  error(meta: Readonly<Record<string, unknown>>, msg: string): void;
}

/** Silent logger default — never throws, degrades to no-op. */
export const noopLogger: AttestorLogger = Object.freeze({
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
});
