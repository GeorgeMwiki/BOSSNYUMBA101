/**
 * Tests for the region policy bundle.
 *
 * These tests pin the policy table against accidental drift. Anyone
 * editing region-policy.ts MUST keep these passing.
 */

import { describe, it, expect } from 'vitest';
import { Region, Language, FiscalAuthority } from '@bossnyumba/domain-models';
import {
  getUserPolicy,
  isSubprocessorBlockedForRegion,
  getOrgFiscalPolicy,
  requiresFiscalSubmission,
} from '../region-policy';

describe('getUserPolicy', () => {
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

describe('isSubprocessorBlockedForRegion', () => {
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

describe('getOrgFiscalPolicy', () => {
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

describe('requiresFiscalSubmission', () => {
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

describe('user vs org region independence', () => {
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
