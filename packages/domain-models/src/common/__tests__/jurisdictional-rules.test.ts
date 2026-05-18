import { describe, it, expect } from 'vitest';
import {
  getJurisdictionalRules,
  listSupportedJurisdictions,
} from '../jurisdictional-rules.js';

describe('getJurisdictionalRules — Tanzania', () => {
  it('returns the TZ entry with currency, dialing code, tax authority, and VAT rate', () => {
    const rules = getJurisdictionalRules('TZ');
    expect(rules.countryCode).toBe('TZ');
    expect(rules.defaultCurrency).toBe('TZS');
    expect(rules.e164CountryCode).toBe('+255');
    expect(rules.taxAuthority.code).toBe('TRA');
    expect(rules.taxAuthority.vatRatePct).toBe(18);
  });
});

describe('getJurisdictionalRules — Kenya', () => {
  it('returns the KE entry with currency, dialing code, tax authority, and VAT rate', () => {
    const rules = getJurisdictionalRules('KE');
    expect(rules.countryCode).toBe('KE');
    expect(rules.defaultCurrency).toBe('KES');
    expect(rules.e164CountryCode).toBe('+254');
    expect(rules.taxAuthority.code).toBe('KRA');
    expect(rules.taxAuthority.vatRatePct).toBe(16);
  });
});

describe('getJurisdictionalRules — case-insensitive lookup', () => {
  it("treats 'tz' the same as 'TZ'", () => {
    const lower = getJurisdictionalRules('tz');
    const upper = getJurisdictionalRules('TZ');
    expect(lower).toBe(upper);
    expect(lower.countryCode).toBe('TZ');
    expect(lower.defaultCurrency).toBe('TZS');
  });
});

describe('getJurisdictionalRules — unknown country', () => {
  it('throws a descriptive error pointing to the registry file', () => {
    expect(() => getJurisdictionalRules('XX')).toThrowError(
      /packages\/domain-models\/src\/common\/jurisdictional-rules\.ts/
    );
    expect(() => getJurisdictionalRules('XX')).toThrowError(/'XX'/);
  });
});

describe('listSupportedJurisdictions', () => {
  it('returns the configured ISO 3166-1 alpha-2 codes', () => {
    const codes = [...listSupportedJurisdictions()].sort();
    expect(codes).toEqual(['KE', 'TZ']);
  });
});

describe('Tanzania phone regex', () => {
  it('matches a Tanzanian E.164 number and rejects a Kenyan one', () => {
    const { phoneRegex } = getJurisdictionalRules('TZ');
    expect(phoneRegex.test('+255712345678')).toBe(true);
    expect(phoneRegex.test('+254712345678')).toBe(false);
  });
});

describe('Kenyan taxpayer-id (KRA PIN) regex', () => {
  it('matches a KRA PIN in KE context and rejects it in TZ context', () => {
    const ke = getJurisdictionalRules('KE');
    const tz = getJurisdictionalRules('TZ');
    expect(ke.taxAuthority.taxpayerIdRegex.test('A123456789B')).toBe(true);
    expect(tz.taxAuthority.taxpayerIdRegex.test('A123456789B')).toBe(false);
  });
});
