/**
 * Regression tests for round-3 finding C-2 (CRITICAL): open redirect
 * on admin-platform-portal `?next=` param.
 *
 * Each rejection case is taken from the audit: external hosts,
 * protocol-relative URLs, back-slash bypass, `javascript:`, `data:`.
 */

import { describe, expect, it } from 'vitest';
import { safeRedirectTarget, isSafeRedirectTarget } from '../safe-redirect';

describe('safeRedirectTarget — accepts', () => {
  it('a root-relative path', () => {
    expect(safeRedirectTarget('/')).toBe('/');
    expect(safeRedirectTarget('/dashboard')).toBe('/dashboard');
    expect(safeRedirectTarget('/customers/123?tab=notes')).toBe(
      '/customers/123?tab=notes',
    );
  });

  it('a path with a fragment', () => {
    expect(safeRedirectTarget('/settings#mfa')).toBe('/settings#mfa');
  });
});

describe('safeRedirectTarget — rejects', () => {
  it.each([
    ['external https URL', 'https://evil-bossnyumba.com/phish'],
    ['external http URL', 'http://evil-bossnyumba.com/phish'],
    ['protocol-relative URL', '//evil-bossnyumba.com/phish'],
    ['back-slash bypass', '/\\evil-bossnyumba.com/phish'],
    ['javascript: scheme', 'javascript:alert(document.cookie)'],
    ['JaVaScRiPt: mixed-case scheme', 'JaVaScRiPt:alert(1)'],
    ['data: scheme', 'data:text/html,<script>alert(1)</script>'],
    ['file: scheme', 'file:///etc/passwd'],
    ['relative path (no leading slash)', 'dashboard'],
    ['empty string', ''],
    ['CR injection', '/dashboard\r\nLocation: https://evil'],
    ['LF injection', '/dashboard\nSet-Cookie: evil'],
  ])('rejects %s and returns the fallback', (_label, input) => {
    expect(safeRedirectTarget(input, '/fallback')).toBe('/fallback');
    expect(isSafeRedirectTarget(input)).toBe(false);
  });

  it('rejects null / undefined', () => {
    expect(safeRedirectTarget(null)).toBe('/');
    expect(safeRedirectTarget(undefined)).toBe('/');
    expect(isSafeRedirectTarget(null)).toBe(false);
    expect(isSafeRedirectTarget(undefined)).toBe(false);
  });
});
