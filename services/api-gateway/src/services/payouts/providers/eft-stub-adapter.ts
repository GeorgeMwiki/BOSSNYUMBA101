/**
 * Bank EFT placeholder adapter — FAILS LOUD.
 *
 * The real EFT integration is bank-by-bank — KCB, NCBA, Equity all
 * expose different APIs (NACHA-style files, RTGS/EFT, SWIFT). The
 * platform's Phase E strategy is to swap this adapter for a per-
 * jurisdiction EFT MCP server (TZ: Selcom; KE: Pesalink/Cellulant;
 * UG: Eversend; RW: BK Connect; ZA: Stitch / Yapily Pay; NG: NIBSS).
 * Each MCP server speaks the local bank rail and the composition root
 * routes tenants to the right one via `tenant.region`.
 *
 * Until that wiring lands, this adapter REFUSES to accept any
 * transfer at all. Previously it returned `{ status: 'failed',
 * failureReason: 'eft_not_implemented' }` which the worker treated as
 * a retryable failure — but that left rows queued for retry forever
 * and gave operators a noisy DLQ rather than a single sharp signal at
 * configuration time. Throwing a typed `NotConfiguredError` at
 * factory call surfaces the gap at composition root, not at runtime.
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

/**
 * Thrown when the EFT adapter is constructed in any non-test environment.
 * Composition root must wire a per-jurisdiction MCP-backed provider
 * (Selcom / Pesalink / Eversend / etc.) before payouts are accepted.
 */
export class EftNotConfiguredError extends Error {
  readonly code = 'EFT_NOT_CONFIGURED';
  constructor(message?: string) {
    super(
      message ??
        'EFT bank-rail adapter is not configured. Phase E composition must bind a per-jurisdiction EFT MCP server (TZ: Selcom; KE: Pesalink/Cellulant; UG: Eversend; RW: BK Connect; ZA: Stitch; NG: NIBSS). This stub refuses to send.',
    );
    this.name = 'EftNotConfiguredError';
  }
}

export function createEftStubAdapter(config: EftStubConfig = {}): PayoutProvider {
  void config;
  // Allow construction in tests so unit tests can still assert the
  // `send` refusal. In any other environment, construction itself is
  // the loud signal: operators see the misconfiguration at boot.
  if (process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.error(
      '[eft-stub-adapter] constructed outside test env — payouts via this adapter will refuse. Wire a real EFT MCP server (see Phase E composition).',
    );
  }

  async function send(input: PayoutProviderInput): Promise<PayoutProviderResult> {
    // Validate the input shape so reconciliation tooling can still
    // distinguish invalid proposals from "no rail configured" — but
    // every successful validation still terminates in a typed refusal.
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
    // Loud refusal: thrown errors propagate to the payout worker which
    // marks the row as `dead_letter` immediately rather than burning
    // retry budget. Operators see one sharp signal per tenant rather
    // than a slow DLQ accumulation.
    throw new EftNotConfiguredError(
      `Refusing EFT payout for tenant ${input.tenantId} (${input.amountMinor} ${input.currency}) — no bank rail bound. See Phase E composition.`,
    );
  }

  return { send };
}
