/**
 * Live detector for the login open-redirect guard.
 *
 * `LoginForm` reads `?next=` from the URL and later does
 * `window.location.href = next`. Without sanitisation a crafted
 * `?next=//evil.com` (or a scheme / backslash variant) would bounce a
 * freshly-authenticated HQ operator off-origin. `safeNext` must collapse
 * every off-origin value to the dashboard root and pass legitimate
 * same-origin relative paths through untouched.
 */

import { describe, expect, it } from 'vitest';

import { safeNext } from '../LoginForm';

describe('safeNext (login open-redirect guard)', () => {
  it('passes through same-origin relative paths', () => {
    expect(safeNext('/dashboard')).toBe('/dashboard');
    expect(safeNext('/ask/thread-123?tab=audit')).toBe('/ask/thread-123?tab=audit');
    expect(safeNext('/')).toBe('/');
  });

  it('falls back to "/" for a missing or empty target', () => {
    expect(safeNext(null)).toBe('/');
    expect(safeNext('')).toBe('/');
  });

  it('rejects protocol-relative URLs (//host)', () => {
    expect(safeNext('//evil.com')).toBe('/');
    expect(safeNext('//evil.com/phish')).toBe('/');
  });

  it('rejects backslash-smuggled protocol-relative URLs', () => {
    expect(safeNext('/\\evil.com')).toBe('/');
  });

  it('rejects absolute URLs with a scheme', () => {
    expect(safeNext('https://evil.com')).toBe('/');
    expect(safeNext('http://evil.com')).toBe('/');
    // eslint-disable-next-line no-script-url
    expect(safeNext('javascript:alert(1)')).toBe('/');
  });

  it('rejects values that do not start with a single slash', () => {
    expect(safeNext('dashboard')).toBe('/');
    expect(safeNext('evil.com')).toBe('/');
  });
});
