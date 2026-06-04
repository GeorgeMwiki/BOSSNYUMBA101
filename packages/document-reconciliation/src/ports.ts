/**
 * Document-reconciliation — injected ports.
 *
 * The reconciler and matchers are pure logic; everything with a side effect
 * is a port the host wires at boot. There is NO Supabase / Drizzle / HTTP /
 * `process.env` import in this package — the api-gateway composition root
 * supplies real adapters; tests supply in-memory fakes.
 *
 * Three read outcomes are kept type-distinct by {@link safeFetch}: a present
 * value (`T`), an empty state (`null` from the fetcher), and a failure (a
 * throw, caught and surfaced as `undefined`). The caller renders each
 * differently — a found report, a "nothing on file" screen, a generic error.
 *
 * @module @bossnyumba/document-reconciliation/ports
 */

import type { ExtractionForReconciliation } from './fact-bag-builder';
import type { FingerprintStore, IssuerFingerprint, FingerprintMatchInput } from './issuer-fingerprint';
import type { ReconciliationReport } from './types';

export type { FingerprintStore } from './issuer-fingerprint';

/**
 * Persistence port for completed reconciliation reports. The host backs this
 * with a `document_reconciliations` table (RLS service-role) or an in-memory
 * map in tests. All methods are async and immutable — `update` returns a
 * fresh record rather than mutating in place.
 */
export interface ReconciliationStore {
  get(matterId: string): Promise<StoredReconciliation | null>;
  create(record: StoredReconciliation): Promise<StoredReconciliation>;
  update(
    matterId: string,
    updates: {
      readonly report?: ReconciliationReport;
      readonly resolved?: boolean;
    },
  ): Promise<StoredReconciliation>;
  /** Mark a reconciliation matter closed. */
  end(matterId: string): Promise<void>;
}

export interface StoredReconciliation {
  readonly matterId: string;
  readonly tenantId: string | null;
  readonly report: ReconciliationReport;
  readonly resolved: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Resolves an inbound document header / logo to a known issuer fingerprint.
 * The host backs it with the {@link FingerprintStore}; an unresolved document
 * returns `null` so the caller proceeds with generic extraction. NEVER throws
 * — an unmatched document is a normal path, not an error.
 */
export interface IssuerResolver {
  resolve(input: FingerprintMatchInput): Promise<IssuerFingerprint | null>;
}

/**
 * Read-only data fetchers for a reconciliation matter. Each is tenant-scoped
 * by the host (the api-gateway binds `app.current_tenant_id` before calling).
 * Returning `null` signals the matching empty state.
 *
 * Fail-soft by contract: a fetcher that throws is caught by {@link safeFetch}
 * and surfaced as `undefined`, never a crash.
 */
export interface ReconciliationDataPort {
  /** Fetch the extractions for every document attached to a matter. */
  fetchExtractions(matterId: string): Promise<readonly ExtractionForReconciliation[] | null>;
  /** Fetch a previously-stored report for a matter, if any. */
  fetchPriorReport(matterId: string): Promise<ReconciliationReport | null>;
}

/**
 * Optional audit sink for reconciliation outcomes. Fire-and-forget; the
 * facade never awaits it on the hot path, and a throwing sink is swallowed.
 */
export interface ReconciliationAuditSink {
  log(entry: {
    readonly matterId: string;
    readonly tenantId: string | null;
    readonly docCount: number;
    readonly blockerCount: number;
    readonly softFlagCount: number;
    readonly overallConsistency: number;
  }): void;
}

/** Injectable clock so tests are deterministic. */
export interface ReconciliationClock {
  now(): Date;
}

/** Default wall-clock implementation. */
export const systemClock: ReconciliationClock = { now: () => new Date() };

/**
 * Wrap a read-only fetcher so its three outcomes stay type-distinct:
 *   - a present value resolves to `T`,
 *   - an explicit empty state (`null`) resolves to `null`,
 *   - a thrown error is caught and resolves to `undefined`.
 *
 * This keeps the package free of try/catch noise at every call site and lets
 * the caller branch on `=== undefined` (error) vs `=== null` (empty) cleanly.
 */
export async function safeFetch<T>(
  fetcher: () => Promise<T | null>,
): Promise<T | null | undefined> {
  try {
    return await fetcher();
  } catch {
    return undefined;
  }
}

/** Build an {@link IssuerResolver} from a {@link FingerprintStore}. */
export function issuerResolverFromStore(
  store: FingerprintStore,
  matchFingerprint: (input: FingerprintMatchInput, store: FingerprintStore) => Promise<IssuerFingerprint | null>,
): IssuerResolver {
  return {
    resolve: async (input) => {
      // Resolution never throws — an adapter failure degrades to "no issuer".
      const result = await safeFetch(() => matchFingerprint(input, store));
      return result ?? null;
    },
  };
}
