/**
 * LIVE DETECTOR — Money.amountMajorUnits + Money.toString() must derive the
 * minor→major divisor and display precision from the CURRENCY'S decimal
 * places, never a hard-coded /100 + .toFixed(2).
 *
 * The bug (services/payments-ledger/src/domain-extensions.ts): both the
 * `amountMajorUnits` getter and the `toString()` override divided by 100 and
 * formatted to 2 decimals unconditionally. For the launch currencies — TZS,
 * UGX, RWF (all 0-decimal, where the minor unit IS the major unit) — this
 * silently divided TSh 1,500 down to 15 and rendered "TZS 15.00". A 0-decimal
 * amount of 1500 minor units is 1500 major units; importing
 * `./domain-extensions` patches the Money prototype, so these assertions fail
 * RED against the old hard /100 and pass GREEN once the divisor is
 * currency-aware.
 *
 * 3-decimal (BHD/KWD) and 2-decimal (USD/KES) cases pin the general rule, not
 * just the TZS special case.
 */
import { describe, expect, it } from 'vitest';
import { Money } from '@bossnyumba/domain-models';
// Side-effect import: augments Money.prototype with toString + amountMajorUnits.
import '../domain-extensions';

describe('Money.amountMajorUnits — currency-aware minor→major (no hard /100)', () => {
  it('TZS (0-decimal): 1500 minor units == 1500 major units, NOT 15', () => {
    const m = Money.fromMinorUnits(1500, 'TZS');
    expect(m.amountMajorUnits).toBe(1500);
  });

  it('UGX (0-decimal): 50000 minor units == 50000 major units', () => {
    const m = Money.fromMinorUnits(50_000, 'UGX');
    expect(m.amountMajorUnits).toBe(50_000);
  });

  it('RWF (0-decimal): 999 minor units == 999 major units', () => {
    const m = Money.fromMinorUnits(999, 'RWF');
    expect(m.amountMajorUnits).toBe(999);
  });

  it('USD (2-decimal): 1500 minor units == 15.00 major units', () => {
    const m = Money.fromMinorUnits(1500, 'USD');
    expect(m.amountMajorUnits).toBe(15);
  });

  it('KES (2-decimal): 150000 minor units == 1500 major units', () => {
    const m = Money.fromMinorUnits(150_000, 'KES');
    expect(m.amountMajorUnits).toBe(1500);
  });

  it('BHD (3-decimal): 1500 minor units == 1.5 major units', () => {
    const m = Money.fromMinorUnits(1500, 'BHD');
    expect(m.amountMajorUnits).toBeCloseTo(1.5, 6);
  });
});

describe('Money.toString — precision matches the currency decimals', () => {
  it('TZS (0-decimal): 1500 renders "TZS 1500" (no ".00")', () => {
    const m = Money.fromMinorUnits(1500, 'TZS');
    expect(m.toString()).toBe('TZS 1500');
  });

  it('UGX (0-decimal): 50000 renders "UGX 50000"', () => {
    const m = Money.fromMinorUnits(50_000, 'UGX');
    expect(m.toString()).toBe('UGX 50000');
  });

  it('USD (2-decimal): 1500 renders "USD 15.00"', () => {
    const m = Money.fromMinorUnits(1500, 'USD');
    expect(m.toString()).toBe('USD 15.00');
  });

  it('KES (2-decimal): 150000 renders "KES 1500.00"', () => {
    const m = Money.fromMinorUnits(150_000, 'KES');
    expect(m.toString()).toBe('KES 1500.00');
  });

  it('BHD (3-decimal): 1500 renders "BHD 1.500"', () => {
    const m = Money.fromMinorUnits(1500, 'BHD');
    expect(m.toString()).toBe('BHD 1.500');
  });
});
