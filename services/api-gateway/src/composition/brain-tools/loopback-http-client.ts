/**
 * Loopback HTTP client for the persona-tool catalog — real-estate edition.
 *
 * Why this exists:
 *   `PersonaToolGate.httpClient` must dispatch through the SAME auth +
 *   RLS + audit + kill-switch + rate-limit gates as a browser request.
 *   This client closes the persona-tool → backend gap by issuing real
 *   loopback HTTP calls back into the same gateway process, carrying
 *   a short-lived service-bound JWT so the upstream auth middleware
 *   accepts the request and binds the tenant context for RLS.
 *
 * Why not a direct in-process function call?
 *   A direct function call would bypass `authMiddleware`,
 *   `databaseMiddleware`, kill-switch gates, the rate-limit budget,
 *   and the observability hooks. The loopback hop keeps every contract
 *   honest at the cost of one extra TCP roundtrip per tool call —
 *   well within the latency budget the tool dispatcher already absorbs.
 *
 * Hard rules respected:
 *   - No `console.*` — caller passes a Pino-compatible logger.
 *   - Service token minted from the same `JWT_SECRET` the gateway uses
 *     for its auth middleware so a leak limits to the gateway's own
 *     trust boundary.
 *   - Token TTL is short (30s) — each tool call mints fresh.
 *   - Errors throw — the caller surfaces them to the dispatcher's
 *     denial path.
 *
 * Ported from Borjie's `loopback-http-client.ts` (commit d45798c3) —
 * the only retailoring is the loopback header (`x-bossnyumba-loopback`
 * replaces `x-borjie-loopback`).
 */

import { AsyncLocalStorage } from 'node:async_hooks';

import { SignJWT } from 'jose';

import type { PersonaToolHttpClient } from './types.js';

/**
 * AsyncLocalStorage that threads the per-tool-call tenant / actor
 * context through the loopback client without touching every persona-
 * tool callsite. The `toBrainToolHandler()` adapter wraps each handler
 * dispatch in `runWithLoopbackContext()` so any nested `httpClient.*`
 * call resolves the matching identity.
 *
 * Why ALS rather than passing context through the client method
 * signature: each persona-tool source file invokes
 * `ctx.httpClient.get/post(...)` dozens of times — changing the method
 * shape touches every line. ALS keeps the surface API identical.
 */
const loopbackContextStorage = new AsyncLocalStorage<{
  readonly tenantId: string;
  readonly actorId: string;
}>();

export function runWithLoopbackContext<T>(
  context: { readonly tenantId: string; readonly actorId: string },
  fn: () => T,
): T {
  return loopbackContextStorage.run(context, fn);
}

export function getLoopbackContext():
  | { readonly tenantId: string; readonly actorId: string }
  | undefined {
  return loopbackContextStorage.getStore();
}

export interface LoopbackClientOptions {
  /**
   * Origin including scheme + host + port (no trailing slash). For
   * gateway loopback this is typically `http://127.0.0.1:${PORT}`.
   */
  readonly origin: string;
  /**
   * Path prefix prepended to every request — typically `/api/v1`.
   */
  readonly apiPrefix: string;
  /**
   * HS256 secret used to sign the service-bound JWT. Should be the
   * same as the gateway's `JWT_SECRET`.
   */
  readonly jwtSecret: string;
  /**
   * Optional override for context resolution. Defaults to reading from
   * the per-call AsyncLocalStorage set by `runWithLoopbackContext`.
   * Tests can pass a fixed identity here.
   */
  readonly resolveContext?: () => {
    readonly tenantId: string;
    readonly actorId: string;
  };
  /**
   * Optional Pino-style logger for warn / error events. Defaults to
   * a no-op so callers that don't need observability stay tiny.
   */
  readonly logger?: { warn: (ctx: unknown, msg: string) => void };
  /**
   * Optional fetch override (tests). Defaults to `globalThis.fetch`.
   */
  readonly fetchImpl?: typeof fetch;
}

const DEFAULT_TIMEOUT_MS = 5_000;
const TOKEN_TTL_SECONDS = 30;

function buildQuery(
  query?: Readonly<Record<string, string | number | undefined>>,
): string {
  if (!query) return '';
  const parts: string[] = [];
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined) continue;
    parts.push(
      `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
    );
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

async function mintServiceToken(
  secret: string,
  tenantId: string,
  actorId: string,
): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new SignJWT({
    sub: actorId,
    userId: actorId,
    tenantId,
    role: 'PLATFORM_ADMIN',
    src: 'persona-tool-loopback',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(key);
}

interface PerformRequestArgs {
  readonly method: 'GET' | 'POST';
  readonly path: string;
  readonly body?: Readonly<Record<string, unknown>>;
  readonly query?: Readonly<Record<string, string | number | undefined>>;
}

/**
 * Construct the persona-tool loopback HTTP client. Returns an object
 * that satisfies `PersonaToolHttpClient`.
 *
 * Throws never at construction. Per-call failures throw a structured
 * `Error` whose message embeds the upstream status; the persona-tool
 * dispatcher's catch block converts that to a tool-denial result.
 */
export function createLoopbackHttpClient(
  options: LoopbackClientOptions,
): PersonaToolHttpClient {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const baseUrl = `${options.origin}${options.apiPrefix}`;
  const log = options.logger;

  const resolveContext =
    options.resolveContext ??
    ((): { readonly tenantId: string; readonly actorId: string } => {
      const ctx = getLoopbackContext();
      if (!ctx) {
        throw new Error(
          'persona-tool loopback: no AsyncLocalStorage context bound — call runWithLoopbackContext() around tool dispatch',
        );
      }
      return ctx;
    });

  async function performRequest<T>({
    method,
    path,
    body,
    query,
  }: PerformRequestArgs): Promise<T> {
    const { tenantId, actorId } = resolveContext();
    if (!tenantId || !actorId) {
      throw new Error(
        'persona-tool loopback: tenantId + actorId required for service-token mint',
      );
    }
    const token = await mintServiceToken(
      options.jwtSecret,
      tenantId,
      actorId,
    );
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      DEFAULT_TIMEOUT_MS,
    );
    try {
      const response = await fetchImpl(
        `${baseUrl}${path}${buildQuery(query)}`,
        {
          method,
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
            'x-bossnyumba-loopback': '1',
          },
          ...(body !== undefined && { body: JSON.stringify(body) }),
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        log?.warn(
          {
            method,
            path,
            status: response.status,
            preview: text.slice(0, 200),
          },
          'persona-tool loopback: upstream non-2xx',
        );
        throw new Error(
          `persona-tool loopback ${method} ${path} → ${response.status}`,
        );
      }
      const payload = (await response.json()) as { data?: T } & T;
      // Most owner-portal handlers wrap the body as `{ success, data }`;
      // some return the data directly. Prefer `data` when present.
      if (
        payload &&
        typeof payload === 'object' &&
        'data' in payload &&
        (payload as { data?: unknown }).data !== undefined
      ) {
        return (payload as { data: T }).data;
      }
      return payload as T;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async get<T = unknown>(
      path: string,
      init?: {
        readonly query?: Readonly<
          Record<string, string | number | undefined>
        >;
      },
    ): Promise<T> {
      return performRequest<T>({
        method: 'GET',
        path,
        ...(init?.query && { query: init.query }),
      });
    },
    async post<T = unknown>(
      path: string,
      body: Readonly<Record<string, unknown>>,
    ): Promise<T> {
      return performRequest<T>({ method: 'POST', path, body });
    },
  };
}
