/**
 * /api/v1/marketplace/listings — G1-D closure (listings + applications).
 *
 * Direct-DB rental-marketplace surface. Sits alongside the legacy
 * marketplace.router.ts (which delegates to a service that returns 503
 * until the composition root wires a Postgres adapter) and serves the
 * five endpoints the buyer-mobile / owner-portal expect at launch:
 *
 *   POST   /                       publish a new listing
 *   GET    /mine                   landlord's own listings (auth tenant)
 *   GET    /nearby?lat&lng[&km=]   public haversine search
 *   PATCH  /:id                    landlord updates listing fields
 *   POST   /:id/applications       tenant applies to a listing
 *
 * Storage:
 *   - Listings: `marketplace_listings` (existing schema).
 *   - Applications: `ai_audit_chain` rows of action
 *     `marketplace.application.received` until a dedicated
 *     `marketplace_applications` table lands. The chain row IS the
 *     durable record; the FE can render history off it.
 *
 * Tenant isolation:
 *   - POST + GET /mine + PATCH: gated by authMiddleware, tenantId from
 *     JWT. Cross-tenant writes fail at the WITH CHECK predicate on
 *     marketplace_listings (RLS FORCE-enabled).
 *   - GET /nearby is anonymous on purpose — the marketplace IS the
 *     public discovery surface. Only `published` rows are returned.
 *
 * Bilingual sw/en: listing copy lives in `attributes.titleSw/titleEn`
 * + `attributes.descriptionSw/descriptionEn`. The router does not
 * transform either — it returns both for the FE to render.
 */

// dsar.router.ts.

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { randomUUID, createHash } from 'node:crypto';
import { and, eq, sql, desc } from 'drizzle-orm';

import {
  marketplaceListings,
  properties,
  units,
} from '@bossnyumba/database';

import { authMiddleware } from '../../middleware/hono-auth';
import { databaseMiddleware } from '../../middleware/database';
import { getSharedPerTenantRateBudget } from '../../middleware/per-tenant-rate-budget';
import { createLogger } from '../../utils/logger';

const moduleLogger = createLogger('marketplace-listings');

// ---------------------------------------------------------------------------
// Hash-chain audit helper (inline for the gap-closure commit).
// ---------------------------------------------------------------------------

interface AuditAppendPayload {
  readonly action: string;
  readonly tenantId: string;
  readonly turnId: string;
  readonly userId: string;
  readonly details: Readonly<Record<string, unknown>>;
}

async function appendAuditEntry(
  db: any,
  payload: AuditAppendPayload,
): Promise<string> {
  const id = randomUUID();
  const canonical = JSON.stringify({
    tenantId: payload.tenantId,
    turnId: payload.turnId,
    action: payload.action,
    userId: payload.userId,
    details: payload.details,
  });
  const latestResult: unknown = await db.execute(
    sql`SELECT COALESCE(MAX(sequence_id), 0) AS max_seq,
               (SELECT this_hash FROM ai_audit_chain
                WHERE tenant_id = ${payload.tenantId}
                ORDER BY sequence_id DESC LIMIT 1) AS last_hash
        FROM ai_audit_chain
        WHERE tenant_id = ${payload.tenantId}`,
  );
  const rows =
    (latestResult as { rows?: ReadonlyArray<Record<string, unknown>> }).rows ??
    (latestResult as ReadonlyArray<Record<string, unknown>>);
  const head = rows[0] ?? {};
  const maxSeq = Number(head.max_seq ?? 0);
  const lastHash =
    typeof head.last_hash === 'string' && head.last_hash.length > 0
      ? head.last_hash
      : '';
  const sequenceId = maxSeq + 1;
  const prevHash = lastHash;
  const thisHash = createHash('sha256')
    .update(prevHash + canonical)
    .digest('hex');
  await db.execute(sql`
    INSERT INTO ai_audit_chain (
      id, tenant_id, sequence_id, turn_id, action,
      prev_hash, this_hash, payload, created_at
    ) VALUES (
      ${id},
      ${payload.tenantId},
      ${sequenceId},
      ${payload.turnId},
      ${payload.action},
      ${prevHash},
      ${thisHash},
      ${JSON.stringify({ userId: payload.userId, details: payload.details })}::jsonb,
      ${new Date().toISOString()}
    )
  `);
  return id;
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const MediaItemSchema = z.object({
  type: z.enum(['photo', 'video', 'floor_360', 'street_view']),
  url: z.string().url().max(2048),
  caption: z.string().max(500).optional(),
});

const CreateListingSchema = z.object({
  unitId: z.string().min(1),
  propertyId: z.string().optional(),
  listingKind: z.enum(['rent', 'lease', 'sale']),
  headlinePrice: z.number().int().positive(),
  // Currency MUST be supplied by the client — the tenant config layer
  // resolves it from `tenants.primary_currency`. We do not default to
  // TZS / KES here to keep the multi-currency hard rule.
  currency: z.string().min(3).max(8),
  negotiable: z.boolean().default(true),
  media: z.array(MediaItemSchema).max(40).optional(),
  attributes: z.record(z.unknown()).optional(),
  expiresAt: z.string().datetime().optional(),
  publishImmediately: z.boolean().default(false),
});

const PatchListingSchema = z.object({
  headlinePrice: z.number().int().positive().optional(),
  currency: z.string().min(3).max(8).optional(),
  negotiable: z.boolean().optional(),
  media: z.array(MediaItemSchema).max(40).optional(),
  attributes: z.record(z.unknown()).optional(),
  status: z.enum(['draft', 'published', 'paused', 'closed']).optional(),
  expiresAt: z.string().datetime().optional(),
});

const NearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  km: z.coerce.number().positive().max(100).default(5),
  listingKind: z.enum(['rent', 'lease', 'sale']).optional(),
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

const ApplyBodySchema = z.object({
  applicantName: z.string().min(1).max(200),
  applicantPhone: z.string().min(7).max(40),
  applicantEmail: z.string().email().optional(),
  message: z.string().max(2000).optional(),
  offerPrice: z.number().int().positive().optional(),
  // English default per CLAUDE.md (flipped 2026-05).
  locale: z.enum(['sw', 'en']).default('en'),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonError(
  code: string,
  message: string,
  status: 400 | 401 | 403 | 404 | 409 | 500 | 503,
) {
  return { status, body: { success: false as const, error: { code, message } } };
}

// Haversine distance in km. Lat/lng in decimal degrees.
function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export function createMarketplaceListingsRouter(): Hono {
  const app = new Hono();
  const rateBudget = getSharedPerTenantRateBudget({ surface: 'api' }).handler;
  app.use('/nearby', databaseMiddleware);
  app.use('/mine', authMiddleware);
  app.use('/mine', databaseMiddleware);
  app.use('/mine', rateBudget);
  app.use('/', authMiddleware);
  app.use('/', databaseMiddleware);
  app.use('/', rateBudget);
  app.use('/:id', authMiddleware);
  app.use('/:id', databaseMiddleware);
  app.use('/:id', rateBudget);
  app.use('/:id/applications', authMiddleware);
  app.use('/:id/applications', databaseMiddleware);
  app.use('/:id/applications', rateBudget);

  // -------------------------------------------------------------------------
  // POST / — publish a new listing.
  //
  // Validates ownership of the unit (tenant_id match) before insert.
  // Status defaults to `draft` unless publishImmediately=true; in that
  // case we set published_at = now() so the row appears in /nearby
  // immediately.
  // -------------------------------------------------------------------------
  app.post('/', zValidator('json', CreateListingSchema), async (c: any) => {
    const auth = c.get('auth') ?? {};
    const { tenantId, userId } = auth as {
      tenantId?: string;
      userId?: string;
    };
    if (!tenantId || !userId) {
      const err = jsonError('UNAUTHORIZED', 'Authentication required', 401);
      return c.json(err.body, err.status);
    }
    const db = c.get('db');
    if (!db) {
      const err = jsonError(
        'MARKETPLACE_UNAVAILABLE',
        'database is not configured on this gateway',
        503,
      );
      return c.json(err.body, err.status);
    }
    const body = c.req.valid('json') as z.infer<typeof CreateListingSchema>;

    try {
      // Verify the unit belongs to the authenticated tenant.
      const [unitRow] = await db
        .select({ id: units.id, propertyId: units.propertyId })
        .from(units)
        .where(and(eq(units.id, body.unitId), eq(units.tenantId, tenantId)))
        .limit(1);
      if (!unitRow) {
        const err = jsonError(
          'UNIT_NOT_FOUND',
          'Unit not found in tenant scope',
          404,
        );
        return c.json(err.body, err.status);
      }

      const id = randomUUID();
      const now = new Date();
      const row = {
        id,
        tenantId,
        unitId: body.unitId,
        propertyId: body.propertyId ?? unitRow.propertyId,
        listingKind: body.listingKind,
        headlinePrice: body.headlinePrice,
        currency: body.currency,
        negotiable: body.negotiable,
        media: body.media ?? [],
        attributes: body.attributes ?? {},
        status: body.publishImmediately
          ? ('published' as const)
          : ('draft' as const),
        publishedAt: body.publishImmediately ? now : null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        createdAt: now,
        createdBy: userId,
        updatedAt: now,
        updatedBy: userId,
      };
      await db.insert(marketplaceListings).values(row);

      return c.json({ success: true as const, data: row }, 201);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'create listing failed';
      moduleLogger.error('marketplace listings POST failed', {
        evt: 'marketplace_listing_create_failed',
        tenantId,
        reason: message,
      });
      const e = jsonError('MARKETPLACE_LISTING_CREATE_FAILED', message, 500);
      return c.json(e.body, e.status);
    }
  });

  // -------------------------------------------------------------------------
  // GET /mine — paginated listings owned by the authenticated tenant.
  // -------------------------------------------------------------------------
  app.get('/mine', async (c: any) => {
    const auth = c.get('auth') ?? {};
    const { tenantId } = auth as { tenantId?: string };
    if (!tenantId) {
      const err = jsonError('UNAUTHORIZED', 'Authentication required', 401);
      return c.json(err.body, err.status);
    }
    const db = c.get('db');
    if (!db) {
      const err = jsonError(
        'MARKETPLACE_UNAVAILABLE',
        'database is not configured on this gateway',
        503,
      );
      return c.json(err.body, err.status);
    }

    try {
      const rows = await db
        .select()
        .from(marketplaceListings)
        .where(eq(marketplaceListings.tenantId, tenantId))
        .orderBy(desc(marketplaceListings.createdAt))
        .limit(100);
      return c.json(
        {
          success: true as const,
          data: rows,
          meta: { total: rows.length },
        },
        200,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'list mine failed';
      moduleLogger.error('marketplace listings /mine failed', {
        evt: 'marketplace_listings_mine_failed',
        tenantId,
        reason: message,
      });
      const e = jsonError('MARKETPLACE_LISTINGS_MINE_FAILED', message, 500);
      return c.json(e.body, e.status);
    }
  });

  // -------------------------------------------------------------------------
  // GET /nearby — public haversine search.
  //
  // Anonymous on purpose. Only returns rows where status = 'published'.
  // Joins to `properties` for lat/lng and computes haversine in JS
  // (≤200 rows scanned), then sorts by distance ascending. For >5k
  // rows we should swap this for PostGIS ST_DWithin in a follow-up.
  // -------------------------------------------------------------------------
  app.get(
    '/nearby',
    zValidator('query', NearbyQuerySchema),
    async (c: any) => {
      const db = c.get('db');
      if (!db) {
        const err = jsonError(
          'MARKETPLACE_UNAVAILABLE',
          'database is not configured on this gateway',
          503,
        );
        return c.json(err.body, err.status);
      }
      const q = c.req.valid('query') as z.infer<typeof NearbyQuerySchema>;

      try {
        const baseConditions = [
          eq(marketplaceListings.status, 'published'),
        ];
        if (q.listingKind) {
          baseConditions.push(
            eq(marketplaceListings.listingKind, q.listingKind as never),
          );
        }
        if (q.minPrice !== undefined) {
          baseConditions.push(
            sql`${marketplaceListings.headlinePrice} >= ${q.minPrice}`,
          );
        }
        if (q.maxPrice !== undefined) {
          baseConditions.push(
            sql`${marketplaceListings.headlinePrice} <= ${q.maxPrice}`,
          );
        }

        const rows = await db
          .select({
            id: marketplaceListings.id,
            tenantId: marketplaceListings.tenantId,
            unitId: marketplaceListings.unitId,
            propertyId: marketplaceListings.propertyId,
            listingKind: marketplaceListings.listingKind,
            headlinePrice: marketplaceListings.headlinePrice,
            currency: marketplaceListings.currency,
            negotiable: marketplaceListings.negotiable,
            media: marketplaceListings.media,
            attributes: marketplaceListings.attributes,
            status: marketplaceListings.status,
            publishedAt: marketplaceListings.publishedAt,
            propertyLatitude: properties.latitude,
            propertyLongitude: properties.longitude,
            propertyName: properties.name,
            propertyCity: properties.city,
          })
          .from(marketplaceListings)
          .leftJoin(
            properties,
            eq(marketplaceListings.propertyId, properties.id),
          )
          .where(and(...baseConditions))
          .limit(500);

        const withDistance = rows
          .filter(
            (r: Record<string, unknown>) =>
              r.propertyLatitude !== null && r.propertyLongitude !== null,
          )
          .map((r: Record<string, unknown>) => {
            const lat = parseFloat(String(r.propertyLatitude));
            const lng = parseFloat(String(r.propertyLongitude));
            const distanceKm = haversineKm(q.lat, q.lng, lat, lng);
            return { ...r, distanceKm };
          })
          .filter((r: { distanceKm: number }) => r.distanceKm <= q.km)
          .sort(
            (a: { distanceKm: number }, b: { distanceKm: number }) =>
              a.distanceKm - b.distanceKm,
          )
          .slice(0, q.limit);

        return c.json(
          {
            success: true as const,
            data: withDistance,
            meta: {
              total: withDistance.length,
              centerLat: q.lat,
              centerLng: q.lng,
              radiusKm: q.km,
            },
          },
          200,
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'nearby failed';
        moduleLogger.error('marketplace listings /nearby failed', {
          evt: 'marketplace_listings_nearby_failed',
          reason: message,
        });
        const e = jsonError(
          'MARKETPLACE_LISTINGS_NEARBY_FAILED',
          message,
          500,
        );
        return c.json(e.body, e.status);
      }
    },
  );

  // -------------------------------------------------------------------------
  // PATCH /:id — landlord updates listing fields.
  //
  // Status transitions are governed inline: draft -> published sets
  // published_at = now(); published -> closed wipes published_at.
  // -------------------------------------------------------------------------
  app.patch(
    '/:id',
    zValidator('json', PatchListingSchema),
    async (c: any) => {
      const auth = c.get('auth') ?? {};
      const { tenantId, userId } = auth as {
        tenantId?: string;
        userId?: string;
      };
      if (!tenantId || !userId) {
        const err = jsonError('UNAUTHORIZED', 'Authentication required', 401);
        return c.json(err.body, err.status);
      }
      const db = c.get('db');
      if (!db) {
        const err = jsonError(
          'MARKETPLACE_UNAVAILABLE',
          'database is not configured on this gateway',
          503,
        );
        return c.json(err.body, err.status);
      }
      const id = c.req.param('id');
      const body = c.req.valid('json') as z.infer<typeof PatchListingSchema>;

      try {
        const [existing] = await db
          .select()
          .from(marketplaceListings)
          .where(
            and(
              eq(marketplaceListings.id, id),
              eq(marketplaceListings.tenantId, tenantId),
            ),
          )
          .limit(1);
        if (!existing) {
          const err = jsonError(
            'LISTING_NOT_FOUND',
            'Listing not found in tenant scope',
            404,
          );
          return c.json(err.body, err.status);
        }

        const set: Record<string, unknown> = {
          updatedAt: new Date(),
          updatedBy: userId,
        };
        if (body.headlinePrice !== undefined) {
          set.headlinePrice = body.headlinePrice;
        }
        if (body.currency !== undefined) set.currency = body.currency;
        if (body.negotiable !== undefined) set.negotiable = body.negotiable;
        if (body.media !== undefined) set.media = body.media;
        if (body.attributes !== undefined) set.attributes = body.attributes;
        if (body.expiresAt !== undefined) {
          set.expiresAt = new Date(body.expiresAt);
        }
        if (body.status !== undefined) {
          set.status = body.status;
          if (
            body.status === 'published' &&
            existing.status !== 'published'
          ) {
            set.publishedAt = new Date();
          } else if (body.status === 'closed') {
            set.publishedAt = null;
          }
        }

        await db
          .update(marketplaceListings)
          .set(set)
          .where(eq(marketplaceListings.id, id));

        const [updated] = await db
          .select()
          .from(marketplaceListings)
          .where(eq(marketplaceListings.id, id))
          .limit(1);
        return c.json({ success: true as const, data: updated }, 200);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'patch failed';
        moduleLogger.error('marketplace listings PATCH failed', {
          evt: 'marketplace_listing_patch_failed',
          tenantId,
          id,
          reason: message,
        });
        const e = jsonError('MARKETPLACE_LISTING_PATCH_FAILED', message, 500);
        return c.json(e.body, e.status);
      }
    },
  );

  // -------------------------------------------------------------------------
  // POST /:id/applications — tenant applies to a listing.
  //
  // Writes an audit-chain row of action `marketplace.application.received`
  // under the LISTING's tenant (so the landlord sees it in their inbox)
  // and returns the chain id as the application id. A dedicated
  // `marketplace_applications` table can land in a follow-up commit
  // without breaking this contract.
  // -------------------------------------------------------------------------
  app.post(
    '/:id/applications',
    zValidator('json', ApplyBodySchema),
    async (c: any) => {
      const auth = c.get('auth') ?? {};
      // The applicant is authenticated against THEIR tenant (typically
      // the marketplace tenant), but the application is recorded under
      // the LISTING's tenant so the landlord can see it.
      const { userId } = auth as { userId?: string };
      if (!userId) {
        const err = jsonError('UNAUTHORIZED', 'Authentication required', 401);
        return c.json(err.body, err.status);
      }
      const db = c.get('db');
      if (!db) {
        const err = jsonError(
          'MARKETPLACE_UNAVAILABLE',
          'database is not configured on this gateway',
          503,
        );
        return c.json(err.body, err.status);
      }
      const id = c.req.param('id');
      const body = c.req.valid('json') as z.infer<typeof ApplyBodySchema>;

      try {
        const [listing] = await db
          .select()
          .from(marketplaceListings)
          .where(eq(marketplaceListings.id, id))
          .limit(1);
        if (!listing) {
          const err = jsonError(
            'LISTING_NOT_FOUND',
            'Listing not found',
            404,
          );
          return c.json(err.body, err.status);
        }
        if (listing.status !== 'published') {
          const err = jsonError(
            'LISTING_NOT_OPEN',
            `Listing is not open for applications (status="${listing.status}")`,
            409,
          );
          return c.json(err.body, err.status);
        }

        const applicationId = randomUUID();
        const chainId = await appendAuditEntry(db, {
          action: 'marketplace.application.received',
          tenantId: listing.tenantId,
          turnId: applicationId,
          userId,
          details: {
            applicationId,
            listingId: id,
            applicantUserId: userId,
            applicantName: body.applicantName,
            applicantPhone: body.applicantPhone,
            applicantEmail: body.applicantEmail ?? null,
            message: body.message ?? null,
            offerPrice: body.offerPrice ?? null,
            locale: body.locale,
            source: 'marketplace-buyer-mobile',
          },
        });

        return c.json(
          {
            success: true as const,
            data: {
              id: applicationId,
              listingId: id,
              status: 'received' as const,
              hashChainId: chainId,
              createdAt: new Date().toISOString(),
            },
          },
          201,
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'apply failed';
        moduleLogger.error('marketplace listings apply failed', {
          evt: 'marketplace_application_create_failed',
          listingId: id,
          reason: message,
        });
        const e = jsonError(
          'MARKETPLACE_APPLICATION_CREATE_FAILED',
          message,
          500,
        );
        return c.json(e.body, e.status);
      }
    },
  );

  return app;
}

export const marketplaceListingsRouter = createMarketplaceListingsRouter();
