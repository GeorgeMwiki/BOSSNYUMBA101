import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_DOMAIN_GROUPS,
  isDomainAllowed,
  normalizeAllowedDomains,
} from './domain-allowlist.js';

describe('normalizeAllowedDomains', () => {
  it('lowercases and dedupes', () => {
    const norm = normalizeAllowedDomains(['Foo.COM', 'foo.com', 'BAR.io']);
    expect(norm).toEqual(['foo.com', 'bar.io']);
  });

  it('strips https:// scheme + trailing slash', () => {
    const norm = normalizeAllowedDomains(['https://itax.kra.go.ke/']);
    expect(norm).toEqual(['itax.kra.go.ke']);
  });

  it('drops empty entries', () => {
    const norm = normalizeAllowedDomains(['  ', '', 'kra.go.ke']);
    expect(norm).toEqual(['kra.go.ke']);
  });
});

describe('isDomainAllowed', () => {
  const allow = ['itax.kra.go.ke', 'kcbgroup.com'];

  it('allows exact host match', () => {
    expect(isDomainAllowed('https://itax.kra.go.ke/login', allow)).toBe(true);
  });

  it('allows subdomains via trailing dot rule', () => {
    expect(isDomainAllowed('https://api.kcbgroup.com/x', allow)).toBe(true);
  });

  it('blocks unrelated hosts', () => {
    expect(isDomainAllowed('https://evil.com/sneaky', allow)).toBe(false);
  });

  it('handles malformed URLs as not allowed', () => {
    expect(isDomainAllowed('not-a-url', allow)).toBe(false);
  });
});

describe('BUILT_IN_DOMAIN_GROUPS', () => {
  it('exposes KRA, banks and vendor-portals groups', () => {
    expect(BUILT_IN_DOMAIN_GROUPS.kra.length).toBeGreaterThan(0);
    expect(BUILT_IN_DOMAIN_GROUPS.banks.length).toBeGreaterThan(0);
    expect(BUILT_IN_DOMAIN_GROUPS['vendor-portals']).toEqual([]);
  });

  it('KRA group includes itax.kra.go.ke', () => {
    expect(BUILT_IN_DOMAIN_GROUPS.kra).toContain('itax.kra.go.ke');
  });
});
