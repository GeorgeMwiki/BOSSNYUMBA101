/**
 * Client-side API helper used by HQ pages migrated from the deprecated
 * admin-portal app.
 *
 * The admin-platform-portal serves staff-only routes; the bearer token
 * is read from sessionStorage if present (the login flow stores it
 * there). Requests target the api-gateway directly via
 * NEXT_PUBLIC_API_URL.
 */

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

function getApiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) {
    const trimmed = configured.replace(/\/$/, '');
    return trimmed.endsWith('/api/v1') ? trimmed : `${trimmed}/api/v1`;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'admin-platform-portal: NEXT_PUBLIC_API_URL is required in production builds.'
    );
  }
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:4000/api/v1';
  }
  return '/api/v1';
}

const API_BASE = getApiBase();

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  // TODO(auth-migration): the platform session is held in an httpOnly
  // cookie set by the identity service; sessionStorage is only used by
  // legacy admin-portal calls. Send credentials so the cookie reaches
  // the gateway.
  const token =
    typeof window !== 'undefined'
      ? window.sessionStorage.getItem('platform_token') ??
        window.localStorage.getItem('admin_token')
      : null;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    let parsed: { data?: T; error?: { message?: string }; message?: string };
    try {
      parsed = (await response.json()) as typeof parsed;
    } catch {
      parsed = {};
    }

    if (!response.ok) {
      return {
        success: false,
        error: parsed.error?.message ?? parsed.message ?? `HTTP ${response.status}`,
      };
    }

    return { success: true, data: parsed.data as T };
  } catch (error) {
    console.error('Platform API request failed:', error);
    return { success: false, error: 'Network error' };
  }
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),
  post: <T>(endpoint: string, data: unknown) =>
    request<T>(endpoint, { method: 'POST', body: JSON.stringify(data) }),
  put: <T>(endpoint: string, data: unknown) =>
    request<T>(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
  patch: <T>(endpoint: string, data: unknown) =>
    request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};

export function formatCurrency(
  amount: number,
  currency = 'USD',
  locale = 'en'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date, locale = 'en'): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}
