/**
 * Stub payouts provider.
 *
 * Returns a deterministic success response so the worker can be wired
 * end-to-end without a live payments rail. Real integration TODO:
 *   - Mpesa B2C disbursement (KES) via Daraja `b2c/v3/paymentrequest`
 *   - bank EFT (TZS / KES / generic) via aggregator (e.g. Selcom, Cellulant)
 *   - card / virtual-card rails via Stripe Connect `transfers.create`
 *
 * The shape of `PayoutProvider` is the seam the real adapters must
 * satisfy; the worker code never imports a concrete provider, only the
 * port. Swap the stub for a real adapter at composition time.
 */
import { randomUUID } from 'crypto';

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
      // TODO: replace with real Mpesa B2C / bank EFT / Stripe Connect
      // dispatch. Keep the input shape stable so the worker doesn't
      // need to change when real rails land.
      return {
        providerRef: `stub_${input.idempotencyKey}_${randomUUID()}`,
        status: 'completed',
      };
    },
  };
}
