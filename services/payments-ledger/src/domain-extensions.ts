/**
 * Domain Model Extensions for Payments-Ledger Service
 *
 * Provides types, interfaces, and utility functions that the payments-ledger
 * service requires but are not yet available in @bossnyumba/domain-models.
 *
 * Also augments the Money class with convenience methods used throughout
 * the service layer.
 */
import {
  Money,
  CurrencyCode,
  TenantId,
  CURRENCY_DECIMALS,
  toDecimal,
} from '@bossnyumba/domain-models';
import { calculatePlatformFeeMinor } from './lib/platform-fee';

// =============================================================================
// Missing Branded Types
// =============================================================================

/** Reconciliation run identifier */
export type ReconciliationId = string & { __brand: 'ReconciliationId' };

// =============================================================================
// Missing Domain Types
// =============================================================================

/** Reconciliation match status */
export type ReconciliationStatus = 'MATCHED' | 'UNMATCHED' | 'EXCEPTION';

/** Serialised Money value (return type of Money.toData()) */
export type MoneyData = { amount: number; currency: CurrencyCode };

/**
 * TenantAggregate – minimal interface used by payment orchestration.
 *
 * In production this would come from the tenant service; here we declare
 * just enough surface for the payments module to calculate fees and route
 * payments to connected accounts.
 */
export interface TenantAggregate {
  id: TenantId;
  /**
   * Platform fee in basis points (e.g. 500 for 5%). CANONICAL fee unit —
   * integer end-to-end, no float round-trip. Prefer this over
   * `getPlatformFeePercent()` for any fee arithmetic (#14).
   */
  getPlatformFeeBps(): number;
  /**
   * Platform fee as a percentage (e.g. 5.0 for 5%). DERIVED view of
   * `getPlatformFeeBps()` kept for callers that still speak percent.
   */
  getPlatformFeePercent(): number;
  paymentSettings: {
    stripeAccountId?: string;
    mpesaShortCode?: string;
  };
}

// =============================================================================
// Missing Utility Functions
// =============================================================================

/**
 * Calculate the platform fee for a given amount.
 *
 * A-BUG #14: this used to floor-vs-round DIFFERENTLY from the canonical
 * integer-basis-point lib (`lib/platform-fee.ts`) — it `Math.round`ed
 * while the lib `Math.floor`s. Two formulas on the live money path meant
 * the fee a payment was charged could differ by one minor unit from what
 * the ledger/statement math expected. This now REDIRECTS to the single
 * canonical `calculatePlatformFeeMinor(amountMinor, bps)` so there is
 * exactly one fee formula in the service (floor, integer end-to-end).
 *
 * @param amount  The gross payment amount
 * @param feePercent  Fee percentage (e.g. 5.0 for 5%)
 * @returns  The fee as a Money value in the same currency
 */
export function calculatePlatformFee(amount: Money, feePercent: number): Money {
  // Percent → basis points is the lib's native unit. `getTenantAggregate`
  // derives `feePercent` as `bps / 100`, so `round(feePercent * 100)`
  // recovers the original integer bps exactly.
  const bps = Math.round(feePercent * 100);
  const feeMinorUnits = calculatePlatformFeeMinor(amount.amountMinorUnits, bps);
  return Money.fromMinorUnits(feeMinorUnits, amount.currency);
}

/**
 * Create a typed branded ID from a string value.
 *
 * Usage: `createId<LedgerEntryId>(\`le_\${uuidv4()}\`)`
 */
export function createId<T extends string>(value: string): T {
  return value as T;
}

// =============================================================================
// Money Class Augmentation
// =============================================================================

// --- TypeScript declaration merging ---
declare module '@bossnyumba/domain-models' {
  interface Money {
    /** True when amount is exactly 0 */
    isZero(): boolean;
    /** True when amount < 0 */
    isNegative(): boolean;
    /** Human-readable representation, e.g. "KES 100.00" */
    toString(): string;
    /** Amount expressed in major currency units (e.g. shillings, dollars) */
    readonly amountMajorUnits: number;
  }
}

// --- Runtime prototype patching ---
const MoneyProto = Money.prototype as unknown as Record<string, unknown>;

if (typeof MoneyProto.isZero !== 'function') {
  MoneyProto.isZero = function (this: Money): boolean {
    return this.amountMinorUnits === 0;
  };
}

if (typeof MoneyProto.isNegative !== 'function') {
  MoneyProto.isNegative = function (this: Money): boolean {
    return this.amountMinorUnits < 0;
  };
}

// Override default Object.prototype.toString with a useful representation.
//
// Currency-aware: the minor→major divisor and the displayed fractional
// precision BOTH derive from the currency's ISO-4217 decimal places, never
// a hard-coded /100 + .toFixed(2). For a 0-decimal currency (TZS / UGX /
// RWF — the launch currencies) the minor unit IS the major unit, so
// `Money.fromMinorUnits(1500, 'TZS').toString()` is "TZS 1500", not
// "TZS 15.00". `toDecimal` already reads the divisor from the canonical
// ISO_4217 table in `@bossnyumba/domain-models`.
MoneyProto.toString = function (this: Money): string {
  const decimals = CURRENCY_DECIMALS[this.currency] ?? 2;
  return `${this.currency} ${toDecimal(this).toFixed(decimals)}`;
};

if (!Object.getOwnPropertyDescriptor(Money.prototype, 'amountMajorUnits')) {
  Object.defineProperty(Money.prototype, 'amountMajorUnits', {
    // Major units = minor units ÷ 10^decimals for the currency. 0-decimal
    // currencies (TZS / UGX / RWF / JPY / KRW) return the minor amount
    // unchanged; the old hard `/100` silently divided TSh 1,500 down to 15.
    get(this: Money): number {
      return toDecimal(this);
    },
    configurable: true,
    enumerable: false,
  });
}
