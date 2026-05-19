function getApiBase(): string {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, '').endsWith('/api/v1')
      ? configured.replace(/\/$/, '')
      : `${configured.replace(/\/$/, '')}/api/v1`;
  }
  // Production builds must provide VITE_API_URL — never silently fall back.
  if (import.meta.env.PROD) {
    throw new Error(
      'owner-portal: VITE_API_URL is required in production builds.'
    );
  }
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:4000/api/v1';
  }
  return '/api/v1';
}

const API_BASE = getApiBase();

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  pagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

// AM-1 — CSRF token held in memory only. The login flow updates it from
// the response body of /auth/login; the boot flow fetches it via
// /auth/csrf. NEVER persisted to localStorage (no XSS exfiltration risk
// because the matching cookie is unreadable from cross-origin scripts —
// see services/api-gateway/src/middleware/csrf.middleware.ts).
let csrfToken: string | undefined;

export function setCsrfToken(token: string | undefined): void {
  csrfToken = token;
}
export function getCsrfToken(): string | undefined {
  return csrfToken;
}

/**
 * Fetch the CSRF token from the gateway at app boot. Called once from
 * AuthContext after the initial /auth/me hydration so we have a valid
 * token in memory before any mutation runs.
 */
export async function bootstrapCsrfToken(): Promise<string | undefined> {
  try {
    const response = await fetch(`${API_BASE}/auth/csrf`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return undefined;
    const body = (await response.json()) as { data?: { csrfToken?: string } };
    if (body?.data?.csrfToken) csrfToken = body.data.csrfToken;
    return csrfToken;
  } catch {
    return undefined;
  }
}

let cookieRefreshPromise: Promise<boolean> | undefined;

/**
 * Single-flight refresh — concurrent 401s share one in-flight request to
 * /auth/refresh. The gateway rotates `bn_session` + `bn_refresh` +
 * `bn_csrf` cookies in the response; we read the new CSRF from the body.
 */
async function refreshCookieSession(): Promise<boolean> {
  if (cookieRefreshPromise) return cookieRefreshPromise;
  cookieRefreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: '{}',
      });
      if (!response.ok) return false;
      const body = (await response.json()) as { data?: { csrfToken?: string } };
      if (body?.data?.csrfToken) csrfToken = body.data.csrfToken;
      return true;
    } catch {
      return false;
    } finally {
      cookieRefreshPromise = undefined;
    }
  })();
  return cookieRefreshPromise;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  retried = false
): Promise<ApiResponse<T>> {
  // AM-1 — cookie-mode auth. No localStorage read; the browser attaches
  // the httpOnly `bn_session` cookie automatically when we set
  // `credentials: 'include'`. CSRF token rides as a header on mutations.
  const method = String(options.method ?? 'GET').toUpperCase();
  const isMutation = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(isMutation && csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 401 && !retried) {
    // Try refresh once; if it works, replay the original request.
    const refreshed = await refreshCookieSession();
    if (refreshed) {
      return request<T>(endpoint, options, true);
    }
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (response.status === 401) {
    // Second 401 after refresh — surrender.
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const data = await response.json();
  return data;
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};

// Formatting utilities — locale and currency come from the tenant's
// region config at render time. Defaults are generic so no country is
// hardcoded. UI components should call useAuth() or read tenant context
// to get the actual locale/currency and pass them in.
export function formatCurrency(amount: number, currency = 'USD', locale = 'en'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: Date | string, locale = 'en'): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string, locale = 'en'): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}
