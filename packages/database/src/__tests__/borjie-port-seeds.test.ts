/**
 * Borjie port seeds — structural validity tests (no DB).
 *
 * Confirms the world-scale regulator-jurisdictions seed covers the
 * declared sets, the scale-tier fixtures span T1-T5, and the test
 * user fixtures have one row per persona role.
 */

import { describe, expect, it } from 'vitest';

import {
  REGULATOR_JURISDICTION_SEED,
} from '../seeds/regulator-jurisdictions.seed.js';
import {
  SCALE_TIER_FIXTURES,
  findScaleTierFixture,
} from '../seeds/scale-tier-fixtures.seed.js';
import {
  BOSSNYUMBA_TEST_USERS,
  findTestUsersByRole,
} from '../seeds/bossnyumba-test-users.seed.js';

// ─────────────────────────────────────────────────────────────────────
// World-scale jurisdictions seed
// ─────────────────────────────────────────────────────────────────────

describe('regulator-jurisdictions seed', () => {
  it('covers TZ/KE/UG/NG/ZA/UK/US/AU + generic (all 9 sets)', () => {
    const sets = new Set(REGULATOR_JURISDICTION_SEED.map((r) => r.regulatorSet));
    expect(sets.has('TZ-set')).toBe(true);
    expect(sets.has('KE-set')).toBe(true);
    expect(sets.has('UG-set')).toBe(true);
    expect(sets.has('NG-set')).toBe(true);
    expect(sets.has('ZA-set')).toBe(true);
    expect(sets.has('UK-set')).toBe(true);
    expect(sets.has('US-set')).toBe(true);
    expect(sets.has('AU-set')).toBe(true);
    expect(sets.has('generic')).toBe(true);
    expect(sets.size).toBe(9);
  });

  it('every row has a 2-char country_code or ZZ for generic', () => {
    for (const row of REGULATOR_JURISDICTION_SEED) {
      expect(row.countryCode.length).toBe(2);
    }
  });

  it('every row carries a slug + name_en + mandate', () => {
    for (const row of REGULATOR_JURISDICTION_SEED) {
      expect(row.slug.length).toBeGreaterThan(0);
      expect(row.nameEn.length).toBeGreaterThan(0);
      expect(row.mandate.length).toBeGreaterThan(0);
    }
  });

  it('(regulator_set, slug) pairs are unique (matches unique index)', () => {
    const seen = new Set<string>();
    for (const row of REGULATOR_JURISDICTION_SEED) {
      const key = `${row.regulatorSet}::${row.slug}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('Tanzania row carries Swahili name_local (bilingual)', () => {
    const tzRows = REGULATOR_JURISDICTION_SEED.filter(
      (r) => r.regulatorSet === 'TZ-set' && r.nameLocal !== null,
    );
    expect(tzRows.length).toBeGreaterThan(0);
  });

  it('Kenya row carries Swahili name_local (bilingual)', () => {
    const keRows = REGULATOR_JURISDICTION_SEED.filter(
      (r) => r.regulatorSet === 'KE-set' && r.nameLocal !== null,
    );
    expect(keRows.length).toBeGreaterThan(0);
  });

  it('covers a tenancy-tribunal mandate per major jurisdiction', () => {
    const tribunalRows = REGULATOR_JURISDICTION_SEED.filter(
      (r) => r.mandate === 'tenancy-tribunal',
    );
    const sets = new Set(tribunalRows.map((r) => r.regulatorSet));
    expect(sets.has('KE-set')).toBe(true);
    expect(sets.has('ZA-set')).toBe(true);
    expect(sets.has('NG-set')).toBe(true);
    expect(sets.has('AU-set')).toBe(true);
    expect(sets.has('TZ-set')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Scale-tier fixtures
// ─────────────────────────────────────────────────────────────────────

describe('scale-tier fixtures', () => {
  it('ships one fixture per T1-T5 tier', () => {
    const tiers = new Set(SCALE_TIER_FIXTURES.map((f) => f.scaleTier));
    expect(tiers.has('t1_single_unit')).toBe(true);
    expect(tiers.has('t2_small_portfolio')).toBe(true);
    expect(tiers.has('t3_mid_portfolio')).toBe(true);
    expect(tiers.has('t4_large_portfolio')).toBe(true);
    expect(tiers.has('t5_multi_country')).toBe(true);
    expect(tiers.size).toBe(5);
  });

  it('every fixture has consistent currency + language for its region', () => {
    for (const f of SCALE_TIER_FIXTURES) {
      expect(f.primaryCurrency.length).toBe(3);
      expect(['sw', 'en', 'sw-KE']).toContain(f.defaultLanguage);
      expect(f.scaleSignals.unitCount).toBeGreaterThan(0);
    }
  });

  it('cross-border (T5) flag is true for multi_country tier', () => {
    const t5 = SCALE_TIER_FIXTURES.find(
      (f) => f.scaleTier === 't5_multi_country',
    );
    expect(t5).toBeDefined();
    expect(t5?.scaleSignals.crossBorder).toBe(true);
  });

  it('findScaleTierFixture resolves by slug + returns undefined on miss', () => {
    expect(findScaleTierFixture('demo-t1-tz-mwananchi')).toBeDefined();
    expect(findScaleTierFixture('does-not-exist')).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────
// Test users
// ─────────────────────────────────────────────────────────────────────

describe('BossNyumba test users', () => {
  it('ships one row per persona role', () => {
    const roles = new Set(BOSSNYUMBA_TEST_USERS.map((u) => u.role));
    expect(roles.has('owner')).toBe(true);
    expect(roles.has('manager')).toBe(true);
    expect(roles.has('maintenance')).toBe(true);
    expect(roles.has('tenant')).toBe(true);
    expect(roles.has('applicant')).toBe(true);
    expect(roles.has('admin')).toBe(true);
  });

  it('all emails are @bossnyumba.test (test domain only)', () => {
    for (const u of BOSSNYUMBA_TEST_USERS) {
      expect(u.email.endsWith('@bossnyumba.test')).toBe(true);
    }
  });

  it('all users carry a tenant slug that matches a fixture', () => {
    const fixtureSlugs = new Set(SCALE_TIER_FIXTURES.map((f) => f.slug));
    for (const u of BOSSNYUMBA_TEST_USERS) {
      expect(fixtureSlugs.has(u.tenantSlug)).toBe(true);
    }
  });

  it('findTestUsersByRole filters correctly', () => {
    const owners = findTestUsersByRole('owner');
    expect(owners.length).toBeGreaterThan(0);
    expect(owners.every((u) => u.role === 'owner')).toBe(true);
  });
});
