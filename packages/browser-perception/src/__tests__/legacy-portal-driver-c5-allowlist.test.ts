/**
 * C5 closure regression: `LegacyPortalDriver.act({verb: 'navigate'})`
 * MUST refuse navigation outside the configured allowlist.
 *
 * Threat model: the driver reads a11y trees FROM external pages, so a
 * prompt-injected brain could emit `navigate http://169.254.169.254/...`
 * and pivot to IMDS via the browser process. The allowlist + scheme
 * gate prevent that.
 *
 * Also covers H25: `findRoleByName` must NOT `new RegExp(...)` on a
 * brain-supplied string (ReDoS surface).
 */

import { describe, it, expect, vi } from 'vitest';
import {
  LegacyPortalDriver,
  NavigationBlockedError,
  assertNavigationAllowed,
  type DrivablePage,
} from '../legacy-portal-driver.js';
import type { RawAxNode } from '../axtree-snapshot.js';

function makePage(snapshots: RawAxNode[]): { page: DrivablePage; goto: ReturnType<typeof vi.fn> } {
  const goto = vi.fn(async () => undefined);
  let i = 0;
  const accessibility = {
    snapshot: vi.fn(async () => {
      const next = snapshots[Math.min(i, snapshots.length - 1)];
      i += 1;
      return next;
    }),
  };
  const page: DrivablePage = {
    url: () => 'https://itax.kra.go.ke/',
    accessibility,
    goto,
  };
  return { page, goto };
}

const SAMPLE: RawAxNode = {
  role: 'WebArea',
  name: 'iTax',
  children: [{ role: 'button', name: 'Login' }],
};

describe('assertNavigationAllowed — pure gate', () => {
  it('rejects file:// scheme', () => {
    expect(() =>
      assertNavigationAllowed('file:///etc/passwd', {
        allowlist: ['itax.kra.go.ke'],
      }),
    ).toThrow(NavigationBlockedError);
  });

  it('rejects data: scheme', () => {
    expect(() =>
      assertNavigationAllowed('data:text/html,<script>x</script>', {
        allowlist: ['itax.kra.go.ke'],
      }),
    ).toThrow(/scheme-denied/);
  });

  it('rejects javascript: scheme', () => {
    expect(() =>
      assertNavigationAllowed('javascript:alert(1)', {
        allowlist: ['itax.kra.go.ke'],
      }),
    ).toThrow(/scheme-denied/);
  });

  it('rejects empty allowlist — explicit deny-all', () => {
    expect(() =>
      assertNavigationAllowed('https://itax.kra.go.ke/', { allowlist: [] }),
    ).toThrow(/empty/);
  });

  it('rejects host outside allowlist (IMDS)', () => {
    expect(() =>
      assertNavigationAllowed('http://169.254.169.254/latest/meta-data/', {
        allowlist: ['itax.kra.go.ke'],
      }),
    ).toThrow(/host-not-in-allowlist/);
  });

  it('allows exact host match', () => {
    expect(() =>
      assertNavigationAllowed('https://itax.kra.go.ke/file-return', {
        allowlist: ['itax.kra.go.ke'],
      }),
    ).not.toThrow();
  });

  it('allows subdomain via leading-dot entry', () => {
    expect(() =>
      assertNavigationAllowed('https://api.gepg.go.tz/lookup', {
        allowlist: ['.gepg.go.tz'],
      }),
    ).not.toThrow();
  });
});

describe('LegacyPortalDriver — openPortal SSRF gate', () => {
  it('openPortal refuses an IMDS URL even when constructor allowlist is empty', async () => {
    const { page } = makePage([SAMPLE]);
    const driver = new LegacyPortalDriver({ page, navigationAllowlist: [] });
    await expect(
      driver.openPortal('http://169.254.169.254/latest/meta-data/'),
    ).rejects.toThrow(NavigationBlockedError);
  });

  it('openPortal allows in-allowlist host', async () => {
    const { page, goto } = makePage([SAMPLE]);
    const driver = new LegacyPortalDriver({
      page,
      navigationAllowlist: ['itax.kra.go.ke'],
    });
    await driver.openPortal('https://itax.kra.go.ke/');
    expect(goto).toHaveBeenCalledWith('https://itax.kra.go.ke/');
  });

  it('act({verb:navigate}) refuses out-of-allowlist URLs', async () => {
    const { page } = makePage([SAMPLE, SAMPLE]);
    const driver = new LegacyPortalDriver({
      page,
      navigationAllowlist: ['itax.kra.go.ke'],
    });
    await driver.openPortal('https://itax.kra.go.ke/');
    const result = await driver.act({
      verb: 'navigate',
      url: 'http://169.254.169.254/latest/meta-data/',
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/host-not-in-allowlist|scheme-denied/);
  });
});

describe('LegacyPortalDriver — H25 findRoleByName ReDoS', () => {
  it('does NOT compile string patterns as RegExp', async () => {
    // A regex like `(a+)+$` on a long input causes catastrophic
    // backtracking. The driver must treat strings as LITERAL substrings.
    // We pass a string that would be a ReDoS regex; the driver should
    // do a literal includes check and resolve without hanging.
    const big: RawAxNode = {
      role: 'WebArea',
      name: 'big',
      children: [{ role: 'button', name: 'aaaaaaaaaaaaaaaaaaaab' }],
    };
    const { page } = makePage([big]);
    const driver = new LegacyPortalDriver({
      page,
      navigationAllowlist: ['itax.kra.go.ke'],
    });
    await driver.openPortal('https://itax.kra.go.ke/');
    // Literal substring 'a+' will not appear in the name; result is null
    // — but if the implementation compiled to regex it would either
    // match (regex semantics) or run for a long time on the catastrophic
    // input.
    const t0 = Date.now();
    const node = await driver.findRoleByName('button', '(a+)+$');
    const elapsed = Date.now() - t0;
    expect(node).toBeNull();
    // Should complete in well under 1s. If the implementation regressed
    // to `new RegExp('(a+)+$').test(name)` on a vulnerable input the
    // test would time out.
    expect(elapsed).toBeLessThan(1000);
  });

  it('explicit RegExp instances are still honoured', async () => {
    const { page } = makePage([SAMPLE]);
    const driver = new LegacyPortalDriver({
      page,
      navigationAllowlist: ['itax.kra.go.ke'],
    });
    await driver.openPortal('https://itax.kra.go.ke/');
    const node = await driver.findRoleByName('button', /login/i);
    expect(node?.name).toBe('Login');
  });
});
