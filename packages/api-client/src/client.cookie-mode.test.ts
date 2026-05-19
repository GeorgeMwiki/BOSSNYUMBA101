/**
 * ApiClient cookie-mode tests (AM-1).
 *
 * Validates the `useCookieAuth` codepath: credentials:'include' on every
 * fetch, no Authorization header, X-CSRF-Token on mutations, and the
 * 401 → /auth/refresh → retry cycle.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiClient } from './client';

interface FetchCall {
  url: string;
  init: RequestInit;
}

function makeFetchMock(...responses: Array<{ status?: number; body?: unknown; headers?: Record<string, string> }>) {
  const calls: FetchCall[] = [];
  let i = 0;
  const fn = vi.fn(async (url: string | URL, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    const body = r?.body ?? { success: true, data: { ok: true } };
    return new Response(JSON.stringify(body), {
      status: r?.status ?? 200,
      headers: { 'Content-Type': 'application/json', ...(r?.headers ?? {}) },
    });
  });
  return { fn, calls };
}

describe('ApiClient cookie-mode (AM-1)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('emits credentials: "include" on every fetch when useCookieAuth is true', async () => {
    const { fn, calls } = makeFetchMock();
    vi.stubGlobal('fetch', fn);
    const client = new ApiClient({ baseUrl: 'https://api.test/api/v1', useCookieAuth: true });

    await client.get('/leases');

    expect(calls[0].init.credentials).toBe('include');
  });

  it('does NOT emit credentials in legacy bearer mode', async () => {
    const { fn, calls } = makeFetchMock();
    vi.stubGlobal('fetch', fn);
    const client = new ApiClient({ baseUrl: 'https://api.test/api/v1', accessToken: 'jwt' });

    await client.get('/leases');

    expect(calls[0].init.credentials).toBeUndefined();
  });

  it('omits Authorization header in cookie-mode (cookie is authoritative)', async () => {
    const { fn, calls } = makeFetchMock();
    vi.stubGlobal('fetch', fn);
    const client = new ApiClient({
      baseUrl: 'https://api.test/api/v1',
      useCookieAuth: true,
      accessToken: 'should-be-ignored-in-cookie-mode',
    });

    await client.get('/leases');

    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('echoes X-CSRF-Token on POST/PUT/PATCH/DELETE', async () => {
    const { fn, calls } = makeFetchMock();
    vi.stubGlobal('fetch', fn);
    const client = new ApiClient({
      baseUrl: 'https://api.test/api/v1',
      useCookieAuth: true,
      csrfToken: 'csrf-abc',
    });

    await client.post('/leases', { name: 'x' });
    await client.put('/leases/1', { name: 'y' });
    await client.patch('/leases/1', { name: 'z' });
    await client.delete('/leases/1');

    for (const call of calls) {
      const headers = call.init.headers as Record<string, string>;
      expect(headers['X-CSRF-Token']).toBe('csrf-abc');
    }
  });

  it('does NOT echo X-CSRF-Token on GET (safe method)', async () => {
    const { fn, calls } = makeFetchMock();
    vi.stubGlobal('fetch', fn);
    const client = new ApiClient({
      baseUrl: 'https://api.test/api/v1',
      useCookieAuth: true,
      csrfToken: 'csrf-abc',
    });

    await client.get('/leases');

    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['X-CSRF-Token']).toBeUndefined();
  });

  it('on 401 → calls /auth/refresh and retries the original request', async () => {
    const { fn, calls } = makeFetchMock(
      { status: 401, body: { success: false, error: { code: 'TOKEN_EXPIRED' } } },
      { status: 200, body: { success: true, data: { csrfToken: 'new-csrf' } } }, // /auth/refresh
      { status: 200, body: { success: true, data: { ok: true } } } // retry
    );
    vi.stubGlobal('fetch', fn);
    const client = new ApiClient({ baseUrl: 'https://api.test/api/v1', useCookieAuth: true });

    await client.get('/leases');

    expect(calls).toHaveLength(3);
    expect(calls[1].url).toBe('https://api.test/api/v1/auth/refresh');
    expect(calls[1].init.method).toBe('POST');
    expect(calls[1].init.credentials).toBe('include');
    expect(client.getCsrfToken()).toBe('new-csrf');
  });

  it('on second 401 after refresh — calls onAuthError', async () => {
    const onAuthError = vi.fn();
    const { fn } = makeFetchMock(
      { status: 401, body: { success: false } },
      { status: 401, body: { success: false } } // /auth/refresh also fails
    );
    vi.stubGlobal('fetch', fn);
    const client = new ApiClient({
      baseUrl: 'https://api.test/api/v1',
      useCookieAuth: true,
      onAuthError,
    });

    try {
      await client.get('/leases');
    } catch {
      /* expected */
    }

    expect(onAuthError).toHaveBeenCalled();
  });

  it('fetchCsrfToken populates the in-memory token from /auth/csrf', async () => {
    const { fn } = makeFetchMock({
      status: 200,
      body: { success: true, data: { csrfToken: 'bootstrap-csrf' } },
    });
    vi.stubGlobal('fetch', fn);
    const client = new ApiClient({ baseUrl: 'https://api.test/api/v1', useCookieAuth: true });

    const token = await client.fetchCsrfToken();

    expect(token).toBe('bootstrap-csrf');
    expect(client.getCsrfToken()).toBe('bootstrap-csrf');
  });

  it('setCsrfToken updates the in-memory CSRF token', () => {
    const client = new ApiClient({ baseUrl: 'https://api.test/api/v1', useCookieAuth: true });
    client.setCsrfToken('updated-token');
    expect(client.getCsrfToken()).toBe('updated-token');
  });

  it('isCookieMode reflects the config flag', () => {
    const cookie = new ApiClient({ baseUrl: 'x', useCookieAuth: true });
    const bearer = new ApiClient({ baseUrl: 'x' });
    expect(cookie.isCookieMode()).toBe(true);
    expect(bearer.isCookieMode()).toBe(false);
  });
});
