/**
 * humanize-error — map raw HTTP/network errors into reassuring,
 * human-readable copy for the customer-app surfaces.
 *
 * EP-4 outsized-UX improvement: every Brain/API call that touches the
 * tenant chat surface should funnel through `humanizeError` so the
 * tenant never sees a raw HTTP status code or stack trace.
 *
 * Pure functions, no React, no I/O — keeps the unit suite trivial and
 * lets the same helper run on the server (route handlers) and in the
 * browser (chat error boundaries).
 */

export interface HumanizedError {
  readonly title: string;
  readonly message: string;
  readonly retryable: boolean;
}

/**
 * Translate an HTTP status code into a tenant-friendly message.
 *
 * Anything outside the explicit map falls through to a soft generic
 * message — never expose a raw status code or backend error string.
 */
export function humanizeStatus(status: number): HumanizedError {
  if (status === 401) {
    return {
      title: 'Session expired',
      message: 'Your session expired — please sign in again.',
      retryable: false,
    };
  }
  if (status === 403) {
    return {
      title: 'Not allowed',
      message: "You don't have permission to do that.",
      retryable: false,
    };
  }
  if (status === 429) {
    return {
      title: 'Too many requests',
      message: "You've made too many requests — please slow down.",
      retryable: true,
    };
  }
  if (status >= 500 && status < 600) {
    return {
      title: 'Thinking hard',
      message: 'Our brain is thinking hard. Try again in 30s.',
      retryable: true,
    };
  }
  if (status >= 400 && status < 500) {
    return {
      title: 'Something off',
      message: "We couldn't process that request. Please try again.",
      retryable: true,
    };
  }
  return {
    title: 'Unexpected',
    message: 'Something unexpected happened. Please try again.',
    retryable: true,
  };
}

/**
 * Detect whether an unknown error value looks like a "network is
 * down" failure (no response at all from the server). Works for the
 * common shapes thrown by `fetch` and Supabase under offline.
 */
export function isNetworkError(error: unknown): boolean {
  if (error === null || error === undefined) return false;
  if (error instanceof TypeError) {
    // `fetch` throws TypeError for genuine network errors in every
    // browser. Message text varies ("Failed to fetch", "Load failed",
    // "NetworkError when attempting to fetch resource") so we accept
    // any TypeError here.
    return true;
  }
  if (typeof error === 'object' && 'message' in error) {
    const msg = String((error as { message?: unknown }).message ?? '').toLowerCase();
    if (msg.includes('network') || msg.includes('failed to fetch') || msg.includes('offline')) {
      return true;
    }
  }
  return false;
}

/**
 * High-level humanizer — accepts anything thrown by a fetch wrapper
 * and returns the customer-facing copy. Use this in chat error
 * handlers and any UI that displays an error toast.
 */
export function humanizeError(error: unknown): HumanizedError {
  if (isNetworkError(error)) {
    return {
      title: 'No connection',
      message: 'Check your connection and try again.',
      retryable: true,
    };
  }
  if (error instanceof Response) {
    return humanizeStatus(error.status);
  }
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === 'number') {
      return humanizeStatus(status);
    }
  }
  // Last resort — preserve the underlying message but never leak a
  // stack trace or backend code path to the user.
  if (error instanceof Error && error.message.length > 0 && error.message.length < 140) {
    return {
      title: 'Something off',
      message: error.message,
      retryable: true,
    };
  }
  return {
    title: 'Unexpected',
    message: 'Something unexpected happened. Please try again.',
    retryable: true,
  };
}

/**
 * Wrap a `fetch` Response and throw a humanized error if the response
 * is not OK. Use after `await fetch(...)`:
 *
 *     const res = await fetch(url);
 *     await throwIfNotOk(res);
 *     const data = await res.json();
 */
export async function throwIfNotOk(res: Response): Promise<void> {
  if (res.ok) return;
  const humanized = humanizeStatus(res.status);
  const err = new Error(humanized.message) as Error & {
    status: number;
    humanized: HumanizedError;
  };
  err.status = res.status;
  err.humanized = humanized;
  throw err;
}
