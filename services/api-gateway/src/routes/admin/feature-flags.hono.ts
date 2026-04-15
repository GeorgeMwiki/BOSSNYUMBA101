// @ts-nocheck
/**
 * Admin Feature Flags Router
 *
 * Surfaces the `feature_flags` table that backs the DB loader registered in
 * `src/index.ts`. Only ADMIN users may read/write — every operation is scoped
 * to the caller's `activeOrgId` (X-Active-Org header) when present, falling
 * back to the JWT `tenantId`. Cross-tenant flag management is intentionally
 * NOT exposed here; that requires SUPER_ADMIN tooling.
 *
 * Routes:
 *   GET    /admin/feature-flags          -> list flags for the active tenant + globals
 *   PUT    /admin/feature-flags/:key     -> upsert a flag for the active tenant
 *   DELETE /admin/feature-flags/:key     -> delete the active-tenant row
 *
 * NB: `metadata` is a free-form JSON object — keep payloads small. We never
 * write a row whose tenant_id is NULL from this endpoint (global flags are
 * SUPER_ADMIN-only); callers always operate within their own tenant scope.
 */

import { Hono } from 'hono';
import { and, asc, eq, isNull, or } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../../middleware/hono-auth';
import { databaseMiddleware, getDatabaseClient, generateId } from '../../middleware/database';
import { UserRole } from '../../types/user-role';

const app = new Hono();

// Auth + role gate — admins only.
app.use('*', authMiddleware);
app.use('*', requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN));
app.use('*', databaseMiddleware);

/**
 * Resolve the tenant the operation should be scoped to. Prefers the
 * X-Active-Org header (set by the active-org middleware on bff routes) and
 * falls back to the JWT tenantId when no override is present.
 */
function resolveActiveTenantId(c: any): string {
  return (c.get('activeOrgId') as string | undefined) ?? c.get('auth').tenantId;
}

/**
 * GET /admin/feature-flags
 *
 * Returns every flag row visible to this tenant: the tenant's own rows plus
 * any global rows (tenant_id IS NULL). Sorted by flag_key for stable UI.
 */
app.get('/', async (c) => {
  const db = getDatabaseClient();
  if (!db) {
    return c.json(
      { success: false, error: { code: 'NO_DB', message: 'Database is not configured' } },
      503
    );
  }

  const tenantId = resolveActiveTenantId(c);
  const { featureFlags } = await import('@bossnyumba/database');

  const rows = await db
    .select()
    .from(featureFlags)
    .where(or(isNull(featureFlags.tenantId), eq(featureFlags.tenantId, tenantId)))
    .orderBy(asc(featureFlags.flagKey));

  return c.json({ success: true, data: rows });
});

/**
 * PUT /admin/feature-flags/:key
 *
 * Upsert the tenant-scoped row for `flag_key = key`. Body shape:
 *
 *   {
 *     enabled: boolean,
 *     userId?: string | null,        // when set, narrows scope to that user
 *     rolloutPercent?: number | null,
 *     metadata?: Record<string, unknown>,
 *   }
 *
 * Uniqueness is enforced by the COALESCE-based unique index on
 * (flag_key, tenant_id, user_id).
 */
app.put('/:key', async (c) => {
  const db = getDatabaseClient();
  if (!db) {
    return c.json(
      { success: false, error: { code: 'NO_DB', message: 'Database is not configured' } },
      503
    );
  }

  const tenantId = resolveActiveTenantId(c);
  const flagKey = c.req.param('key');
  const body = await c.req.json().catch(() => ({}));

  const enabled = Boolean(body?.enabled);
  const userId: string | null = body?.userId ?? null;
  const rolloutPercent: number | null =
    typeof body?.rolloutPercent === 'number' ? body.rolloutPercent : null;
  const metadata = (body?.metadata ?? {}) as Record<string, unknown>;

  if (rolloutPercent != null && (rolloutPercent < 0 || rolloutPercent > 100)) {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_ROLLOUT_PERCENT',
          message: 'rolloutPercent must be between 0 and 100',
        },
      },
      400
    );
  }

  const { featureFlags } = await import('@bossnyumba/database');

  // Look up existing row at the exact same scope.
  const existing = await db
    .select()
    .from(featureFlags)
    .where(
      and(
        eq(featureFlags.flagKey, flagKey),
        eq(featureFlags.tenantId, tenantId),
        userId == null ? isNull(featureFlags.userId) : eq(featureFlags.userId, userId)
      )
    )
    .limit(1);

  const now = new Date();

  if (existing[0]) {
    const [updated] = await db
      .update(featureFlags)
      .set({ enabled, rolloutPercent, metadata, updatedAt: now })
      .where(eq(featureFlags.id, existing[0].id))
      .returning();
    return c.json({ success: true, data: updated });
  }

  const [inserted] = await db
    .insert(featureFlags)
    .values({
      id: generateId(),
      flagKey,
      tenantId,
      userId,
      enabled,
      rolloutPercent,
      metadata,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return c.json({ success: true, data: inserted }, 201);
});

/**
 * DELETE /admin/feature-flags/:key
 *
 * Removes the tenant-scoped row(s) for `flag_key = key`. Optional `userId`
 * query param narrows deletion to a single user-scoped row. Global rows are
 * never touched here.
 */
app.delete('/:key', async (c) => {
  const db = getDatabaseClient();
  if (!db) {
    return c.json(
      { success: false, error: { code: 'NO_DB', message: 'Database is not configured' } },
      503
    );
  }

  const tenantId = resolveActiveTenantId(c);
  const flagKey = c.req.param('key');
  const userIdParam = c.req.query('userId');

  const { featureFlags } = await import('@bossnyumba/database');

  const result = await db
    .delete(featureFlags)
    .where(
      and(
        eq(featureFlags.flagKey, flagKey),
        eq(featureFlags.tenantId, tenantId),
        userIdParam ? eq(featureFlags.userId, userIdParam) : isNull(featureFlags.userId)
      )
    )
    .returning({ id: featureFlags.id });

  return c.json({ success: true, data: { deleted: result.length } });
});

export const adminFeatureFlagsRouter = app;
