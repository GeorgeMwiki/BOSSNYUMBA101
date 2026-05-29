/**
 * Settlement orchestrator — real-estate chain L8 types.
 *
 * Money math (primary currency — TZS, but multi-currency supported):
 *   gross   = rent_amount * lease_term_months
 *   deposit = optional security-deposit credit at move-in (rare, often zero)
 *   fee     = gross * PLATFORM_FEE_RATE  (1.5%)
 *   net     = gross - deposit - fee
 *
 * Money path (CLAUDE.md hard rule): every settlement runs
 * `LedgerService.post()` via the SettlementLedgerPort seam. The
 * journal must be balanced (debits = credits) — the orchestrator
 * builds three lines per settlement:
 *   DR  tenant_settlement_pool    gross
 *   CR  security_deposit_pool     deposit
 *   CR  platform_fee_revenue      fee
 *   CR  landlord_payout_pool      net
 * (gross debit = deposit + fee + net credits.)
 *
 * Real-estate retailoring of Borjie's mining settlement orchestrator.
 * The buyer/seller/RFB axis became the tenant/landlord/RFA (request-
 * for-application) axis, the mineral royalty became security deposit,
 * and the chain-of-custody photo + checksum step became move-in
 * inspection signature.
 */

export type SettlementStatus =
  | 'pending'
  | 'posted'
  | 'paying_out'
  | 'completed'
  | 'failed';

export type PayoutProvider = 'mpesa_b2c' | 'wallet' | 'stripe';

export interface SettlementMath {
  readonly grossAmount: number;
  readonly depositAmount: number;
  readonly feeAmount: number;
  readonly netAmount: number;
  readonly currencyCode: string;
}

export interface SignMoveInInput {
  readonly tenantId: string;
  /** The landlord-tenant (RLS scope) user signing the move-in. */
  readonly landlordUserId: string;
  /** The RFA-response (accepted tenant application) id. */
  readonly responseId: string;
  /** Move-in inspection checksum — drives cross-tenant idempotency. */
  readonly moveInChecksum: string;
}

export interface SignMoveInResult {
  readonly settlementId: string;
  readonly status: SettlementStatus;
  readonly math: SettlementMath;
  readonly ledgerTxnId: string | null;
  readonly payoutProvider: PayoutProvider | null;
  readonly payoutProviderRef: string | null;
  readonly idempotent: boolean;
}

export interface SettlementLedgerPostInput {
  readonly tenantId: string;
  readonly responseId: string;
  readonly idempotencyKey: string;
  readonly math: SettlementMath;
}

export interface SettlementLedgerPostResult {
  /** Journal id from LedgerService.post(). */
  readonly journalId: string;
}

export interface SettlementLedgerPort {
  post(input: SettlementLedgerPostInput): Promise<SettlementLedgerPostResult>;
}

export interface SettlementPayoutInput {
  readonly tenantId: string;
  readonly settlementId: string;
  readonly netAmount: number;
  readonly currencyCode: string;
  readonly landlordUserId: string;
}

export interface SettlementPayoutResult {
  readonly provider: PayoutProvider;
  readonly providerRef: string;
}

export interface SettlementPayoutPort {
  payout(input: SettlementPayoutInput): Promise<SettlementPayoutResult>;
}

/** Default platform fee — 1.5% of gross. */
export const PLATFORM_FEE_RATE = 0.015;

/**
 * Currencies the settlements table CHECK constraint accepts. Must stay
 * in sync with `packages/database/src/migrations/0287_*.sql`.
 */
export const SETTLEMENT_CURRENCIES = [
  'TZS', 'USD', 'KES', 'UGX', 'NGN', 'EUR', 'ZAR', 'GBP', 'AUD',
] as const;
export type SettlementCurrency = (typeof SETTLEMENT_CURRENCIES)[number];

/**
 * Round to two decimals — settlements are stored as numeric(15,2)
 * per the migration. Half-up rounding.
 */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Compute the settlement math from a lease application response row.
 *
 * Inputs are positive numbers. The result satisfies the migration's
 * CHECK constraint: net = gross - deposit - fee.
 */
export function computeSettlementMath(input: {
  readonly rentAmount: number;
  readonly leaseTermMonths: number;
  readonly depositAmount?: number;
  readonly currencyCode: string;
}): SettlementMath {
  if (input.rentAmount <= 0) {
    throw new Error('rentAmount must be positive');
  }
  if (input.leaseTermMonths <= 0) {
    throw new Error('leaseTermMonths must be positive');
  }
  const currencyCode = input.currencyCode.toUpperCase();
  if (
    !SETTLEMENT_CURRENCIES.includes(currencyCode as SettlementCurrency)
  ) {
    throw new Error(`unsupported settlement currency: ${currencyCode}`);
  }
  const grossAmount = round2(input.rentAmount * input.leaseTermMonths);
  const depositAmount = round2(Math.max(0, input.depositAmount ?? 0));
  const feeAmount = round2(grossAmount * PLATFORM_FEE_RATE);
  // Compute net as gross - deposit - fee then round; the CHECK
  // constraint will refuse rows that don't satisfy this identity.
  const netAmount = round2(grossAmount - depositAmount - feeAmount);
  if (netAmount <= 0) {
    throw new Error(
      `net settlement amount must be positive (gross=${grossAmount}, ` +
      `deposit=${depositAmount}, fee=${feeAmount})`,
    );
  }
  return { grossAmount, depositAmount, feeAmount, netAmount, currencyCode };
}
