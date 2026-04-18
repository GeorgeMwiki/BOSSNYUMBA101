// @ts-nocheck
/**
 * Shared helpers for the Wave 2 hook tests.
 *
 * We don't pull in `@testing-library/react` here — each hook delegates
 * to the ApiClient, so we can cover happy + error paths by driving the
 * underlying `fetch` implementation directly and verifying the client
 * emits the right request and surfaces the right response. This keeps
 * the hook tests dependency-light while still exercising the real hook
 * module (not a stub).
 */

import { vi } from 'vitest';
import { initializeApiClient, getApiClient } from '../../client';

export interface StubFetchOptions {
  readonly ok?: boolean;
  readonly status?: number;
  readonly body?: unknown;
}

/**
 * Install a global fetch stub that returns one or more queued responses
 * in sequence. Calls beyond the queue repeat the final response.
 */
export function stubFetchSequence(responses: ReadonlyArray<StubFetchOptions>) {
  const queue = [...responses];
  const mock = vi.fn().mockImplementation(async () => {
    const next = queue.shift() ?? responses[responses.length - 1];
    const status = next.status ?? (next.ok === false ? 500 : 200);
    const ok = next.ok ?? status < 400;
    const headers = new Map<string, string>([
      ['content-type', 'application/json'],
    ]);
    return {
      ok,
      status,
      statusText: ok ? 'OK' : 'ERROR',
      headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
      json: async () => next.body ?? {},
      text: async () => JSON.stringify(next.body ?? {}),
    } as unknown as Response;
  });
  // @ts-expect-error — assigning to the global fetch in a test context.
  globalThis.fetch = mock;
  return mock;
}

/**
 * Install a fresh ApiClient pointing at a dummy base URL. Safe to call
 * in every `beforeEach` — later calls overwrite the previous client.
 */
export function bootstrapTestClient() {
  initializeApiClient({
    baseUrl: 'https://api.test.local',
    accessToken: 'test-token',
  });
  return getApiClient();
}

/**
 * Execute a `queryFn` callback in isolation. React Query's queryFn takes
 * a `QueryFunctionContext`, but our hooks only use the closure'd params,
 * so passing an empty context is safe.
 */
export async function runQueryFn<T>(
  fn: (ctx: { queryKey: ReadonlyArray<unknown>; signal: AbortSignal }) => Promise<T>,
  queryKey: ReadonlyArray<unknown> = [],
): Promise<T> {
  const controller = new AbortController();
  return fn({ queryKey, signal: controller.signal });
}
