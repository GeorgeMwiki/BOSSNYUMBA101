// @ts-nocheck — Hono v4 MiddlewareHandler status-code literal union: multiple
// c.json({...}, status) branches widen the return type and the TypedResponse
// overload rejects the union. Tracked at hono-dev/hono#3891 (same pragma used
// by every sibling Hono router in this directory).
/**
 * /api/v1/me — the authenticated caller's own resources.
 *
 * Currently exposes device-token registration, the canonical push-receiver
 * surface BOTH mobile apps call on sign-in:
 *
 *   POST   /me/device-tokens          register / refresh this device's token
 *   DELETE /me/device-tokens/:token   revoke a token (soft-revoke, audit-safe)
 *
 * Before this router the mobile clients
 * (apps/{tenant,staff}-mobile/src/lib/notifications/push-register.ts) POSTed to
 * /api/v1/me/device-tokens — a route that did NOT exist — so no device ever
 * received a push. The handler upserts into `device_tokens` (migration 0327),
 * keyed on (user_id, token, platform), bound to the JWT's tenant + user.
 *
 * Tenant + user identity come ONLY from the JWT (c.get('auth')). The request
 * body's tenant/user, if present, are ignored. Idempotent: re-registering the
 * same token collapses to one row via ON CONFLICT.
 *
 * NOTE for the orchestrator: this router needs a NEW mount in index.ts:
 *   import { meRouter } from './routes/me.hono';
 *   api.route('/me', meRouter);
 * (existing sub-mounts like '/me/notification-preferences' remain — Hono
 * matches the more specific prefix first; '/me/device-tokens' is served here.)
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { sql } from 'drizzle-orm';

import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import { getSharedPerTenantRateBudget } from '../middleware/per-tenant-rate-budget';
import { createLogger } from '../utils/logger.js';

const moduleLogger = createLogger('me-device-tokens');

// The mobile clients send { platform, app, expoPushToken }. We accept either
// `expoPushToken` (current client shape) or a generic `token` alias and
// normalise to a single opaque receiver token.
const RegisterDeviceTokenSchema = z
  .object({
    platform: z.enum(['ios', 'android', 'web']),
    app: z.string().min(1).max(64).optional(),
    expoPushToken: z.string().min(8).max(500).optional(),
    token: z.string().min(8).max(500).optional(),
  })
  .refine((b) => Boolean(b.expoPushToken) || Boolean(b.token), {
    message: 'expoPushToken (or token) is required',
  });

function rowsOf(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && 'rows' in raw) {
    const r = raw.rows;
    if (Array.isArray(r)) return r;
  }
  return [];
}

const app = new Hono();

app.use('*', authMiddleware);
app.use('*', databaseMiddleware);
app.use('*', getSharedPerTenantRateBudget({ surface: 'api' }).handler);

/**
 * POST /me/device-tokens — register or refresh this device's push token.
 *
 * Idempotent upsert on (user_id, token, platform): a repeat registration of
 * the same token bumps last_seen_at and un-revokes rather than minting a
 * duplicate.
 */
app.post('/device-tokens', async (c) => {
  const auth = c.get('auth') as
    | { tenantId?: string; userId?: string }
    | undefined;
  const tenantId = auth?.tenantId;
  const userId = auth?.userId;
  if (!tenantId || !userId) {
    return c.json(
      {
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'device-tokens requires an authenticated user',
        },
      },
      401,
    );
  }

  const raw = await c.req.json().catch(() => null);
  const parsed = RegisterDeviceTokenSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'invalid device-token payload',
          issues: parsed.error.issues,
        },
      },
      400,
    );
  }

  const db = c.get('db') as
    | { execute(q: unknown): Promise<unknown> }
    | null
    | undefined;
  if (!db) {
    // No live DB (mock mode / tests) — we cannot persist; surface honestly.
    return c.json(
      {
        success: false,
        error: {
          code: 'LIVE_DATA_NOT_CONFIGURED',
          message: 'A live database connection is required.',
        },
      },
      503,
    );
  }

  const input = parsed.data;
  const token = String(input.expoPushToken ?? input.token ?? '');
  const appName = input.app ?? null;

  const rows = rowsOf(
    await db.execute(sql`
      INSERT INTO device_tokens (
        tenant_id, user_id, token, platform, app,
        installed_at, last_seen_at, revoked_at
      ) VALUES (
        ${tenantId}, ${userId}, ${token}, ${input.platform}, ${appName},
        NOW(), NOW(), NULL
      )
      ON CONFLICT (tenant_id, user_id, token, platform) DO UPDATE SET
        last_seen_at = NOW(),
        revoked_at   = NULL,
        app          = EXCLUDED.app,
        updated_at   = NOW()
      RETURNING id::text AS id, last_seen_at
    `),
  );

  const row = rows[0];
  moduleLogger.info('device_token_registered', {
    tenantId,
    userId,
    platform: input.platform,
    app: appName,
    tokenId: row?.id,
  });

  return c.json({
    success: true,
    data: {
      tokenId: String(row?.id ?? ''),
      lastSeenAt: row?.last_seen_at ?? null,
    },
  });
});

/**
 * DELETE /me/device-tokens/:token — soft-revoke a token for the caller.
 *
 * Uniform 404 when the token is not the caller's (RLS + the explicit
 * user_id predicate) so it cannot be used to probe other users' tokens.
 */
app.delete('/device-tokens/:token', async (c) => {
  const auth = c.get('auth') as
    | { tenantId?: string; userId?: string }
    | undefined;
  const tenantId = auth?.tenantId;
  const userId = auth?.userId;
  if (!tenantId || !userId) {
    return c.json(
      {
        success: false,
        error: { code: 'AUTH_REQUIRED', message: 'auth required' },
      },
      401,
    );
  }

  const token = c.req.param('token');
  if (!token) {
    return c.json(
      {
        success: false,
        error: { code: 'INVALID_PARAMS', message: 'token is required' },
      },
      400,
    );
  }

  const db = c.get('db') as
    | { execute(q: unknown): Promise<unknown> }
    | null
    | undefined;
  if (!db) {
    return c.json(
      {
        success: false,
        error: {
          code: 'LIVE_DATA_NOT_CONFIGURED',
          message: 'A live database connection is required.',
        },
      },
      503,
    );
  }

  const rows = rowsOf(
    await db.execute(sql`
      UPDATE device_tokens
         SET revoked_at = NOW(), updated_at = NOW()
       WHERE token = ${token}
         AND tenant_id = ${tenantId}
         AND user_id = ${userId}
         AND revoked_at IS NULL
      RETURNING id::text AS id
    `),
  );

  if (rows.length === 0) {
    return c.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: 'token not found' },
      },
      404,
    );
  }

  moduleLogger.info('device_token_revoked', { tenantId, userId });
  return c.json({ success: true, data: { revoked: true } });
});

export const meRouter = app;
export default meRouter;
