/**
 * Admin router for outbound webhook dead-letters.
 *
 *   GET  /api/v1/webhooks/dead-letters           — list DLQ entries
 *   GET  /api/v1/webhooks/dead-letters/:id       — inspect one
 *   POST /api/v1/webhooks/dead-letters/:id/replay — re-queue for delivery
 *
 * All routes are admin-only (`requireRole('admin')`) and tenant-scoped by
 * the auth context. The replay endpoint asks the injected dispatcher to
 * emit a fresh `WebhookDeliveryQueued` event with a new deliveryId, then
 * stamps `replayed_at` / `replayed_by` on the DLQ row so operators know
 * it has been handled.
 */

import { Hono } from 'hono';
import { authMiddleware, requireRole } from '../middleware/hono-auth.js';
import { UserRole } from '../types/user-role.js';
import type {
  WebhookDeliveryRepository,
  WebhookDeliveryQueued,
} from '../workers/webhook-retry-worker.js';

export interface WebhookDlqDeps {
  repository: WebhookDeliveryRepository;
  /** Emit a fresh delivery event. The new deliveryId is returned and
   *  recorded on the DLQ row. */
  requeue(event: WebhookDeliveryQueued): Promise<string>;
  /** Millisecond clock; swap for tests. */
  now?: () => number;
  /** ID generator (UUID-like); swap for tests. */
  generateId?: () => string;
}

function defaultId(): string {
  // Node 19+ has global crypto.randomUUID.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  return g.crypto?.randomUUID?.() ?? `wh-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createWebhookDlqRouter(deps: WebhookDlqDeps): Hono {
  const now = deps.now ?? Date.now;
  const genId = deps.generateId ?? defaultId;

  const app = new Hono();

  app.use('*', authMiddleware);
  // Any admin-class role may inspect + replay the DLQ.
  app.use('*', requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TENANT_ADMIN));

  // ---------------------------------------------------------------------
  // GET /api/v1/webhooks/dead-letters
  // ---------------------------------------------------------------------
  app.get('/api/v1/webhooks/dead-letters', async (c) => {
    const auth = c.get('auth');
    const limitRaw = Number(c.req.query('limit') ?? '50');
    const offsetRaw = Number(c.req.query('offset') ?? '0');
    const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, limitRaw)) : 50;
    const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0;

    try {
      const entries = await deps.repository.listDeadLetters({
        tenantId: auth?.tenantId,
        limit,
        offset,
      });
      return c.json({
        success: true,
        data: entries,
        meta: { limit, offset, count: entries.length },
      });
    } catch (err) {
      return c.json(
        {
          success: false,
          error: {
            code: 'DLQ_LIST_FAILED',
            message: err instanceof Error ? err.message : 'unable to list dead-letters',
          },
        },
        500
      );
    }
  });

  // ---------------------------------------------------------------------
  // GET /api/v1/webhooks/dead-letters/:id
  // ---------------------------------------------------------------------
  app.get('/api/v1/webhooks/dead-letters/:id', async (c) => {
    const id = c.req.param('id');
    const entry = await deps.repository.getDeadLetter(id);
    if (!entry) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'dead-letter not found' } },
        404
      );
    }
    // Tenant isolation — admins can only see DLQ entries for their own tenant.
    const auth = c.get('auth');
    if (auth?.tenantId && entry.tenantId !== auth.tenantId) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'dead-letter not found' } },
        404
      );
    }
    return c.json({ success: true, data: entry });
  });

  // ---------------------------------------------------------------------
  // POST /api/v1/webhooks/dead-letters/:id/replay
  // ---------------------------------------------------------------------
  app.post('/api/v1/webhooks/dead-letters/:id/replay', async (c) => {
    const id = c.req.param('id');
    const auth = c.get('auth');

    const entry = await deps.repository.getDeadLetter(id);
    if (!entry) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'dead-letter not found' } },
        404
      );
    }
    if (auth?.tenantId && entry.tenantId !== auth.tenantId) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'dead-letter not found' } },
        404
      );
    }

    const newDeliveryId = `${entry.deliveryId}-replay-${genId().slice(0, 8)}`;
    try {
      await deps.requeue({
        deliveryId: newDeliveryId,
        tenantId: entry.tenantId,
        targetUrl: entry.targetUrl,
        eventType: entry.eventType,
        payload: entry.payload,
      });
      await deps.repository.markDeadLetterReplayed(
        id,
        auth?.userId ?? 'unknown-admin',
        newDeliveryId
      );
      return c.json({
        success: true,
        data: { id, replayDeliveryId: newDeliveryId, replayedAt: new Date(now()).toISOString() },
      });
    } catch (err) {
      return c.json(
        {
          success: false,
          error: {
            code: 'REPLAY_FAILED',
            message: err instanceof Error ? err.message : 'failed to replay',
          },
        },
        500
      );
    }
  });

  return app;
}
