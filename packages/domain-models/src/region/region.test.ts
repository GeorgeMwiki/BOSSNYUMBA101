/**
 * Tests for Region / Language / FiscalAuthority helpers.
 */

import { describe, it, expect } from 'vitest';
import {
  Region,
  Language,
  FiscalAuthority,
  ALL_REGIONS,
  ALL_LANGUAGES,
  isRegion,
  isLanguage,
  parseRegion,
  defaultLanguageForRegion,
  fiscalAuthorityForRegion,
} from './region';

describe('Region constants', () => {
  it('exposes TZ, KE, OTHER', () => {
    expect(Region.TANZANIA).toBe('TZ');
    expect(Region.KENYA).toBe('KE');
    expect(Region.OTHER).toBe('OTHER');
  });

  it('ALL_REGIONS contains exactly the three values', () => {
    expect([...ALL_REGIONS].sort()).toEqual(['KE', 'OTHER', 'TZ']);
  });
});

describe('isRegion', () => {
  it('accepts valid regions', () => {
    expect(isRegion('TZ')).toBe(true);
    expect(isRegion('KE')).toBe(true);
    expect(isRegion('OTHER')).toBe(true);
  });

  it('rejects invalid regions and non-strings', () => {
    expect(isRegion('US')).toBe(false);
    expect(isRegion('tz')).toBe(false); // case-sensitive type guard
    expect(isRegion(undefined)).toBe(false);
    expect(isRegion(123)).toBe(false);
  });
});

describe('parseRegion', () => {
  it.each([
    ['tz', Region.TANZANIA],
    ['TZ', Region.TANZANIA],
    ['Tanzania', Region.TANZANIA],
    ['TZA', Region.TANZANIA],
    ['ke', Region.KENYA],
    ['KE', Region.KENYA],
    ['Kenya', Region.KENYA],
    ['KEN', Region.KENYA],
    ['OTHER', Region.OTHER],
    ['  tz  ', Region.TANZANIA],
  ])('parses %s -> %s', (input, expected) => {
    expect(parseRegion(input)).toBe(expected);
  });

  it('returns undefined for unparseable', () => {
    expect(parseRegion('Mars')).toBeUndefined();
    expect(parseRegion('')).toBeUndefined();
    expect(parseRegion(null)).toBeUndefined();
    expect(parseRegion(undefined)).toBeUndefined();
  });
});

describe('Language', () => {
  it('exposes en + sw', () => {
    expect(Language.ENGLISH).toBe('en');
    expect(Language.SWAHILI).toBe('sw');
  });

  it('ALL_LANGUAGES contains both', () => {
    expect([...ALL_LANGUAGES].sort()).toEqual(['en', 'sw']);
  });

  it('isLanguage accepts en/sw, rejects others', () => {
    expect(isLanguage('en')).toBe(true);
    expect(isLanguage('sw')).toBe(true);
    expect(isLanguage('fr')).toBe(false);
    expect(isLanguage(undefined)).toBe(false);
  });
});

describe('defaultLanguageForRegion', () => {
  it('TZ -> Swahili', () => {
    expect(defaultLanguageForRegion(Region.TANZANIA)).toBe(Language.SWAHILI);
  });

  it('KE -> English', () => {
    expect(defaultLanguageForRegion(Region.KENYA)).toBe(Language.ENGLISH);
  });

  it('OTHER -> English', () => {
    expect(defaultLanguageForRegion(Region.OTHER)).toBe(Language.ENGLISH);
  });
});

describe('fiscalAuthorityForRegion', () => {
  it('KE -> KRA', () => {
    expect(fiscalAuthorityForRegion(Region.KENYA)).toBe(FiscalAuthority.KRA);
  });

  it('TZ -> TRA', () => {
    expect(fiscalAuthorityForRegion(Region.TANZANIA)).toBe(FiscalAuthority.TRA);
  });

  it('OTHER -> NONE', () => {
    expect(fiscalAuthorityForRegion(Region.OTHER)).toBe(FiscalAuthority.NONE);
  });
});
