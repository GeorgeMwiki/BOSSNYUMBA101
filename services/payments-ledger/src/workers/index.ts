/**
 * Worker entrypoint for the payments-ledger service.
 *
 * Starts background workers alongside the HTTP server when
 * `PAYMENTS_LEDGER_WORKER_MODE=true`. Currently manages:
 *
 *   - eTIMS retry worker (KRA tax submission retries)
 *
 * The HTTP server imports `startWorkersIfEnabled()` and invokes it after
 * boot so a single process can serve API traffic and run workers; a
 * dedicated worker container can invoke this module directly via
 * `node dist/workers/index.js`.
 */
import pino from 'pino';

import {
  createEtimsRetryWorker,
  type EtimsRetryInvoiceRepo,
  type EtimsRetryWorker,
  type KraEtimsClient,
} from './etims-retry.worker';

const logger = pino({
  name: 'payments-ledger-workers',
  level: process.env.LOG_LEVEL || 'info',
});

export interface WorkerBootstrapDeps {
  kraEtimsClient: KraEtimsClient;
  invoiceRepo: EtimsRetryInvoiceRepo;
}

export interface WorkerHandles {
  etimsRetry: EtimsRetryWorker;
  stopAll: () => Promise<void>;
}

/**
 * Check whether workers should run in this process.
 */
export function isWorkerModeEnabled(): boolean {
  const flag = (process.env.PAYMENTS_LEDGER_WORKER_MODE || '').toLowerCase();
  return flag === 'true' || flag === '1' || flag === 'yes';
}

/**
 * Start background workers using the supplied dependencies. Returns handles
 * so the caller can stop them during graceful shutdown.
 */
export function startWorkers(deps: WorkerBootstrapDeps): WorkerHandles {
  const etimsRetry = createEtimsRetryWorker({
    kraEtimsClient: deps.kraEtimsClient,
    invoiceRepo: deps.invoiceRepo,
    logger,
  });

  etimsRetry.start();

  const stopAll = async () => {
    await etimsRetry.stop();
  };

  // Register shutdown hooks once.
  const onSignal = async (signal: NodeJS.Signals) => {
    logger.info({ signal }, 'Worker shutdown signal received');
    try {
      await stopAll();
    } catch (err) {
      logger.error({ err: (err as Error)?.message }, 'Error during worker shutdown');
    }
  };
  process.once('SIGTERM', () => {
    void onSignal('SIGTERM');
  });
  process.once('SIGINT', () => {
    void onSignal('SIGINT');
  });

  return { etimsRetry, stopAll };
}

/**
 * Convenience helper for the HTTP server: only starts workers when the
 * env flag is set. If no deps are supplied the call is a no-op and a
 * warning is logged (worker mode requested but no wiring provided).
 */
export function startWorkersIfEnabled(
  deps?: WorkerBootstrapDeps
): WorkerHandles | null {
  if (!isWorkerModeEnabled()) return null;

  if (!deps) {
    logger.warn(
      'PAYMENTS_LEDGER_WORKER_MODE=true but no worker dependencies supplied; skipping worker start'
    );
    return null;
  }

  logger.info('PAYMENTS_LEDGER_WORKER_MODE enabled – starting workers');
  return startWorkers(deps);
}

// Re-export worker types for downstream wiring.
export * from './etims-retry.worker';
