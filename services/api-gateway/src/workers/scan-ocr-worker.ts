/**
 * Scan-bundle OCR consumer — closes audit #22.
 *
 * Before: `POST /bundles/:id/ocr` flipped the bundle to `processing`, emitted
 * `ScanBundleOcrRequested`, and returned `workerWillProcess: true` — but NO
 * subscriber existed, so every bundle sat in `processing` forever with
 * `ocr_text` null. The "worker will process" claim was a lie.
 *
 * After: this module registers a real subscriber for `ScanBundleOcrRequested`
 * that ALWAYS drives the bundle to a terminal state:
 *
 *   - When a real OCR runner AND a page-bytes resolver are injected, it reads
 *     each page's bytes, runs OCR, writes `ocr_text` / `ocr_confidence`, and
 *     transitions the bundle to `ready`.
 *   - When either is absent (the honest reality in a gateway with no OCR vendor
 *     or object-storage backend wired), it transitions the bundle to `failed`
 *     with a structured `error_message` instead of leaving it stuck in
 *     `processing`. An operator polling the bundle sees a truthful terminal
 *     status, not an eternal "processing" lie.
 *
 * The handler is RLS-correct: every DB statement runs inside
 * `withWorkerTenantContext` so `app.current_tenant_id` is bound transactionally.
 *
 * Failures never throw out of the subscriber — `safeOcrHandler` logs and
 * absorbs so the outbox treats the event as acknowledged (mirrors the
 * convention in `event-subscribers.ts`).
 */

import { sql } from 'drizzle-orm';
import type { Logger } from 'pino';

import { withWorkerTenantContext } from './with-tenant-context.js';

// ---------------------------------------------------------------------------
// Injected ports — kept minimal so this module never pulls the
// document-intelligence service or the heavy drizzle client typings into the
// api-gateway dependency graph. The composition root supplies the real
// implementations; tests inject fakes.
// ---------------------------------------------------------------------------

export interface ScanOcrDbLike {
  execute(query: unknown): Promise<unknown>;
}

export interface SubscribableBusLike {
  subscribe(
    pattern: string,
    handler: (event: ScanOcrEventLike) => Promise<void> | void,
    opts?: { id?: string },
  ): string | void;
}

export interface ScanOcrEventLike {
  type?: string;
  eventType?: string;
  aggregateId?: string;
  payload?: Record<string, unknown>;
  metadata?: { tenantId?: string; correlationId?: string; [k: string]: unknown };
}

/** A single page's raw bytes + mime, fetched from object storage. */
export interface PageBytes {
  readonly bytes: Uint8Array;
  readonly mimeType: string;
}

/**
 * Resolves the raw bytes for a stored page. Returns `null` when the bytes are
 * not retrievable (no object-storage backend wired, or the key is gone) — the
 * worker then fails the bundle honestly rather than guessing.
 */
export interface PageBytesResolver {
  resolve(args: {
    readonly tenantId: string;
    readonly bundleId: string;
    readonly pageId: string;
    readonly storageKey: string;
    readonly mimeType: string;
  }): Promise<PageBytes | null>;
}

/** A real OCR provider, wrapped to the one call this worker needs. */
export interface ScanOcrRunner {
  /** Confidence is 0–100 to match `scan_bundle_pages.ocr_confidence` (integer). */
  run(args: {
    readonly bytes: Uint8Array;
    readonly mimeType: string;
    readonly language?: string;
  }): Promise<{ readonly text: string; readonly confidence: number }>;
}

export interface ScanOcrSubscriberDeps {
  readonly bus: SubscribableBusLike;
  readonly db: ScanOcrDbLike;
  readonly logger: Logger;
  /** Real OCR provider. Absent ⇒ bundles fail with `ocr_provider_unavailable`. */
  readonly ocr?: ScanOcrRunner | null;
  /** Page-bytes fetcher. Absent ⇒ bundles fail with `page_bytes_unavailable`. */
  readonly pageBytes?: PageBytesResolver | null;
  /** Test seam for deterministic timestamps. */
  readonly now?: () => Date;
}

interface PageRow {
  readonly id: string;
  readonly pageNumber: number;
  readonly storageKey: string;
  readonly mimeType: string;
}

interface ProcessingLogEntry {
  readonly step: string;
  readonly at: string;
  readonly detail?: string;
}

const SUBSCRIBER_ID = 'scan-bundle.ocr-consumer';
const OCR_EVENT = 'ScanBundleOcrRequested';

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function asRows(res: unknown): readonly Record<string, unknown>[] {
  if (Array.isArray(res)) return res as Record<string, unknown>[];
  const r = (res as { rows?: unknown }).rows;
  return Array.isArray(r) ? (r as Record<string, unknown>[]) : [];
}

function asString(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  return typeof v === 'string' ? v : '';
}

function asNumber(row: Record<string, unknown>, key: string): number {
  const v = row[key];
  return typeof v === 'number' ? v : Number(v ?? 0) || 0;
}

/** Clamp + round a 0–100 confidence into the integer column's domain. */
export function normalizeConfidence(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  const scaled = raw <= 1 ? raw * 100 : raw;
  return Math.max(0, Math.min(100, Math.round(scaled)));
}

export function appendLog(
  existing: unknown,
  entry: ProcessingLogEntry,
): ProcessingLogEntry[] {
  const prior = Array.isArray(existing) ? (existing as ProcessingLogEntry[]) : [];
  return [...prior, entry];
}

function safeOcrHandler(
  logger: Logger,
  fn: (event: ScanOcrEventLike) => Promise<void>,
): (event: ScanOcrEventLike) => Promise<void> {
  return async (event) => {
    try {
      await fn(event);
    } catch (err) {
      logger.error(
        {
          err: err instanceof Error ? err.message : String(err),
          eventType: event.eventType ?? event.type,
          aggregateId: event.aggregateId,
          correlationId: event.metadata?.correlationId,
        },
        'scan-ocr-consumer: handler failed',
      );
    }
  };
}

// ---------------------------------------------------------------------------
// DB operations (RLS-scoped via withWorkerTenantContext by the caller)
// ---------------------------------------------------------------------------

async function loadPages(
  db: ScanOcrDbLike,
  bundleId: string,
): Promise<readonly PageRow[]> {
  const res = await db.execute(sql`
    SELECT id, page_number, storage_key, mime_type
    FROM scan_bundle_pages
    WHERE bundle_id = ${bundleId}
    ORDER BY page_number ASC
  `);
  return asRows(res).map((r) => ({
    id: asString(r, 'id'),
    pageNumber: asNumber(r, 'page_number'),
    storageKey: asString(r, 'storage_key'),
    mimeType: asString(r, 'mime_type'),
  }));
}

async function loadProcessingLog(
  db: ScanOcrDbLike,
  bundleId: string,
): Promise<unknown> {
  const res = await db.execute(sql`
    SELECT processing_log FROM scan_bundles WHERE id = ${bundleId} LIMIT 1
  `);
  const row = asRows(res)[0];
  return row?.['processing_log'] ?? [];
}

async function writePageOcr(
  db: ScanOcrDbLike,
  pageId: string,
  text: string,
  confidence: number,
): Promise<void> {
  await db.execute(sql`
    UPDATE scan_bundle_pages
    SET ocr_text = ${text}, ocr_confidence = ${confidence}
    WHERE id = ${pageId}
  `);
}

async function finalizeBundle(
  db: ScanOcrDbLike,
  args: {
    readonly bundleId: string;
    readonly status: 'ready' | 'failed';
    readonly processingLog: ProcessingLogEntry[];
    readonly errorMessage: string | null;
    readonly now: Date;
  },
): Promise<void> {
  const logJson = JSON.stringify(args.processingLog);
  await db.execute(sql`
    UPDATE scan_bundles
    SET status = ${args.status},
        processing_log = ${logJson}::jsonb,
        error_message = ${args.errorMessage},
        updated_at = ${args.now.toISOString()}
    WHERE id = ${args.bundleId}
  `);
}

// ---------------------------------------------------------------------------
// Core processing
// ---------------------------------------------------------------------------

/**
 * Process one OCR request. Always lands the bundle in `ready` or `failed`.
 * Returns the terminal status so tests can assert it.
 */
export async function processScanOcrRequest(
  deps: ScanOcrSubscriberDeps,
  args: { readonly tenantId: string; readonly bundleId: string },
): Promise<'ready' | 'failed'> {
  const now = deps.now ?? (() => new Date());
  const { tenantId, bundleId } = args;

  // `pinned` is the connection the per-tenant SET LOCAL bound — every DB call
  // below threads it (NOT the pooled `deps.db`) so the FORCE-RLS reads/writes
  // run under the tenant GUC. Non-DB deps (ocr / pageBytes / logger) are
  // external IO and stay on their own handles.
  return withWorkerTenantContext(deps.db, tenantId, async (pinned) => {
    const at = now();
    const baseLog = await loadProcessingLog(pinned, bundleId);

    // Honest refusal: no real OCR provider and/or no byte store wired. Fail the
    // bundle to a terminal state instead of leaving it forever in `processing`.
    if (!deps.ocr || !deps.pageBytes) {
      const reason = !deps.ocr ? 'ocr_provider_unavailable' : 'page_bytes_unavailable';
      const log = appendLog(baseLog, { step: 'ocr_failed', at: at.toISOString(), detail: reason });
      await finalizeBundle(pinned, {
        bundleId,
        status: 'failed',
        processingLog: log,
        errorMessage: `OCR not performed: ${reason}`,
        now: at,
      });
      deps.logger.warn({ tenantId, bundleId, reason }, 'scan-ocr-consumer: OCR unavailable; bundle failed');
      return 'failed';
    }

    const pages = await loadPages(pinned, bundleId);
    if (pages.length === 0) {
      const log = appendLog(baseLog, { step: 'ocr_failed', at: at.toISOString(), detail: 'no_pages' });
      await finalizeBundle(pinned, {
        bundleId,
        status: 'failed',
        processingLog: log,
        errorMessage: 'OCR not performed: bundle has no pages',
        now: at,
      });
      return 'failed';
    }

    let ocredCount = 0;
    for (const page of pages) {
      const fetched = await deps.pageBytes.resolve({
        tenantId,
        bundleId,
        pageId: page.id,
        storageKey: page.storageKey,
        mimeType: page.mimeType,
      });
      if (!fetched) continue; // page bytes gone — skip; reflected in count below
      const result = await deps.ocr.run({ bytes: fetched.bytes, mimeType: fetched.mimeType });
      await writePageOcr(pinned, page.id, result.text, normalizeConfidence(result.confidence));
      ocredCount += 1;
    }

    if (ocredCount === 0) {
      const log = appendLog(baseLog, { step: 'ocr_failed', at: at.toISOString(), detail: 'no_page_bytes_retrievable' });
      await finalizeBundle(pinned, {
        bundleId,
        status: 'failed',
        processingLog: log,
        errorMessage: 'OCR not performed: no page bytes were retrievable',
        now: at,
      });
      return 'failed';
    }

    const log = appendLog(baseLog, {
      step: 'ocr_completed',
      at: at.toISOString(),
      detail: `${ocredCount}/${pages.length} pages`,
    });
    await finalizeBundle(pinned, {
      bundleId,
      status: 'ready',
      processingLog: log,
      errorMessage: null,
      now: at,
    });
    deps.logger.info({ tenantId, bundleId, ocredCount, pageCount: pages.length }, 'scan-ocr-consumer: bundle ready');
    return 'ready';
  });
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * Register the `ScanBundleOcrRequested` consumer on the event bus. Idempotent
 * by subscriber id — safe to call once at boot. Returns the subscription id
 * (or undefined when the bus implementation does not return one).
 */
export function registerScanOcrSubscriber(deps: ScanOcrSubscriberDeps): string | void {
  return deps.bus.subscribe(
    OCR_EVENT,
    safeOcrHandler(deps.logger, async (event) => {
      const tenantId = event.metadata?.tenantId;
      const payload = event.payload ?? {};
      const bundleId =
        typeof payload['bundleId'] === 'string' ? (payload['bundleId'] as string) : event.aggregateId;
      if (!tenantId || !bundleId) {
        deps.logger.warn(
          { tenantId, bundleId, eventType: event.eventType ?? event.type },
          'scan-ocr-consumer: missing tenantId/bundleId; skipping',
        );
        return;
      }
      await processScanOcrRequest(deps, { tenantId, bundleId });
    }),
    { id: SUBSCRIBER_ID },
  );
}
