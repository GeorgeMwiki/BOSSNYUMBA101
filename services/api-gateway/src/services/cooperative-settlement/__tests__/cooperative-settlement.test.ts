/**
 * Housing-cooperative settlement service — unit tests.
 *
 * Covers the pure settlement math (net-distributable netting + member
 * share split), input validation, and the money-path honest-degrade
 * guard. No database — the math is referentially transparent.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  computeNetDistributable,
  computeMemberShares,
  isSupportedCurrency,
  assertLedgerWired,
  round2,
  CooperativeSettlementError,
  type CooperativeLedgerPort,
} from '../index.js';

const MEMBER_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const MEMBER_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const MEMBER_C = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

describe('computeNetDistributable', () => {
  it('sums the collected pool and nets out operating expenses', () => {
    const math = computeNetDistributable({
      serviceChargeCollected: 1_000_000,
      sinkingFundCollected: 500_000,
      rentShareCollected: 250_000,
      operatingExpenses: 300_000,
    });
    expect(math.collected).toBe(1_750_000);
    expect(math.netDistributable).toBe(1_450_000);
  });

  it('floors net-distributable at zero for a deficit period', () => {
    const math = computeNetDistributable({
      serviceChargeCollected: 100,
      sinkingFundCollected: 0,
      rentShareCollected: 0,
      operatingExpenses: 5_000,
    });
    expect(math.collected).toBe(100);
    expect(math.netDistributable).toBe(0);
  });

  it('rounds the collected sum to two decimals', () => {
    const math = computeNetDistributable({
      serviceChargeCollected: 100.005,
      sinkingFundCollected: 0,
      rentShareCollected: 0,
      operatingExpenses: 0,
    });
    expect(math.collected).toBe(100.01);
  });

  it('rejects a negative input', () => {
    expect(() =>
      computeNetDistributable({
        serviceChargeCollected: -1,
        sinkingFundCollected: 0,
        rentShareCollected: 0,
        operatingExpenses: 0,
      }),
    ).toThrowError(CooperativeSettlementError);
  });

  it('rejects a non-finite input', () => {
    expect(() =>
      computeNetDistributable({
        serviceChargeCollected: Number.POSITIVE_INFINITY,
        sinkingFundCollected: 0,
        rentShareCollected: 0,
        operatingExpenses: 0,
      }),
    ).toThrowError(/non-negative finite/);
  });
});

describe('computeMemberShares', () => {
  it('splits the pool by share percentage', () => {
    const lines = computeMemberShares(1_000_000, [
      { memberHouseholdPartyId: MEMBER_A, sharePct: 50 },
      { memberHouseholdPartyId: MEMBER_B, sharePct: 30 },
      { memberHouseholdPartyId: MEMBER_C, sharePct: 20 },
    ]);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toEqual({
      memberHouseholdPartyId: MEMBER_A,
      sharePct: 50,
      amount: 500_000,
    });
    expect(lines[1]?.amount).toBe(300_000);
    expect(lines[2]?.amount).toBe(200_000);
  });

  it('preserves input order', () => {
    const lines = computeMemberShares(900, [
      { memberHouseholdPartyId: MEMBER_C, sharePct: 10 },
      { memberHouseholdPartyId: MEMBER_A, sharePct: 20 },
    ]);
    expect(lines.map((l) => l.memberHouseholdPartyId)).toEqual([
      MEMBER_C,
      MEMBER_A,
    ]);
  });

  it('allows a retained remainder (sum < 100)', () => {
    const lines = computeMemberShares(1_000, [
      { memberHouseholdPartyId: MEMBER_A, sharePct: 40 },
    ]);
    expect(lines[0]?.amount).toBe(400);
  });

  it('rounds each member amount to two decimals', () => {
    const lines = computeMemberShares(100, [
      { memberHouseholdPartyId: MEMBER_A, sharePct: 33.3333 },
    ]);
    expect(lines[0]?.amount).toBe(round2((33.3333 / 100) * 100));
  });

  it('rejects an empty member list', () => {
    expect(() => computeMemberShares(100, [])).toThrowError(/at least one/);
  });

  it('rejects a share percentage out of range', () => {
    expect(() =>
      computeMemberShares(100, [
        { memberHouseholdPartyId: MEMBER_A, sharePct: 150 },
      ]),
    ).toThrowError(/out of range/);
  });

  it('rejects a duplicate member', () => {
    expect(() =>
      computeMemberShares(100, [
        { memberHouseholdPartyId: MEMBER_A, sharePct: 10 },
        { memberHouseholdPartyId: MEMBER_A, sharePct: 10 },
      ]),
    ).toThrowError(/more than once/);
  });

  it('rejects an over-allocated pool (sum > 100)', () => {
    expect(() =>
      computeMemberShares(100, [
        { memberHouseholdPartyId: MEMBER_A, sharePct: 60 },
        { memberHouseholdPartyId: MEMBER_B, sharePct: 60 },
      ]),
    ).toThrowError(/exceeds 100/);
  });

  it('rejects a negative net-distributable amount', () => {
    expect(() =>
      computeMemberShares(-1, [
        { memberHouseholdPartyId: MEMBER_A, sharePct: 10 },
      ]),
    ).toThrowError(/non-negative finite/);
  });

  it('carries a stable error code on the domain error', () => {
    try {
      computeMemberShares(100, []);
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(CooperativeSettlementError);
      expect((err as CooperativeSettlementError).code).toBe('NO_MEMBERS');
    }
  });
});

describe('isSupportedCurrency', () => {
  it('accepts supported ISO codes', () => {
    expect(isSupportedCurrency('TZS')).toBe(true);
    expect(isSupportedCurrency('KES')).toBe(true);
    expect(isSupportedCurrency('USD')).toBe(true);
  });
  it('rejects unsupported codes', () => {
    expect(isSupportedCurrency('ZZZ')).toBe(false);
    expect(isSupportedCurrency('tzs')).toBe(false);
  });
});

describe('assertLedgerWired (money path honest-degrade)', () => {
  it('returns the port when one is wired', () => {
    const port: CooperativeLedgerPort = {
      post: vi.fn().mockResolvedValue({ paymentRef: 'LEDGER-1' }),
    };
    expect(assertLedgerWired(port)).toBe(port);
  });

  it('throws LEDGER_NOT_WIRED when no port is present', () => {
    try {
      assertLedgerWired(null);
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(CooperativeSettlementError);
      expect((err as CooperativeSettlementError).code).toBe('LEDGER_NOT_WIRED');
    }
  });

  it('throws on undefined too', () => {
    expect(() => assertLedgerWired(undefined)).toThrowError(
      /requires a LedgerService\.post\(\) port/,
    );
  });
});
