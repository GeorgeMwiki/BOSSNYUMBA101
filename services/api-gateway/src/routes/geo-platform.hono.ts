/**
 * Geo-platform router.
 *
 *   POST /geo-platform/area-insights
 *
 * Wraps `fetchAreaInsights` from `@bossnyumba/geo-platform`.
 * Returns the bundled Solar + Air Quality + Pollen + drive-time
 * sample for a coordinate. Partial-failure tolerant — per-section
 * errors are surfaced inside the response payload.
 *
 * Tenant-scoped + audit-logged. NB: this is a POST (not GET)
 * because the input includes a structured list of drive-time
 * targets that exceed a reasonable URL length.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { and, eq, isNotNull } from 'drizzle-orm';
import { fetchAreaInsights } from '@bossnyumba/geo-platform';
import { properties, withTenantContext } from '@bossnyumba/database';
import { withSecurityEvents } from '@bossnyumba/observability';
import { authMiddleware } from '../middleware/hono-auth.js';
import { safeInternalError } from '../utils/safe-error.js';

type AnyCtx = any;

// Properties store a single point (lat/lng), not a surveyed boundary. Paint a
// small square (~±22m) around the point so the map renders a clickable parcel.
const PARCEL_HALF_DEG = 0.0002;

function statusColor(status: string | null | undefined): string {
  switch (status) {
    case 'active':
    case 'occupied':
      return '#34D399'; // emerald — occupied/active
    case 'maintenance':
      return '#F59E0B'; // amber — under maintenance
    default:
      return '#E5B26B'; // brand gold — draft / other
  }
}

const WaypointSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })
  .passthrough();

const AreaInsightsInputSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  driveTimeTargets: z
    .array(
      z.object({
        label: z.string().min(1).max(128),
        destination: WaypointSchema,
      }),
    )
    .max(20)
    .optional(),
  include: z
    .object({
      solar: z.boolean().optional(),
      airQuality: z.boolean().optional(),
      pollen: z.boolean().optional(),
      routes: z.boolean().optional(),
    })
    .optional(),
});

const router = new Hono();
router.use('*', authMiddleware);

router.post(
  '/area-insights',
  withSecurityEvents(
    {
      action: 'geo-platform.run',
      resource: 'geo-platform',
      severity: 'info',
    },
    async (c: AnyCtx) => {
      const tenantId = c.get('tenantId');
      if (!tenantId) {
        return c.json(
          {
            success: false,
            error: { code: 'MISSING_TENANT', message: 'tenantId required' },
          },
          400,
        );
      }
      let body;
      try {
        body = await c.req.json();
      } catch {
        return c.json(
          {
            success: false,
            error: { code: 'INVALID_JSON', message: 'invalid JSON body' },
          },
          400,
        );
      }
      const parsed = AreaInsightsInputSchema.safeParse(body);
      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: { code: 'BAD_REQUEST', message: parsed.error.message },
          },
          400,
        );
      }
      try {
        const result = await fetchAreaInsights(parsed.data as never);
        return c.json({ success: true, data: result });
      } catch (e) {
        return safeInternalError(c, e, {
          code: 'ADVISOR_ERROR',
          fallback: 'geo-platform failed',
        });
      }
    },
  ),
);

// GET /geo-platform/parcels — the tenant's geocoded properties as painted
// parcels for the admin geo map. Real source: the properties register
// (latitude/longitude). Properties without coordinates are omitted; a tenant
// with no geocoded properties gets an empty list (the map renders, no parcels).
router.get(
  '/parcels',
  withSecurityEvents(
    {
      action: 'geo-platform.parcels',
      resource: 'geo-platform',
      severity: 'info',
    },
    async (c: AnyCtx) => {
      const tenantId = c.get('tenantId');
      if (!tenantId) {
        return c.json(
          {
            success: false,
            error: { code: 'MISSING_TENANT', message: 'tenantId required' },
          },
          400,
        );
      }
      const db = (c.get('services') ?? {}).db;
      if (!db) {
        // Service registry not bound (degraded boot) — honest empty, not a 500.
        return c.json({ success: true, data: { parcels: [] } });
      }
      try {
        const rows = await withTenantContext(db, tenantId, async (sdb: AnyCtx) =>
          sdb
            .select({
              id: properties.id,
              name: properties.name,
              status: properties.status,
              latitude: properties.latitude,
              longitude: properties.longitude,
            })
            .from(properties)
            .where(
              and(
                eq(properties.tenantId, tenantId),
                isNotNull(properties.latitude),
                isNotNull(properties.longitude),
              ),
            )
            .limit(500),
        );
        const parcels = (rows as ReadonlyArray<AnyCtx>)
          .map((r) => {
            const lat = Number(r.latitude);
            const lng = Number(r.longitude);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
            const d = PARCEL_HALF_DEG;
            return {
              id: r.id,
              label: r.name ?? r.id,
              center: { lat, lng },
              polygon: [
                [lat - d, lng - d],
                [lat - d, lng + d],
                [lat + d, lng + d],
                [lat + d, lng - d],
              ] as ReadonlyArray<readonly [number, number]>,
              color: statusColor(r.status),
            };
          })
          .filter((p): p is NonNullable<typeof p> => p !== null);
        return c.json({ success: true, data: { parcels } });
      } catch (e) {
        return safeInternalError(c, e, {
          code: 'ADVISOR_ERROR',
          fallback: 'geo-platform parcels failed',
        });
      }
    },
  ),
);

export default router;
