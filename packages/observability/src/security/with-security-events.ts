/**
 * withSecurityEvents — mutation-route audit wrapper.
 *
 * Phase D agent D9 → flaky-CI-closure. The Security Route Coverage gate
 * enforces that every mutating HTTP handler (POST/PUT/DELETE/PATCH)
 * emits a structured SecurityEvent so SOC 2 CC7.2 and GDPR Art. 30
 * recordkeeping are satisfied uniformly.
 *
 * This module exports three shapes so callers can adopt whichever fits
 * the host framework:
 *
 *   1. `withSecurityEvents(handler, options?)`  — per-handler HOF, used
 *      where the route already has bespoke logic (e.g. SSE streams,
 *      multipart uploads) that benefit from explicit before/after hooks.
 *
 *   2. `securityEventsMiddleware`               — Hono-style middleware,
 *      mounted ONCE at the api-gateway composition root to cover every
 *      mutating request in a single line. The middleware no-ops for
 *      idempotent verbs (GET/HEAD/OPTIONS) so read paths aren't audited
 *      twice. State-changing verbs always emit.
 *
 *   3. `recordSecurityEvent(...)`               — low-level emit helper.
 *      Used by code paths that already know the outcome (e.g. webhook
 *      signature verifiers that need to log a DENIED audit before
 *      throwing).
 *
 * Determinism + non-blocking semantics:
 *
 *   - The middleware never lets the audit emission block the request.
 *     If the configured sink rejects, the failure is captured via the
 *     onError hook so observability can alarm, but the handler's
 *     response is delivered unchanged.
 *   - Outcome is derived from the response status: 2xx → SUCCESS,
 *     401/403 → DENIED, 4xx → FAILURE, 5xx → ERROR.
 *   - The request context (method, path, IP, user-agent, tenantId,
 *     userId) is captured from Hono's `c.get('auth')` and `c.req`.
 *
 * Configuration:
 *   `initAuditLogger({ store })` must be called at boot. The middleware
 *   resolves the singleton lazily, so it's safe to import this module
 *   before boot.
 */

import type { AuditOutcome, AuditSeverity } from '../types/audit.types.js';
import { AuditSeverity as AuditSeverityEnum } from '../types/audit.types.js';
import { logAuditEvent, type AuditUser, type AuditResource } from '../audit-logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Minimal Hono-like context shape. We avoid a hard dep on `hono` so this
 * package stays usable from Express-style services too — duck-typed.
 */
export interface AuditableContext {
  req: {
    method: string;
    path?: string;
    url?: string;
    header(name: string): string | undefined;
    raw?: { headers: Headers };
  };
  res?: { status: number };
  get(key: 'auth'): unknown;
  get(key: string): unknown;
  set?(key: string, value: unknown): void;
}

export type AuditableNext = () => Promise<void> | void;

export interface WithSecurityEventsOptions {
  /**
   * Override the resource type recorded on the audit event. Defaults
   * to the first non-empty path segment (e.g. `/v1/properties/abc`
   * → `properties`).
   */
  resourceType?: string;
  /**
   * Override the resource id. Defaults to the LAST non-empty path
   * segment.
   */
  resourceIdFromPath?: boolean;
  /**
   * Hook fired when the audit emission itself fails. The original
   * response is delivered regardless.
   */
  onError?: (err: unknown) => void;
  /**
   * Skip audit emission for the current request. Use sparingly — the
   * preferred opt-out is the static allowlist at
   * `.github/security-route-allowlist.yml` which is reviewed by
   * auditors.
   */
  skip?: (ctx: AuditableContext) => boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MUTATING_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive `(resourceType, resourceId)` from the request path. Best-effort
 * — we never throw from here; if we can't classify we fall back to
 * 'unknown' so the audit record is still emitted.
 */
function deriveResource(path: string): { type: string; id: string } {
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return { type: 'unknown', id: 'root' };
  // Skip the API version prefix (v1, v2, …) and 'api' prefix if present.
  const filtered = segments.filter((s) => !/^v\d+$/i.test(s) && s !== 'api');
  const type = filtered[0] ?? segments[0] ?? 'unknown';
  const id = filtered.length > 1 ? filtered[filtered.length - 1] : 'collection';
  return { type, id };
}

function classifyOutcome(status: number): { outcome: AuditOutcome; severity: AuditSeverity } {
  if (status >= 200 && status < 300) {
    return { outcome: 'SUCCESS', severity: AuditSeverityEnum.INFO };
  }
  if (status === 401 || status === 403) {
    return { outcome: 'DENIED', severity: AuditSeverityEnum.WARNING };
  }
  if (status >= 400 && status < 500) {
    return { outcome: 'FAILURE', severity: AuditSeverityEnum.WARNING };
  }
  if (status >= 500) {
    return { outcome: 'ERROR', severity: AuditSeverityEnum.CRITICAL };
  }
  return { outcome: 'SUCCESS', severity: AuditSeverityEnum.INFO };
}

function extractUser(ctx: AuditableContext): AuditUser {
  const auth = (ctx.get('auth') ?? {}) as Record<string, unknown>;
  const ipHeader = ctx.req.header('x-forwarded-for') ?? ctx.req.header('x-real-ip');
  return {
    id: (auth.userId as string) ?? (auth.sub as string) ?? 'anonymous',
    name: (auth.displayName as string) ?? (auth.email as string) ?? undefined,
    email: (auth.email as string) ?? undefined,
    roles: Array.isArray(auth.roles) ? (auth.roles as string[]) : auth.role ? [auth.role as string] : undefined,
    ipAddress: ipHeader?.split(',')[0]?.trim(),
    userAgent: ctx.req.header('user-agent') ?? undefined,
  };
}

function getPath(ctx: AuditableContext): string {
  if (ctx.req.path) return ctx.req.path;
  if (ctx.req.url) {
    try {
      return new URL(ctx.req.url).pathname;
    } catch {
      return ctx.req.url;
    }
  }
  return '/';
}

function getStatus(ctx: AuditableContext): number {
  return ctx.res?.status ?? 200;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Per-handler HOF. Wraps a Hono handler so a SecurityEvent fires after
 * the response is produced. Errors thrown by `handler` are caught,
 * audited with outcome=ERROR, and re-thrown unchanged.
 *
 * @example
 * ```ts
 * adminRouter.post('/properties',
 *   withSecurityEvents(async (c) => {
 *     const body = await c.req.json();
 *     return c.json(await createProperty(body));
 *   }),
 * );
 * ```
 */
export function withSecurityEvents<TCtx extends AuditableContext, TResult>(
  handler: (ctx: TCtx) => Promise<TResult> | TResult,
  options: WithSecurityEventsOptions = {},
): (ctx: TCtx) => Promise<TResult> {
  return async (ctx: TCtx): Promise<TResult> => {
    const method = ctx.req.method.toUpperCase();
    const skip = options.skip?.(ctx) === true;
    let result: TResult;
    let thrown: unknown = null;
    try {
      result = await handler(ctx);
    } catch (err) {
      thrown = err;
      throw err;
    } finally {
      if (!skip && MUTATING_METHODS.has(method)) {
        const status = thrown ? 500 : getStatus(ctx);
        emit(ctx, status, options).catch((emitErr) => {
          options.onError?.(emitErr);
        });
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return result!;
  };
}

/**
 * Hono-style middleware. Mount once at the gateway root:
 *
 *   api.use('*', securityEventsMiddleware);
 *
 * Idempotent verbs (GET/HEAD/OPTIONS) pass through with zero overhead.
 */
export async function securityEventsMiddleware(
  ctx: AuditableContext,
  next: AuditableNext,
): Promise<void> {
  const method = ctx.req.method.toUpperCase();
  if (!MUTATING_METHODS.has(method)) {
    await next();
    return;
  }
  try {
    await next();
  } finally {
    const status = getStatus(ctx);
    // Best-effort, non-blocking.
    emit(ctx, status, {}).catch((err) => {
      // Surface to OTel via the host logger if available; never throw.
      // eslint-disable-next-line no-console
      console.warn('securityEventsMiddleware: audit emit failed', err);
    });
  }
}

/**
 * Low-level emit helper. Useful for code paths that already know the
 * outcome (e.g. webhook verifier denying before delegating).
 */
export async function recordSecurityEvent(
  ctx: AuditableContext,
  outcome: AuditOutcome,
  reason?: string,
): Promise<void> {
  const path = getPath(ctx);
  const resource = deriveResource(path);
  const user = extractUser(ctx);
  await logAuditEvent(
    user,
    ctx.req.method.toUpperCase(),
    { type: resource.type, id: resource.id },
    {
      category: 'SYSTEM',
      outcome,
      severity:
        outcome === 'SUCCESS' ? AuditSeverityEnum.INFO : AuditSeverityEnum.WARNING,
      description: `${ctx.req.method.toUpperCase()} ${path}`,
      reason,
      request: { httpMethod: ctx.req.method.toUpperCase(), httpPath: path },
    },
  );
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

async function emit(
  ctx: AuditableContext,
  status: number,
  options: WithSecurityEventsOptions,
): Promise<void> {
  const path = getPath(ctx);
  const fallback = deriveResource(path);
  const resource: AuditResource = {
    type: options.resourceType ?? fallback.type,
    id: options.resourceIdFromPath === false ? 'collection' : fallback.id,
  };
  const { outcome, severity } = classifyOutcome(status);
  const user = extractUser(ctx);
  await logAuditEvent(user, ctx.req.method.toUpperCase(), resource, {
    category: 'SYSTEM',
    outcome,
    severity,
    description: `${ctx.req.method.toUpperCase()} ${path} → ${status}`,
    request: { httpMethod: ctx.req.method.toUpperCase(), httpPath: path },
    metadata: { statusCode: status },
  });
}
