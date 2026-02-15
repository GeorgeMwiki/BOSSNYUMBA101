/**
 * Money value object for handling currency amounts
 * Immutable and currency-aware
 */

import { z } from 'zod';
import type { CurrencyCode } from './types';

export const MoneySchema = z.object({
  amount: z.number().int(),
  currency: z.enum(['KES', 'USD', 'EUR', 'GBP', 'TZS', 'UGX']),
});

/** Re-export for consumers that import from money */
export type { CurrencyCode };

/**
 * Money value object - class with methods for domain logic
 */
export class Money {
  readonly amount: number; // Always stored in smallest unit (cents)
  readonly currency: CurrencyCode;

  constructor(amount: number, currency: CurrencyCode = 'KES') {
    if (!Number.isInteger(amount)) {
      throw new Error('Money amount must be an integer (smallest currency unit)');
    }
    this.amount = amount;
    this.currency = currency;
  }

  get amountMinorUnits(): number {
    return this.amount;
  }

  static zero(currency: CurrencyCode = 'KES'): Money {
    return new Money(0, currency);
  }

  static fromMinorUnits(amount: number, currency: CurrencyCode = 'KES'): Money {
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
export function money(amount: number, currency: CurrencyCode = 'KES'): Money {
  return new Money(amount, currency);
}

/**
 * Create Money from a decimal amount (e.g., 10.50 becomes 1050 cents)
 */
export function moneyFromDecimal(decimal: number, currency: CurrencyCode = 'KES'): Money {
  return money(Math.round(decimal * 100), currency);
}

/**
 * Convert Money to decimal display format
 */
export function toDecimal(m: Money): number {
  return m.amount / 100;
}

/**
 * Format Money for display
 */
export function formatMoney(m: Money): string {
  const decimal = toDecimal(m);
  const formatter = new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: m.currency,
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
export function zeroMoney(currency: CurrencyCode = 'KES'): Money {
  return money(0, currency);
}
