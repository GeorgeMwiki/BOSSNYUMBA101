/**
 * Mwikila autonomy framework — types + inviolable rails tests.
 *
 * Covers:
 *   - 12 real-estate categories matched to SQL CHECK in 0290/0291
 *   - tierRank monotonic ordering
 *   - effectiveTier owner-override vs default
 *   - resolveDelegation owner-set vs null fallback
 *   - inviolable rails: kill-switch / family / non-domestic /
 *     envelope / capex-over / eviction-autonomy-refused
 *   - bilingual sw/en human-readable strings
 */

import { describe, expect, it } from 'vitest';
import {
  DELEGATION_CATEGORIES,
  DELEGATION_TIERS,
  ACTION_STATUSES,
  CATEGORY_DEFAULT_TIER,
  CATEGORY_DEFAULT_REVERSAL_HOURS,
  tierRank,
  effectiveTier,
  resolveDelegation,
  tierAllowsImmediateExecution,
  tierAllowsReversal,
  type DelegationPref,
} from '../types.js';
import {
  DEFAULT_MONTHLY_ENVELOPE,
  INVIOLABLE_REASONS,
  checkAutonomyInviolable,
  type AutonomyActionDescriptor,
} from '../inviolable-rails.js';

describe('DELEGATION_CATEGORIES — real-estate vocabulary', () => {
  it('has exactly 12 entries', () => {
    expect(DELEGATION_CATEGORIES.length).toBe(12);
  });

  it('matches the SQL CHECK in 0290 + 0291', () => {
    const expected = [
      'rent-scheduling',
      'regulatory-filings',
      'lease-renewals',
      'payroll-prep',
      'listing-counter-offers',
      'maintenance-approvals-low-value',
      'tenant-communications',
      'evictions-initial-notice',
      'capex',
      'inventory',
      'marketplace-listings',
      'contractor-engagement',
    ];
    expect([...DELEGATION_CATEGORIES]).toEqual(expected);
  });
});

describe('DELEGATION_TIERS + ACTION_STATUSES', () => {
  it('has 4 tiers', () => {
    expect(DELEGATION_TIERS).toEqual(['T0', 'T1', 'T2', 'T3']);
  });

  it('has 8 action statuses matching mig CHECK', () => {
    expect([...ACTION_STATUSES]).toEqual([
      'proposed',
      'owner_approved',
      'owner_denied',
      'executed',
      'reversed',
      'committed',
      'blocked_by_inviolable',
      'expired',
    ]);
  });
});

describe('tierRank', () => {
  it('is monotonic 0..3', () => {
    expect(tierRank('T0')).toBe(0);
    expect(tierRank('T1')).toBe(1);
    expect(tierRank('T2')).toBe(2);
    expect(tierRank('T3')).toBe(3);
  });
});

describe('CATEGORY_DEFAULT_TIER — defaults are conservative', () => {
  it('evictions-initial-notice + capex default to T0', () => {
    expect(CATEGORY_DEFAULT_TIER['evictions-initial-notice']).toBe('T0');
    expect(CATEGORY_DEFAULT_TIER['capex']).toBe('T0');
  });

  it('listing-counter-offers + rent-scheduling default to T2', () => {
    expect(CATEGORY_DEFAULT_TIER['listing-counter-offers']).toBe('T2');
    expect(CATEGORY_DEFAULT_TIER['rent-scheduling']).toBe('T2');
  });
});

describe('CATEGORY_DEFAULT_REVERSAL_HOURS — counter offers get 4h', () => {
  it('listing-counter-offers gets 4h (counterparty volatility)', () => {
    expect(CATEGORY_DEFAULT_REVERSAL_HOURS['listing-counter-offers']).toBe(4);
  });

  it('rest are 24h', () => {
    const others = (
      Object.keys(CATEGORY_DEFAULT_REVERSAL_HOURS) as Array<
        keyof typeof CATEGORY_DEFAULT_REVERSAL_HOURS
      >
    ).filter((k) => k !== 'listing-counter-offers');
    for (const k of others) {
      expect(CATEGORY_DEFAULT_REVERSAL_HOURS[k]).toBe(24);
    }
  });
});

describe('effectiveTier', () => {
  it('returns category default when owner tier is null', () => {
    expect(effectiveTier(null, 'rent-scheduling')).toBe('T2');
    expect(effectiveTier(null, 'capex')).toBe('T0');
  });

  it('honours owner-set tier when provided', () => {
    expect(effectiveTier('T3', 'rent-scheduling')).toBe('T3');
    expect(effectiveTier('T0', 'listing-counter-offers')).toBe('T0');
  });
});

describe('resolveDelegation', () => {
  it('returns default when pref is null', () => {
    const r = resolveDelegation(null, 'rent-scheduling');
    expect(r.source).toBe('default');
    expect(r.tier).toBe('T2');
    expect(r.reversalWindowHours).toBe(24);
    expect(r.envelopeThreshold).toBeNull();
    expect(r.envelopeThresholdCurrency).toBe('TZS');
  });

  it('honours owner pref + reversal override', () => {
    const pref: DelegationPref = {
      tenantId: 'tnt-1',
      category: 'rent-scheduling',
      tier: 'T3',
      reversalWindowHours: 48,
      envelopeThreshold: 1_000_000,
      envelopeThresholdCurrency: 'KES',
      setByUserId: 'usr-owner',
      setAt: '2026-05-29T08:00:00Z',
      notes: null,
    };
    const r = resolveDelegation(pref, 'rent-scheduling');
    expect(r.source).toBe('owner');
    expect(r.tier).toBe('T3');
    expect(r.reversalWindowHours).toBe(48);
    expect(r.envelopeThreshold).toBe(1_000_000);
    expect(r.envelopeThresholdCurrency).toBe('KES');
  });

  it('falls back to category reversal when owner leaves it null', () => {
    const pref: DelegationPref = {
      tenantId: 'tnt-1',
      category: 'listing-counter-offers',
      tier: 'T2',
      reversalWindowHours: null,
      envelopeThreshold: null,
      envelopeThresholdCurrency: 'TZS',
      setByUserId: 'usr-owner',
      setAt: '2026-05-29T08:00:00Z',
      notes: null,
    };
    const r = resolveDelegation(pref, 'listing-counter-offers');
    expect(r.reversalWindowHours).toBe(4);
  });

  it('falls back to default when pref.category mismatches request', () => {
    const pref: DelegationPref = {
      tenantId: 'tnt-1',
      category: 'capex',
      tier: 'T3',
      reversalWindowHours: 48,
      envelopeThreshold: null,
      envelopeThresholdCurrency: 'TZS',
      setByUserId: 'usr-owner',
      setAt: '2026-05-29T08:00:00Z',
      notes: null,
    };
    const r = resolveDelegation(pref, 'rent-scheduling');
    expect(r.source).toBe('default');
    expect(r.tier).toBe('T2');
  });
});

describe('tierAllowsImmediateExecution / tierAllowsReversal', () => {
  it('T2 + T3 may execute immediately', () => {
    expect(tierAllowsImmediateExecution('T0')).toBe(false);
    expect(tierAllowsImmediateExecution('T1')).toBe(false);
    expect(tierAllowsImmediateExecution('T2')).toBe(true);
    expect(tierAllowsImmediateExecution('T3')).toBe(true);
  });

  it('only T2 supports reversal', () => {
    expect(tierAllowsReversal('T0')).toBe(false);
    expect(tierAllowsReversal('T1')).toBe(false);
    expect(tierAllowsReversal('T2')).toBe(true);
    expect(tierAllowsReversal('T3')).toBe(false);
  });
});

describe('INVIOLABLE_REASONS — 6 categories', () => {
  it('has all 6 rails', () => {
    expect([...INVIOLABLE_REASONS]).toEqual([
      'kill_switch_open',
      'family_member_target',
      'non_domestic_currency',
      'envelope_exceeded',
      'capex_over_envelope',
      'eviction_autonomy_refused',
    ]);
  });
});

describe('checkAutonomyInviolable — six rails', () => {
  const passingDescriptor: AutonomyActionDescriptor = {
    category: 'rent-scheduling',
    amount: 0,
    currency: 'TZS',
    domesticCurrency: 'TZS',
    targetRelation: null,
    envelopeThreshold: 5_000_000,
    killSwitchOpen: false,
  };

  it('passes a benign rent-scheduling action', () => {
    const v = checkAutonomyInviolable(passingDescriptor);
    expect(v.status).toBe('pass');
  });

  it('blocks first when kill-switch is open', () => {
    const v = checkAutonomyInviolable({
      ...passingDescriptor,
      killSwitchOpen: true,
    });
    expect(v.status).toBe('block');
    expect(v.reason).toBe('kill_switch_open');
    expect(v.humanReadable).toMatch(/kill-switch/i);
    expect(v.humanReadableSw).toMatch(/dharura/i);
  });

  it('blocks family-member targets even when kill-switch is closed', () => {
    const v = checkAutonomyInviolable({
      ...passingDescriptor,
      targetRelation: 'family',
    });
    expect(v.reason).toBe('family_member_target');
    expect(v.humanReadableSw).toMatch(/familia/i);
  });

  it('blocks eviction-initial-notice category — never autonomous', () => {
    const v = checkAutonomyInviolable({
      ...passingDescriptor,
      category: 'evictions-initial-notice',
    });
    expect(v.status).toBe('block');
    expect(v.reason).toBe('eviction_autonomy_refused');
  });

  it('blocks non-domestic currency money-out', () => {
    const v = checkAutonomyInviolable({
      ...passingDescriptor,
      amount: 100,
      currency: 'USD',
      domesticCurrency: 'TZS',
    });
    expect(v.reason).toBe('non_domestic_currency');
    expect(v.humanReadable).toContain('TZS');
  });

  it('blocks money-out above the envelope', () => {
    const v = checkAutonomyInviolable({
      ...passingDescriptor,
      amount: 10_000_000,
      envelopeThreshold: 5_000_000,
    });
    expect(v.reason).toBe('envelope_exceeded');
  });

  it('blocks capex above the envelope with a specific reason', () => {
    const v = checkAutonomyInviolable({
      ...passingDescriptor,
      category: 'capex',
      amount: 10_000_000,
      envelopeThreshold: 5_000_000,
    });
    expect(v.reason).toBe('capex_over_envelope');
  });

  it('falls back to DEFAULT_MONTHLY_ENVELOPE when no threshold is set', () => {
    const v = checkAutonomyInviolable({
      ...passingDescriptor,
      amount: DEFAULT_MONTHLY_ENVELOPE + 1,
      envelopeThreshold: null,
    });
    expect(v.reason).toBe('envelope_exceeded');
  });

  it('a counter-offer below the envelope passes', () => {
    const v = checkAutonomyInviolable({
      ...passingDescriptor,
      category: 'listing-counter-offers',
      amount: 50_000,
      envelopeThreshold: 5_000_000,
    });
    expect(v.status).toBe('pass');
  });
});
