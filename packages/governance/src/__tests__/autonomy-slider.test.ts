/**
 * Autonomy slider tests — resolution chain + decision + auto-suggest + state
 * transitions. 20+ tests.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AUTONOMY_LEVEL,
  CLEAN_DAYS_FOR_PLAN_SUGGEST,
  initialTenantState,
  resolveAutonomyLevel,
  decideAutonomyAction,
  computeAutonomySuggestion,
  acceptSuggestion,
  downgradeAutonomy,
  upgradeAutonomyToAgentic,
  resolveLevelForConversation,
  type AutonomyStateStore,
  type ConversationAutonomyOverride,
  type TenantAutonomyState,
  type TenantTrackRecord,
} from '../autonomy-slider/index.js';

describe('default level', () => {
  it('is "chat"', () => {
    expect(DEFAULT_AUTONOMY_LEVEL).toBe('chat');
  });
});

describe('initialTenantState', () => {
  it('starts a new tenant in chat mode', () => {
    const state = initialTenantState('tenant-1', 1700000000000);
    expect(state.currentLevel).toBe('chat');
    expect(state.setBy).toBe('system');
    expect(state.setAt).toBe(1700000000000);
    expect(state.pendingSuggestion).toBeUndefined();
  });
});

describe('resolveAutonomyLevel', () => {
  const tenantState: TenantAutonomyState = {
    tenantId: 'tenant-1',
    currentLevel: 'plan',
    setAt: 0,
    setBy: 'user-1',
  };

  it('returns tenant default when no override is set', () => {
    expect(resolveAutonomyLevel({ tenantState })).toBe('plan');
  });

  it('returns platform default when tenant state is missing', () => {
    expect(resolveAutonomyLevel({ tenantState: null })).toBe('chat');
  });

  it('returns conversation override when present and not expired', () => {
    const override: ConversationAutonomyOverride = {
      conversationId: 'conv-1',
      tenantId: 'tenant-1',
      override: 'chat',
      setAt: 0,
      setBy: 'user-1',
    };
    expect(
      resolveAutonomyLevel({ tenantState, conversationOverride: override }),
    ).toBe('chat');
  });

  it('respects expired overrides (falls back to tenant default)', () => {
    const override: ConversationAutonomyOverride = {
      conversationId: 'conv-1',
      tenantId: 'tenant-1',
      override: 'chat',
      setAt: 0,
      setBy: 'user-1',
      expiresAt: 1000,
    };
    expect(
      resolveAutonomyLevel({
        tenantState,
        conversationOverride: override,
        now: 2000,
      }),
    ).toBe('plan');
  });

  it('does not respect a future-expiring override yet', () => {
    const override: ConversationAutonomyOverride = {
      conversationId: 'conv-1',
      tenantId: 'tenant-1',
      override: 'chat',
      setAt: 0,
      setBy: 'user-1',
      expiresAt: 5000,
    };
    expect(
      resolveAutonomyLevel({
        tenantState,
        conversationOverride: override,
        now: 1000,
      }),
    ).toBe('chat');
  });
});

describe('decideAutonomyAction', () => {
  it('chat mode → request-step-approval', () => {
    expect(decideAutonomyAction({ level: 'chat' })).toEqual({
      kind: 'request-step-approval',
      level: 'chat',
    });
  });

  it('plan mode without approval → request-plan-approval', () => {
    expect(decideAutonomyAction({ level: 'plan' })).toEqual({
      kind: 'request-plan-approval',
      level: 'plan',
    });
  });

  it('plan mode WITH approval → request-step-approval (step-by-step)', () => {
    expect(
      decideAutonomyAction({ level: 'plan', hasPlanApproval: true }),
    ).toEqual({
      kind: 'request-step-approval',
      level: 'plan',
    });
  });

  it('agentic mode → auto-execute', () => {
    expect(decideAutonomyAction({ level: 'agentic' })).toEqual({
      kind: 'auto-execute',
      level: 'agentic',
    });
  });
});

describe('computeAutonomySuggestion', () => {
  it('suggests plan when 30 clean days + no violations + currently chat', () => {
    const trackRecord: TenantTrackRecord = {
      cleanDays: 31,
      violationsLast90: 0,
      approvalsLast90: 10,
    };
    expect(
      computeAutonomySuggestion({ currentLevel: 'chat', trackRecord }),
    ).toBe('plan');
  });

  it('exactly at threshold suggests', () => {
    const trackRecord: TenantTrackRecord = {
      cleanDays: CLEAN_DAYS_FOR_PLAN_SUGGEST,
      violationsLast90: 0,
      approvalsLast90: 0,
    };
    expect(
      computeAutonomySuggestion({ currentLevel: 'chat', trackRecord }),
    ).toBe('plan');
  });

  it('does not suggest when track record has any recent violations', () => {
    const trackRecord: TenantTrackRecord = {
      cleanDays: 60,
      violationsLast90: 1,
      approvalsLast90: 0,
    };
    expect(
      computeAutonomySuggestion({ currentLevel: 'chat', trackRecord }),
    ).toBeNull();
  });

  it('does not suggest below the clean-days threshold', () => {
    const trackRecord: TenantTrackRecord = {
      cleanDays: 29,
      violationsLast90: 0,
      approvalsLast90: 0,
    };
    expect(
      computeAutonomySuggestion({ currentLevel: 'chat', trackRecord }),
    ).toBeNull();
  });

  it('does NOT suggest agentic auto-suggest from plan (must be opt-in)', () => {
    const trackRecord: TenantTrackRecord = {
      cleanDays: 365,
      violationsLast90: 0,
      approvalsLast90: 1000,
    };
    expect(
      computeAutonomySuggestion({ currentLevel: 'plan', trackRecord }),
    ).toBeNull();
  });

  it('respects a custom threshold', () => {
    const trackRecord: TenantTrackRecord = {
      cleanDays: 10,
      violationsLast90: 0,
      approvalsLast90: 0,
    };
    expect(
      computeAutonomySuggestion({
        currentLevel: 'chat',
        trackRecord,
        cleanDaysThreshold: 7,
      }),
    ).toBe('plan');
  });
});

describe('acceptSuggestion', () => {
  it('promotes the level when the pending suggestion matches', () => {
    const state: TenantAutonomyState = {
      tenantId: 'tenant-1',
      currentLevel: 'chat',
      setAt: 0,
      setBy: 'system',
      pendingSuggestion: 'plan',
    };
    const next = acceptSuggestion({
      state,
      approverUserId: 'user-1',
      acceptedLevel: 'plan',
      now: 1000,
    });
    expect(next.currentLevel).toBe('plan');
    expect(next.setBy).toBe('user-1');
    expect(next.setAt).toBe(1000);
    expect(next.pendingSuggestion).toBeUndefined();
  });

  it('throws when no matching pending suggestion exists', () => {
    const state: TenantAutonomyState = {
      tenantId: 'tenant-1',
      currentLevel: 'chat',
      setAt: 0,
      setBy: 'system',
    };
    expect(() =>
      acceptSuggestion({
        state,
        approverUserId: 'user-1',
        acceptedLevel: 'plan',
      }),
    ).toThrow(/no matching pending suggestion/);
  });

  it('is immutable — does not mutate the input state', () => {
    const state: TenantAutonomyState = {
      tenantId: 'tenant-1',
      currentLevel: 'chat',
      setAt: 0,
      setBy: 'system',
      pendingSuggestion: 'plan',
    };
    acceptSuggestion({
      state,
      approverUserId: 'user-1',
      acceptedLevel: 'plan',
    });
    expect(state.currentLevel).toBe('chat');
    expect(state.pendingSuggestion).toBe('plan');
  });
});

describe('downgradeAutonomy', () => {
  it('moves agentic → plan', () => {
    const state: TenantAutonomyState = {
      tenantId: 'tenant-1',
      currentLevel: 'agentic',
      setAt: 0,
      setBy: 'user-1',
    };
    const next = downgradeAutonomy({
      state,
      approverUserId: 'user-2',
      toLevel: 'plan',
      now: 1000,
    });
    expect(next.currentLevel).toBe('plan');
    expect(next.setBy).toBe('user-2');
  });

  it('moves plan → chat', () => {
    const state: TenantAutonomyState = {
      tenantId: 'tenant-1',
      currentLevel: 'plan',
      setAt: 0,
      setBy: 'user-1',
    };
    const next = downgradeAutonomy({
      state,
      approverUserId: 'user-2',
      toLevel: 'chat',
    });
    expect(next.currentLevel).toBe('chat');
  });

  it('rejects lateral or upward moves', () => {
    const state: TenantAutonomyState = {
      tenantId: 'tenant-1',
      currentLevel: 'plan',
      setAt: 0,
      setBy: 'user-1',
    };
    expect(() =>
      downgradeAutonomy({
        state,
        approverUserId: 'user-2',
        toLevel: 'plan',
      }),
    ).toThrow(/may only lower/);
    expect(() =>
      downgradeAutonomy({
        state,
        approverUserId: 'user-2',
        toLevel: 'agentic',
      }),
    ).toThrow(/may only lower/);
  });
});

describe('upgradeAutonomyToAgentic', () => {
  it('moves to agentic with the explicit approver', () => {
    const state: TenantAutonomyState = {
      tenantId: 'tenant-1',
      currentLevel: 'plan',
      setAt: 0,
      setBy: 'user-1',
    };
    const next = upgradeAutonomyToAgentic({
      state,
      approverUserId: 'user-2',
      now: 1000,
    });
    expect(next.currentLevel).toBe('agentic');
    expect(next.setBy).toBe('user-2');
    expect(next.setAt).toBe(1000);
  });
});

describe('resolveLevelForConversation (store integration)', () => {
  const buildStore = (args: {
    readonly tenantState: TenantAutonomyState | null;
    readonly override?: ConversationAutonomyOverride | null;
  }): AutonomyStateStore => ({
    async loadTenantState() {
      return args.tenantState;
    },
    async saveTenantState() {
      /* no-op */
    },
    async loadConversationOverride() {
      return args.override ?? null;
    },
    async saveConversationOverride() {
      /* no-op */
    },
    async loadTrackRecord() {
      return { cleanDays: 0, violationsLast90: 0, approvalsLast90: 0 };
    },
  });

  it('resolves through the store with no override', async () => {
    const store = buildStore({
      tenantState: {
        tenantId: 'tenant-1',
        currentLevel: 'agentic',
        setAt: 0,
        setBy: 'user-1',
      },
    });
    const resolved = await resolveLevelForConversation({
      store,
      tenantId: 'tenant-1',
      conversationId: 'conv-1',
    });
    expect(resolved).toBe('agentic');
  });

  it('conversation override wins over tenant state', async () => {
    const store = buildStore({
      tenantState: {
        tenantId: 'tenant-1',
        currentLevel: 'agentic',
        setAt: 0,
        setBy: 'user-1',
      },
      override: {
        conversationId: 'conv-1',
        tenantId: 'tenant-1',
        override: 'chat',
        setAt: 0,
        setBy: 'user-1',
      },
    });
    const resolved = await resolveLevelForConversation({
      store,
      tenantId: 'tenant-1',
      conversationId: 'conv-1',
    });
    expect(resolved).toBe('chat');
  });
});
