/**
 * scale-defaults tests — BossNyumba real-estate tier ladder.
 *
 * Asserts:
 *   - Tier sizes match spec (4, 7, 11, 16, 20)
 *   - Tier ladder is strictly additive (T(n+1) ⊇ T(n))
 *   - autoDetectScaleTier obeys signal precedence
 *   - coerceScaleTier safely handles garbage input
 *   - All tab ids exist in OWNER_OS_TAB_TYPES (registry contract)
 *   - SCALE_TIER_LABELS array is bilingual + frozen
 */

import { describe, expect, it } from 'vitest';

import {
  OWNER_OS_TAB_TYPES,
  type OwnerOSTabType,
} from '../types.js';
import {
  SCALE_TIERS,
  SCALE_TIER_LABELS,
  autoDetectScaleTier,
  coerceScaleTier,
  defaultTabsFor,
  scaleTierLabel,
  type ScaleTier,
} from '../scale-defaults.js';

describe('defaultTabsFor — tier ladder', () => {
  it.each([
    ['t1_single_unit', 4],
    ['t2_small_portfolio', 7],
    ['t3_mid_tier', 11],
    ['t4_industrial_property', 16],
    ['t5_multi_country', 20],
  ] as ReadonlyArray<[ScaleTier, number]>)(
    '%s returns exactly %i tabs',
    (tier, expected) => {
      expect(defaultTabsFor(tier).length).toBe(expected);
    },
  );

  it('ladder is strictly additive — each tier is a superset of the previous', () => {
    const tiers: ReadonlyArray<ScaleTier> = [
      't1_single_unit',
      't2_small_portfolio',
      't3_mid_tier',
      't4_industrial_property',
      't5_multi_country',
    ];
    for (let i = 1; i < tiers.length; i++) {
      const lower = new Set(defaultTabsFor(tiers[i - 1]!));
      const higher = new Set(defaultTabsFor(tiers[i]!));
      for (const id of lower) {
        expect(higher.has(id)).toBe(true);
      }
    }
  });

  it('every default tab id is registered in OWNER_OS_TAB_TYPES', () => {
    const allowed: ReadonlySet<OwnerOSTabType> = new Set(OWNER_OS_TAB_TYPES);
    for (const tier of SCALE_TIERS) {
      for (const id of defaultTabsFor(tier)) {
        expect(allowed.has(id)).toBe(true);
      }
    }
  });

  it('T1 contains chat / reminders / rent / treasury — the artisanal core', () => {
    expect(defaultTabsFor('t1_single_unit')).toEqual([
      'chat',
      'reminders',
      'rent',
      'treasury',
    ]);
  });
});

describe('autoDetectScaleTier', () => {
  it('crossBorder=true forces T5 regardless of other signals', () => {
    expect(autoDetectScaleTier({ crossBorder: true })).toBe(
      't5_multi_country',
    );
    expect(
      autoDetectScaleTier({ propertyCount: 1, crossBorder: true }),
    ).toBe('t5_multi_country');
  });

  it('large portfolio (>150) goes to T4', () => {
    expect(autoDetectScaleTier({ propertyCount: 500 })).toBe(
      't4_industrial_property',
    );
  });

  it('mid portfolio (>15) goes to T3', () => {
    expect(autoDetectScaleTier({ propertyCount: 50 })).toBe('t3_mid_tier');
  });

  it('multi-region (>3) bumps tiny portfolio to T3', () => {
    expect(
      autoDetectScaleTier({ propertyCount: 5, regionCount: 4 }),
    ).toBe('t3_mid_tier');
  });

  it('small portfolio (>1) goes to T2', () => {
    expect(autoDetectScaleTier({ propertyCount: 5 })).toBe(
      't2_small_portfolio',
    );
  });

  it('empty signals defaults to T1', () => {
    expect(autoDetectScaleTier({})).toBe('t1_single_unit');
  });
});

describe('coerceScaleTier', () => {
  it('returns the tier when valid', () => {
    expect(coerceScaleTier('t3_mid_tier')).toBe('t3_mid_tier');
  });

  it('falls back to t1_single_unit for garbage input', () => {
    expect(coerceScaleTier('garbage')).toBe('t1_single_unit');
    expect(coerceScaleTier(null)).toBe('t1_single_unit');
    expect(coerceScaleTier(undefined)).toBe('t1_single_unit');
    expect(coerceScaleTier('')).toBe('t1_single_unit');
  });
});

describe('SCALE_TIER_LABELS — bilingual contract', () => {
  it('every tier has sw + en label + description', () => {
    expect(SCALE_TIER_LABELS.length).toBe(SCALE_TIERS.length);
    for (const tier of SCALE_TIERS) {
      const label = scaleTierLabel(tier);
      expect(label.labelEn.length).toBeGreaterThan(0);
      expect(label.labelSw.length).toBeGreaterThan(0);
      expect(label.descriptionEn.length).toBeGreaterThan(0);
      expect(label.descriptionSw.length).toBeGreaterThan(0);
    }
  });

  it('SCALE_TIER_LABELS is frozen', () => {
    expect(Object.isFrozen(SCALE_TIER_LABELS)).toBe(true);
  });

  it('scaleTierLabel falls back to T1 when tier is unrecognised', () => {
    // @ts-expect-error — testing runtime fallback
    expect(scaleTierLabel('garbage').tier).toBe('t1_single_unit');
  });
});
