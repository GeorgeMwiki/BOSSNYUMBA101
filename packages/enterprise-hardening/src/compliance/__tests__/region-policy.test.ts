/**
 * Tests for the region-policy SHIM and the underlying jurisdiction
 * registry that backs it.
 *
 * The shim in `../region-policy` is @deprecated — it delegates to
 * `@bossnyumba/domain-models`'s jurisdiction registry. We test BOTH
 * surfaces here so:
 *   1. Backward-compat callers keep working through the shim, and
 *   2. The new jurisdiction API is exercised by the same expectations
 *      so seed data drift can't desync the two surfaces.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  Region,
  Language,
  FiscalAuthority,
  loadSeedJurisdictions,
  getJurisdiction,
  isSubprocessorBlocked,
  getTaxRate,
  requiresFiscalSubmission as registryRequiresFiscalSubmission,
} from '@bossnyumba/domain-models';
import {
  getUserPolicy,
  isSubprocessorBlockedForRegion,
  getOrgFiscalPolicy,
  requiresFiscalSubmission,
} from '../region-policy';

beforeAll(() => {
  // Make sure the jurisdiction registry is populated before exercising
  // either the shim or the registry directly. The shim auto-seeds, but
  // we also want the registry-direct tests below to work standalone.
  loadSeedJurisdictions();
});

// ---------------------------------------------------------------------------
// Legacy shim — must stay backward-compatible for un-migrated callers
// ---------------------------------------------------------------------------

describe('shim: getUserPolicy', () => {
  it('Tanzania policy: Swahili default, DeepSeek blocked, PDPA', () => {
    const p = getUserPolicy(Region.TANZANIA);
    expect(p.region).toBe('TZ');
    expect(p.defaultLanguage).toBe(Language.SWAHILI);
    expect(p.availableLanguages).toContain(Language.SWAHILI);
    expect(p.availableLanguages).toContain(Language.ENGLISH);
    expect(p.blockedSubprocessors).toContain('deepseek');
    expect(p.dataProtectionLaw).toMatch(/Tanzania/);
    expect(p.dataProtectionLaw).toMatch(/PDPA/);
    expect(p.requiresExplicitCookieConsent).toBe(true);
  });

  it('Kenya policy: English default, DeepSeek blocked, DPA 2019', () => {
    const p = getUserPolicy(Region.KENYA);
    expect(p.region).toBe('KE');
    expect(p.defaultLanguage).toBe(Language.ENGLISH);
    expect(p.blockedSubprocessors).toContain('deepseek');
    expect(p.dataProtectionLaw).toMatch(/Kenya/);
    expect(p.dataProtectionLaw).toMatch(/2019/);
    expect(p.requiresExplicitCookieConsent).toBe(true);
  });

  it('OTHER policy: no subprocessor blocks, GDPR fallback', () => {
    const p = getUserPolicy(Region.OTHER);
    expect(p.region).toBe('OTHER');
    expect(p.blockedSubprocessors).toEqual([]);
    expect(p.dataProtectionLaw).toMatch(/GDPR/);
  });

  it('falls back to OTHER for undefined region', () => {
    expect(getUserPolicy(undefined).region).toBe('OTHER');
    expect(getUserPolicy(null).region).toBe('OTHER');
  });

  it('every policy has stable privacy + terms doc ids', () => {
    for (const region of [Region.TANZANIA, Region.KENYA, Region.OTHER]) {
      const p = getUserPolicy(region);
      expect(p.privacyDocId).toMatch(/.+/);
      expect(p.termsDocId).toMatch(/.+/);
    }
  });
});

describe('shim: isSubprocessorBlockedForRegion', () => {
  it('blocks DeepSeek for TZ', () => {
    expect(isSubprocessorBlockedForRegion('deepseek', Region.TANZANIA)).toBe(true);
  });

  it('blocks DeepSeek for KE', () => {
    expect(isSubprocessorBlockedForRegion('deepseek', Region.KENYA)).toBe(true);
  });

  it('does NOT block DeepSeek for OTHER', () => {
    expect(isSubprocessorBlockedForRegion('deepseek', Region.OTHER)).toBe(false);
  });

  it('does NOT block OpenAI for any region', () => {
    expect(isSubprocessorBlockedForRegion('openai', Region.TANZANIA)).toBe(false);
    expect(isSubprocessorBlockedForRegion('openai', Region.KENYA)).toBe(false);
    expect(isSubprocessorBlockedForRegion('openai', Region.OTHER)).toBe(false);
  });

  it('does NOT block Anthropic for any region', () => {
    expect(isSubprocessorBlockedForRegion('anthropic', Region.TANZANIA)).toBe(false);
    expect(isSubprocessorBlockedForRegion('anthropic', Region.KENYA)).toBe(false);
  });
});

describe('shim: getOrgFiscalPolicy', () => {
  it('Tanzania: TRA, TZS, 18% VAT, 10% resident WHT, no MRI', () => {
    const p = getOrgFiscalPolicy(Region.TANZANIA);
    expect(p.fiscalCountry).toBe('TZ');
    expect(p.fiscalAuthority).toBe(FiscalAuthority.TRA);
    expect(p.defaultCurrency).toBe('TZS');
    expect(p.taxRates.vat).toBe(0.18);
    expect(p.taxRates.whtRentResident).toBe(0.10);
    expect(p.taxRates.whtRentNonResident).toBe(0.15);
    expect(p.taxRates.mri).toBeNull();
    expect(p.requiresFiscalSubmissionBeforeAuthoritative).toBe(true);
  });

  it('Kenya: KRA, KES, 16% VAT, 7.5% MRI', () => {
    const p = getOrgFiscalPolicy(Region.KENYA);
    expect(p.fiscalCountry).toBe('KE');
    expect(p.fiscalAuthority).toBe(FiscalAuthority.KRA);
    expect(p.defaultCurrency).toBe('KES');
    expect(p.taxRates.vat).toBe(0.16);
    expect(p.taxRates.mri).toBe(0.075);
    expect(p.requiresFiscalSubmissionBeforeAuthoritative).toBe(true);
  });

  it('OTHER: no fiscal authority, USD, zero rates, no submission', () => {
    const p = getOrgFiscalPolicy(Region.OTHER);
    expect(p.fiscalAuthority).toBe(FiscalAuthority.NONE);
    expect(p.defaultCurrency).toBe('USD');
    expect(p.taxRates.vat).toBe(0);
    expect(p.requiresFiscalSubmissionBeforeAuthoritative).toBe(false);
  });

  it('falls back to OTHER for undefined fiscal country', () => {
    expect(getOrgFiscalPolicy(undefined).fiscalAuthority).toBe(FiscalAuthority.NONE);
    expect(getOrgFiscalPolicy(null).fiscalAuthority).toBe(FiscalAuthority.NONE);
  });
});

describe('shim: requiresFiscalSubmission', () => {
  it('returns true for KE', () => {
    expect(requiresFiscalSubmission(Region.KENYA)).toBe(true);
  });

  it('returns true for TZ', () => {
    expect(requiresFiscalSubmission(Region.TANZANIA)).toBe(true);
  });

  it('returns false for OTHER', () => {
    expect(requiresFiscalSubmission(Region.OTHER)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(requiresFiscalSubmission(undefined)).toBe(false);
  });
});

describe('shim: user vs org region independence', () => {
  it('TZ user renting from KE landlord gets TZ user policy + KE fiscal policy', () => {
    const userP = getUserPolicy(Region.TANZANIA);
    const orgP = getOrgFiscalPolicy(Region.KENYA);

    // User-side: Tanzania PDPA, Swahili default, DeepSeek blocked
    expect(userP.dataProtectionLaw).toMatch(/Tanzania/);
    expect(userP.defaultLanguage).toBe(Language.SWAHILI);
    expect(userP.blockedSubprocessors).toContain('deepseek');

    // Org-side: KRA, KES, 16% VAT, eTIMS submission required
    expect(orgP.fiscalAuthority).toBe(FiscalAuthority.KRA);
    expect(orgP.defaultCurrency).toBe('KES');
    expect(orgP.requiresFiscalSubmissionBeforeAuthoritative).toBe(true);
  });

  it('KE user renting from TZ landlord gets KE user policy + TZ fiscal policy', () => {
    const userP = getUserPolicy(Region.KENYA);
    const orgP = getOrgFiscalPolicy(Region.TANZANIA);

    expect(userP.dataProtectionLaw).toMatch(/Kenya/);
    expect(userP.defaultLanguage).toBe(Language.ENGLISH);
    expect(orgP.fiscalAuthority).toBe(FiscalAuthority.TRA);
    expect(orgP.defaultCurrency).toBe('TZS');
  });
});

// ---------------------------------------------------------------------------
// New jurisdiction registry — the canonical source of truth
// ---------------------------------------------------------------------------

describe('jurisdiction registry: getJurisdiction', () => {
  it('returns Tanzania config keyed by ISO code', () => {
    const j = getJurisdiction('TZ');
    expect(j.countryCode).toBe('TZ');
    expect(j.defaultCurrency).toBe('TZS');
    expect(j.defaultLanguage).toBe('sw');
    expect(j.compliance.blockedSubprocessors).toContain('deepseek');
    expect(j.fiscalAuthority?.key).toBe('tra');
  });

  it('returns Kenya config keyed by ISO code', () => {
    const j = getJurisdiction('KE');
    expect(j.countryCode).toBe('KE');
    expect(j.defaultCurrency).toBe('KES');
    expect(j.fiscalAuthority?.key).toBe('kra');
  });

  it('seeds Nigeria and South Africa as expansion-ready', () => {
    expect(getJurisdiction('NG').countryCode).toBe('NG');
    expect(getJurisdiction('ZA').countryCode).toBe('ZA');
  });

  it('falls back to GLOBAL default for unknown country code', () => {
    const j = getJurisdiction('XX');
    expect(j.defaultCurrency).toBe('USD');
    expect(j.compliance.dataProtectionLaw).toMatch(/GDPR/);
  });

  it('case-insensitive lookup', () => {
    expect(getJurisdiction('tz').defaultCurrency).toBe('TZS');
    expect(getJurisdiction(' KE ').defaultCurrency).toBe('KES');
  });
});

describe('jurisdiction registry: getTaxRate', () => {
  it('returns TZ VAT 18%', () => {
    expect(getTaxRate('TZ', 'vat')).toBe(0.18);
  });

  it('returns KE MRI 7.5%', () => {
    expect(getTaxRate('KE', 'mri')).toBe(0.075);
  });

  it('returns 0 for an unknown tax key', () => {
    expect(getTaxRate('TZ', 'no_such_tax')).toBe(0);
  });
});

describe('jurisdiction registry: isSubprocessorBlocked', () => {
  it('blocks deepseek for TZ and KE', () => {
    expect(isSubprocessorBlocked('TZ', 'deepseek')).toBe(true);
    expect(isSubprocessorBlocked('KE', 'deepseek')).toBe(true);
  });

  it('does not block openai/anthropic anywhere', () => {
    expect(isSubprocessorBlocked('TZ', 'openai')).toBe(false);
    expect(isSubprocessorBlocked('KE', 'anthropic')).toBe(false);
    expect(isSubprocessorBlocked('XX', 'deepseek')).toBe(false);
  });
});

describe('jurisdiction registry: requiresFiscalSubmission', () => {
  it('TZ + RENT requires submission', () => {
    expect(registryRequiresFiscalSubmission('TZ', 'RENT')).toBe(true);
  });

  it('KE + UTILITY requires submission', () => {
    expect(registryRequiresFiscalSubmission('KE', 'UTILITY')).toBe(true);
  });

  it('NG fiscal authority is inactive — no submission required', () => {
    expect(registryRequiresFiscalSubmission('NG', 'RENT')).toBe(false);
  });

  it('unknown country — no submission required', () => {
    expect(registryRequiresFiscalSubmission('XX', 'RENT')).toBe(false);
  });
});

describe('shim<->registry parity', () => {
  it('shim VAT matches registry VAT for TZ and KE', () => {
    expect(getOrgFiscalPolicy(Region.TANZANIA).taxRates.vat).toBe(getTaxRate('TZ', 'vat'));
    expect(getOrgFiscalPolicy(Region.KENYA).taxRates.vat).toBe(getTaxRate('KE', 'vat'));
  });

  it('shim subprocessor block matches registry block', () => {
    expect(isSubprocessorBlockedForRegion('deepseek', Region.TANZANIA)).toBe(
      isSubprocessorBlocked('TZ', 'deepseek'),
    );
    expect(isSubprocessorBlockedForRegion('deepseek', Region.KENYA)).toBe(
      isSubprocessorBlocked('KE', 'deepseek'),
    );
  });
});
