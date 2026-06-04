/**
 * Document reconciliation — composition root (default-OFF feature flag).
 *
 * The reconciler ships behind a flag that is OFF unless explicitly enabled.
 * This package stays ENV-FREE: it never reads `process.env`. The caller (the
 * api-gateway composition root) reads the flag
 * `BOSSNYUMBA_FEATURE_DOCUMENT_RECONCILIATION` and passes the resolved
 * boolean as `deps.enabled`. When the flag is off,
 * {@link wireDocumentReconciliation} returns `null` and the gateway simply
 * never mounts the reconciliation route.
 *
 * The returned {@link DocumentReconciliation} is a thin, dependency-bound
 * facade over {@link buildFactBags} + {@link reconcileDocBatch}: the host
 * calls `engine.handle(request)` without re-threading ports each time. The
 * request is validated at the boundary with zod; a malformed payload yields
 * a safe empty report rather than throwing into the route handler.
 *
 * @module @bossnyumba/document-reconciliation/wire
 */

import { buildFactBags, type ExtractedField, type ExtractionForReconciliation } from './fact-bag-builder.js';
import { reconcileDocBatch } from './fact-matcher.js';
import { safeFetch } from './ports.js';
import type {
  ReconciliationAuditSink,
  ReconciliationClock,
  ReconciliationDataPort,
  ReconciliationStore,
} from './ports.js';
import { reconciliationRequestSchema, type ParsedExtraction, type ReconciliationReport } from './types.js';

/** The canonical feature-flag name. READ BY THE CALLER, never by this package. */
export const DOCUMENT_RECONCILIATION_FLAG =
  'BOSSNYUMBA_FEATURE_DOCUMENT_RECONCILIATION' as const;

/**
 * Engine dependencies. Every side effect is an injected port; the facade
 * binds them once. `store` and `audit` are optional — without a store the
 * facade computes-and-returns without persisting; without an audit sink the
 * fire-and-forget log is skipped.
 */
export interface DocumentReconciliationDeps {
  /** Optional read-only fetcher used by {@link DocumentReconciliation.handleMatter}. */
  readonly data?: ReconciliationDataPort;
  /** Optional persistence port; results are stored when present. */
  readonly store?: ReconciliationStore;
  /** Optional fire-and-forget audit sink. */
  readonly audit?: ReconciliationAuditSink;
  /** Injectable clock (defaults to wall-clock). */
  readonly clock?: ReconciliationClock;
}

/**
 * Dependencies for {@link wireDocumentReconciliation}. Extends the engine
 * deps with a single `enabled` boolean the caller derives from the flag.
 */
export interface WireDocumentReconciliationDeps extends DocumentReconciliationDeps {
  /**
   * Resolved value of `BOSSNYUMBA_FEATURE_DOCUMENT_RECONCILIATION`. The
   * composition root computes `flagValue === 'on'` and passes the boolean
   * here; this package never touches the environment itself.
   */
  readonly enabled: boolean;
}

/** Dependency-bound reconciliation facade returned by the wiring. */
export interface DocumentReconciliation {
  /**
   * Reconcile a batch of extractions supplied inline. The request is
   * validated at the boundary with zod; a malformed payload yields a trivially
   * consistent empty report rather than throwing.
   */
  handle(request: unknown): Promise<ReconciliationReport>;
  /**
   * Reconcile every document attached to a matter by fetching the extractions
   * through the injected {@link ReconciliationDataPort}. A fetch failure
   * (caught by {@link safeFetch}) or an empty matter both yield a trivially
   * consistent empty report — never a throw.
   */
  handleMatter(matterId: string, tenantId?: string): Promise<ReconciliationReport>;
}

/**
 * A trivially-consistent empty report. Returned when there is nothing to
 * reconcile (fewer than two documents), when the request fails the zod
 * boundary, or when a data fetch errors / is empty — the facade never throws.
 */
const EMPTY_REPORT: ReconciliationReport = Object.freeze({
  mismatches: [],
  matches: [],
  overallConsistency: 1,
  blockers: [],
  softFlags: [],
});

/**
 * Re-shape a zod-parsed extraction into the exact {@link ExtractionForReconciliation}
 * contract. The parsed `fields` declare `value` as an optional key; the
 * builder contract keeps the key present (value-or-undefined), so we set it
 * explicitly here. This keeps the boundary guard (zod) separate from the
 * exact-optional interface the builder consumes.
 */
function normaliseExtraction(e: ParsedExtraction): ExtractionForReconciliation {
  const fields: ExtractedField[] = e.fields.map((f) => ({
    field_name: f.field_name,
    value: f.value ?? undefined,
    confidence: f.confidence,
  }));
  return { documentId: e.documentId, docType: e.docType, fields };
}

/**
 * Wire the document reconciler behind its feature flag.
 *
 * Returns a bound {@link DocumentReconciliation} when `deps.enabled` is true,
 * or `null` when the flag is off (default). Returning `null` is the single,
 * explicit signal the caller uses to skip mounting the reconciliation route.
 */
export function wireDocumentReconciliation(
  deps: WireDocumentReconciliationDeps,
): DocumentReconciliation | null {
  if (!deps.enabled) return null;

  const clock = deps.clock;

  const persistAndAudit = async (
    report: ReconciliationReport,
    matterId: string | undefined,
    tenantId: string | null,
    docCount: number,
  ): Promise<void> => {
    if (deps.store && matterId) {
      const nowIso = (clock?.now() ?? new Date()).toISOString();
      try {
        const existing = await deps.store.get(matterId);
        if (existing) {
          await deps.store.update(matterId, { report });
        } else {
          await deps.store.create({
            matterId,
            tenantId,
            report,
            resolved: false,
            createdAt: nowIso,
            updatedAt: nowIso,
          });
        }
      } catch {
        // Persistence failure must not fail a read-style reconciliation.
      }
    }
    if (deps.audit) {
      try {
        deps.audit.log({
          matterId: matterId ?? '',
          tenantId,
          docCount,
          blockerCount: report.blockers.length,
          softFlagCount: report.softFlags.length,
          overallConsistency: report.overallConsistency,
        });
      } catch {
        // Fire-and-forget; never throw on the hot path.
      }
    }
  };

  return {
    handle: async (request: unknown): Promise<ReconciliationReport> => {
      const parsed = reconciliationRequestSchema.safeParse(request);
      if (!parsed.success) {
        return EMPTY_REPORT;
      }
      const { extractions, tenantId, matterId } = parsed.data;
      // The zod-parsed `fields` carry `value` as an optional key; the
      // ExtractedField contract keeps the key present (value-or-undefined).
      // Re-shape at the boundary rather than forcing parsed.data into the
      // exact-optional interface param (per the package layout guidance).
      const normalised = extractions.map(normaliseExtraction);
      const bags = buildFactBags(normalised);
      const report = reconcileDocBatch(bags);
      await persistAndAudit(report, matterId, tenantId ?? null, normalised.length);
      return report;
    },

    handleMatter: async (matterId: string, tenantId?: string): Promise<ReconciliationReport> => {
      if (!deps.data) return EMPTY_REPORT;
      const extractions = await safeFetch(() => deps.data!.fetchExtractions(matterId));
      // `undefined` => fetch threw (error); `null` => empty matter. Both are
      // a safe empty report; the caller decides how to surface each via its
      // own state. We never reconcile partial/garbage data.
      if (!extractions) return EMPTY_REPORT;
      const bags = buildFactBags(extractions);
      const report = reconcileDocBatch(bags);
      await persistAndAudit(report, matterId, tenantId ?? null, extractions.length);
      return report;
    },
  };
}
