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
    // M-13: defer the redirect so any in-flight React Query / SSE listener
    // has a chance to settle its onError before the page unloads. Without
    // this, the synchronous `window.location.href = …` raced React Query's
    // error pipeline, leaving dangling subscriptions in StrictMode dev
    // and occasional Sentry "unmounted setState" warnings in prod.
    //
    // We also broadcast an `auth:unauthorized` event so AuthContext can
    // clear local state synchronously (without owning the navigation
    // policy here).
    localStorage.removeItem('token');
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      } catch {
        // CustomEvent unsupported (old browsers / SSR sandbox) — ignore.
      }
      // Schedule navigation on the next macrotask so the current
      // request/response chain unwinds cleanly first.
      setTimeout(() => {
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }, 0);
    }
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
