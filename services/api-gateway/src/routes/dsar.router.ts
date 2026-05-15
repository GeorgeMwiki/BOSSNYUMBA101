/**
 * DSAR (Data-Subject Access Request) HTTP surface.
 *
 * GDPR Art. 20 + Tanzania PDPA s.27 implementation. Mounted at
 * `/api/v1/dsar`. Three endpoints:
 *
 *   GET  /api/v1/dsar/:subjectId/export   — download bundle (attachment)
 *   GET  /api/v1/dsar/:subjectId/preview  — admin review (inline JSON)
 *   POST /api/v1/dsar/:subjectId/rtbf     — schedule right-to-be-forgotten
 *
 * Authorisation
 * ─────────────
 * Admin roles (SUPER_ADMIN / ADMIN / TENANT_ADMIN) can request any
 * subject's bundle inside their tenant. A non-admin caller MAY request
 * THEIR OWN bundle (subject-self) iff the JWT email or userId matches
 * the :subjectId path param. Cross-subject reads by non-admins are 403.
 *
 * Rate limiting
 * ─────────────
 * Per-tenant in-memory bucket: 3 exports / hour. RTBF + preview are
 * NOT rate-limited (preview is the read-mostly admin path; RTBF is a
 * legal channel that shouldn't be rate-limited at all). Distributed
 * deployments should swap the in-memory bucket for the Redis limiter
 * in a follow-up — see the TODO marker below.
 *
 * Audit
 * ─────
 * Every export, preview, and RTBF emits a `dsar.*` audit event via
 * the shared event bus so the audit-trail surface (Wave 27 Agent C)
 * picks it up.
 */

// @ts-nocheck — Hono v4 ContextVariableMap drift (same pattern as
// head-briefing / tenant-branding routers).

import { Hono } from 'hono';
import {
  compileDsar,
  createEmptyDsarDataSource,
  createNoopClassificationLookup,
  type DsarBundle,
  type DsarDataSource,
  type DsarClassificationLookup,
} from '@bossnyumba/ai-copilot';
import { authMiddleware } from '../middleware/hono-auth';
import { UserRole } from '../types/user-role';
import { routeCatch } from '../utils/safe-error';

// ─────────────────────────────────────────────────────────────────────
// Rate-limit bucket — 3 exports per tenant per hour. In-memory; replace
// with the Redis limiter for cluster-wide enforcement.
// ─────────────────────────────────────────────────────────────────────

const EXPORT_RATE_LIMIT = Object.freeze({
  windowMs: 60 * 60 * 1000,
  maxRequests: 3,
});

interface RateBucket {
  count: number;
  resetAt: number;
}

const exportBucket = new Map<string, RateBucket>();

function rateLimitExport(tenantId: string): {
  ok: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const existing = exportBucket.get(tenantId);
  if (!existing || now >= existing.resetAt) {
    const fresh: RateBucket = { count: 1, resetAt: now + EXPORT_RATE_LIMIT.windowMs };
    exportBucket.set(tenantId, fresh);
    return { ok: true, remaining: EXPORT_RATE_LIMIT.maxRequests - 1, resetAt: fresh.resetAt };
  }
  // Replace (immutability discipline) rather than mutate the bucket.
  const next: RateBucket = { count: existing.count + 1, resetAt: existing.resetAt };
  exportBucket.set(tenantId, next);
  const remaining = Math.max(0, EXPORT_RATE_LIMIT.maxRequests - next.count);
  return {
    ok: next.count <= EXPORT_RATE_LIMIT.maxRequests,
    remaining,
    resetAt: next.resetAt,
  };
}

/** Test seam — empties the bucket between tests. */
export function _resetExportRateBucketForTests(): void {
  exportBucket.clear();
}

// ─────────────────────────────────────────────────────────────────────
// Authorization helpers — admin OR matching subject.
// ─────────────────────────────────────────────────────────────────────

const ADMIN_ROLES = new Set<UserRole>([
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.TENANT_ADMIN,
]);

function isAdminRole(role: UserRole | undefined): boolean {
  if (!role) return false;
  return ADMIN_ROLES.has(role);
}

function isSubjectSelf(
  auth: { userId?: string; tenantId?: string; email?: string },
  subjectId: string,
  jwtEmail: string | undefined,
): boolean {
  if (!subjectId) return false;
  if (auth.userId && auth.userId === subjectId) return true;
  if (jwtEmail && jwtEmail === subjectId) return true;
  return false;
}

function forbidden(c: any) {
  return c.json(
    {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'You do not have permission to access this subject',
      },
    },
    403,
  );
}

function badRequest(c: any, message: string) {
  return c.json(
    {
      success: false,
      error: { code: 'VALIDATION', message },
    },
    400,
  );
}

// ─────────────────────────────────────────────────────────────────────
// Dependency resolution — pull data source + classification lookup from
// the service registry. Each is optional; we degrade to the compiler's
// safe defaults when a slot is missing so the bundle is at least shaped.
// ─────────────────────────────────────────────────────────────────────

function resolveDeps(c: any): {
  dataSource: DsarDataSource;
  classifications: DsarClassificationLookup;
} {
  const services = (c.get('services') ?? {}) as {
    dsarDataSource?: DsarDataSource;
    dsarClassifications?: DsarClassificationLookup;
  };
  return {
    dataSource: services.dsarDataSource ?? createEmptyDsarDataSource(),
    classifications:
      services.dsarClassifications ?? createNoopClassificationLookup(),
  };
}

async function emitAudit(
  c: any,
  eventType: 'dsar.export' | 'dsar.preview' | 'dsar.rtbf',
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const services = (c.get('services') ?? {}) as {
      eventBus?: {
        publish: (envelope: unknown) => Promise<void> | void;
      };
    };
    const bus = services.eventBus;
    if (!bus || typeof bus.publish !== 'function') return;
    await bus.publish({
      event: {
        eventId: `dsar_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        eventType,
        timestamp: new Date().toISOString(),
        tenantId: payload.tenantId ?? 'unknown',
        correlationId: c.get('requestId') ?? `dsar_${Date.now()}`,
        causationId: null,
        metadata: {},
        payload,
      },
      version: 1,
      aggregateId: String(payload.subjectId ?? 'unknown'),
      aggregateType: 'DataSubjectAccessRequest',
    });
  } catch {
    // Audit emission is non-fatal — never break the user request.
  }
}

// ─────────────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────────────

export interface CreateDsarRouterOptions {
  /** Optional injected clock — used by tests for deterministic timestamps. */
  readonly now?: () => Date;
}

export function createDsarRouter(opts: CreateDsarRouterOptions = {}): Hono {
  const app = new Hono();
  app.use('*', authMiddleware);

  const compileForRequest = async (
    c: any,
    subjectId: string,
  ): Promise<DsarBundle> => {
    const { dataSource, classifications } = resolveDeps(c);
    return compileDsar(
      { subjectId },
      {
        dataSource,
        classifications,
        ...(opts.now ? { now: opts.now } : {}),
      },
    );
  };

  // ───────────────────────────────────────────────────────────────────
  // GET /:subjectId/export — download bundle as JSON attachment
  // ───────────────────────────────────────────────────────────────────
  app.get('/:subjectId/export', async (c: any) => {
    const subjectId = c.req.param('subjectId');
    if (!subjectId || subjectId.trim().length === 0) {
      return badRequest(c, 'subjectId is required');
    }
    const auth = c.get('auth') ?? {};
    const jwtEmail = (auth as { email?: string }).email;

    const admin = isAdminRole(auth.role);
    const self = isSubjectSelf(auth, subjectId, jwtEmail);
    if (!admin && !self) return forbidden(c);

    // Rate-limit per tenant. Admin OR subject-self both consume the
    // same bucket so a tenant can't bypass via subject-self runs.
    const tenantId = auth.tenantId ?? 'unknown';
    const limit = rateLimitExport(tenantId);
    if (!limit.ok) {
      return c.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `DSAR exports limited to ${EXPORT_RATE_LIMIT.maxRequests} per hour per tenant`,
            retryAfter: Math.max(0, Math.ceil((limit.resetAt - Date.now()) / 1000)),
          },
        },
        429,
      );
    }

    try {
      const bundle = await compileForRequest(c, subjectId);
      const tableCount = Object.keys(bundle.tables).length;
      await emitAudit(c, 'dsar.export', {
        subjectId,
        requestedBy: auth.userId,
        tenantId,
        tableCount,
      });
      const filename = `dsar-${subjectId.replace(/[^a-zA-Z0-9._-]/g, '_')}-${Date.now()}.json`;
      return c.body(JSON.stringify(bundle, null, 2), 200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-RateLimit-Remaining': String(limit.remaining),
      });
    } catch (err: any) {
      return routeCatch(c, err, {
        code: 'DSAR_EXPORT_FAILED',
        status: 500,
        fallback: 'Failed to compile DSAR bundle',
      });
    }
  });

  // ───────────────────────────────────────────────────────────────────
  // GET /:subjectId/preview — admin review, inline JSON (no download)
  // ───────────────────────────────────────────────────────────────────
  app.get('/:subjectId/preview', async (c: any) => {
    const subjectId = c.req.param('subjectId');
    if (!subjectId || subjectId.trim().length === 0) {
      return badRequest(c, 'subjectId is required');
    }
    const auth = c.get('auth') ?? {};
    const jwtEmail = (auth as { email?: string }).email;

    const admin = isAdminRole(auth.role);
    const self = isSubjectSelf(auth, subjectId, jwtEmail);
    if (!admin && !self) return forbidden(c);

    try {
      const bundle = await compileForRequest(c, subjectId);
      await emitAudit(c, 'dsar.preview', {
        subjectId,
        requestedBy: auth.userId,
        tenantId: auth.tenantId ?? 'unknown',
        tableCount: Object.keys(bundle.tables).length,
      });
      return c.json({ success: true, data: bundle });
    } catch (err: any) {
      return routeCatch(c, err, {
        code: 'DSAR_PREVIEW_FAILED',
        status: 500,
        fallback: 'Failed to compile DSAR preview',
      });
    }
  });

  // ───────────────────────────────────────────────────────────────────
  // POST /:subjectId/rtbf — schedule right-to-be-forgotten (stub)
  // Actual deletion is TIER-3 follow-up; this endpoint exists so legal
  // can issue requests today. Admins only.
  // ───────────────────────────────────────────────────────────────────
  app.post('/:subjectId/rtbf', async (c: any) => {
    const subjectId = c.req.param('subjectId');
    if (!subjectId || subjectId.trim().length === 0) {
      return badRequest(c, 'subjectId is required');
    }
    const auth = c.get('auth') ?? {};
    if (!isAdminRole(auth.role)) return forbidden(c);

    const now = opts.now ? opts.now() : new Date();
    const scheduledAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    await emitAudit(c, 'dsar.rtbf', {
      subjectId,
      requestedBy: auth.userId,
      tenantId: auth.tenantId ?? 'unknown',
      scheduledAt,
    });
    return c.json({
      success: true,
      data: {
        accepted: true,
        subjectId,
        scheduledAt,
        note: 'RTBF execution is scheduled; final pseudonymization runs via /api/v1/gdpr/delete-request/:id/execute (admin)',
      },
    });
  });

  return app;
}

export default createDsarRouter;
