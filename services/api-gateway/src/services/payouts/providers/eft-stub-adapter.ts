/**
 * Bank EFT placeholder adapter.
 *
 * The real EFT integration is bank-by-bank — KCB, NCBA, Equity all
 * expose different APIs (NACHA-style files, RTGS/EFT, SWIFT). The
 * platform's strategy is to route TZS / generic-currency payouts via
 * an aggregator (e.g. Selcom for TZ, Cellulant for multi-rail) once
 * tenant pilots reach scale. Until then this adapter:
 *
 *  - validates the disbursement input (positive integer minor amount,
 *    non-empty destination iban / account-number),
 *  - returns `'failed'` with reason `eft_not_implemented`, which the
 *    worker treats as a retryable failure. After `max_retries` the row
 *    transitions to `dead_letter`, which is exactly the visibility we
 *    want — operators see an actionable signal in the DLQ rather than
 *    silently consuming proposals.
 *
 * Why not return `'completed'`? Because that would be a lie: no money
 * has moved. Better to fail loudly so accounting reconciliation never
 * shows a `published` outbox row that does not correspond to a real
 * bank settlement.
 */

import type {
  PayoutProvider,
  PayoutProviderInput,
  PayoutProviderResult,
} from '../stub-payout-provider';

export type EftStubConfig = {
  /** ISO-4217 currencies this provider is authoritative for. */
  readonly supportedCurrencies?: ReadonlyArray<string>;
};

export function createEftStubAdapter(config: EftStubConfig = {}): PayoutProvider {
  const supported = new Set(config.supportedCurrencies ?? []);

  async function send(input: PayoutProviderInput): Promise<PayoutProviderResult> {
    if (supported.size > 0 && !supported.has(input.currency)) {
      return {
        providerRef: `eft_unsupported_${input.idempotencyKey}`,
        status: 'failed',
        failureReason: `eft_unsupported_currency_${input.currency}`,
      };
    }
    if (!Number.isFinite(input.amountMinor) || input.amountMinor <= 0) {
      return {
        providerRef: `eft_invalid_${input.idempotencyKey}`,
        status: 'failed',
        failureReason: 'eft_invalid_amount',
      };
    }
    if (typeof input.destination !== 'string' || input.destination.trim().length === 0) {
      return {
        providerRef: `eft_invalid_dest_${input.idempotencyKey}`,
        status: 'failed',
        failureReason: 'eft_missing_destination',
      };
    }
    return {
      providerRef: `eft_pending_${input.tenantId}_${input.idempotencyKey}`,
      status: 'failed',
      failureReason: 'eft_not_implemented',
    };
  }

  return { send };
}
