/**
 * eTIMS retry worker.
 *
 * Invoices that fail KRA eTIMS submission are persisted with status
 * `PENDING_TAX_SUBMISSION` (plus a `taxSubmissionError` reason) by the
 * invoice generator / payment pipeline. This worker polls those invoices,
 * retries the KRA submission, and finalises the invoice state.
 *
 * - Success: invoice flips to `ISSUED`, `kraReceiptNo` / `kraQrUrl` stored.
 * - Failure: invoice stays in `PENDING_TAX_SUBMISSION`; `taxSubmissionError`
 *   is updated so operators can triage.
 *
 * Runs every `ETIMS_RETRY_INTERVAL_MS` (default 5 min). Shutdown is
 * cooperative: SIGTERM clears the interval and resolves the inflight tick.
 */
import pino from 'pino';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Minimal shape the worker needs from a pending-tax invoice. The concrete
 * repository may return a richer object; only these fields are consumed.
 */
export interface PendingTaxInvoice {
  id: string;
  tenantId: string;
  invoiceNumber: string;
  totalAmount: { amountMinorUnits: number; currency: string };
  taxSubmissionError?: string;
  taxSubmissionAttempts?: number;
  [key: string]: unknown;
}

export interface EtimsSubmissionResult {
  kraReceiptNo: string;
  kraQrUrl: string;
}

export interface KraEtimsClient {
  submitInvoice(invoice: PendingTaxInvoice): Promise<EtimsSubmissionResult>;
}

export interface EtimsRetryInvoiceRepo {
  /** Return invoices currently in PENDING_TAX_SUBMISSION status. */
  findPendingTaxSubmission(limit: number): Promise<PendingTaxInvoice[]>;
  /** Flip an invoice to ISSUED with eTIMS receipt/QR persisted. */
  markIssuedWithKra(
    invoiceId: string,
    tenantId: string,
    kra: EtimsSubmissionResult
  ): Promise<void>;
  /** Leave invoice in PENDING but refresh the failure reason + attempt count. */
  recordTaxSubmissionFailure(
    invoiceId: string,
    tenantId: string,
    error: string
  ): Promise<void>;
}

export interface EtimsRetryLogger {
  info: (obj: Record<string, unknown>, msg?: string) => void;
  warn: (obj: Record<string, unknown>, msg?: string) => void;
  error: (obj: Record<string, unknown>, msg?: string) => void;
}

export interface EtimsRetryWorkerDeps {
  kraEtimsClient: KraEtimsClient;
  invoiceRepo: EtimsRetryInvoiceRepo;
  logger?: EtimsRetryLogger;
  /** Polling interval in ms. Defaults to ETIMS_RETRY_INTERVAL_MS env or 5 min. */
  intervalMs?: number;
  /** Max invoices processed per tick. Default 50. */
  batchSize?: number;
}

export interface EtimsRetryWorker {
  /** Start the polling loop. Safe to call once per process. */
  start(): void;
  /** Stop the loop; awaits the inflight tick. */
  stop(): Promise<void>;
  /** Run a single tick immediately (also used internally + by tests). */
  runOnce(): Promise<EtimsRetryTickResult>;
  readonly isRunning: boolean;
}

export interface EtimsRetryTickResult {
  attempted: number;
  succeeded: number;
  failed: number;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 50;

function resolveInterval(override?: number): number {
  if (typeof override === 'number' && override > 0) return override;
  const env = process.env.ETIMS_RETRY_INTERVAL_MS;
  if (env) {
    const parsed = Number(env);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_INTERVAL_MS;
}

// ---------------------------------------------------------------------------
// Worker factory
// ---------------------------------------------------------------------------

export function createEtimsRetryWorker(
  deps: EtimsRetryWorkerDeps
): EtimsRetryWorker {
  const logger: EtimsRetryLogger =
    deps.logger ||
    pino({
      name: 'etims-retry-worker',
      level: process.env.LOG_LEVEL || 'info',
    });
  const intervalMs = resolveInterval(deps.intervalMs);
  const batchSize = deps.batchSize ?? DEFAULT_BATCH_SIZE;

  let handle: NodeJS.Timeout | null = null;
  let running = false;
  let inflight: Promise<EtimsRetryTickResult> | null = null;
  let stopping = false;

  async function runOnce(): Promise<EtimsRetryTickResult> {
    if (inflight) return inflight;
    inflight = (async () => {
      const result: EtimsRetryTickResult = {
        attempted: 0,
        succeeded: 0,
        failed: 0,
      };

      let invoices: PendingTaxInvoice[] = [];
      try {
        invoices = await deps.invoiceRepo.findPendingTaxSubmission(batchSize);
      } catch (err) {
        logger.error(
          { err: (err as Error)?.message, worker: 'etims-retry' },
          'Failed to load pending tax invoices'
        );
        return result;
      }

      if (invoices.length === 0) {
        logger.info(
          { worker: 'etims-retry', attempted: 0 },
          'eTIMS retry tick: no pending invoices'
        );
        return result;
      }

      for (const invoice of invoices) {
        if (stopping) break;
        result.attempted += 1;

        logger.info(
          {
            worker: 'etims-retry',
            event: 'retry_attempted',
            invoiceId: invoice.id,
            tenantId: invoice.tenantId,
            invoiceNumber: invoice.invoiceNumber,
            previousAttempts: invoice.taxSubmissionAttempts ?? 0,
          },
          'eTIMS retry attempted'
        );

        try {
          const kra = await deps.kraEtimsClient.submitInvoice(invoice);
          await deps.invoiceRepo.markIssuedWithKra(
            invoice.id,
            invoice.tenantId,
            kra
          );
          result.succeeded += 1;

          logger.info(
            {
              worker: 'etims-retry',
              event: 'retry_succeeded',
              invoiceId: invoice.id,
              tenantId: invoice.tenantId,
              kraReceiptNo: kra.kraReceiptNo,
            },
            'eTIMS retry succeeded'
          );
        } catch (err) {
          const message =
            err instanceof Error ? err.message : String(err ?? 'unknown error');
          result.failed += 1;

          try {
            await deps.invoiceRepo.recordTaxSubmissionFailure(
              invoice.id,
              invoice.tenantId,
              message
            );
          } catch (persistErr) {
            logger.error(
              {
                worker: 'etims-retry',
                invoiceId: invoice.id,
                tenantId: invoice.tenantId,
                err: (persistErr as Error)?.message,
              },
              'Failed to persist eTIMS retry failure'
            );
          }

          logger.warn(
            {
              worker: 'etims-retry',
              event: 'retry_failed',
              invoiceId: invoice.id,
              tenantId: invoice.tenantId,
              error: message,
            },
            'eTIMS retry failed'
          );
        }
      }

      logger.info(
        {
          worker: 'etims-retry',
          event: 'tick_complete',
          attempted: result.attempted,
          succeeded: result.succeeded,
          failed: result.failed,
        },
        'eTIMS retry tick complete'
      );

      return result;
    })();

    try {
      return await inflight;
    } finally {
      inflight = null;
    }
  }

  function start(): void {
    if (running) return;
    running = true;
    stopping = false;

    logger.info(
      { worker: 'etims-retry', intervalMs, batchSize },
      'eTIMS retry worker started'
    );

    // Kick off an initial tick slightly after start so we don't block boot.
    handle = setInterval(() => {
      runOnce().catch((err) => {
        logger.error(
          { worker: 'etims-retry', err: (err as Error)?.message },
          'eTIMS retry tick crashed'
        );
      });
    }, intervalMs);

    // Don't keep the event loop alive solely for the timer.
    if (typeof handle.unref === 'function') handle.unref();
  }

  async function stop(): Promise<void> {
    if (!running) return;
    stopping = true;
    running = false;
    if (handle) {
      clearInterval(handle);
      handle = null;
    }
    if (inflight) {
      try {
        await inflight;
      } catch {
        /* swallow – already logged */
      }
    }
    logger.info({ worker: 'etims-retry' }, 'eTIMS retry worker stopped');
  }

  return {
    start,
    stop,
    runOnce,
    get isRunning() {
      return running;
    },
  };
}
