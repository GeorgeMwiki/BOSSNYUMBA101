/**
 * Typed API Client - BOSSNYUMBA
 *
 * Full-featured HTTP client with:
 * - Type-safe requests and responses
 * - Automatic token refresh
 * - Request/response interceptors
 * - Retry logic with exponential backoff
 * - Request cancellation
 * - Offline detection
 */

import type {
  ApiResponse,
  ApiError,
  PaginationParams,
  PaginatedResponse,
  RequestConfig,
  ApiClientConfig,
  TokenPair,
  RefreshTokenFn,
} from './types';

// ============================================================================
// Types
// ============================================================================

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions extends RequestConfig {
  params?: Record<string, string | number | boolean | string[] | undefined>;
  body?: unknown;
  signal?: AbortSignal;
}

export type RequestInterceptor = (
  config: RequestOptions & { url: string; method: HttpMethod }
) => RequestOptions & { url: string; method: HttpMethod } | Promise<RequestOptions & { url: string; method: HttpMethod }>;

export type ResponseInterceptor = (
  response: Response,
  request: RequestOptions & { url: string; method: HttpMethod }
) => Response | Promise<Response>;

export type ErrorInterceptor = (
  error: ApiClientError,
  request: RequestOptions & { url: string; method: HttpMethod }
) => ApiClientError | Promise<ApiClientError>;

// ============================================================================
// Error Class
// ============================================================================

export class ApiClientError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: Record<string, unknown> | Array<Record<string, unknown>>;
  public readonly requestId?: string;
  public readonly isNetworkError: boolean;
  public readonly isTimeout: boolean;
  public readonly isRetryable: boolean;

  constructor(
    code: string,
    message: string,
    options: {
      status?: number;
      details?: Record<string, unknown> | Array<Record<string, unknown>>;
      requestId?: string;
      isNetworkError?: boolean;
      isTimeout?: boolean;
    } = {}
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = options.status || 0;
    this.details = options.details;
    this.requestId = options.requestId;
    this.isNetworkError = options.isNetworkError || false;
    this.isTimeout = options.isTimeout || false;
    this.isRetryable = this.isNetworkError || this.isTimeout || this.status >= 500;
  }

  toJSON(): ApiError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      requestId: this.requestId,
    };
  }
}

// ============================================================================
// API Client Class
// ============================================================================

export class ApiClient {
  private config: ApiClientConfig;
  private accessToken?: string;
  private refreshToken?: string;
  /** AM-1 — in-memory CSRF token. Echoed as X-CSRF-Token on mutations. */
  private csrfToken?: string;
  /** AM-1 — single-flight refresh promise so concurrent 401s share one /refresh. */
  private cookieRefreshPromise?: Promise<boolean>;
  private refreshPromise?: Promise<TokenPair>;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  private errorInterceptors: ErrorInterceptor[] = [];

  constructor(config: ApiClientConfig) {
    this.config = {
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      ...config,
    };

    if (config.accessToken) {
      this.accessToken = config.accessToken;
    }
    if (config.refreshToken) {
      this.refreshToken = config.refreshToken;
    }
    if (config.csrfToken) {
      this.csrfToken = config.csrfToken;
    }
  }

  // =========================================================================
  // AM-1 — Cookie-mode + CSRF helpers
  // =========================================================================

  /** True when the client is operating in cookie-mode (httpOnly bn_session). */
  isCookieMode(): boolean {
    return Boolean(this.config.useCookieAuth);
  }

  /** Update the in-memory CSRF token (called after /auth/login + /auth/refresh). */
  setCsrfToken(token: string | undefined): void {
    this.csrfToken = token;
  }

  getCsrfToken(): string | undefined {
    return this.csrfToken;
  }

  /**
   * Fetch a CSRF token from the gateway and stash it in memory.
   * Called at app boot or when a CSRF_TOKEN_* error indicates the
   * in-memory copy is stale.
   */
  async fetchCsrfToken(): Promise<string | undefined> {
    try {
      const response = await fetch(`${this.config.baseUrl}/auth/csrf`, {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return undefined;
      const body = (await response.json()) as { data?: { csrfToken?: string } };
      const token = body?.data?.csrfToken;
      if (token) this.csrfToken = token;
      return token;
    } catch {
      return undefined;
    }
  }

  // =========================================================================
  // Configuration Methods
  // =========================================================================

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  setRefreshToken(token: string): void {
    this.refreshToken = token;
  }

  setTokens(accessToken: string, refreshToken?: string): void {
    this.accessToken = accessToken;
    if (refreshToken) {
      this.refreshToken = refreshToken;
    }
  }

  clearTokens(): void {
    this.accessToken = undefined;
    this.refreshToken = undefined;
    this.refreshPromise = undefined;
  }

  getAccessToken(): string | undefined {
    return this.accessToken;
  }

  hasValidToken(): boolean {
    return Boolean(this.accessToken);
  }

  // =========================================================================
  // Interceptors
  // =========================================================================

  addRequestInterceptor(interceptor: RequestInterceptor): () => void {
    this.requestInterceptors.push(interceptor);
    return () => {
      const index = this.requestInterceptors.indexOf(interceptor);
      if (index > -1) {
        this.requestInterceptors.splice(index, 1);
      }
    };
  }

  addResponseInterceptor(interceptor: ResponseInterceptor): () => void {
    this.responseInterceptors.push(interceptor);
    return () => {
      const index = this.responseInterceptors.indexOf(interceptor);
      if (index > -1) {
        this.responseInterceptors.splice(index, 1);
      }
    };
  }

  addErrorInterceptor(interceptor: ErrorInterceptor): () => void {
    this.errorInterceptors.push(interceptor);
    return () => {
      const index = this.errorInterceptors.indexOf(interceptor);
      if (index > -1) {
        this.errorInterceptors.splice(index, 1);
      }
    };
  }

  // =========================================================================
  // HTTP Methods
  // =========================================================================

  async get<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path, options);
  }

  async post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, { ...options, body });
  }

  async put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', path, { ...options, body });
  }

  async patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', path, { ...options, body });
  }

  async delete<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path, options);
  }

  // =========================================================================
  // Paginated Requests
  // =========================================================================

  async list<T>(
    path: string,
    pagination?: PaginationParams,
    options?: RequestOptions
  ): Promise<PaginatedResponse<T>> {
    const params = {
      ...options?.params,
      ...(pagination?.page && { page: pagination.page }),
      ...(pagination?.pageSize && { pageSize: pagination.pageSize }),
    };

    const response = await this.get<T[]>(path, { ...options, params });

    return {
      data: response.data,
      pagination: response.pagination || {
        page: pagination?.page || 1,
        pageSize: pagination?.pageSize || 20,
        totalItems: response.data.length,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
  }

  // =========================================================================
  // Core Request Method
  // =========================================================================

  private async request<T>(
    method: HttpMethod,
    path: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    let config = { ...options, url: path, method };

    // Run request interceptors
    for (const interceptor of this.requestInterceptors) {
      config = await interceptor(config);
    }

    const { url, params, body, signal, skipAuth, timeout } = config;

    // Build URL with params
    const fullUrl = this.buildUrl(url, params);

    // Build headers (cookie-mode CSRF header is keyed off method)
    const headers = this.buildHeaders(skipAuth, method);

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutMs = timeout || this.config.timeout || 30000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // AM-1: cookie-mode sends credentials so the browser attaches the
    // httpOnly `bn_session` cookie. Legacy bearer-mode keeps the
    // pre-existing behaviour (no cookies, header only).
    const credentials: RequestCredentials | undefined = this.isCookieMode() ? 'include' : undefined;

    try {
      let response = await this.executeWithRetry(
        () =>
          fetch(fullUrl, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            signal: signal || controller.signal,
            credentials,
          }),
        options
      );

      clearTimeout(timeoutId);

      // Run response interceptors
      for (const interceptor of this.responseInterceptors) {
        response = await interceptor(response, config);
      }

      // Handle 401 — refresh and retry, then on second 401 surrender to
      // the caller-provided auth-error handler. Cookie-mode and legacy
      // bearer-mode use different refresh codepaths.
      if (response.status === 401 && !skipAuth) {
        if (this.isCookieMode()) {
          const refreshed = await this.handleCookieRefresh();
          if (refreshed) {
            return this.request<T>(method, path, { ...options, skipAuth: true });
          }
        } else if (this.refreshToken && this.config.onTokenRefresh) {
          const refreshed = await this.handleTokenRefresh();
          if (refreshed) {
            return this.request<T>(method, path, { ...options, skipAuth: true });
          }
        }
      }

      // Parse response
      return this.parseResponse<T>(response);
    } catch (error) {
      clearTimeout(timeoutId);

      let apiError = this.createError(error);

      // Run error interceptors
      for (const interceptor of this.errorInterceptors) {
        apiError = await interceptor(apiError, config);
      }

      throw apiError;
    }
  }

  // =========================================================================
  // Helper Methods
  // =========================================================================

  private buildUrl(
    path: string,
    params?: Record<string, string | number | boolean | string[] | undefined>
  ): string {
    const url = new URL(path, this.config.baseUrl);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        if (Array.isArray(value)) {
          value.forEach((v) => url.searchParams.append(key, String(v)));
        } else {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  private buildHeaders(skipAuth?: boolean, method?: HttpMethod): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (this.config.tenantId) {
      headers['X-Tenant-ID'] = this.config.tenantId;
    }

    if (this.isCookieMode()) {
      // Cookie-mode: do NOT set Authorization header (cookie is the
      // authoritative credential). Echo CSRF token on mutations so the
      // gateway's csrf.middleware.ts accepts the request.
      if (!skipAuth && method && method !== 'GET' && this.csrfToken) {
        headers['X-CSRF-Token'] = this.csrfToken;
      }
    } else if (!skipAuth && this.accessToken) {
      // Legacy bearer-mode (pre-AM-1 callers).
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    // Add custom headers
    if (this.config.headers) {
      Object.assign(headers, this.config.headers);
    }

    return headers;
  }

  private async executeWithRetry(
    fn: () => Promise<Response>,
    options: RequestOptions
  ): Promise<Response> {
    const maxRetries = options.retries ?? this.config.retries ?? 3;
    const baseDelay = options.retryDelay ?? this.config.retryDelay ?? 1000;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fn();

        // Don't retry successful responses or client errors
        if (response.ok || (response.status >= 400 && response.status < 500)) {
          return response;
        }

        // Server errors are retryable
        if (attempt < maxRetries) {
          await this.delay(baseDelay * Math.pow(2, attempt));
          continue;
        }

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry abort errors
        if (lastError.name === 'AbortError') {
          throw lastError;
        }

        // Retry network errors
        if (attempt < maxRetries) {
          await this.delay(baseDelay * Math.pow(2, attempt));
          continue;
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  private async parseResponse<T>(response: Response): Promise<ApiResponse<T>> {
    if (!response.ok) {
      let errorData: { error?: ApiError; code?: string; message?: string };

      try {
        errorData = await response.json();
      } catch {
        throw new ApiClientError('UNKNOWN_ERROR', response.statusText || 'Request failed', {
          status: response.status,
        });
      }

      const error: Partial<ApiError> = errorData.error ?? errorData;
      throw new ApiClientError(error.code || 'UNKNOWN_ERROR', error.message || 'Request failed', {
        status: response.status,
        details: error.details,
        requestId: response.headers.get('X-Request-ID') || undefined,
      });
    }

    // Handle empty responses
    if (response.status === 204 || response.headers.get('Content-Length') === '0') {
      return { success: true, data: undefined as T };
    }

    const data = await response.json();

    // Handle different response formats
    if ('success' in data) {
      return data as ApiResponse<T>;
    }

    return {
      success: true,
      data: data.data ?? data,
      pagination: data.pagination ?? data.meta,
    };
  }

  /**
   * AM-1 — cookie-mode token refresh.
   *
   * On a 401 the client calls /api/v1/auth/refresh which rotates the
   * `bn_session` + `bn_refresh` cookies server-side. We update the
   * in-memory CSRF token from the response body, then signal the caller
   * to retry. Single-flight: concurrent 401s share one in-flight refresh.
   */
  private async handleCookieRefresh(): Promise<boolean> {
    if (this.cookieRefreshPromise) {
      return this.cookieRefreshPromise;
    }
    this.cookieRefreshPromise = (async () => {
      try {
        const response = await fetch(`${this.config.baseUrl}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: '{}',
        });
        if (!response.ok) {
          // Refresh failed (refresh-cookie expired / revoked / missing).
          this.config.onAuthError?.();
          return false;
        }
        const body = (await response.json()) as { data?: { csrfToken?: string } };
        if (body?.data?.csrfToken) this.csrfToken = body.data.csrfToken;
        return true;
      } catch {
        this.config.onAuthError?.();
        return false;
      } finally {
        this.cookieRefreshPromise = undefined;
      }
    })();
    return this.cookieRefreshPromise;
  }

  private async handleTokenRefresh(): Promise<boolean> {
    if (!this.refreshToken || !this.config.onTokenRefresh) {
      return false;
    }

    // Prevent multiple simultaneous refresh attempts
    if (this.refreshPromise) {
      try {
        const tokens = await this.refreshPromise;
        this.setTokens(tokens.accessToken, tokens.refreshToken);
        return true;
      } catch {
        return false;
      }
    }

    this.refreshPromise = this.config.onTokenRefresh(this.refreshToken);

    try {
      const tokens = await this.refreshPromise;
      this.setTokens(tokens.accessToken, tokens.refreshToken);
      return true;
    } catch {
      this.clearTokens();
      this.config.onAuthError?.();
      return false;
    } finally {
      this.refreshPromise = undefined;
    }
  }

  private createError(error: unknown): ApiClientError {
    if (error instanceof ApiClientError) {
      return error;
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return new ApiClientError('TIMEOUT', 'Request timed out', {
          isTimeout: true,
        });
      }

      // Network error
      if (error.message === 'Failed to fetch' || error.message.includes('network')) {
        return new ApiClientError('NETWORK_ERROR', 'Network error - please check your connection', {
          isNetworkError: true,
        });
      }

      return new ApiClientError('UNKNOWN_ERROR', error.message);
    }

    return new ApiClientError('UNKNOWN_ERROR', 'An unexpected error occurred');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let defaultClient: ApiClient | null = null;

export function initializeApiClient(config: ApiClientConfig): ApiClient {
  defaultClient = new ApiClient(config);
  return defaultClient;
}

export function getApiClient(): ApiClient {
  if (!defaultClient) {
    throw new Error('API client not initialized. Call initializeApiClient first.');
  }
  return defaultClient;
}

export function hasApiClient(): boolean {
  return defaultClient !== null;
}

// ============================================================================
// Factory Function
// ============================================================================

export function createApiClient(config: ApiClientConfig): ApiClient {
  return new ApiClient(config);
}

// Re-export types
export type { ApiClientConfig, ApiResponse, ApiError, PaginationParams, PaginatedResponse };
