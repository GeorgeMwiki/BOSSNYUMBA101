/**
 * Payments package bootstrap.
 *
 * Imported for side effects from `src/index.ts` so that any service consuming
 * `@bossnyumba/payments-service` gets its M-Pesa support stores configured
 * automatically based on `MPESA_STORE_BACKEND`.
 *
 * If you need to override the injection (e.g., tests), call the setters
 * directly after importing this module:
 *
 *   import { setStkIdempotencyStore } from '@bossnyumba/payments-service';
 *   setStkIdempotencyStore(customStore);
 */
import { logger } from './common/logger';
import { createStores } from './common/store-factory';
import {
  setCallbackReplayStore,
  setStkIdempotencyStore,
  setStkRateLimiter,
} from './common/stores';

let bootstrapped = false;
let cachedClose: (() => Promise<void>) | undefined;

export function bootstrapPaymentsStores(): void {
  if (bootstrapped) return;
  bootstrapped = true;

  try {
    const stores = createStores();
    setStkIdempotencyStore(stores.stkIdempotencyStore);
    setCallbackReplayStore(stores.callbackReplayStore);
    setStkRateLimiter(stores.stkRateLimiter);
    cachedClose = stores.close;

    logger.info(
      { backend: process.env.MPESA_STORE_BACKEND || 'memory' },
      'Payments package bootstrap complete'
    );
  } catch (err) {
    // Never block import on a bootstrap failure – callers still have working
    // in-memory defaults from `stores.ts`.
    logger.error({ err }, 'Payments bootstrap failed; using in-memory defaults');
  }
}

export async function shutdownPaymentsStores(): Promise<void> {
  if (cachedClose) {
    await cachedClose();
    cachedClose = undefined;
  }
  bootstrapped = false;
}

// Auto-run at import time so consumers are wired without extra setup.
bootstrapPaymentsStores();
