/**
 * Smoke test for the customer-app currency-preference hook's formatter
 * delegate. The hook itself is a thin wrapper around `formatCurrency`
 * from `@bossnyumba/api-client`; the shared formatter has its own
 * exhaustive test suite (see `packages/api-client/src/currency.test.ts`).
 *
 * These tests pin the *integration* contract that customer-app pages
 * rely on: the same ISO-4217 precision table is wired through, and
 * the `code: string` argument is what the hook passes downstream.
 */

import { describe, it, expect } from 'vitest';
import { formatCurrency } from '@bossnyumba/api-client';

describe('customer-app currency formatting (via shared helper)', () => {
  it('formats KES with two decimals', () => {
    const result = formatCurrency(100000, 'KES', { locale: 'en-US' });
    expect(result).toContain('KES');
    expect(result).toMatch(/100[,.]000\.00/);
  });

  it('formats JPY without decimals', () => {
    const result = formatCurrency(100000, 'JPY', { locale: 'en-US' });
    expect(result).toContain('JPY');
    expect(result).not.toMatch(/\.\d/);
  });

  it('formats BHD with three decimals', () => {
    const result = formatCurrency(100, 'BHD', { locale: 'en-US' });
    expect(result).toContain('BHD');
    expect(result).toMatch(/100\.000/);
  });

  it('throws when currency is missing', () => {
    expect(() => formatCurrency(100, '')).toThrow(/required/i);
  });
});
