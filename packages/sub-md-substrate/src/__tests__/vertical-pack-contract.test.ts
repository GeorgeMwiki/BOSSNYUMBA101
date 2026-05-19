import { describe, expect, it } from 'vitest';
import { validatePack, type VerticalPack } from '../vertical-pack/contract.js';
import { PROPERTY_MANAGEMENT_PACK } from '../verticals/property-management/pack.js';
import { BOSSNYUMBA_INTERNAL_PACK } from '../verticals/bossnyumba-internal/pack.js';

describe('validatePack', () => {
  it('property-management pack passes', () => {
    const r = validatePack(PROPERTY_MANAGEMENT_PACK);
    expect(r.ok).toBe(true);
  });

  it('bossnyumba-internal pack passes', () => {
    const r = validatePack(BOSSNYUMBA_INTERNAL_PACK);
    expect(r.ok).toBe(true);
  });

  it('rejects empty subMds', () => {
    const bad: VerticalPack = {
      ...PROPERTY_MANAGEMENT_PACK,
      subMds: [],
    };
    const r = validatePack(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain('pack.subMds must be non-empty');
  });

  it('rejects non-kebab name', () => {
    const bad: VerticalPack = {
      ...PROPERTY_MANAGEMENT_PACK,
      name: 'Property Mgmt!',
    };
    const r = validatePack(bad);
    expect(r.ok).toBe(false);
  });

  it('rejects empty entityTypes', () => {
    const bad: VerticalPack = {
      ...PROPERTY_MANAGEMENT_PACK,
      entityTypes: [],
    };
    const r = validatePack(bad);
    expect(r.ok).toBe(false);
  });

  it('rejects duplicate sub-MD names', () => {
    const sm = PROPERTY_MANAGEMENT_PACK.subMds[0]!;
    const bad: VerticalPack = {
      ...PROPERTY_MANAGEMENT_PACK,
      subMds: [sm, sm],
    };
    const r = validatePack(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.includes('duplicate sub-MD'))).toBe(true);
  });

  it('rejects sub-MD with unknown entity type', () => {
    const sm = PROPERTY_MANAGEMENT_PACK.subMds[0]!;
    const bad: VerticalPack = {
      ...PROPERTY_MANAGEMENT_PACK,
      subMds: [
        {
          ...sm,
          entityTypes: ['unknown-entity'],
        },
      ],
    };
    const r = validatePack(bad);
    expect(r.ok).toBe(false);
  });

  it('rejects sub-MD with unknown connector', () => {
    const sm = PROPERTY_MANAGEMENT_PACK.subMds[0]!;
    const bad: VerticalPack = {
      ...PROPERTY_MANAGEMENT_PACK,
      subMds: [
        {
          ...sm,
          connectorsRequired: ['some-missing-connector'],
        },
      ],
    };
    const r = validatePack(bad);
    expect(r.ok).toBe(false);
  });

  it('rejects sub-MD with no primitives', () => {
    const sm = PROPERTY_MANAGEMENT_PACK.subMds[0]!;
    const bad: VerticalPack = {
      ...PROPERTY_MANAGEMENT_PACK,
      subMds: [
        {
          ...sm,
          primitives: [],
        },
      ],
    };
    const r = validatePack(bad);
    expect(r.ok).toBe(false);
  });
});

describe('PROPERTY_MANAGEMENT_PACK content', () => {
  it('contains maintenance.dispatch', () => {
    expect(
      PROPERTY_MANAGEMENT_PACK.subMds.some((s) => s.name === 'maintenance.dispatch'),
    ).toBe(true);
  });
  it('declares jurisdictionRules for TZ and KE', () => {
    const codes = PROPERTY_MANAGEMENT_PACK.jurisdictionRules?.map((j) => j.countryCode);
    expect(codes).toContain('TZ');
    expect(codes).toContain('KE');
  });
});

describe('BOSSNYUMBA_INTERNAL_PACK content', () => {
  it('contains the 6 internal sub-MDs', () => {
    const names = BOSSNYUMBA_INTERNAL_PACK.subMds.map((s) => s.name).sort();
    expect(names).toEqual(
      [
        'customer-success.compile',
        'hr.dispatch',
        'incident.triage',
        'payroll.compile',
        'sales.chase',
        'vendor.reconcile',
      ].sort(),
    );
  });
  it('declares a TZ jurisdiction rule', () => {
    expect(
      BOSSNYUMBA_INTERNAL_PACK.jurisdictionRules?.some((j) => j.countryCode === 'TZ'),
    ).toBe(true);
  });
  it('hr.dispatch uses act-on-yes by default', () => {
    const hr = BOSSNYUMBA_INTERNAL_PACK.subMds.find((s) => s.name === 'hr.dispatch')!;
    expect(hr.defaultPermissionMode).toBe('act-on-yes');
  });
  it('incident.triage uses auto by default (oncall paging)', () => {
    const inc = BOSSNYUMBA_INTERNAL_PACK.subMds.find((s) => s.name === 'incident.triage')!;
    expect(inc.defaultPermissionMode).toBe('auto');
  });
});
