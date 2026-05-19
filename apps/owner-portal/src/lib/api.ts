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

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('token');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('token');
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

/**
 * The defence-in-depth display fallback for the owner-portal UI when no
 * tenant currency has been resolved yet. AM-4 hardcoded-fallback-purge:
 * this constant is kept as an explicit, named exception (UX always
 * trumps a crash for display concerns), with a one-shot dev-only warning
 * to nudge callers towards passing real tenant currency.
 */
export const EMERGENCY_DISPLAY_FALLBACK_CURRENCY = 'USD';

let _warnedMissingCurrency = false;

// Formatting utilities — locale and currency come from the tenant's
// region config at render time. Callers SHOULD pass the resolved
// currency from tenant/user context (`useCurrencyPreference` or
// `useTenant`). The optional default is a defence-in-depth literal
// only; calling without a currency logs a one-shot dev warning.
export function formatCurrency(
  amount: number,
  currency?: string,
  locale = 'en',
): string {
  const resolved = currency ?? EMERGENCY_DISPLAY_FALLBACK_CURRENCY;
  if (!currency && !_warnedMissingCurrency && process.env.NODE_ENV !== 'production') {
    _warnedMissingCurrency = true;
    // eslint-disable-next-line no-console
    console.warn(
      '[owner-portal/api] formatCurrency called without an explicit currency — ' +
        'callers should thread tenant currency through. Falling back to ' +
        `${EMERGENCY_DISPLAY_FALLBACK_CURRENCY} this once.`,
    );
  }
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: resolved,
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
