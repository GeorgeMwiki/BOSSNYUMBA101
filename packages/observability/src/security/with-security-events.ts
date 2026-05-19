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

import type {
  AuditOutcome,
  AuditSeverity,
  AuditTenantContext,
} from '../types/audit.types.js';
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

/**
 * Derive the tenant-context block from the request (H1 closure).
 *
 * The previous implementation never read `auth.tenantId`, so every
 * audit row emitted via the HOF / middleware was tenant-LESS — and the
 * Security Route Coverage gate's tenant-binding goal was defeated
 * silently. We now read `tenantId` (also `orgId` / `organizationId`
 * as aliases) from the auth context and attach it via the
 * `AuditTenantContext` block that `logAuditEvent` already supports.
 */
function extractTenantContext(ctx: AuditableContext): AuditTenantContext | undefined {
  const auth = (ctx.get('auth') ?? {}) as Record<string, unknown>;
  const tenantId =
    (auth.tenantId as string | undefined) ??
    (auth.orgId as string | undefined) ??
    (auth.organizationId as string | undefined);
  if (!tenantId || typeof tenantId !== 'string') return undefined;
  const tenantName = auth.tenantName as string | undefined;
  const environment = auth.environment as string | undefined;
  return {
    tenantId,
    ...(tenantName ? { tenantName } : {}),
    ...(environment ? { environment } : {}),
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
    // L1 closure: restructure so the post-emit return type is
    // statically reachable. The try block resolves to `result`; the
    // catch re-throws (so we never reach the post-catch path on error).
    try {
      const result = await handler(ctx);
      if (!skip && MUTATING_METHODS.has(method)) {
        const status = getStatus(ctx);
        emit(ctx, status, options).catch((emitErr) => {
          options.onError?.(emitErr);
        });
      }
      return result;
    } catch (err) {
      if (!skip && MUTATING_METHODS.has(method)) {
        emit(ctx, 500, options).catch((emitErr) => {
          options.onError?.(emitErr);
        });
      }
      throw err;
    }
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
  // H2 closure: if `next()` throws, `ctx.res` is never populated and
  // `getStatus(ctx)` returns 200 — the audit row records SUCCESS for a
  // 5xx response. We track the thrown flag explicitly and normalise to
  // 500 in the same way the per-handler HOF does.
  let thrown: unknown = null;
  try {
    await next();
  } catch (err) {
    thrown = err;
    throw err;
  } finally {
    const status = thrown ? 500 : getStatus(ctx);
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
 *
 * M1 closure: routes through the same `emitAuditRow` shared helper used
 * by both `withSecurityEvents` and `securityEventsMiddleware`. The row
 * shape is now identical across all three emit paths — every consumer
 * sees `metadata.statusCode`, severity derived from outcome (not a
 * hard-coded INFO/WARNING split), and the tenant block when surfaced.
 *
 * The status defaults to a canonical HTTP code derived from the
 * outcome: SUCCESS → 200, DENIED → 403, FAILURE → 400, ERROR → 500.
 * Callers with a more specific code should use `recordSecurityEventWithStatus`.
 */
export async function recordSecurityEvent(
  ctx: AuditableContext,
  outcome: AuditOutcome,
  reason?: string,
): Promise<void> {
  const status = canonicalStatusForOutcome(outcome);
  await emitAuditRow(ctx, { status, outcome, reason });
}

/**
 * Variant that lets the caller commit a specific status code AND
 * outcome (e.g. signature-verifier denying with 401 vs CSRF denying
 * with 403). The metadata.statusCode and severity are both derived
 * consistently with the HOF/middleware paths.
 */
export async function recordSecurityEventWithStatus(
  ctx: AuditableContext,
  status: number,
  reason?: string,
): Promise<void> {
  await emitAuditRow(ctx, { status, reason });
}

// ---------------------------------------------------------------------------
// Internal — single shared emit path (M1 closure).
// ---------------------------------------------------------------------------

function canonicalStatusForOutcome(outcome: AuditOutcome): number {
  switch (outcome) {
    case 'SUCCESS':
      return 200;
    case 'DENIED':
      return 403;
    case 'FAILURE':
      return 400;
    case 'ERROR':
      return 500;
    default:
      return 200;
  }
}

interface EmitRowArgs {
  status: number;
  outcome?: AuditOutcome;
  reason?: string;
  options?: WithSecurityEventsOptions;
}

/**
 * The single authoritative audit-row emitter. Every other public emit
 * shape funnels through here so the row schema stays consistent.
 */
async function emitAuditRow(ctx: AuditableContext, args: EmitRowArgs): Promise<void> {
  const { status, outcome: outcomeOverride, reason, options = {} } = args;
  const path = getPath(ctx);
  const fallback = deriveResource(path);
  const resource: AuditResource = {
    type: options.resourceType ?? fallback.type,
    id: options.resourceIdFromPath === false ? 'collection' : fallback.id,
  };
  const classified = classifyOutcome(status);
  const outcome = outcomeOverride ?? classified.outcome;
  // Severity tracks the FINAL outcome, even when caller overrides it
  // (so DENIED with a 200 status still surfaces as WARNING).
  const severity =
    outcomeOverride !== undefined
      ? classifyOutcome(canonicalStatusForOutcome(outcomeOverride)).severity
      : classified.severity;
  const user = extractUser(ctx);
  // H1 closure: every audit row carries a tenant block when the auth
  // context surfaces one. Anonymous / unauthenticated routes still
  // emit with no tenant block (consumers filter by tenantId for the
  // tenant-binding goal).
  const tenant = extractTenantContext(ctx);
  const method = ctx.req.method.toUpperCase();
  await logAuditEvent(user, method, resource, {
    category: 'SYSTEM',
    outcome,
    severity,
    description: `${method} ${path} → ${status}`,
    ...(reason ? { reason } : {}),
    request: { httpMethod: method, httpPath: path },
    metadata: { statusCode: status },
    ...(tenant ? { tenant } : {}),
  });
}

async function emit(
  ctx: AuditableContext,
  status: number,
  options: WithSecurityEventsOptions,
): Promise<void> {
  await emitAuditRow(ctx, { status, options });
}
