import { describe, it, expect } from 'vitest';
import { normaliseUrl } from '../url-normalise.js';

describe('normaliseUrl', () => {
  it('lowercases scheme and host', () => {
    expect(normaliseUrl('HTTPS://EXAMPLE.COM/Path')).toBe('https://example.com/Path');
  });
  it('strips default ports', () => {
    expect(normaliseUrl('http://example.com:80/x')).toBe('http://example.com/x');
    expect(normaliseUrl('https://example.com:443/x')).toBe('https://example.com/x');
  });
  it('keeps non-default ports', () => {
    expect(normaliseUrl('https://example.com:8443/x')).toBe('https://example.com:8443/x');
  });
  it('strips fragments', () => {
    expect(normaliseUrl('https://example.com/x#section-2')).toBe('https://example.com/x');
  });
  it('strips utm_* tracking params', () => {
    expect(normaliseUrl('https://example.com/x?utm_source=google&q=1')).toBe(
      'https://example.com/x?q=1',
    );
  });
  it('strips fbclid, gclid, msclkid', () => {
    expect(normaliseUrl('https://example.com/?fbclid=abc')).toBe('https://example.com/');
    expect(normaliseUrl('https://example.com/?gclid=abc')).toBe('https://example.com/');
  });
  it('sorts query params alphabetically', () => {
    expect(normaliseUrl('https://example.com/?z=1&a=2')).toBe('https://example.com/?a=2&z=1');
  });
  it('strips trailing slash except on root', () => {
    expect(normaliseUrl('https://example.com/foo/')).toBe('https://example.com/foo');
    expect(normaliseUrl('https://example.com/')).toBe('https://example.com/');
  });
  it('returns null for unparseable URLs', () => {
    expect(normaliseUrl('not a url')).toBeNull();
  });
  it('collapses two URLs that differ only in tracking params', () => {
    const a = normaliseUrl('https://example.com/x?utm_source=g');
    const b = normaliseUrl('https://example.com/x?utm_source=fb');
    expect(a).toEqual(b);
  });
});
