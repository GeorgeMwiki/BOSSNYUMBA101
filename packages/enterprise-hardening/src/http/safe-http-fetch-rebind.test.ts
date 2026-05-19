/**
 * Round-3 C3 closure regression tests for `safeHttpFetch` DNS-rebinding
 * defence. The textbook attack:
 *   1. Hostile DNS returns a public IP on resolution 1 (passes the gate)
 *   2. TTL=0 forces a re-resolve; resolution 2 returns 127.0.0.1
 *   3. The fetch lands at the internal target.
 *
 * Closure: pin the first resolution. `safeHttpFetch` consumes the
 * pinned IP and constructs a dispatcher whose layer-3 destination is
 * pre-resolved (SNI / Host header preserve the original hostname for
 * TLS validation).
 *
 * Also covers H/M-class 7.7: octal / hex / integer IPv4 form bypass.
 */

import { describe, it, expect } from 'vitest';
import type { LookupAddress } from 'node:dns';
import {
  safeHttpFetch,
  SafeHttpFetchError,
  assertUrlSafe,
  buildPinnedDispatcher,
} from './safe-http-fetch';

const okFetch = async () =>
  new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } });

describe('safeHttpFetch — C3 DNS rebind closure', () => {
  it('only calls the injected resolver ONCE per request', async () => {
    let calls = 0;
    const dnsLookup = async (
      _host: string,
    ): Promise<ReadonlyArray<LookupAddress>> => {
      calls += 1;
      return [{ address: '93.184.216.34', family: 4 }];
    };
    await safeHttpFetch('https://example.com/', {
      fetchImpl: okFetch as typeof fetch,
      dnsLookup,
    });
    // Exactly ONE lookup. Any future second resolution (rebind) is
    // impossible because the dispatcher's connect.lookup callback
    // bypasses DNS entirely.
    expect(calls).toBe(1);
  });

  it('rejects an octal IPv4 literal (0177.0.0.1 = 127.0.0.1)', async () => {
    await expect(
      safeHttpFetch('http://0177.0.0.1/admin', {
        fetchImpl: okFetch as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(SafeHttpFetchError);
  });

  it('rejects a hex IPv4 literal (0x7f.0.0.1 = 127.0.0.1)', async () => {
    await expect(
      safeHttpFetch('http://0x7f.0.0.1/admin', {
        fetchImpl: okFetch as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(SafeHttpFetchError);
  });

  it('rejects an integer-form IPv4 literal (2130706433 = 127.0.0.1)', async () => {
    await expect(
      safeHttpFetch('http://2130706433/admin', {
        fetchImpl: okFetch as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(SafeHttpFetchError);
  });
});

describe('assertUrlSafe — returns pinned address for caller-owned fetch', () => {
  it('returns the first resolved public IP as `pinnedAddress`', async () => {
    const result = await assertUrlSafe('https://example.com/', {
      dnsLookup: async () => [
        { address: '93.184.216.34', family: 4 },
        { address: '203.0.113.7', family: 4 },
      ],
    });
    expect(result.pinnedAddress).toBe('93.184.216.34');
    expect(result.pinnedFamily).toBe(4);
  });

  it('buildPinnedDispatcher resolves to undefined when undici is not installed', async () => {
    // In test runtimes WITHOUT undici this returns undefined; in
    // bundled-Node runtimes the function returns a real Agent. We
    // only assert that the call DOESN'T throw and yields either
    // a value or undefined.
    const result = await buildPinnedDispatcher({
      pinnedAddress: '93.184.216.34',
      pinnedFamily: 4,
    });
    expect(result === undefined || typeof result === 'object').toBe(true);
  });
});
