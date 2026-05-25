import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RETRY_POLICY,
  planAttempts,
} from '../collection/collection-orchestrator.js';
import {
  escalationPlan,
  planChannels,
  stepsDueToday,
} from '../collection/escalation-policy.js';

describe('collection-orchestrator', () => {
  it('returns 4 attempts in canonical retry policy', () => {
    const plan = planAttempts({
      tenantId: 't1',
      leaseId: 'l1',
      amount: 50_000,
      dueDate: '2026-06-01',
      currency: 'KES',
    });
    expect(plan.length).toBe(4);
    expect(plan[0].offsetMinutes).toBe(0);
    expect(plan[1].offsetMinutes).toBe(240);
    expect(plan[2].offsetMinutes).toBe(1440);
    expect(plan[3].offsetMinutes).toBe(4320);
  });

  it('returns empty plan for zero amount', () => {
    const plan = planAttempts({
      tenantId: 't1',
      leaseId: 'l1',
      amount: 0,
      dueDate: '2026-06-01',
      currency: 'KES',
    });
    expect(plan).toEqual([]);
  });

  it('uses M-Pesa STK push for the first 3 attempts', () => {
    const plan = planAttempts({
      tenantId: 't1',
      leaseId: 'l1',
      amount: 1000,
      dueDate: '2026-06-01',
      currency: 'KES',
    });
    expect(plan.slice(0, 3).every((a) => a.channel === 'mpesa-stk-push')).toBe(true);
  });

  it('exports a default policy that is read-only-safe', () => {
    expect(DEFAULT_RETRY_POLICY.attempts.length).toBe(4);
  });
});

describe('escalation-policy', () => {
  it('cure-cohort tenant gets soft reminders only', () => {
    const plan = escalationPlan({
      fullPayCountLast6m: 6,
      currentBalanceMonths: 0.5,
    });
    expect(plan.every((s) => s.stage === 'soft-reminder')).toBe(true);
  });

  it('delinquent tenant gets full plan', () => {
    const plan = escalationPlan({
      fullPayCountLast6m: 1,
      currentBalanceMonths: 2,
    });
    expect(plan.some((s) => s.stage === 'eviction-prep')).toBe(true);
  });

  it('stepsDueToday filters by offset', () => {
    const plan = escalationPlan({ fullPayCountLast6m: 0, currentBalanceMonths: 3 });
    expect(stepsDueToday(plan, 30).length).toBe(1);
    expect(stepsDueToday(plan, 31).length).toBe(0);
  });

  it('planChannels dedupes', () => {
    const plan = escalationPlan({ fullPayCountLast6m: 0, currentBalanceMonths: 3 });
    const chans = planChannels(plan);
    expect(new Set(chans).size).toBe(chans.length);
  });

  it('honours cure threshold overrides', () => {
    const plan = escalationPlan(
      { fullPayCountLast6m: 4, currentBalanceMonths: 1 },
      { cureFullPaymentsRequired: 5, cureMaxOutstandingMonths: 0.5 },
    );
    expect(plan.some((s) => s.stage !== 'soft-reminder')).toBe(true);
  });
});
