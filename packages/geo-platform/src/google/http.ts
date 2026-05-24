/**
 * Shared HTTP helper for every Google Maps Platform client in this
 * package. Centralises: lazy env-key read, 10s default timeout via
 * AbortController, structured error mapping, and the rule that the
 * API key MUST NEVER appear in console logs or thrown error messages.
 *
 * Spec: `.audit/sota-2026-05-24/01-geo-platform.md` §10.
 */

import type {
  ClientCallOptions,
  ErrorResult,
  GeoErrorKind,
  GeoResult,
} from '../types.js';

export const DEFAULT_TIMEOUT_MS = 10_000;
export const GOOGLE_API_KEY_ENV = 'GOOGLE_MAPS_API_KEY';

/** Lazy read — never cache across calls so tests can stub env. */
export function readApiKey(override?: string): string | undefined {
  if (override && override.length > 0) {
    return override;
  }
  if (typeof process === 'undefined' || !process.env) {
    return undefined;
  }
  const value = process.env[GOOGLE_API_KEY_ENV];
  return value && value.length > 0 ? value : undefined;
}

export function missingKeyError(): ErrorResult {
  return {
    ok: false,
    error: {
      kind: 'missing_api_key',
      message: `${GOOGLE_API_KEY_ENV} is not configured.`,
    },
  };
}

/** Map an HTTP status code to a GeoErrorKind. */
function statusToKind(status: number): GeoErrorKind {
  if (status === 401 || status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 408) return 'timeout';
  if (status === 429) return 'rate_limited';
  return 'http_error';
}

/**
 * Compose the caller signal (optional) with an internal timeout
 * signal so the request aborts on whichever fires first.
 */
function composeSignal(
  callerSignal: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
  let onCallerAbort: (() => void) | null = null;
  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort(callerSignal.reason);
    } else {
      onCallerAbort = () => controller.abort(callerSignal.reason);
      callerSignal.addEventListener('abort', onCallerAbort, { once: true });
    }
  }
  return {
    signal: controller.signal,
    cancel: () => {
      clearTimeout(timer);
      if (callerSignal && onCallerAbort) {
        callerSignal.removeEventListener('abort', onCallerAbort);
      }
    },
  };
}

export interface FetchJsonInput {
  readonly url: string;
  readonly method?: 'GET' | 'POST';
  readonly body?: unknown;
  readonly headers?: Record<string, string>;
  readonly options?: ClientCallOptions;
}

/**
 * Perform an HTTP request and decode JSON.
 *
 * Returns a `GeoResult<T>` — never throws. Aborted, network, timeout,
 * non-2xx, and invalid-JSON responses are all mapped to the structured
 * error envelope.
 *
 * IMPORTANT: this function NEVER includes the API key in `error.message`
 * or any thrown value. Callers must also strip it from their own logs.
 */
export async function fetchJson<T>(input: FetchJsonInput): Promise<GeoResult<T>> {
  const timeoutMs = input.options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const { signal, cancel } = composeSignal(input.options?.signal, timeoutMs);

  const headers: Record<string, string> = {
    accept: 'application/json',
    ...input.headers,
  };
  if (input.body !== undefined) {
    headers['content-type'] = 'application/json';
  }

  let response: Response;
  try {
    response = await fetch(input.url, {
      method: input.method ?? 'GET',
      headers,
      body: input.body !== undefined ? JSON.stringify(input.body) : undefined,
      signal,
    });
  } catch (err) {
    cancel();
    const reason = (err as { name?: string; message?: string }) ?? {};
    if (reason.name === 'AbortError' || reason.message === 'timeout') {
      // Distinguish: if caller signal aborted, surface as aborted;
      // otherwise the timeout fired.
      if (input.options?.signal?.aborted) {
        return {
          ok: false,
          error: { kind: 'aborted', message: 'Request aborted by caller.' },
        };
      }
      return {
        ok: false,
        error: { kind: 'timeout', message: `Request exceeded ${timeoutMs}ms.` },
      };
    }
    return {
      ok: false,
      error: { kind: 'network', message: 'Network request failed.' },
    };
  }

  cancel();

  if (!response.ok) {
    return {
      ok: false,
      error: {
        kind: statusToKind(response.status),
        message: `Upstream responded with ${response.status}.`,
        status: response.status,
      },
    };
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    return {
      ok: false,
      error: { kind: 'invalid_response', message: 'Upstream returned non-JSON body.' },
    };
  }

  return { ok: true, data: parsed as T };
}

/**
 * Append `?key=...` to a URL without ever logging the key. Caller is
 * responsible for never echoing the returned URL to logs.
 */
export function withKey(baseUrl: string, key: string): string {
  const sep = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${sep}key=${encodeURIComponent(key)}`;
}
