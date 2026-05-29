/**
 * Lease history routes — real-estate chain-of-custody.
 *
 * Mounted at `/api/v1/leases/:leaseId/history*` so the brain tools
 * `lease_history.append_step` and `lease_history.show_trace` have a
 * canonical hop. RLS is enforced by the database middleware.
 *
 * Routes:
 *   - POST /:leaseId/history/steps        append a step (lease_history.append_step)
 *   - GET  /:leaseId/history              return the trace (lease_history.show_trace)
 *
 * Provenance: the body is expected to carry
 * `{ provenance: { via:'chat', sessionId, turnId, actorId } }` (the
 * brain handler attaches it via withChatProvenance). We pass it through
 * to the lease-history service as free-form jsonb so the row's
 * provenance column carries the trail.
 */

import { Hono } from 'hono';
import { z } from 'zod';

import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import { createLogger } from '../utils/logger.js';
import {
  LeaseHistoryService,
  LeaseHistoryError,
  LEASE_HISTORY_ACTIONS,
  LEASE_HISTORY_ACTOR_ROLES,
  type LeaseHistoryAction,
  type LeaseHistoryActorRole,
} from '../services/lease-history/index.js';

const moduleLogger = createLogger('lease-history-route');

const AppendStepSchema = z.object({
  action: z.enum(LEASE_HISTORY_ACTIONS),
  actorRole: z.enum(LEASE_HISTORY_ACTOR_ROLES),
  photoCid: z.string().min(8).max(500).nullable().optional(),
  locationLat: z.number().min(-90).max(90).nullable().optional(),
  locationLon: z.number().min(-180).max(180).nullable().optional(),
  amount: z.number().nonnegative().nullable().optional(),
  currencyCode: z.string().min(3).max(8).nullable().optional(),
  evidenceRefs: z.array(z.string().min(1).max(500)).optional(),
  provenance: z.record(z.unknown()).optional(),
});

const app = new Hono();
app.use('*', authMiddleware, databaseMiddleware);

app.post('/:leaseId/history/steps', async (c) => {
  const auth = c.get('auth') as
    | { tenantId?: string; userId?: string }
    | undefined;
  const tenantId = auth?.tenantId;
  const actorId = auth?.userId;
  if (!tenantId || !actorId) {
    return c.json(
      {
        success: false,
        error: { code: 'AUTH_REQUIRED', message: 'auth required' },
      },
      401,
    );
  }
  const leaseId = c.req.param('leaseId');
  if (!leaseId) {
    return c.json(
      {
        success: false,
        error: { code: 'INVALID_PARAMS', message: 'leaseId required' },
      },
      400,
    );
  }

  const body = await c.req.json().catch(() => null);
  const parsed = AppendStepSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'invalid lease history step payload',
          issues: parsed.error.issues,
        },
      },
      400,
    );
  }

  const db = c.get('db') as { execute(q: unknown): Promise<unknown> };
  const svc = new LeaseHistoryService({ db });
  try {
    const step = await svc.appendStep({
      tenantId,
      leaseId,
      action: parsed.data.action as LeaseHistoryAction,
      actorId,
      actorRole: parsed.data.actorRole as LeaseHistoryActorRole,
      ...(parsed.data.photoCid != null && { photoCid: parsed.data.photoCid }),
      ...(parsed.data.locationLat != null && {
        locationLat: parsed.data.locationLat,
      }),
      ...(parsed.data.locationLon != null && {
        locationLon: parsed.data.locationLon,
      }),
      ...(parsed.data.amount != null && { amount: parsed.data.amount }),
      ...(parsed.data.currencyCode != null && {
        currencyCode: parsed.data.currencyCode,
      }),
      provenance: {
        ...(parsed.data.provenance ?? {}),
        ...(parsed.data.evidenceRefs?.length
          ? { evidenceRefs: parsed.data.evidenceRefs }
          : {}),
      },
    });
    return c.json({
      success: true,
      data: {
        id: step.id,
        stepIndex: step.stepIndex,
        auditHash: step.auditHash,
        prevAuditHash: step.prevAuditHash,
      },
    });
  } catch (err) {
    if (err instanceof LeaseHistoryError) {
      moduleLogger.warn('lease_history_append_rejected', {
        tenantId,
        leaseId,
        code: err.code,
      });
      return c.json(
        {
          success: false,
          error: { code: err.code, message: err.message },
        },
        400,
      );
    }
    moduleLogger.error('lease_history_append_failed', {
      tenantId,
      leaseId,
      err: err instanceof Error ? err.message : String(err),
    });
    return c.json(
      {
        success: false,
        error: { code: 'INTERNAL', message: 'lease history append failed' },
      },
      500,
    );
  }
});

app.get('/:leaseId/history', async (c) => {
  const auth = c.get('auth') as { tenantId?: string } | undefined;
  const tenantId = auth?.tenantId;
  if (!tenantId) {
    return c.json(
      {
        success: false,
        error: { code: 'AUTH_REQUIRED', message: 'auth required' },
      },
      401,
    );
  }
  const leaseId = c.req.param('leaseId');
  if (!leaseId) {
    return c.json(
      {
        success: false,
        error: { code: 'INVALID_PARAMS', message: 'leaseId required' },
      },
      400,
    );
  }
  const limitStr = c.req.query('limit');
  const limit = Math.min(Math.max(Number(limitStr ?? 200) || 200, 1), 500);
  const db = c.get('db') as { execute(q: unknown): Promise<unknown> };
  const svc = new LeaseHistoryService({ db });
  const trace = await svc.showTrace({ tenantId, leaseId, limit });
  return c.json({ success: true, data: trace });
});

export const leaseHistoryRouter = app;
export default leaseHistoryRouter;
