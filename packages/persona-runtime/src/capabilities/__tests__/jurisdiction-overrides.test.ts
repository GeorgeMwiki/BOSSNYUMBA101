/**
 * Jurisdiction-override tests — JA-3.
 *
 * Verifies that:
 *   - Override map is frozen at module load.
 *   - resolveCapabilityForJurisdiction returns the base entry when no
 *     override applies.
 *   - resolveCapabilityForJurisdiction substitutes only the fields the
 *     override specifies; other fields stay intact.
 *   - Every override references a known capability id (referential
 *     integrity).
 */

import { describe, expect, it } from 'vitest';
import {
  CAPABILITY_JURISDICTION_OVERRIDES,
  CAPABILITY_REGISTRY,
  getCapabilityById,
  getCapabilityOverride,
  hasJurisdictionOverrides,
  listCapabilitiesWithOverrides,
  resolveCapabilityForJurisdiction,
} from '../index.js';

describe('CAPABILITY_JURISDICTION_OVERRIDES — boot integrity', () => {
  it('every override key resolves to a known capability id', () => {
    const ids = new Set(CAPABILITY_REGISTRY.map((entry) => entry.id));
    for (const overrideId of listCapabilitiesWithOverrides()) {
      expect(ids.has(overrideId)).toBe(true);
    }
  });

  it('hasJurisdictionOverrides reports overrides for compliance.statutory', () => {
    expect(hasJurisdictionOverrides('mwikila.compliance.statutory')).toBe(true);
  });

  it('hasJurisdictionOverrides false for ids without overrides', () => {
    expect(hasJurisdictionOverrides('mwikila.draft.payslip')).toBe(false);
  });

  it('override map is frozen', () => {
    expect(() => {
      // @ts-expect-error — testing immutability at runtime
      CAPABILITY_JURISDICTION_OVERRIDES.NEW_KEY = {};
    }).toThrow();
  });
});

describe('resolveCapabilityForJurisdiction', () => {
  it('returns the base entry unchanged for KE (canonical default)', () => {
    const base = getCapabilityById('mwikila.compliance.statutory');
    expect(base).toBeDefined();
    if (!base) return;
    const resolved = resolveCapabilityForJurisdiction(base, 'KE');
    expect(resolved).toEqual(base);
  });

  it('substitutes the TZ public_description for compliance.statutory', () => {
    const base = getCapabilityById('mwikila.compliance.statutory');
    expect(base).toBeDefined();
    if (!base) return;
    const resolved = resolveCapabilityForJurisdiction(base, 'TZ');
    expect(resolved.public_description.en).toContain('TRA');
    expect(resolved.public_description.en).not.toEqual(
      base.public_description.en,
    );
    // unrelated fields preserved
    expect(resolved.id).toBe(base.id);
    expect(resolved.topic).toBe(base.topic);
    expect(resolved.related).toEqual(base.related);
  });

  it('falls back to base when override missing for a country', () => {
    const base = getCapabilityById('mwikila.compliance.statutory');
    expect(base).toBeDefined();
    if (!base) return;
    const resolved = resolveCapabilityForJurisdiction(base, 'XX');
    expect(resolved).toEqual(base);
  });

  it('getCapabilityOverride returns undefined for unknown id', () => {
    expect(
      getCapabilityOverride('mwikila.fake.entry', 'KE'),
    ).toBeUndefined();
  });
});
