/**
 * Tests for the customer-app AuthContext helpers.
 *
 * These exercise the JWT decode, expiry, token-storage, and login flow logic
 * that back the React context. Pure-TS so they run in vitest's default Node
 * environment without needing jsdom / testing-library.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AUTH_TOKEN_KEY,
  LEGACY_TOKEN_KEY,
  LEGACY_USER_KEY,
  clearTokenFromStorage,
  decodeJwt,
  isTokenExpired,
  performLogin,
  readTokenFromStorage,
  writeTokenToStorage,
  type Storage,
} from './auth-utils';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function base64url(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function makeJwt(payload: Record<string, unknown>): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  // Signature is never verified on the client — any string works.
  return `${header}.${body}.sig`;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function memoryStorage(): Storage & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
}

// ---------------------------------------------------------------------------
// decodeJwt
// ---------------------------------------------------------------------------

describe('decodeJwt', () => {
  it('decodes a well-formed token and surfaces tenant/user claims', () => {
    const token = makeJwt({
      userId: 'user-123',
      tenantId: 'tenant-abc',
      role: 'RESIDENT',
      permissions: ['payments:read'],
      exp: nowSeconds() + 3600,
      iat: nowSeconds(),
    });

    const claims = decodeJwt(token);

    expect(claims).not.toBeNull();
    expect(claims?.userId).toBe('user-123');
    expect(claims?.tenantId).toBe('tenant-abc');
    expect(claims?.role).toBe('RESIDENT');
    expect(claims?.permissions).toEqual(['payments:read']);
  });

  it('returns null for malformed tokens', () => {
    expect(decodeJwt('')).toBeNull();
    expect(decodeJwt('not-a-jwt')).toBeNull();
    expect(decodeJwt('a.b')).toBeNull();
    expect(decodeJwt('a.!!!.c')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isTokenExpired — "expired token triggers re-auth"
// ---------------------------------------------------------------------------

describe('isTokenExpired', () => {
  it('returns false for a token valid in the future', () => {
    const token = makeJwt({ exp: nowSeconds() + 3600 });
    expect(isTokenExpired(token)).toBe(false);
  });

  it('returns true for a token whose exp has passed', () => {
    const token = makeJwt({ exp: nowSeconds() - 10 });
    expect(isTokenExpired(token)).toBe(true);
  });

  it('treats skew window as expired', () => {
    // Expires in 30 seconds but we require 60 seconds of runway.
    const token = makeJwt({ exp: nowSeconds() + 30 });
    expect(isTokenExpired(token, 60)).toBe(true);
  });

  it('returns false when exp is missing (server will reject anyway)', () => {
    const token = makeJwt({ userId: 'x' });
    expect(isTokenExpired(token)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Storage helpers — "logout clears state"
// ---------------------------------------------------------------------------

describe('token storage helpers', () => {
  let storage: ReturnType<typeof memoryStorage>;

  beforeEach(() => {
    storage = memoryStorage();
  });

  it('writes the canonical key and the legacy compat keys', () => {
    const token = makeJwt({ userId: 'u1', tenantId: 't1', exp: nowSeconds() + 60 });
    writeTokenToStorage(storage, token, { id: 'u1', email: 'a@b.com' });

    expect(storage.getItem(AUTH_TOKEN_KEY)).toBe(token);
    expect(storage.getItem(LEGACY_TOKEN_KEY)).toBe(token);
    expect(storage.getItem(LEGACY_USER_KEY)).toBe(
      JSON.stringify({ id: 'u1', email: 'a@b.com' })
    );
  });

  it('readTokenFromStorage prefers the canonical key', () => {
    storage.setItem(AUTH_TOKEN_KEY, 'new-token');
    storage.setItem(LEGACY_TOKEN_KEY, 'old-token');
    expect(readTokenFromStorage(storage)).toBe('new-token');
  });

  it('readTokenFromStorage falls back to the legacy key', () => {
    storage.setItem(LEGACY_TOKEN_KEY, 'legacy-only');
    expect(readTokenFromStorage(storage)).toBe('legacy-only');
  });

  it('clearTokenFromStorage removes every known auth key', () => {
    writeTokenToStorage(storage, 'x.y.z', { id: 'u1' });
    clearTokenFromStorage(storage);

    expect(storage.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(storage.getItem(LEGACY_TOKEN_KEY)).toBeNull();
    expect(storage.getItem(LEGACY_USER_KEY)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// performLogin — "login success stores token" / "login failure shows error"
// ---------------------------------------------------------------------------

describe('performLogin', () => {
  const baseUrl = 'http://localhost:4000/api/v1';
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns success and a decoded tenantId on a successful login', async () => {
    const token = makeJwt({
      userId: 'user-1',
      tenantId: 'tenant-77',
      role: 'RESIDENT',
      exp: nowSeconds() + 3600,
    });

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            token,
            user: { id: 'user-1', email: 'jane@example.com', firstName: 'Jane', lastName: 'Doe' },
            tenant: { id: 'tenant-77', name: 'Acme', slug: 'acme' },
            role: 'RESIDENT',
            permissions: ['payments:read'],
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const result = await performLogin(
      baseUrl,
      'jane@example.com',
      'hunter2',
      fetchMock as unknown as typeof fetch
    );

    expect(result.success).toBe(true);
    expect(result.token).toBe(token);
    expect(result.tenantId).toBe('tenant-77');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe(`${baseUrl}/auth/login`);
    expect(calledInit.method).toBe('POST');
    const body = JSON.parse(calledInit.body as string);
    expect(body).toEqual({ email: 'jane@example.com', password: 'hunter2' });
  });

  it('returns failure with a surfaced error message on 401', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
        }),
        { status: 401, headers: { 'content-type': 'application/json' } }
      )
    );

    const result = await performLogin(
      baseUrl,
      'wrong@example.com',
      'nope',
      fetchMock as unknown as typeof fetch
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid email or password');
    expect(result.token).toBeUndefined();
  });

  it('returns failure on network errors without throwing', async () => {
    fetchMock.mockRejectedValueOnce(new Error('fetch exploded'));

    const result = await performLogin(
      baseUrl,
      'user@example.com',
      'pw',
      fetchMock as unknown as typeof fetch
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe('fetch exploded');
  });

  it('returns failure when the server returns a 200 but an unsuccessful envelope', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ success: false, error: { message: 'MFA required' } }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const result = await performLogin(
      baseUrl,
      'user@example.com',
      'pw',
      fetchMock as unknown as typeof fetch
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe('MFA required');
  });
});

// ---------------------------------------------------------------------------
// ProtectedRoute semantics — "protected route redirects when unauthenticated"
// ---------------------------------------------------------------------------
// The ProtectedRoute component itself is a thin wrapper over the
// `isAuthenticated` flag, so we assert the contract that drives it: an empty
// storage means `readTokenFromStorage` returns null, which in turn forces
// `isAuthenticated` to be false inside the context provider.

describe('ProtectedRoute authentication contract', () => {
  it('reports unauthenticated when no token is in storage', () => {
    const storage = memoryStorage();
    expect(readTokenFromStorage(storage)).toBeNull();
  });

  it('reports authenticated once a valid token is stored', () => {
    const storage = memoryStorage();
    const token = makeJwt({
      userId: 'u1',
      tenantId: 't1',
      exp: nowSeconds() + 3600,
    });
    writeTokenToStorage(storage, token, { id: 'u1' });
    const stored = readTokenFromStorage(storage);
    expect(stored).toBe(token);
    expect(isTokenExpired(stored!)).toBe(false);
  });

  it('forces re-auth when the stored token is already expired', () => {
    const storage = memoryStorage();
    const token = makeJwt({
      userId: 'u1',
      tenantId: 't1',
      exp: nowSeconds() - 1,
    });
    writeTokenToStorage(storage, token, { id: 'u1' });
    expect(isTokenExpired(readTokenFromStorage(storage)!)).toBe(true);
  });
});
