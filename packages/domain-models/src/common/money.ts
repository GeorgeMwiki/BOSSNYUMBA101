/**
 * Money value object for handling currency amounts
 * Immutable and currency-aware
 */

import { z } from 'zod';
import type { CurrencyCode } from './types';

export const MoneySchema = z.object({
  amount: z.number().int(),
  currency: z.enum(['KES', 'TZS', 'UGX', 'RWF', 'USD', 'EUR', 'GBP']),
});

/** Re-export for consumers that import from money */
export type { CurrencyCode };

/**
 * Money value object - class with methods for domain logic
 */
export class Money {
  readonly amount: number; // Always stored in smallest unit (cents)
  readonly currency: CurrencyCode;

  constructor(amount: number, currency: CurrencyCode = 'USD') {
    if (!Number.isInteger(amount)) {
      throw new Error('Money amount must be an integer (smallest currency unit)');
    }
    this.amount = amount;
    this.currency = currency;
  }

  get amountMinorUnits(): number {
    return this.amount;
  }

  static zero(currency: CurrencyCode = 'USD'): Money {
    return new Money(0, currency);
  }

  static fromMinorUnits(amount: number, currency: CurrencyCode = 'USD'): Money {
    return new Money(amount, currency);
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error(`Cannot add different currencies: ${this.currency} + ${other.currency}`);
    }
    return new Money(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error(`Cannot subtract different currencies: ${this.currency} - ${other.currency}`);
    }
    return new Money(this.amount - other.amount, this.currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  isGreaterThan(other: Money): boolean {
    if (this.currency !== other.currency) {
      throw new Error(`Cannot compare different currencies: ${this.currency} vs ${other.currency}`);
    }
    return this.amount > other.amount;
  }

  toData(): { amount: number; currency: CurrencyCode } {
    return { amount: this.amount, currency: this.currency };
  }
}

/**
 * Create a Money value object (factory for backward compatibility)
 * @param amount Amount in smallest currency unit (e.g., cents)
 * @param currency ISO 4217 currency code
 */
export function money(amount: number, currency: CurrencyCode = 'USD'): Money {
  return new Money(amount, currency);
}

/**
 * Number of decimal places for each supported currency. TZS / UGX / RWF
 * are 0-decimal — their minor-unit IS the main unit. Hardcoding `/100`
 * underquoted those currencies by 100× and produced invoice/statement
 * lines that looked absurdly small. Wave-19 fix.
 *
 * Kept explicit + exhaustive rather than reaching for `Intl` metadata so
 * it's trivially auditable and never silently changes.
 */
export const CURRENCY_DECIMALS: Record<CurrencyCode, number> = {
  KES: 2,
  TZS: 0,
  UGX: 0,
  RWF: 0,
  USD: 2,
  EUR: 2,
  GBP: 2,
};

function decimalsFor(currency: CurrencyCode): number {
  return CURRENCY_DECIMALS[currency] ?? 2;
}

function minorUnitDivisor(currency: CurrencyCode): number {
  const d = decimalsFor(currency);
  return d === 0 ? 1 : Math.pow(10, d);
}

/**
 * Create Money from a decimal amount. The multiplier depends on the
 * currency's fractional precision — 2 decimals for KES/USD/EUR/GBP,
 * 0 decimals for TZS/UGX/RWF (where the minor unit is the main unit).
 */
export function moneyFromDecimal(decimal: number, currency: CurrencyCode = 'USD'): Money {
  return money(Math.round(decimal * minorUnitDivisor(currency)), currency);
}

/**
 * Convert Money to decimal display format, currency-aware.
 */
export function toDecimal(m: Money): number {
  return m.amount / minorUnitDivisor(m.currency);
}

/**
 * Format Money for display.
 *
 * `locale` should be the tenant's BCP-47 locale — resolve via
 * `getRegionConfig(tenant.countryCode).defaultLocale`. Defaults to the
 * neutral 'en' so output is never silently Kenya-flavoured; callers with
 * tenant context should always pass the real locale.
 */
export function formatMoney(m: Money, locale: string = 'en'): string {
  const decimals = decimalsFor(m.currency);
  const decimal = toDecimal(m);
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: m.currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return formatter.format(decimal);
}

/**
 * Add two Money values (must be same currency)
 */
export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot add different currencies: ${a.currency} + ${b.currency}`);
  }
  return money(a.amount + b.amount, a.currency);
}

/**
 * Subtract two Money values (must be same currency)
 */
export function subtractMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot subtract different currencies: ${a.currency} - ${b.currency}`);
  }
  return money(a.amount - b.amount, a.currency);
}

/**
 * Multiply Money by a factor
 */
export function multiplyMoney(m: Money, factor: number): Money {
  return money(Math.round(m.amount * factor), m.currency);
}

/**
 * Check if Money value is zero
 */
export function isZero(m: Money): boolean {
  return m.amount === 0;
}

/**
 * Check if Money value is positive
 */
export function isPositive(m: Money): boolean {
  return m.amount > 0;
}

/**
 * Check if Money value is negative
 */
export function isNegative(m: Money): boolean {
  return m.amount < 0;
}

/**
 * Zero money in a given currency
 */
export function zeroMoney(currency: CurrencyCode = 'USD'): Money {
  return money(0, currency);
}
