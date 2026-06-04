/**
 * `@bossnyumba/belief-engine` — injected ports (ports-and-adapters seam).
 *
 * The engine is pure epistemic logic; everything with a side effect is a
 * port the host wires at boot. There is NO pg / drizzle / @supabase / axios /
 * fetch / process.env / console import in this package — the api-gateway
 * composition root supplies real adapters; tests supply in-memory fakes.
 *
 * Three port shapes, three failure contracts:
 *   - Store      — async get/create/update/end; `upsert` returns a fresh
 *                  immutable belief. The convince-loop is the SOLE caller of
 *                  `upsert`; app code never writes a belief directly.
 *   - Resolver / read-only Data fetcher (WebSearchPort, OutcomeFetcher) —
 *                  returns its data; a `null`/`[]` is the empty-state, a throw
 *                  is caught by {@link safeFetch} and degrades to `undefined`
 *                  so the three outcomes stay type-distinct.
 *   - AuditSink  — fire-and-forget, wrapped in try/catch, never awaited on the
 *                  hot path.
 * Plus a {@link Clock} with an exported {@link systemClock} default so tests
 * are deterministic.
 *
 * @module @bossnyumba/belief-engine/ports
 */

import type {
  Belief,
  BeliefDomain,
  BeliefScope,
  RevisionRecord,
  ReviewQueueItem,
  WebSearchResult,
} from './types';

// ─────────────────────────────────────────────────────────────────────
// Clock
// ─────────────────────────────────────────────────────────────────────

/** Injectable clock so tests are deterministic. */
export interface Clock {
  now(): Date;
}

/** Default wall-clock implementation. */
export const systemClock: Clock = { now: () => new Date() };

// ─────────────────────────────────────────────────────────────────────
// Belief store — the ONLY surface that touches persistence
// ─────────────────────────────────────────────────────────────────────

/**
 * Belief store port. The convince-loop is the sole caller of `upsert`; app
 * code must never call `upsert` directly to write a belief (hard rule:
 * beliefs are never written directly). The host backs this with the
 * brain_beliefs / belief_revisions / belief_review_queue tables (RLS
 * service-role) or an in-memory map in tests. `upsert` returns a fresh,
 * immutable belief.
 */
export interface BeliefStorePort {
  findBySubject(subject: string, scope?: BeliefScope): Promise<Belief | null>;
  listByDomain(
    domain: BeliefDomain,
    limit?: number,
    scope?: BeliefScope,
  ): Promise<ReadonlyArray<Belief>>;
  /** Insert-or-replace by the (subject, user, org) natural key. */
  upsert(belief: Belief): Promise<Belief>;
  /** Append an immutable revision-history row. */
  recordRevision(record: RevisionRecord): Promise<void>;
  /** Enqueue a contradiction in the 0.05-0.25 split band for review. */
  enqueueReview(item: ReviewQueueItem): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────
// Read-only data fetchers
// ─────────────────────────────────────────────────────────────────────

/**
 * Web-search port — injected. Returns corroborating evidence for the heavy
 * convince pass. A fetcher that throws is caught by {@link safeFetch} and
 * treated as "no evidence"; the default returns `[]`.
 */
export type WebSearchPort = (
  query: string,
  opts: { readonly maxResults: number },
) => Promise<ReadonlyArray<WebSearchResult>>;

/** Default web-search: no corroborating evidence. */
export const NO_WEB_SEARCH: WebSearchPort = async () => [];

/**
 * One anonymised property-outcome row for the nightly correlation pass. The
 * warehouse co-observes the belief-aligned quantity at the moment each
 * outcome is recorded (e.g. the believed rent comparable in force when an
 * occupancy / arrears outcome landed).
 */
export interface OutcomeRow {
  readonly segment: string | null;
  readonly region: string | null;
  readonly metric: string;
  readonly value: number;
  /**
   * The belief this row's `beliefValue` was co-observed against. When unset,
   * the row applies to every numeric belief in the cell (the fetcher could
   * not attribute it to one subject).
   */
  readonly beliefSubject?: string | null;
  /**
   * The belief-aligned quantity in force when this outcome was recorded. This
   * is the VARYING series the Pearson pass correlates against `value`. When
   * unset, the row carries no variance and is dropped before correlation.
   */
  readonly beliefValue?: number | null;
}

/** Injected outcome source — returns anonymised property-outcome rows. */
export type OutcomeFetcher = () => Promise<ReadonlyArray<OutcomeRow>>;

// ─────────────────────────────────────────────────────────────────────
// Audit sink — fire-and-forget
// ─────────────────────────────────────────────────────────────────────

/**
 * Optional audit sink for belief revisions / learning decisions.
 * Fire-and-forget; callers never await it on the hot path. Use
 * {@link emitAudit} to invoke it so a throwing sink can never break the loop.
 */
export interface BeliefAuditSink {
  log(entry: {
    readonly event: string;
    readonly beliefId?: string;
    readonly subject?: string;
    readonly detail: string;
  }): void;
}

/**
 * Fire-and-forget audit emit. Swallows any sink error so the belief path is
 * never broken by a misbehaving sink. NEVER awaited.
 */
export function emitAudit(
  sink: BeliefAuditSink | undefined,
  entry: {
    readonly event: string;
    readonly beliefId?: string;
    readonly subject?: string;
    readonly detail: string;
  },
): void {
  if (!sink) return;
  try {
    sink.log(entry);
  } catch {
    // Swallow — audit is best-effort and must never break the belief path.
  }
}

// ─────────────────────────────────────────────────────────────────────
// safeFetch — keep the three read outcomes type-distinct
// ─────────────────────────────────────────────────────────────────────

/**
 * Wrap a read-only fetcher so the three outcomes stay type-distinct:
 *   - the fetcher resolves a value  → that value (may itself be `null`/`[]`,
 *                                      the caller's empty-state),
 *   - the fetcher throws            → caught, returns `undefined` (error),
 * Callers branch on `undefined` vs a resolved value to tell "errored" apart
 * from "empty". Private to the package — not exported on the public surface.
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
