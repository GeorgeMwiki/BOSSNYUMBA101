/**
 * Legacy-token scrubber tests (AM-1).
 *
 * Each test exercises one of the documented branches in
 * `legacy-token-scrubber.ts`. The fetch global is stubbed so we can
 * assert what gets POSTed to /api/v1/auth/logout-legacy-token.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { scrubLegacyTokens, hasLegacyTokens, __testing } from './legacy-token-scrubber';

const LEGACY_BEARER =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1LTEiLCJpYXQiOjE1MTYyMzkwMjJ9.fake';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('scrubLegacyTokens (AM-1)', () => {
  it('no-ops when storages are clean', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await scrubLegacyTokens({ apiBaseUrl: 'https://api.test' });

    expect(result.tokensScrubbed).toBe(0);
    expect(result.keysCleared).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('clears auth_token + customer_token + manager_token + token from localStorage', async () => {
    window.localStorage.setItem('auth_token', LEGACY_BEARER);
    window.localStorage.setItem('customer_token', LEGACY_BEARER);
    window.localStorage.setItem('manager_token', LEGACY_BEARER);
    window.localStorage.setItem('token', LEGACY_BEARER);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await scrubLegacyTokens({ apiBaseUrl: 'https://api.test' });

    expect(result.tokensScrubbed).toBe(4);
    expect(window.localStorage.getItem('auth_token')).toBeNull();
    expect(window.localStorage.getItem('customer_token')).toBeNull();
    expect(window.localStorage.getItem('manager_token')).toBeNull();
    expect(window.localStorage.getItem('token')).toBeNull();
  });

  it('also clears platform_token from sessionStorage', async () => {
    window.sessionStorage.setItem('platform_token', LEGACY_BEARER);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await scrubLegacyTokens({ apiBaseUrl: 'https://api.test' });

    expect(result.tokensScrubbed).toBe(1);
    expect(window.sessionStorage.getItem('platform_token')).toBeNull();
  });

  it('POSTs each scrubbed bearer to /auth/logout-legacy-token', async () => {
    window.localStorage.setItem('auth_token', LEGACY_BEARER);
    window.localStorage.setItem('customer_token', LEGACY_BEARER + 'X');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    await scrubLegacyTokens({ apiBaseUrl: 'https://api.test' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall[0]).toBe('https://api.test/auth/logout-legacy-token');
    expect(firstCall[1].method).toBe('POST');
    expect(firstCall[1].credentials).toBe('include');
    expect(JSON.parse(firstCall[1].body).token).toBe(LEGACY_BEARER);
  });

  it('removes legacy USER blobs (customer_user, manager_user, manager_tenant)', async () => {
    window.localStorage.setItem('customer_user', '{"id":"u-1"}');
    window.localStorage.setItem('manager_user', '{"id":"m-1"}');
    window.localStorage.setItem('manager_tenant', '{"id":"t-1"}');
    window.localStorage.setItem('lastActivity', new Date().toISOString());
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    await scrubLegacyTokens({ apiBaseUrl: 'https://api.test' });

    expect(window.localStorage.getItem('customer_user')).toBeNull();
    expect(window.localStorage.getItem('manager_user')).toBeNull();
    expect(window.localStorage.getItem('manager_tenant')).toBeNull();
    expect(window.localStorage.getItem('lastActivity')).toBeNull();
    // No tokens were scrubbed — these are user blobs, not bearers
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('idempotent — repeated invocations after a clean run are no-ops', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    const first = await scrubLegacyTokens({ apiBaseUrl: 'https://api.test' });
    const second = await scrubLegacyTokens({ apiBaseUrl: 'https://api.test' });

    expect(first.tokensScrubbed).toBe(0);
    expect(second.tokensScrubbed).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('survives network failure (fire-and-forget — return result still accurate)', async () => {
    window.localStorage.setItem('auth_token', LEGACY_BEARER);
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    // Should NOT throw — server-side blocklist is best-effort.
    const result = await scrubLegacyTokens({ apiBaseUrl: 'https://api.test' });

    expect(result.tokensScrubbed).toBe(1);
    expect(window.localStorage.getItem('auth_token')).toBeNull();
  });

  it('survives localStorage throwing (Safari private mode simulation)', async () => {
    const original = window.localStorage.getItem;
    let throws = true;
    window.localStorage.getItem = function (key: string) {
      if (throws && key === 'auth_token') {
        throws = false;
        throw new Error('QuotaExceededError');
      }
      return original.call(this, key);
    };

    const result = await scrubLegacyTokens({ apiBaseUrl: 'https://api.test' });

    expect(result).toBeDefined();
    expect(result.tokensScrubbed).toBe(0);
  });

  it('ignores values shorter than 20 chars (not bearer-shaped)', async () => {
    window.localStorage.setItem('auth_token', 'short');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await scrubLegacyTokens({ apiBaseUrl: 'https://api.test' });

    // Key is still cleared (we don't trust short values either), but no POST.
    expect(window.localStorage.getItem('auth_token')).toBeNull();
    expect(result.tokensScrubbed).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('hasLegacyTokens (AM-1)', () => {
  it('returns false on a clean device', () => {
    expect(hasLegacyTokens()).toBe(false);
  });

  it('returns true when any legacy key is set', () => {
    window.localStorage.setItem('auth_token', 'x');
    expect(hasLegacyTokens()).toBe(true);
  });

  it('returns true when sessionStorage carries a legacy key', () => {
    window.sessionStorage.setItem('platform_token', 'x');
    expect(hasLegacyTokens()).toBe(true);
  });
});

describe('__testing — legacy key registry contract', () => {
  it('LEGACY_TOKEN_KEYS includes the canonical four bearer slots', () => {
    expect(__testing.LEGACY_TOKEN_KEYS).toContain('token');
    expect(__testing.LEGACY_TOKEN_KEYS).toContain('auth_token');
    expect(__testing.LEGACY_TOKEN_KEYS).toContain('customer_token');
    expect(__testing.LEGACY_TOKEN_KEYS).toContain('manager_token');
    expect(__testing.LEGACY_TOKEN_KEYS).toContain('platform_token');
  });

  it('LEGACY_USER_KEYS includes the canonical user blobs', () => {
    expect(__testing.LEGACY_USER_KEYS).toContain('customer_user');
    expect(__testing.LEGACY_USER_KEYS).toContain('manager_user');
    expect(__testing.LEGACY_USER_KEYS).toContain('manager_tenant');
  });
});
