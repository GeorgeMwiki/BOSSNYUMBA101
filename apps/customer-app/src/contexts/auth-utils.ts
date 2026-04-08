/**
 * Pure helpers shared by the customer-app AuthContext.
 *
 * Kept free of React/JSX so the same module can be unit-tested from a plain
 * Node test environment (vitest default).
 */

export const AUTH_TOKEN_KEY = 'bossnyumba:auth:token';
export const LEGACY_TOKEN_KEY = 'customer_token';
export const LEGACY_USER_KEY = 'customer_user';

export interface DecodedJwt {
  userId?: string;
  sub?: string;
  tenantId?: string;
  role?: string;
  permissions?: string[];
  propertyAccess?: string[];
  email?: string;
  exp?: number;
  iat?: number;
}

/**
 * Decode a JWT payload without verifying — the server is the source of truth.
 * Returns `null` for any malformed token.
 */
export function decodeJwt(token: string): DecodedJwt | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
    const source = padded + pad;
    const json =
      typeof atob === 'function'
        ? atob(source)
        : Buffer.from(source, 'base64').toString('binary');
    const decoded = decodeURIComponent(
      Array.from(json)
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(decoded) as DecodedJwt;
  } catch {
    return null;
  }
}

/** Returns `true` if the token's `exp` is in the past (or within `skewSeconds`). */
export function isTokenExpired(token: string, skewSeconds = 0): boolean {
  const claims = decodeJwt(token);
  if (!claims?.exp) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return claims.exp - skewSeconds <= nowSeconds;
}

export interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function writeTokenToStorage(
  storage: Storage | undefined,
  token: string,
  user: unknown | null
): void {
  if (!storage) return;
  storage.setItem(AUTH_TOKEN_KEY, token);
  storage.setItem(LEGACY_TOKEN_KEY, token);
  if (user) storage.setItem(LEGACY_USER_KEY, JSON.stringify(user));
}

export function clearTokenFromStorage(storage: Storage | undefined): void {
  if (!storage) return;
  storage.removeItem(AUTH_TOKEN_KEY);
  storage.removeItem(LEGACY_TOKEN_KEY);
  storage.removeItem(LEGACY_USER_KEY);
}

export function readTokenFromStorage(storage: Storage | undefined): string | null {
  if (!storage) return null;
  return storage.getItem(AUTH_TOKEN_KEY) ?? storage.getItem(LEGACY_TOKEN_KEY) ?? null;
}

export interface LoginResponseBody {
  success: boolean;
  data?: {
    token: string;
    user: { id: string; email?: string; firstName?: string; lastName?: string };
    tenant?: { id: string; name?: string; slug?: string };
    role?: string;
    permissions?: string[];
  };
  error?: { code?: string; message?: string };
}

export interface LoginResult {
  success: boolean;
  message?: string;
  token?: string;
  tenantId?: string;
}

/**
 * Run the login POST against `/auth/login`, validate the response, and return
 * a normalized result. Extracted for unit-testing so the component can call
 * this with an injectable `fetch`.
 */
export async function performLogin(
  baseUrl: string,
  email: string,
  password: string,
  fetchImpl: typeof fetch = fetch
): Promise<LoginResult> {
  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Network error',
    };
  }

  let body: LoginResponseBody | undefined;
  try {
    body = (await response.json()) as LoginResponseBody;
  } catch {
    body = undefined;
  }

  if (!response.ok || !body?.success || !body.data?.token) {
    return {
      success: false,
      message: body?.error?.message ?? 'Invalid email or password',
    };
  }

  const claims = decodeJwt(body.data.token);
  return {
    success: true,
    token: body.data.token,
    tenantId: body.data.tenant?.id ?? claims?.tenantId ?? undefined,
  };
}
