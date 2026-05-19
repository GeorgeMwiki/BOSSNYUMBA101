/**
 * Checkpoint gate tests — one fixture per action class + per option +
 * four-eye + bulk-mutation threshold. 20+ tests.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GATE_CONFIG,
  initialTenantGateSettings,
  evaluateGate,
  evaluateGateForTenant,
  updateGateConfig,
  type ActionClass,
  type GateSettingsStore,
  type TenantGateSettings,
} from '../checkpoint-gates/index.js';

const tenantId = 'tenant-1';

describe('DEFAULT_GATE_CONFIG', () => {
  it('covers all six action classes', () => {
    const expected: readonly ActionClass[] = [
      'send-external-comm',
      'charge-payment',
      'public-content',
      'legal-document',
      'bulk-mutation',
      'cross-tenant-read',
    ];
    expected.forEach((cls) => {
      expect(DEFAULT_GATE_CONFIG[cls]).toBeDefined();
    });
  });

  it('charge-payment defaults to alwaysAsk + fourEye', () => {
    expect(DEFAULT_GATE_CONFIG['charge-payment'].alwaysAsk).toBe(true);
    expect(DEFAULT_GATE_CONFIG['charge-payment'].fourEye).toBe(true);
  });

  it('legal-document defaults to alwaysAsk + fourEye', () => {
    expect(DEFAULT_GATE_CONFIG['legal-document'].alwaysAsk).toBe(true);
    expect(DEFAULT_GATE_CONFIG['legal-document'].fourEye).toBe(true);
  });

  it('cross-tenant-read defaults to alwaysAsk + fourEye', () => {
    expect(DEFAULT_GATE_CONFIG['cross-tenant-read'].alwaysAsk).toBe(true);
    expect(DEFAULT_GATE_CONFIG['cross-tenant-read'].fourEye).toBe(true);
  });

  it('bulk-mutation defaults to autoBelow=10 + askThreshold=10', () => {
    expect(DEFAULT_GATE_CONFIG['bulk-mutation'].autoBelow).toBe(10);
    expect(DEFAULT_GATE_CONFIG['bulk-mutation'].askThreshold).toBe(10);
    expect(DEFAULT_GATE_CONFIG['bulk-mutation'].alwaysAsk).toBe(false);
  });
});

describe('initialTenantGateSettings', () => {
  it('produces a settings object with all defaults', () => {
    const settings = initialTenantGateSettings(tenantId);
    expect(settings.tenantId).toBe(tenantId);
    expect(settings.gates['send-external-comm']).toEqual(
      DEFAULT_GATE_CONFIG['send-external-comm'],
    );
  });
});

describe('evaluateGate — alwaysAsk classes', () => {
  const settings = initialTenantGateSettings(tenantId);

  it('send-external-comm always requests approval', () => {
    const verdict = evaluateGate({
      request: { actionClass: 'send-external-comm', tenantId },
      settings,
    });
    expect(verdict.outcome).toBe('request-approval');
  });

  it('charge-payment always requests approval and flags four-eye', () => {
    const verdict = evaluateGate({
      request: { actionClass: 'charge-payment', tenantId },
      settings,
    });
    expect(verdict.outcome).toBe('request-approval');
    if (verdict.outcome === 'request-approval') {
      expect(verdict.fourEye).toBe(true);
    }
  });

  it('public-content always requests approval (no four-eye)', () => {
    const verdict = evaluateGate({
      request: { actionClass: 'public-content', tenantId },
      settings,
    });
    expect(verdict.outcome).toBe('request-approval');
    if (verdict.outcome === 'request-approval') {
      expect(verdict.fourEye).toBe(false);
    }
  });

  it('legal-document always requests approval with four-eye', () => {
    const verdict = evaluateGate({
      request: { actionClass: 'legal-document', tenantId },
      settings,
    });
    expect(verdict.outcome).toBe('request-approval');
    if (verdict.outcome === 'request-approval') {
      expect(verdict.fourEye).toBe(true);
    }
  });

  it('cross-tenant-read always requests approval with four-eye', () => {
    const verdict = evaluateGate({
      request: { actionClass: 'cross-tenant-read', tenantId },
      settings,
    });
    expect(verdict.outcome).toBe('request-approval');
    if (verdict.outcome === 'request-approval') {
      expect(verdict.fourEye).toBe(true);
    }
  });
});

describe('evaluateGate — bulk-mutation threshold semantics', () => {
  const settings = initialTenantGateSettings(tenantId);

  it('batch of 1 auto-approves', () => {
    const verdict = evaluateGate({
      request: { actionClass: 'bulk-mutation', tenantId, batchSize: 1 },
      settings,
    });
    expect(verdict.outcome).toBe('auto-approve');
  });

  it('batch of 9 auto-approves (below threshold)', () => {
    const verdict = evaluateGate({
      request: { actionClass: 'bulk-mutation', tenantId, batchSize: 9 },
      settings,
    });
    expect(verdict.outcome).toBe('auto-approve');
  });

  it('batch of exactly 10 requests approval (meets threshold)', () => {
    const verdict = evaluateGate({
      request: { actionClass: 'bulk-mutation', tenantId, batchSize: 10 },
      settings,
    });
    expect(verdict.outcome).toBe('request-approval');
  });

  it('large batch requests approval', () => {
    const verdict = evaluateGate({
      request: { actionClass: 'bulk-mutation', tenantId, batchSize: 100 },
      settings,
    });
    expect(verdict.outcome).toBe('request-approval');
  });
});

describe('evaluateGate — four-eye self-approval', () => {
  const settings = initialTenantGateSettings(tenantId);

  it('denies when proposed approver equals initiator (charge-payment)', () => {
    const verdict = evaluateGate({
      request: {
        actionClass: 'charge-payment',
        tenantId,
        initiatorUserId: 'user-1',
        proposedApproverUserId: 'user-1',
      },
      settings,
    });
    expect(verdict.outcome).toBe('deny');
  });

  it('allows when initiator and approver are distinct', () => {
    const verdict = evaluateGate({
      request: {
        actionClass: 'charge-payment',
        tenantId,
        initiatorUserId: 'user-1',
        proposedApproverUserId: 'user-2',
      },
      settings,
    });
    expect(verdict.outcome).toBe('request-approval');
  });

  it('does not deny when fourEye is false even if approver=initiator', () => {
    const verdict = evaluateGate({
      request: {
        actionClass: 'send-external-comm',
        tenantId,
        initiatorUserId: 'user-1',
        proposedApproverUserId: 'user-1',
      },
      settings,
    });
    expect(verdict.outcome).toBe('request-approval');
  });
});

describe('evaluateGate — unknown action class fails closed', () => {
  it('returns request-approval for an unknown class', () => {
    const settings: TenantGateSettings = {
      tenantId,
      gates: {} as TenantGateSettings['gates'],
    };
    const verdict = evaluateGate({
      request: {
        actionClass: 'send-external-comm',
        tenantId,
      },
      settings,
    });
    expect(verdict.outcome).toBe('request-approval');
    if (verdict.outcome === 'request-approval') {
      expect(verdict.fourEye).toBe(true);
    }
  });
});

describe('updateGateConfig', () => {
  it('replaces only the targeted class — immutable', () => {
    const settings = initialTenantGateSettings(tenantId);
    const next = updateGateConfig({
      settings,
      updated: {
        actionClass: 'bulk-mutation',
        alwaysAsk: true,
        fourEye: false,
      },
    });
    expect(next.gates['bulk-mutation'].alwaysAsk).toBe(true);
    expect(next.gates['send-external-comm']).toEqual(
      DEFAULT_GATE_CONFIG['send-external-comm'],
    );
    // Original untouched.
    expect(settings.gates['bulk-mutation'].alwaysAsk).toBe(false);
  });
});

describe('evaluateGateForTenant (store integration)', () => {
  const buildStore = (settings: TenantGateSettings): GateSettingsStore => ({
    async loadSettings() {
      return settings;
    },
    async saveSettings() {
      /* no-op */
    },
  });

  it('loads settings from the store and evaluates', async () => {
    const verdict = await evaluateGateForTenant({
      store: buildStore(initialTenantGateSettings(tenantId)),
      request: { actionClass: 'send-external-comm', tenantId },
    });
    expect(verdict.outcome).toBe('request-approval');
  });

  it('respects owner-customised gates', async () => {
    const customised: TenantGateSettings = {
      tenantId,
      gates: {
        ...initialTenantGateSettings(tenantId).gates,
        'send-external-comm': {
          actionClass: 'send-external-comm',
          alwaysAsk: false,
          autoBelow: 100,
          fourEye: false,
        },
      },
    };
    const verdict = await evaluateGateForTenant({
      store: buildStore(customised),
      request: { actionClass: 'send-external-comm', tenantId, batchSize: 5 },
    });
    expect(verdict.outcome).toBe('auto-approve');
  });
});
