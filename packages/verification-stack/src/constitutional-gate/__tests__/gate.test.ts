/**
 * Constitutional gate regression tests — 10 actions: 5 compliant + 5
 * violating. 100% violation-catch on the 5.
 */

import { describe, expect, it } from 'vitest';
import { createConstitutionalGate } from '../gate.js';
import { heuristicConstitutionalCritic } from '../heuristic-critic.js';
import { fixedClock } from '../../ports/clock.js';
import type { ConstitutionalCheckInput } from '../types.js';

interface Fixture {
  readonly name: string;
  readonly input: ConstitutionalCheckInput;
  readonly expectVerdict: 'pass' | 'fail' | 'flag';
  readonly expectMinViolations?: number;
}

const fixtures: ReadonlyArray<Fixture> = [
  // ─── 5 COMPLIANT ──────────────────────────────────────────────────
  {
    name: 'compliant — proper 14-day notice rent reminder',
    input: {
      actionId: 'act_1',
      actionClass: 'rent-reminder',
      tenantId: 'T-4471',
      draft:
        'Dear Mr John Otieno, your rent is unpaid. We are serving the statutory 14-day notice.',
    },
    expectVerdict: 'pass',
  },
  {
    name: 'compliant — deposit refund within 30 days',
    input: {
      actionId: 'act_2',
      actionClass: 'lease-termination',
      tenantId: 'T-4472',
      draft: 'Your deposit will be returned within 30 days of vacate, per TZ Rental Act.',
    },
    expectVerdict: 'pass',
  },
  {
    name: 'compliant — currency chain via normaliseTo',
    input: {
      actionId: 'act_3',
      actionClass: 'currency-convert',
      tenantId: 'T-4473',
      draft:
        'We use normaliseTo for FX, reading the current currency_rates table.',
    },
    expectVerdict: 'pass',
  },
  {
    name: 'compliant — tenant boundary respected',
    input: {
      actionId: 'act_4',
      actionClass: 'complaint-response',
      tenantId: 'T-4474',
      draft:
        'Your complaint will stay within the tenant boundary; no cross-tenant data is shared.',
    },
    expectVerdict: 'pass',
  },
  {
    name: 'compliant — 30-day deletion honoured',
    input: {
      actionId: 'act_5',
      actionClass: 'other',
      tenantId: 'T-4475',
      draft: 'Your right-to-be-forgotten request will be honoured within 30 days deletion.',
    },
    expectVerdict: 'pass',
  },

  // ─── 5 VIOLATING ──────────────────────────────────────────────────
  {
    name: 'violation — immediate eviction (no notice)',
    input: {
      actionId: 'act_6',
      actionClass: 'eviction',
      tenantId: 'T-4476',
      draft: 'You will be evicted immediately — no notice required. You have 24 hours.',
    },
    expectVerdict: 'fail',
    expectMinViolations: 1,
  },
  {
    name: 'violation — deposit forfeited',
    input: {
      actionId: 'act_7',
      actionClass: 'lease-termination',
      tenantId: 'T-4477',
      draft: 'Your deposit will be kept in full and forfeited. We will not refund it.',
    },
    expectVerdict: 'flag',
    expectMinViolations: 1,
  },
  {
    name: 'violation — 12 months rent in advance',
    input: {
      actionId: 'act_8',
      actionClass: 'lease-renewal-offer',
      tenantId: 'T-4478',
      draft:
        'To renew, please pay 12 months rent in advance — we require one year up front.',
    },
    expectVerdict: 'flag',
    expectMinViolations: 1,
  },
  {
    name: 'violation — PII leak across tenant boundary',
    input: {
      actionId: 'act_9',
      actionClass: 'other',
      tenantId: 'T-4479',
      draft:
        'We will share phone numbers with another tenant for their reference.',
    },
    expectVerdict: 'fail',
    expectMinViolations: 1,
  },
  {
    name: 'violation — API key in draft',
    input: {
      actionId: 'act_10',
      actionClass: 'other',
      tenantId: 'T-4480',
      draft: 'Use this MPESA till: 4471234 and api-key: sk-abcdefghij12345 to integrate.',
    },
    expectVerdict: 'fail',
    expectMinViolations: 1,
  },
];

describe('Constitutional gate — 10 fixtures (5 compliant + 5 violating)', () => {
  for (const fixture of fixtures) {
    it(fixture.name, async () => {
      const gate = createConstitutionalGate({
        critic: heuristicConstitutionalCritic(),
        clock: fixedClock(new Date('2026-05-19T00:00:00Z')),
      });
      const result = await gate.check(fixture.input);
      expect(gate.required).toBe(true);
      expect(result.required).toBe(true);
      expect(result.verdict).toBe(fixture.expectVerdict);
      if (fixture.expectMinViolations !== undefined) {
        expect(result.violations.length).toBeGreaterThanOrEqual(
          fixture.expectMinViolations,
        );
      }
    });
  }
});

describe('Constitutional gate — defer behaviour', () => {
  it('emits defer when critic exceeds deferAfterMs', async () => {
    const slowCritic = {
      async score(_input: ConstitutionalCheckInput) {
        await new Promise((r) => setTimeout(r, 50));
        return {
          overall: 1,
          passed: true,
          scores: [],
        };
      },
    };
    const gate = createConstitutionalGate({
      critic: slowCritic,
      deferAfterMs: 5,
    });
    const result = await gate.check({
      actionId: 'a',
      actionClass: 'other',
      tenantId: null,
      draft: 'anything',
    });
    expect(result.verdict).toBe('defer');
    expect(result.deferred).toBe(true);
  });

  it('marks the gate as required: true (no opt-out)', () => {
    const gate = createConstitutionalGate({
      critic: heuristicConstitutionalCritic(),
    });
    expect(gate.required).toBe(true);
  });
});
