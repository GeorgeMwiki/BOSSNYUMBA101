/**
 * `withSecurityEvents` — HOF wrapper for route handlers that emits a
 * structured SecurityEvent on every state-changing call.
 *
 * Closes the gap surfaced by `scripts/security-route-coverage.mjs` —
 * the CI gate fails any PR whose mutation routes don't wrap with this
 * helper. Required for SOC 2 CC7.2 (logging) + GDPR Art. 30 (records
 * of processing) + an auditable chain of custody on every write.
 *
 * Usage (Hono):
 *
 *   import { withSecurityEvents } from '@bossnyumba/observability';
 *
 *   app.post('/leases', withSecurityEvents({
 *     action: 'lease.create',
 *     resource: 'lease',
 *     severity: 'info',
 *   }, async (c) => {
 *     // existing handler body
 *   }));
 *
 * Usage (Next.js route.ts):
 *
 *   export const POST = withSecurityEventsNextRoute({
 *     action: 'payment.create',
 *     resource: 'payment',
 *     severity: 'notice',
 *   }, async (req) => { ... });
 *
 * The sink is pluggable. The default sink writes to stdout in JSON
 * lines so an OTel collector or fluentd can scoop them up; production
 * wires a Postgres sink + a Kafka tap.
 */

// ────────────────────────────────────────────────────────────────────
// Event shape — exhaustive on purpose. Auditors prefer 1 verbose
// event over 5 thin ones.
// ────────────────────────────────────────────────────────────────────

export type SecurityEventSeverity = 'info' | 'notice' | 'warn' | 'critical';

export interface SecurityEvent {
  /** ISO-8601 instant the request was received. */
  readonly at: string;
  /** "<resource>.<verb>" — stable identifier for grep + aggregation. */
  readonly action: string;
  /** Top-level resource the request touches (e.g. 'lease', 'payment'). */
  readonly resource: string;
  /** Severity drives alert routing — `critical` pages SRE. */
  readonly severity: SecurityEventSeverity;
  /** HTTP verb of the inbound request. */
  readonly method: string;
  /** Route path with parameters substituted ('/leases/:id'). */
  readonly route: string;
  /** Resolved tenant — empty when the request was unauthenticated. */
  readonly tenantId: string | null;
  /** Resolved acting user — empty when unauthenticated. */
  readonly actorId: string | null;
  /** HTTP status the handler eventually returned. */
  readonly responseStatus: number;
  /** Wall-clock latency in ms. */
  readonly latencyMs: number;
  /** True if the handler threw (or returned 5xx). */
  readonly errored: boolean;
  /** Free-form payload for the resource id, before/after diffs, etc. */
  readonly detail: Record<string, unknown>;
  /** Request id propagated from upstream when present. */
  readonly correlationId: string | null;
  /** Remote IP (proxy-stripped when available). */
  readonly clientIp: string | null;
}

export type SecurityEventSink = (event: SecurityEvent) => void | Promise<void>;

let activeSink: SecurityEventSink = defaultStdoutSink;

export function setSecurityEventSink(sink: SecurityEventSink): void {
  activeSink = sink;
}

export function getSecurityEventSink(): SecurityEventSink {
  return activeSink;
}

export function resetSecurityEventSink(): void {
  activeSink = defaultStdoutSink;
}

function defaultStdoutSink(event: SecurityEvent): void {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ...event, source: 'security-events' }));
}

// ────────────────────────────────────────────────────────────────────
// Wrappers — one per supported runtime. They all funnel into
// `recordSecurityEvent(...)`.
// ────────────────────────────────────────────────────────────────────

export interface SecurityEventBinding {
  readonly action: string;
  readonly resource: string;
  readonly severity?: SecurityEventSeverity;
  /** Optional detail extractor — runs after the handler completes. */
  readonly extractDetail?: (ctx: unknown, result: unknown) => Record<string, unknown>;
}

/**
 * Hono wrapper — `c` is the Hono Context. Resolves `tenantId` and
 * `actorId` from `c.get(...)` if the upstream auth middleware set them.
 */
export function withSecurityEvents<C extends HonoContextLike, R>(
  binding: SecurityEventBinding,
  handler: (c: C) => Promise<R> | R,
): (c: C) => Promise<R> {
  return async (c: C): Promise<R> => {
    const started = performance.now();
    let result: R | undefined;
    let errored = false;
    let thrown: unknown;
    try {
      result = await handler(c);
      return result;
    } catch (err) {
      errored = true;
      thrown = err;
      throw err;
    } finally {
      const latencyMs = performance.now() - started;
      const req = c.req;
      const detail = binding.extractDetail?.(c, result) ?? {};
      const evt: SecurityEvent = {
        at: new Date().toISOString(),
        action: binding.action,
        resource: binding.resource,
        severity: binding.severity ?? 'info',
        method: req.method,
        route: req.routePath ?? req.path ?? 'unknown',
        tenantId: safeGet(c, 'tenantId'),
        actorId: safeGet(c, 'actorId'),
        responseStatus: errored ? 500 : c.res?.status ?? 200,
        latencyMs,
        errored,
        detail: {
          ...detail,
          ...(thrown ? { errorMessage: String((thrown as Error).message ?? thrown) } : {}),
        },
        correlationId: safeReqHeader(req, 'x-correlation-id') ?? safeReqHeader(req, 'x-request-id'),
        clientIp: safeReqHeader(req, 'x-forwarded-for') ?? safeReqHeader(req, 'x-real-ip'),
      };
      try {
        await activeSink(evt);
      } catch {
        // never let the sink fail the request.
      }
    }
  };
}

/**
 * Next.js App Router wrapper. The handler signature must match Next's
 * `(req: Request, ctx?) => Response | Promise<Response>`.
 */
export function withSecurityEventsNextRoute(
  binding: SecurityEventBinding,
  handler: (req: Request, ctx?: unknown) => Promise<Response> | Response,
): (req: Request, ctx?: unknown) => Promise<Response> {
  return async (req: Request, ctx?: unknown): Promise<Response> => {
    const started = performance.now();
    let response: Response | undefined;
    let errored = false;
    let thrown: unknown;
    try {
      response = await handler(req, ctx);
      return response;
    } catch (err) {
      errored = true;
      thrown = err;
      throw err;
    } finally {
      const latencyMs = performance.now() - started;
      const url = new URL(req.url);
      const evt: SecurityEvent = {
        at: new Date().toISOString(),
        action: binding.action,
        resource: binding.resource,
        severity: binding.severity ?? 'info',
        method: req.method,
        route: url.pathname,
        tenantId: req.headers.get('x-tenant-id'),
        actorId: req.headers.get('x-actor-id'),
        responseStatus: errored ? 500 : response?.status ?? 200,
        latencyMs,
        errored,
        detail: thrown
          ? { errorMessage: String((thrown as Error).message ?? thrown) }
          : (binding.extractDetail?.(req, response) ?? {}),
        correlationId: req.headers.get('x-correlation-id') ?? req.headers.get('x-request-id'),
        clientIp: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
      };
      try {
        await activeSink(evt);
      } catch {
        // never let the sink fail the request.
      }
    }
  };
}

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

interface HonoContextLike {
  readonly req: {
    readonly method: string;
    readonly path?: string;
    readonly routePath?: string;
    readonly header?: (name: string) => string | null | undefined;
    readonly raw?: { readonly headers: Headers };
  };
  readonly res?: { readonly status: number };
  get(key: string): unknown;
}

function safeGet(c: HonoContextLike, key: string): string | null {
  try {
    const v = c.get(key);
    return typeof v === 'string' ? v : null;
  } catch {
    return null;
  }
}

function safeReqHeader(req: HonoContextLike['req'], name: string): string | null {
  try {
    if (typeof req.header === 'function') {
      const v = req.header(name);
      return typeof v === 'string' ? v : null;
    }
    if (req.raw?.headers) {
      return req.raw.headers.get(name);
    }
  } catch {
    // ignore
  }
  return null;
}

/** Direct emit — for code paths that aren't HTTP routes (cron, queue). */
export async function recordSecurityEvent(
  binding: Omit<SecurityEventBinding, 'extractDetail'> & {
    readonly detail?: Record<string, unknown>;
    readonly method?: string;
    readonly route?: string;
    readonly tenantId?: string | null;
    readonly actorId?: string | null;
  },
): Promise<void> {
  const evt: SecurityEvent = {
    at: new Date().toISOString(),
    action: binding.action,
    resource: binding.resource,
    severity: binding.severity ?? 'info',
    method: binding.method ?? 'INTERNAL',
    route: binding.route ?? 'internal',
    tenantId: binding.tenantId ?? null,
    actorId: binding.actorId ?? null,
    responseStatus: 200,
    latencyMs: 0,
    errored: false,
    detail: binding.detail ?? {},
    correlationId: null,
    clientIp: null,
  };
  try {
    await activeSink(evt);
  } catch {
    // never propagate
  }
}
