/**
 * Device push tokens — bidirectional notification receiver registration.
 *
 * Mobile apps (staff-mobile / tenant-mobile / estate-manager-mobile /
 * customer-mobile) call POST /api/v1/device-push-tokens on app start
 * with their Expo / FCM / APNS token. The endpoint upserts a row in
 * `device_push_tokens` (migration 0287) bound to the JWT's tenantId +
 * userId. Soft-revoke via DELETE preserves the audit trail.
 *
 * Tenant isolation: the JWT-bound tenant ID is the ONLY source of
 * truth — the request body's `tenantId`, if present, is ignored.
 *
 * Routes:
 *   - POST   /                 register or refresh a token
 *   - DELETE /:tokenId         soft-revoke a token (stamps revoked_at)
 *   - GET    /mine             list the caller's active tokens
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { sql } from 'drizzle-orm';

import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import { getSharedPerTenantRateBudget } from '../middleware/per-tenant-rate-budget';
import { createLogger } from '../utils/logger.js';

const moduleLogger = createLogger('device-push-tokens');

const RegisterTokenSchema = z
  .object({
    platform: z.enum(['ios', 'android', 'web']),
    app: z.enum([
      'owner-portal',
      'admin-portal',
      'admin-platform-portal',
      'tenant-portal',
      'staff-mobile',
      'tenant-mobile',
      'estate-manager-mobile',
      'customer-mobile',
    ]),
    expoPushToken: z.string().min(8).max(500).optional(),
    fcmToken: z.string().min(8).max(500).optional(),
    apnsToken: z.string().min(8).max(500).optional(),
  })
  .refine(
    (b) =>
      Boolean(b.expoPushToken) || Boolean(b.fcmToken) || Boolean(b.apnsToken),
    {
      message: 'at least one of expoPushToken / fcmToken / apnsToken required',
    },
  );

interface DbRow {
  [key: string]: unknown;
}

function rowsOf(raw: unknown): ReadonlyArray<DbRow> {
  if (Array.isArray(raw)) return raw as ReadonlyArray<DbRow>;
  if (raw && typeof raw === 'object' && 'rows' in raw) {
    const r = (raw as { rows: unknown }).rows;
    if (Array.isArray(r)) return r as ReadonlyArray<DbRow>;
  }
  return [];
}

const app = new Hono();

app.use('*', authMiddleware, databaseMiddleware);
app.use('*', getSharedPerTenantRateBudget({ surface: 'api' }).handler);

app.post('/', async (c) => {
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
          message: 'device-push-tokens requires an authenticated user',
        },
      },
      401,
    );
  }
  const body = await c.req.json().catch(() => null);
  const parsed = RegisterTokenSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'invalid device-push-token payload',
          issues: parsed.error.issues,
        },
      },
      400,
    );
  }
  const input = parsed.data;
  const db = c.get('db') as { execute(q: unknown): Promise<unknown> };

  // Upsert on the (user_id, app, COALESCE(expo|fcm|apns) ) tuple — the
  // migration's unique index covers that exact shape.
  const rows = rowsOf(
    await db.execute(sql`
      INSERT INTO device_push_tokens (
        tenant_id, user_id, platform, app,
        expo_push_token, fcm_token, apns_token,
        installed_at, last_seen_at, revoked_at
      ) VALUES (
        ${tenantId}::uuid,
        ${userId},
        ${input.platform},
        ${input.app},
        ${input.expoPushToken ?? null},
        ${input.fcmToken ?? null},
        ${input.apnsToken ?? null},
        NOW(), NOW(), NULL
      )
      ON CONFLICT (
        user_id,
        app,
        (COALESCE(expo_push_token, '') || '|' || COALESCE(fcm_token, '') || '|' || COALESCE(apns_token, ''))
      ) DO UPDATE SET
        last_seen_at = NOW(),
        revoked_at   = NULL,
        platform     = EXCLUDED.platform,
        updated_at   = NOW()
      RETURNING id::text AS id, last_seen_at
    `),
  );

  const row = rows[0];
  moduleLogger.info('device_push_token_registered', {
    tenantId,
    userId,
    app: input.app,
    platform: input.platform,
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

app.delete('/:tokenId', async (c) => {
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
  const tokenId = c.req.param('tokenId');
  const db = c.get('db') as { execute(q: unknown): Promise<unknown> };
  const rows = rowsOf(
    await db.execute(sql`
      UPDATE device_push_tokens
         SET revoked_at = NOW(), updated_at = NOW()
       WHERE id = ${tokenId}::uuid
         AND tenant_id = ${tenantId}::uuid
         AND user_id = ${userId}
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
  moduleLogger.info('device_push_token_revoked', {
    tenantId,
    userId,
    tokenId,
  });
  return c.json({ success: true, data: { tokenId } });
});

app.get('/mine', async (c) => {
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
  const db = c.get('db') as { execute(q: unknown): Promise<unknown> };
  const rows = rowsOf(
    await db.execute(sql`
      SELECT id::text AS id,
             platform,
             app,
             expo_push_token IS NOT NULL AS has_expo,
             fcm_token       IS NOT NULL AS has_fcm,
             apns_token      IS NOT NULL AS has_apns,
             last_seen_at,
             installed_at
        FROM device_push_tokens
       WHERE tenant_id = ${tenantId}::uuid
         AND user_id   = ${userId}
         AND revoked_at IS NULL
       ORDER BY last_seen_at DESC
    `),
  );
  return c.json({
    success: true,
    data: {
      tokens: rows.map((r) => ({
        id: String(r.id),
        platform: String(r.platform),
        app: String(r.app),
        hasExpo: Boolean(r.has_expo),
        hasFcm: Boolean(r.has_fcm),
        hasApns: Boolean(r.has_apns),
        installedAt: r.installed_at ?? null,
        lastSeenAt: r.last_seen_at ?? null,
      })),
    },
  });
});

export const devicePushTokensRouter = app;
export default devicePushTokensRouter;
