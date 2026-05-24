import { describe, expect, it } from 'vitest';
import { flagPSAClauses } from '../loi-psa/psa-clause-flagger.js';

describe('psa-clause-flagger', () => {
  it('flags missing titleObjectionMechanic as critical (universal)', () => {
    const flags = flagPSAClauses({ clauses: [], jurisdiction: 'US' });
    const t = flags.find((f) => f.key === 'titleObjectionMechanic');
    expect(t?.riskLevel).toBe('critical');
    expect(t?.present).toBe(false);
  });

  it('marks present + buyer-favorable clause as low risk', () => {
    const flags = flagPSAClauses({
      clauses: [
        { key: 'titleObjectionMechanic', present: true, buyerFavorable: true },
      ],
      jurisdiction: 'US',
    });
    const t = flags.find((f) => f.key === 'titleObjectionMechanic');
    expect(t?.riskLevel).toBe('low');
  });

  it('escalates risk band when clause present but seller-favorable', () => {
    const flags = flagPSAClauses({
      clauses: [
        { key: 'titleObjectionMechanic', present: true, buyerFavorable: false },
      ],
      jurisdiction: 'US',
    });
    const t = flags.find((f) => f.key === 'titleObjectionMechanic');
    expect(t?.riskLevel).toBe('critical');
  });

  it('LBP disclosure only flagged in US', () => {
    const us = flagPSAClauses({ clauses: [], jurisdiction: 'US' });
    expect(us.some((f) => f.key === 'lbpDisclosure')).toBe(true);
    const ke = flagPSAClauses({ clauses: [], jurisdiction: 'KE' });
    expect(ke.some((f) => f.key === 'lbpDisclosure')).toBe(false);
  });

  it('KE spousal consent flagged for KE deals', () => {
    const ke = flagPSAClauses({ clauses: [], jurisdiction: 'KE' });
    const spousal = ke.find((f) => f.key === 'spousalConsentKE');
    expect(spousal).toBeDefined();
    expect(spousal?.riskLevel).toBe('critical');
  });

  it('TZ family-trust flag appears for TZ, not for KE/UG', () => {
    expect(
      flagPSAClauses({ clauses: [], jurisdiction: 'TZ' }).some(
        (f) => f.key === 'familyTrustTZ',
      ),
    ).toBe(true);
    expect(
      flagPSAClauses({ clauses: [], jurisdiction: 'KE' }).some(
        (f) => f.key === 'familyTrustTZ',
      ),
    ).toBe(false);
  });

  it('UG customary release flag appears only for UG', () => {
    expect(
      flagPSAClauses({ clauses: [], jurisdiction: 'UG' }).some(
        (f) => f.key === 'customaryReleaseUG',
      ),
    ).toBe(true);
  });

  it('ancestral release flag applies to KE, TZ, UG only', () => {
    expect(
      flagPSAClauses({ clauses: [], jurisdiction: 'KE' }).some(
        (f) => f.key === 'ancestralRelease',
      ),
    ).toBe(true);
    expect(
      flagPSAClauses({ clauses: [], jurisdiction: 'US' }).some(
        (f) => f.key === 'ancestralRelease',
      ),
    ).toBe(false);
  });
});
