/**
 * Integration tests — the four layers running together in the order a
 * pre-tool-use hook would invoke them:
 *
 *   1. resolveManagedSettings()
 *   2. evaluateGate()
 *   3. resolveAutonomyLevel() + decideAutonomyAction()
 *   4. enforceConstitution()
 *
 * Each test models one realistic scenario end-to-end.
 */

import { describe, expect, it } from 'vitest';
import {
  enforceConstitution,
  resolveAutonomyLevel,
  decideAutonomyAction,
  evaluateGate,
  resolveManagedSettings,
  isCompliant,
  buildFailClosedBundle,
  isFailClosedBundle,
  initialTenantGateSettings,
  initialTenantState,
  type ProposedAction,
  type ConstitutionContext,
  type ManagedSettingsCache,
  type ManagedSettingsRemote,
  type ManagedSettingsLedger,
  type ConversationAutonomyOverride,
} from '../index.js';

const tenantId = 'tenant-1';

describe('integration: send-sms in chat mode', () => {
  it('blocks the send pending step-approval AND requires agent disclosure', async () => {
    const tenantState = initialTenantState(tenantId);
    const gateSettings = initialTenantGateSettings(tenantId);
    const action: ProposedAction = {
      kind: 'send-sms',
      riskClass: 'external-comm',
      tenantId,
      params: {
        recipient: '+255713222333',
        body: 'Your rent is due',
        approverUserId: 'user-2',
        agentDisclosed: false,
      },
      intent: 'Send the May rent reminder',
    };
    const context: ConstitutionContext = {
      residencyRegion: 'TZ',
      tenantCurrency: 'TZS',
      initiatorUserId: 'user-1',
      ledgerReachable: true,
    };

    // Step 1: gate
    const gateVerdict = evaluateGate({
      request: {
        actionClass: 'send-external-comm',
        tenantId,
        initiatorUserId: 'user-1',
      },
      settings: gateSettings,
    });
    expect(gateVerdict.outcome).toBe('request-approval');

    // Step 2: autonomy slider → chat → request-step-approval
    const level = resolveAutonomyLevel({ tenantState });
    expect(level).toBe('chat');
    expect(decideAutonomyAction({ level }).kind).toBe('request-step-approval');

    // Step 3: constitution → transparency violation (no agentDisclosed)
    const constitutionVerdict = await enforceConstitution(action, context);
    expect(constitutionVerdict.outcome).toBe('violation');
    if (constitutionVerdict.outcome === 'violation') {
      expect(constitutionVerdict.violation).toBe('transparency-of-action');
    }
  });
});

describe('integration: charge-payment in agentic mode', () => {
  it('still requires explicit approval (gate is alwaysAsk) + four-eye', async () => {
    const tenantState = {
      ...initialTenantState(tenantId),
      currentLevel: 'agentic' as const,
    };
    const gateSettings = initialTenantGateSettings(tenantId);

    // Gate denies self-approval.
    const gateVerdict = evaluateGate({
      request: {
        actionClass: 'charge-payment',
        tenantId,
        initiatorUserId: 'user-1',
        proposedApproverUserId: 'user-1',
      },
      settings: gateSettings,
    });
    expect(gateVerdict.outcome).toBe('deny');

    // Even in agentic mode, the gate runs first and denies.
    const level = resolveAutonomyLevel({ tenantState });
    expect(level).toBe('agentic');
    // The brain would short-circuit on gate denial and never invoke the
    // autonomy action handler — but the decision function itself still
    // returns auto-execute (the gate's job is to keep that from happening).
    expect(decideAutonomyAction({ level }).kind).toBe('auto-execute');
  });
});

describe('integration: managed-settings fail-closed forces fallback policy', () => {
  it('unreachable remote with forceRefresh pins tenant to most-restrictive', async () => {
    const remote: ManagedSettingsRemote = {
      async fetch() {
        return { status: 'unreachable' as const, errorReason: 'down' };
      },
    };
    const cache: ManagedSettingsCache = {
      async load() {
        return null;
      },
      async save() {
        /* no-op */
      },
    };
    const ledger: ManagedSettingsLedger = {
      async recordChange() {
        /* no-op */
      },
    };
    const settings = await resolveManagedSettings({
      tenantId,
      deps: { remote, cache, ledger, forceRefreshOverride: true },
    });
    expect(isFailClosedBundle(settings)).toBe(true);
    // The fail-closed bundle pins autonomy to `chat` — the brain MUST
    // honour this even if the tenant's local state says `agentic`.
    expect(settings.pinnedAutonomy).toBe('chat');
  });
});

describe('integration: bulk-mutation under threshold + clean constitution', () => {
  it('auto-approves a small batch and passes all constitution checks', async () => {
    const gateSettings = initialTenantGateSettings(tenantId);
    const gateVerdict = evaluateGate({
      request: {
        actionClass: 'bulk-mutation',
        tenantId,
        batchSize: 3,
      },
      settings: gateSettings,
    });
    expect(gateVerdict.outcome).toBe('auto-approve');

    const action: ProposedAction = {
      kind: 'tag-tickets',
      riskClass: 'destructive',
      tenantId,
      params: {
        approverUserId: 'user-1',
        ticketIds: ['t-1', 't-2', 't-3'],
      },
    };
    const verdict = await enforceConstitution(action, {
      residencyRegion: 'TZ',
      tenantCurrency: 'TZS',
      initiatorUserId: 'user-1',
      ledgerReachable: true,
    });
    expect(isCompliant(verdict)).toBe(true);
  });
});

describe('integration: bulk-mutation crosses threshold', () => {
  it('requires approval at 10+', async () => {
    const gateVerdict = evaluateGate({
      request: {
        actionClass: 'bulk-mutation',
        tenantId,
        batchSize: 10,
      },
      settings: initialTenantGateSettings(tenantId),
    });
    expect(gateVerdict.outcome).toBe('request-approval');
  });
});

describe('integration: ledger unreachable blocks side effects', () => {
  it('constitution refuses when ledgerReachable=false', async () => {
    const action: ProposedAction = {
      kind: 'create-invoice',
      riskClass: 'financial',
      tenantId,
      params: {
        amount: 50000,
        currency: 'TZS',
        approverUserId: 'user-1',
      },
    };
    const verdict = await enforceConstitution(action, {
      residencyRegion: 'TZ',
      tenantCurrency: 'TZS',
      initiatorUserId: 'user-1',
      ledgerReachable: false,
    });
    expect(verdict.outcome).toBe('violation');
    if (verdict.outcome === 'violation') {
      expect(verdict.violation).toBe('audit-everything');
      expect(verdict.severity).toBe('critical');
    }
  });
});

describe('integration: conversation override downgrades agentic → chat', () => {
  it('per-conversation override wins over tenant default', () => {
    const tenantState = {
      ...initialTenantState(tenantId),
      currentLevel: 'agentic' as const,
    };
    const override: ConversationAutonomyOverride = {
      conversationId: 'conv-1',
      tenantId,
      override: 'chat',
      setAt: 0,
      setBy: 'user-1',
    };
    const level = resolveAutonomyLevel({
      tenantState,
      conversationOverride: override,
    });
    expect(level).toBe('chat');
    expect(decideAutonomyAction({ level }).kind).toBe('request-step-approval');
  });
});

describe('integration: cross-tenant-read four-eye + audit', () => {
  it('always requests approval AND four-eye is on', () => {
    const verdict = evaluateGate({
      request: {
        actionClass: 'cross-tenant-read',
        tenantId,
        initiatorUserId: 'admin-1',
        proposedApproverUserId: 'admin-2',
      },
      settings: initialTenantGateSettings(tenantId),
    });
    expect(verdict.outcome).toBe('request-approval');
    if (verdict.outcome === 'request-approval') {
      expect(verdict.fourEye).toBe(true);
    }
  });
});

describe('integration: residency mismatch is critical', () => {
  it('constitution returns critical when region differs from tenant residency', async () => {
    const action: ProposedAction = {
      kind: 'compute-embedding',
      riskClass: 'destructive',
      tenantId,
      params: {
        approverUserId: 'user-2',
        region: 'US',
      },
    };
    const verdict = await enforceConstitution(action, {
      residencyRegion: 'TZ',
      ledgerReachable: true,
      initiatorUserId: 'user-1',
    });
    expect(verdict.outcome).toBe('violation');
    if (verdict.outcome === 'violation') {
      expect(verdict.violation).toBe('data-residency');
      expect(verdict.severity).toBe('critical');
    }
  });
});

describe('integration: full happy path — agentic tenant, in-region, clean action', () => {
  it('passes every layer', async () => {
    const gateVerdict = evaluateGate({
      request: {
        actionClass: 'bulk-mutation',
        tenantId,
        batchSize: 2,
      },
      settings: initialTenantGateSettings(tenantId),
    });
    expect(gateVerdict.outcome).toBe('auto-approve');

    const tenantState = {
      ...initialTenantState(tenantId),
      currentLevel: 'agentic' as const,
    };
    const level = resolveAutonomyLevel({ tenantState });
    expect(level).toBe('agentic');
    expect(decideAutonomyAction({ level }).kind).toBe('auto-execute');

    const action: ProposedAction = {
      kind: 'tag-tickets',
      riskClass: 'destructive',
      tenantId,
      params: {
        approverUserId: 'user-2',
        ticketIds: ['t-1', 't-2'],
      },
      intent: 'Categorise the two new maintenance tickets by severity.',
    };
    const verdict = await enforceConstitution(action, {
      residencyRegion: 'TZ',
      tenantCurrency: 'TZS',
      initiatorUserId: 'user-1',
      ledgerReachable: true,
    });
    expect(isCompliant(verdict)).toBe(true);
  });
});

describe('integration: fail-closed bundle overrides tenant agentic preference', () => {
  it('demonstrates that the managed-settings bundle is the source of truth', () => {
    // When the managed-settings layer returns a fail-closed bundle, the
    // brain MUST treat pinnedAutonomy as the ceiling — even if the
    // tenant's saved state says `agentic`. This is the contract the brain
    // is expected to honour at the call site.
    const failClosed = buildFailClosedBundle(tenantId);
    expect(failClosed.pinnedAutonomy).toBe('chat');

    const tenantState = {
      ...initialTenantState(tenantId),
      currentLevel: 'agentic' as const,
    };
    // Without the bundle, resolution returns agentic.
    expect(resolveAutonomyLevel({ tenantState })).toBe('agentic');
    // The bundle's pinnedAutonomy is the ceiling — the brain uses
    // Math.min(pinned, resolved) at the call site. We model that here.
    const order = { chat: 0, plan: 1, agentic: 2 } as const;
    const resolved = resolveAutonomyLevel({ tenantState });
    const effective =
      order[resolved] < order[failClosed.pinnedAutonomy!] ? resolved : failClosed.pinnedAutonomy!;
    expect(effective).toBe('chat');
  });
});
