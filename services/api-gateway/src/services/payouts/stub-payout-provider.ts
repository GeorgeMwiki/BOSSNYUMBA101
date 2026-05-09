/**
 * Payout provider port + stub + env-driven real-rail composition.
 *
 * The `PayoutProvider` shape is the seam the worker code targets. It
 * never imports a concrete provider, only this port.
 *
 * Three factories are exported:
 *
 *  - `createStubPayoutProvider()` — deterministic always-success stub
 *    for dev / wiring tests. Real-money rails MUST replace this at
 *    composition time.
 *  - `createPayoutProviderFromEnv(env)` — reads Mpesa B2C + EFT config
 *    from process.env, builds a composite if any rail is configured,
 *    falls back to the stub if nothing is set.
 *  - The two concrete adapters live under `./providers/`.
 */
import { randomUUID } from 'crypto';

import { createCompositePayoutProvider } from './providers/composite';
import { createEftStubAdapter } from './providers/eft-stub-adapter';
import {
  createMpesaB2CAdapter,
  type MpesaB2CConfig,
} from './providers/mpesa-b2c-adapter';

export type PayoutProviderInput = {
  readonly tenantId: string;
  readonly ownerId: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly destination: string;
  readonly idempotencyKey: string;
};

export type PayoutProviderResult = {
  readonly providerRef: string;
  readonly status: 'completed' | 'failed';
  readonly failureReason?: string;
};

export type PayoutProvider = {
  send(input: PayoutProviderInput): Promise<PayoutProviderResult>;
};

/**
 * Stub provider. Always succeeds — useful for wiring tests + dev
 * environments. Real-money rails MUST replace this at composition.
 *
 * The `providerRef` is namespaced so audit rows make it obvious the
 * payout was simulated; production rails should return the rail's
 * own transaction id (e.g. Mpesa `ConversationID`).
 */
export function createStubPayoutProvider(): PayoutProvider {
  return {
    async send(input) {
      return {
        providerRef: `stub_${input.idempotencyKey}_${randomUUID()}`,
        status: 'completed',
      };
    },
  };
}

/**
 * Build the composed real-rail provider from env. If the Mpesa block
 * is fully configured we wire the B2C adapter; otherwise we skip it.
 * EFT is always wired (it's a stub that fails-loudly for the brief
 * window before real bank integration lands). If neither is wired we
 * return `null` and let the caller decide what to do.
 *
 * Returning `null` rather than a stub here is deliberate: callers
 * that *want* the stub explicitly call `createStubPayoutProvider()`,
 * keeping the production code path safe from accidental "always
 * succeeds" semantics in production-like environments.
 */
export function createPayoutProviderFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): PayoutProvider | null {
  const mpesa = readMpesaB2CConfig(env);
  const mpesaAdapter = mpesa ? createMpesaB2CAdapter(mpesa) : undefined;
  const eftEnabled = env.PAYOUTS_EFT_ENABLED === 'true' || mpesaAdapter !== undefined;
  const eftAdapter = eftEnabled ? createEftStubAdapter() : undefined;
  return createCompositePayoutProvider({
    ...(mpesaAdapter ? { mpesa: mpesaAdapter } : {}),
    ...(eftAdapter ? { eft: eftAdapter } : {}),
  });
}

/**
 * Composition entry point: try env-driven real rails first, fall
 * back to the always-success stub if nothing is configured.
 *
 * Intended for use at process start-up:
 *
 *   const provider = resolvePayoutProvider();
 *   const worker = createPayoutsWorker({ db, provider, logger });
 */
export function resolvePayoutProvider(
  env: NodeJS.ProcessEnv = process.env,
): PayoutProvider {
  return createPayoutProviderFromEnv(env) ?? createStubPayoutProvider();
}

// ---------------------------------------------------------------------------
// Env parsing
// ---------------------------------------------------------------------------

function readMpesaB2CConfig(env: NodeJS.ProcessEnv): MpesaB2CConfig | null {
  const host = env.MPESA_API_HOST;
  const consumerKey = env.MPESA_CONSUMER_KEY;
  const consumerSecret = env.MPESA_CONSUMER_SECRET;
  const initiatorName = env.MPESA_B2C_INITIATOR_NAME;
  const securityCredential = env.MPESA_B2C_SECURITY_CREDENTIAL;
  const shortcode = env.MPESA_B2C_SHORTCODE;
  const queueTimeoutUrl = env.MPESA_B2C_QUEUE_TIMEOUT_URL;
  const resultUrl = env.MPESA_B2C_RESULT_URL;
  if (
    !host ||
    !consumerKey ||
    !consumerSecret ||
    !initiatorName ||
    !securityCredential ||
    !shortcode ||
    !queueTimeoutUrl ||
    !resultUrl
  ) {
    return null;
  }
  return {
    host,
    consumerKey,
    consumerSecret,
    initiatorName,
    securityCredential,
    shortcode,
    queueTimeoutUrl,
    resultUrl,
  };
}
