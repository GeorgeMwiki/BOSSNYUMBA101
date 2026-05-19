/**
 * Constitution tests — one violating-action fixture per principle, plus
 * the aggregator semantics. 30+ tests.
 */

import { describe, expect, it } from 'vitest';
import {
  enforceConstitution,
  isCompliant,
  passthroughSelfCritiquePort,
  strictSelfCritiquePort,
  composePorts,
  pickWorstViolation,
  shouldSampleReadOnlyForTelemetry,
  PRINCIPLE_CHECKERS,
  SEVERITY_RANK,
  type ConstitutionContext,
  type ProposedAction,
  type PrincipleVerdict,
} from '../constitution/index.js';

const baseContext: ConstitutionContext = {
  residencyRegion: 'TZ',
  tenantCurrency: 'TZS',
  initiatorUserId: 'user-init-1',
  allowMockData: false,
  ledgerReachable: true,
};

const compliantAction = (
  overrides: Partial<ProposedAction> = {},
): ProposedAction => ({
  kind: 'create-invoice',
  riskClass: 'financial',
  tenantId: 'tenant-1',
  params: {
    amount: 50000,
    currency: 'TZS',
    approverUserId: 'user-approver-1',
  },
  ...overrides,
});

describe('PRINCIPLE_CHECKERS registry', () => {
  it('exposes exactly the 9 canonical principles in the correct order', () => {
    expect(PRINCIPLE_CHECKERS.map((p) => p.name)).toEqual([
      'jurisdiction-neutrality',
      'currency-neutrality',
      'tenant-privacy',
      'data-residency',
      'no-mock-data',
      'transparency-of-action',
      'owner-approval-for-destructive',
      'audit-everything',
      'failure-makes-us-stronger',
    ]);
  });
});

describe('§1 jurisdiction-neutrality', () => {
  it('blocks an action that hard-codes a country in params', async () => {
    const action = compliantAction({
      params: {
        amount: 50000,
        currency: 'TZS',
        approverUserId: 'user-approver-1',
        country: 'TZ',
      },
    });
    const verdict = await enforceConstitution(action, baseContext);
    expect(verdict.outcome).toBe('violation');
    if (verdict.outcome === 'violation') {
      expect(verdict.violation).toBe('jurisdiction-neutrality');
      expect(verdict.severity).toBe('block');
    }
  });

  it('blocks an action that hard-codes a court', async () => {
    const action = compliantAction({
      params: {
        amount: 50000,
        currency: 'TZS',
        approverUserId: 'user-approver-1',
        court: 'Magistrates Court of Dar es Salaam',
      },
    });
    const verdict = await enforceConstitution(action, baseContext);
    expect(verdict.outcome).toBe('violation');
  });

  it('does not flag actions without jurisdiction keys', async () => {
    const verdict = await enforceConstitution(compliantAction(), baseContext);
    expect(isCompliant(verdict)).toBe(true);
  });
});

describe('§2 currency-neutrality', () => {
  it('blocks a money field without a currency sibling', async () => {
    const action = compliantAction({
      params: { amount: 50000, approverUserId: 'user-approver-1' },
    });
    const verdict = await enforceConstitution(action, baseContext);
    expect(verdict.outcome).toBe('violation');
    if (verdict.outcome === 'violation') {
      expect(verdict.violation).toBe('currency-neutrality');
    }
  });

  it('passes when a currency code is present alongside the money field', async () => {
    const verdict = await enforceConstitution(compliantAction(), baseContext);
    expect(isCompliant(verdict)).toBe(true);
  });

  it('blocks bare-number rent fields', async () => {
    const action = compliantAction({
      params: { rent: 850000, approverUserId: 'user-approver-1' },
    });
    const verdict = await enforceConstitution(action, baseContext);
    expect(verdict.outcome).toBe('violation');
  });
});

describe('§3 tenant-privacy', () => {
  it('blocks a cross-tenant reference in params', async () => {
    const action = compliantAction({
      params: {
        amount: 50000,
        currency: 'TZS',
        approverUserId: 'user-approver-1',
        tenantId: 'OTHER-tenant',
      },
    });
    const verdict = await enforceConstitution(action, baseContext);
    expect(verdict.outcome).toBe('violation');
    if (verdict.outcome === 'violation') {
      expect(verdict.violation).toBe('tenant-privacy');
    }
  });

  it('passes when params reference the same tenant as the action binding', async () => {
    const action = compliantAction({
      params: {
        amount: 50000,
        currency: 'TZS',
        approverUserId: 'user-approver-1',
        tenantId: 'tenant-1',
      },
    });
    const verdict = await enforceConstitution(action, baseContext);
    expect(isCompliant(verdict)).toBe(true);
  });
});

describe('§4 data-residency', () => {
  it('blocks an action whose proposed region differs from tenant residency (critical)', async () => {
    const action = compliantAction({
      params: {
        amount: 50000,
        currency: 'TZS',
        approverUserId: 'user-approver-1',
        region: 'EU',
      },
    });
    const verdict = await enforceConstitution(action, baseContext);
    expect(verdict.outcome).toBe('violation');
    if (verdict.outcome === 'violation') {
      expect(verdict.violation).toBe('data-residency');
      expect(verdict.severity).toBe('critical');
    }
  });

  it('passes when no region is proposed', async () => {
    const verdict = await enforceConstitution(compliantAction(), baseContext);
    expect(isCompliant(verdict)).toBe(true);
  });

  it('passes when region matches tenant residency', async () => {
    const action = compliantAction({
      params: {
        amount: 50000,
        currency: 'TZS',
        approverUserId: 'user-approver-1',
        region: 'TZ',
      },
    });
    const verdict = await enforceConstitution(action, baseContext);
    expect(isCompliant(verdict)).toBe(true);
  });
});

describe('§5 no-mock-data', () => {
  it('blocks lorem ipsum in params', async () => {
    const action = compliantAction({
      kind: 'create-tenant',
      params: {
        amount: 50000,
        currency: 'TZS',
        approverUserId: 'user-approver-1',
        notes: 'Lorem ipsum dolor sit amet',
      },
    });
    const verdict = await enforceConstitution(action, baseContext);
    expect(verdict.outcome).toBe('violation');
    if (verdict.outcome === 'violation') {
      expect(verdict.violation).toBe('no-mock-data');
    }
  });

  it('blocks fake phone numbers', async () => {
    const action = compliantAction({
      params: {
        amount: 50000,
        currency: 'TZS',
        approverUserId: 'user-approver-1',
        phone: '+255 700 000 000',
      },
    });
    const verdict = await enforceConstitution(action, baseContext);
    expect(verdict.outcome).toBe('violation');
  });

  it('blocks example.com emails', async () => {
    const action = compliantAction({
      params: {
        amount: 50000,
        currency: 'TZS',
        approverUserId: 'user-approver-1',
        email: 'tenant@example.com',
      },
    });
    const verdict = await enforceConstitution(action, baseContext);
    expect(verdict.outcome).toBe('violation');
  });

  it('blocks "Demo Property" placeholders', async () => {
    const action = compliantAction({
      params: {
        amount: 50000,
        currency: 'TZS',
        approverUserId: 'user-approver-1',
        propertyName: 'Demo Property 1',
      },
    });
    const verdict = await enforceConstitution(action, baseContext);
    expect(verdict.outcome).toBe('violation');
  });

  it('permits mock data when context.allowMockData is true (test env)', async () => {
    const action = compliantAction({
      params: {
        amount: 50000,
        currency: 'TZS',
        approverUserId: 'user-approver-1',
        notes: 'Lorem ipsum',
      },
    });
    const verdict = await enforceConstitution(action, {
      ...baseContext,
      allowMockData: true,
    });
    expect(isCompliant(verdict)).toBe(true);
  });
});

describe('§6 transparency-of-action', () => {
  it('warns when external comm lacks agentDisclosed', async () => {
    const action: ProposedAction = {
      kind: 'send-sms',
      riskClass: 'external-comm',
      tenantId: 'tenant-1',
      params: {
        approverUserId: 'user-approver-1',
        recipient: '+255713111222',
        body: 'Rent reminder',
      },
    };
    const verdict = await enforceConstitution(action, baseContext);
    expect(verdict.outcome).toBe('violation');
    if (verdict.outcome === 'violation') {
      expect(verdict.violation).toBe('transparency-of-action');
      expect(verdict.severity).toBe('warn');
    }
  });

  it('passes when external comm carries agentDisclosed=true', async () => {
    const action: ProposedAction = {
      kind: 'send-sms',
      riskClass: 'external-comm',
      tenantId: 'tenant-1',
      params: {
        approverUserId: 'user-approver-1',
        recipient: '+255713111222',
        body: 'Rent reminder',
        agentDisclosed: true,
      },
    };
    const verdict = await enforceConstitution(action, baseContext);
    expect(isCompliant(verdict)).toBe(true);
  });

  it('does not require agentDisclosed for non-external-comm actions', async () => {
    const verdict = await enforceConstitution(compliantAction(), baseContext);
    expect(isCompliant(verdict)).toBe(true);
  });
});

describe('§7 owner-approval-for-destructive', () => {
  it('blocks a destructive action with no approver', async () => {
    const action = compliantAction({
      params: { amount: 50000, currency: 'TZS' },
    });
    const verdict = await enforceConstitution(action, baseContext);
    expect(verdict.outcome).toBe('violation');
    if (verdict.outcome === 'violation') {
      expect(verdict.violation).toBe('owner-approval-for-destructive');
    }
  });

  it('blocks four-eye self-approval (approver = initiator)', async () => {
    const action = compliantAction({
      params: {
        amount: 50000,
        currency: 'TZS',
        approverUserId: baseContext.initiatorUserId!,
        fourEye: true,
      },
    });
    const verdict = await enforceConstitution(action, baseContext);
    expect(verdict.outcome).toBe('violation');
  });

  it('passes for a destructive action with a distinct approver when four-eye is on', async () => {
    const action = compliantAction({
      params: {
        amount: 50000,
        currency: 'TZS',
        approverUserId: 'user-approver-1',
        fourEye: true,
      },
    });
    const verdict = await enforceConstitution(action, baseContext);
    expect(isCompliant(verdict)).toBe(true);
  });
});

describe('§8 audit-everything', () => {
  it('blocks side-effecting actions when ledger is unreachable (critical)', async () => {
    const verdict = await enforceConstitution(compliantAction(), {
      ...baseContext,
      ledgerReachable: false,
    });
    expect(verdict.outcome).toBe('violation');
    if (verdict.outcome === 'violation') {
      expect(verdict.violation).toBe('audit-everything');
      expect(verdict.severity).toBe('critical');
    }
  });

  it('passes when ledger is reachable', async () => {
    const verdict = await enforceConstitution(compliantAction(), baseContext);
    expect(isCompliant(verdict)).toBe(true);
  });
});

describe('§9 failure-makes-us-stronger', () => {
  it('warns on uncertainty-suppression phrasing in intent', async () => {
    const action = compliantAction({
      intent: "I'll just guess what the rent should be",
    });
    const verdict = await enforceConstitution(action, baseContext);
    expect(verdict.outcome).toBe('violation');
    if (verdict.outcome === 'violation') {
      expect(verdict.violation).toBe('failure-makes-us-stronger');
      expect(verdict.severity).toBe('warn');
    }
  });

  it('passes when intent is empty', async () => {
    const verdict = await enforceConstitution(compliantAction(), baseContext);
    expect(isCompliant(verdict)).toBe(true);
  });

  it('passes when intent is clean', async () => {
    const action = compliantAction({
      intent: 'Issue the May rent invoice using the lease-rate value on file.',
    });
    const verdict = await enforceConstitution(action, baseContext);
    expect(isCompliant(verdict)).toBe(true);
  });
});

describe('aggregator semantics', () => {
  it('returns compliant when all checks pass', async () => {
    const verdict = await enforceConstitution(compliantAction(), baseContext);
    expect(verdict.outcome).toBe('compliant');
  });

  it('returns the worst-severity violation when several principles fail', async () => {
    // currency (block) + data-residency (critical) → critical wins.
    const action: ProposedAction = {
      kind: 'send-sms',
      riskClass: 'external-comm',
      tenantId: 'tenant-1',
      params: {
        amount: 5000, // currency-neutrality block (no currency sibling)
        approverUserId: 'user-approver-1',
        region: 'EU', // data-residency critical
        agentDisclosed: true,
      },
    };
    const verdict = await enforceConstitution(action, baseContext);
    expect(verdict.outcome).toBe('violation');
    if (verdict.outcome === 'violation') {
      expect(verdict.violation).toBe('data-residency');
      expect(verdict.severity).toBe('critical');
    }
  });

  it('mitigation text is non-empty for every block-severity violation', async () => {
    const action = compliantAction({
      params: { amount: 5000, approverUserId: 'user-approver-1' },
    });
    const verdict = await enforceConstitution(action, baseContext);
    if (verdict.outcome === 'violation') {
      expect(verdict.mitigation.length).toBeGreaterThan(0);
    }
  });

  it('records all check verdicts, not just the worst', async () => {
    const verdict = await enforceConstitution(compliantAction(), baseContext);
    expect(verdict.checks.length).toBe(9);
  });
});

describe('read-only sampling', () => {
  it('skips evaluation entirely below the sample rate', async () => {
    const action: ProposedAction = {
      kind: 'list-tenants',
      riskClass: 'read-only',
      tenantId: 'tenant-1',
      params: {},
    };
    const verdict = await enforceConstitution(action, baseContext, {
      random: () => 0.9, // far above the 0.05 sample rate
    });
    expect(verdict.outcome).toBe('compliant');
    expect(verdict.checks.length).toBe(0);
  });

  it('samples evaluation when random falls below sample rate (telemetry only, never blocks)', async () => {
    const action: ProposedAction = {
      kind: 'list-tenants',
      riskClass: 'read-only',
      tenantId: 'tenant-1',
      params: { country: 'TZ' }, // jurisdiction violation
    };
    const verdict = await enforceConstitution(action, baseContext, {
      random: () => 0.01, // below 0.05
    });
    // Sampled, but read-only never blocks — outcome stays compliant.
    expect(verdict.outcome).toBe('compliant');
    expect(verdict.checks.length).toBe(9);
  });

  it('respects a custom sample rate', () => {
    const action: ProposedAction = {
      kind: 'list-tenants',
      riskClass: 'read-only',
      tenantId: 'tenant-1',
      params: {},
    };
    expect(
      shouldSampleReadOnlyForTelemetry(action, baseContext, () => 0.5, 0.6),
    ).toBe(true);
    expect(
      shouldSampleReadOnlyForTelemetry(action, baseContext, () => 0.7, 0.6),
    ).toBe(false);
  });
});

describe('SEVERITY_RANK + pickWorstViolation', () => {
  it('rank is strictly ascending', () => {
    expect(SEVERITY_RANK.info).toBe(0);
    expect(SEVERITY_RANK.warn).toBe(1);
    expect(SEVERITY_RANK.block).toBe(2);
    expect(SEVERITY_RANK.critical).toBe(3);
  });

  it('pickWorstViolation returns undefined for an all-compliant set', () => {
    const verdicts: PrincipleVerdict[] = PRINCIPLE_CHECKERS.map((p) => ({
      principle: p.name,
      violated: false,
      severity: 'info',
      explanation: 'ok',
      mitigation: '',
    }));
    expect(pickWorstViolation(verdicts)).toBeUndefined();
  });

  it('pickWorstViolation prefers higher severity', () => {
    const verdicts: PrincipleVerdict[] = [
      {
        principle: 'jurisdiction-neutrality',
        violated: true,
        severity: 'warn',
        explanation: '',
        mitigation: '',
      },
      {
        principle: 'data-residency',
        violated: true,
        severity: 'critical',
        explanation: '',
        mitigation: '',
      },
    ];
    expect(pickWorstViolation(verdicts)?.principle).toBe('data-residency');
  });

  it('pickWorstViolation ties on severity → picks the lower-numbered principle', () => {
    const verdicts: PrincipleVerdict[] = [
      {
        principle: 'currency-neutrality',
        violated: true,
        severity: 'block',
        explanation: '',
        mitigation: '',
      },
      {
        principle: 'jurisdiction-neutrality',
        violated: true,
        severity: 'block',
        explanation: '',
        mitigation: '',
      },
    ];
    expect(pickWorstViolation(verdicts)?.principle).toBe('jurisdiction-neutrality');
  });
});

describe('SelfCritiquePort composition', () => {
  it('strict port escalates warn → block for destructive/external-comm/financial', async () => {
    const verdict = await strictSelfCritiquePort.critique({
      principle: 'failure-makes-us-stronger',
      action: {
        kind: 'send-sms',
        riskClass: 'external-comm',
        tenantId: 'tenant-1',
        params: { recipient: '+255713111222', agentDisclosed: true },
        intent: "I'll just guess the time",
      },
      context: baseContext,
    });
    expect(verdict.violated).toBe(true);
    expect(verdict.severity).toBe('block');
  });

  it('strict port does not escalate for read-only', async () => {
    const verdict = await strictSelfCritiquePort.critique({
      principle: 'failure-makes-us-stronger',
      action: {
        kind: 'list',
        riskClass: 'read-only',
        tenantId: 'tenant-1',
        params: {},
        intent: "I'll just guess",
      },
      context: baseContext,
    });
    expect(verdict.severity).toBe('warn');
  });

  it('composePorts: fallback fires only when primary returns compliant', async () => {
    let fallbackCalled = 0;
    const fallback = {
      async critique() {
        fallbackCalled += 1;
        return {
          principle: 'audit-everything' as const,
          violated: false,
          severity: 'info' as const,
          explanation: '',
          mitigation: '',
        };
      },
    };
    const composed = composePorts(passthroughSelfCritiquePort, fallback);
    // First action: primary returns violation → fallback should NOT fire.
    await composed.critique({
      principle: 'currency-neutrality',
      action: {
        kind: 'create-invoice',
        riskClass: 'financial',
        tenantId: 'tenant-1',
        params: { amount: 5000 }, // bare number
      },
      context: baseContext,
    });
    expect(fallbackCalled).toBe(0);
    // Second action: primary returns compliant → fallback fires.
    await composed.critique({
      principle: 'currency-neutrality',
      action: {
        kind: 'create-invoice',
        riskClass: 'financial',
        tenantId: 'tenant-1',
        params: { amount: 5000, currency: 'TZS' },
      },
      context: baseContext,
    });
    expect(fallbackCalled).toBe(1);
  });
});
