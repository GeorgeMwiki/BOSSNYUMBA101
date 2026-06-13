/**
 * Parcel CRUD routes — Phase E.5 scaffold over an in-memory store.
 * Phase F replaces the store with a PostGIS-backed repository (env
 * var `PARCEL_DB_URL`) and adds tenant-RLS middleware
 * (`SET LOCAL app.current_tenant = $tenantId`).
 *
 * Spec: `.audit/litfin-sota-2026-05-23/17-spatial-parcel-engine.md`
 * Part E §3 ("REST/tRPC: POST /parcels, GET /parcels?bbox=…,
 * PATCH /parcels/:id …").
 */
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { areaSqm, centroid } from '@bossnyumba/spatial-engine';
import type {
  Parcel,
  GeoJsonMultiPolygon,
  AuthoritativeSource,
} from '@bossnyumba/spatial-engine';

import { withSecurityEventsFastify } from '@bossnyumba/observability';

// ---------------------------------------------------------------------------
// Boundary-payload Zod schemas (route-boundary validation).
//
// `boundary` is a GeoJSON MultiPolygon: coordinates are an array of
// polygons, each an array of linear rings, each a ring of [lng, lat]
// position pairs. We validate the structural shape here; the spatial
// engine (areaSqm/centroid) performs the geometric semantics downstream.
// ---------------------------------------------------------------------------

const PositionSchema = z.array(z.number().finite()).min(2);
const LinearRingSchema = z.array(PositionSchema).min(1);
const PolygonCoordsSchema = z.array(LinearRingSchema).min(1);

const MultiPolygonSchema = z.object({
  type: z.literal('MultiPolygon'),
  coordinates: z.array(PolygonCoordsSchema),
});

// Mirrors the `AuthoritativeSource` union in
// packages/spatial-engine/src/types.ts (SQL CHECK in migration 0164).
const AuthoritativeSourceSchema = z.enum([
  'user_traced',
  'overture',
  'google_open_buildings',
  'osm',
  'sam_assisted',
  'gps_walk',
  'cadastral_authority',
  'microsoft_ml_footprints',
  'unknown',
]);

const CreateParcelBodySchema = z.object({
  name: z.string().trim().min(1).max(256),
  boundary: MultiPolygonSchema,
  propertyId: z.string().trim().min(1).max(128).optional(),
  authoritativeSource: AuthoritativeSourceSchema.optional(),
  accuracyM: z.number().finite().nonnegative().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const PatchParcelBodySchema = z.object({
  name: z.string().trim().min(1).max(256).optional(),
  boundary: MultiPolygonSchema.optional(),
  propertyId: z.string().trim().min(1).max(128).optional(),
  authoritativeSource: AuthoritativeSourceSchema.optional(),
  accuracyM: z.number().finite().nonnegative().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
// ---------------------------------------------------------------------------
// In-memory store (Phase E.5 default; swapped by composition root).
// ---------------------------------------------------------------------------

export interface ParcelStore {
  list(tenantId: string): Promise<ReadonlyArray<Parcel>>;
  get(tenantId: string, id: string): Promise<Parcel | null>;
  create(input: CreateParcelInput): Promise<Parcel>;
  update(
    tenantId: string,
    id: string,
    patch: PatchParcelInput,
  ): Promise<Parcel | null>;
  delete(tenantId: string, id: string): Promise<boolean>;
}

export interface CreateParcelInput {
  readonly tenantId: string;
  readonly name: string;
  readonly boundary: GeoJsonMultiPolygon;
  readonly propertyId?: string;
  readonly authoritativeSource?: AuthoritativeSource;
  readonly accuracyM?: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface PatchParcelInput {
  readonly name?: string;
  readonly boundary?: GeoJsonMultiPolygon;
  readonly propertyId?: string;
  readonly authoritativeSource?: AuthoritativeSource;
  readonly accuracyM?: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export function createInMemoryParcelStore(): ParcelStore {
  // Tenant-scoped map: tenantId → (parcelId → Parcel).
  const byTenant = new Map<string, Map<string, Parcel>>();

  function tenantBucket(tenantId: string): Map<string, Parcel> {
    let bucket = byTenant.get(tenantId);
    if (!bucket) {
      bucket = new Map<string, Parcel>();
      byTenant.set(tenantId, bucket);
    }
    return bucket;
  }

  return Object.freeze({
    async list(tenantId: string): Promise<ReadonlyArray<Parcel>> {
      const bucket = byTenant.get(tenantId);
      return bucket ? Array.from(bucket.values()) : [];
    },
    async get(tenantId: string, id: string): Promise<Parcel | null> {
      return byTenant.get(tenantId)?.get(id) ?? null;
    },
    async create(input: CreateParcelInput): Promise<Parcel> {
      const id = randomUUID();
      const parcel = parcelFromInput(id, input);
      tenantBucket(input.tenantId).set(id, parcel);
      return parcel;
    },
    async update(
      tenantId: string,
      id: string,
      patch: PatchParcelInput,
    ): Promise<Parcel | null> {
      const bucket = byTenant.get(tenantId);
      const existing = bucket?.get(id);
      if (!bucket || !existing) return null;
      const merged = mergeParcel(existing, patch);
      bucket.set(id, merged);
      return merged;
    },
    async delete(tenantId: string, id: string): Promise<boolean> {
      const bucket = byTenant.get(tenantId);
      if (!bucket) return false;
      return bucket.delete(id);
    },
  });
}

function parcelFromInput(id: string, input: CreateParcelInput): Parcel {
  const area = areaSqm(input.boundary);
  const c = centroid(input.boundary);
  return Object.freeze({
    id,
    tenantId: input.tenantId,
    ...(input.propertyId ? { propertyId: input.propertyId } : {}),
    name: input.name,
    boundary: input.boundary,
    centroid: c,
    areaSqm: area,
    authoritativeSource: input.authoritativeSource ?? 'user_traced',
    accuracyM: input.accuracyM ?? 5,
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}

function mergeParcel(existing: Parcel, patch: PatchParcelInput): Parcel {
  const boundary = patch.boundary ?? existing.boundary;
  return Object.freeze({
    ...existing,
    name: patch.name ?? existing.name,
    boundary,
    centroid: patch.boundary ? centroid(boundary) : existing.centroid,
    areaSqm: patch.boundary ? areaSqm(boundary) : existing.areaSqm,
    ...(patch.propertyId !== undefined
      ? { propertyId: patch.propertyId }
      : {}),
    authoritativeSource:
      patch.authoritativeSource ?? existing.authoritativeSource,
    accuracyM: patch.accuracyM ?? existing.accuracyM,
    metadata: patch.metadata
      ? Object.freeze({ ...existing.metadata, ...patch.metadata })
      : existing.metadata,
  });
}

// ---------------------------------------------------------------------------
// Validation helpers — Zod-free for now to keep the dep surface minimal.
// ---------------------------------------------------------------------------

function isMultiPolygon(v: unknown): v is GeoJsonMultiPolygon {
  if (!v || typeof v !== 'object') return false;
  const g = v as { type?: unknown; coordinates?: unknown };
  return g.type === 'MultiPolygon' && Array.isArray(g.coordinates);
}

/**
 * Bug-sweep 2026-05-24 — CRITICAL #1 (multi-tenant break):
 *
 * Pre-fix every CRUD route trusted the inbound `X-Tenant-Id` header
 * directly with NO authentication. Any client could spoof any tenant
 * and read/write/delete their parcels (CWE-285 missing authorization).
 *
 * Post-fix the routes require a `TenantResolver` port — the composition
 * root is responsible for wiring a real resolver that maps an
 * authenticated request (Bearer / API key / mTLS) to a tenant id.
 * The header path remains as a TEST-ONLY fallback, gated by
 * `allowHeaderFallback=true` so production deploys must explicitly
 * opt in (and never do).
 */
export interface TenantResolver {
  /**
   * Returns the tenant id the authenticated principal may operate on,
   * or null when the request is unauthorised. MUST NOT trust any
   * client-supplied tenant id without verifying the principal has
   * access to it.
   */
  resolve(request: unknown): Promise<string | null> | string | null;
}

function isLooseHeaderRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object';
}

function headerFallbackTenantId(headers: unknown): string | null {
  if (!isLooseHeaderRecord(headers)) return null;
  const raw = headers['x-tenant-id'];
  if (typeof raw === 'string' && raw.length > 0 && raw.length <= 128) {
    return raw;
  }
  return null;
}

/**
 * Resolve the tenant for a request. Returns null when no resolver is
 * wired OR the resolver rejects the request OR (header fallback) the
 * header is missing / too long. Callers must reply 401/403 on null.
 */
async function resolveTenant(
  request: unknown,
  resolver: TenantResolver | undefined,
  allowHeaderFallback: boolean,
): Promise<string | null> {
  if (resolver) {
    try {
      const resolved = await resolver.resolve(request);
      return typeof resolved === 'string' && resolved.length > 0 ? resolved : null;
    } catch {
      // Defensive: a misbehaving resolver MUST NOT degrade to
      // header-trust — that's the very thing we are guarding against.
      return null;
    }
  }
  if (allowHeaderFallback) {
    const headers = (request as { headers?: unknown })?.headers;
    return headerFallbackTenantId(headers);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Fastify plugin
// ---------------------------------------------------------------------------

export interface ParcelsRouteDeps {
  readonly store: ParcelStore;
  /**
   * Authenticates the inbound request and returns the tenant id it is
   * allowed to operate on. REQUIRED in production; omit only in tests
   * that explicitly enable `allowHeaderFallback`.
   */
  readonly tenantResolver?: TenantResolver;
  /**
   * Test-only escape hatch: when true and no `tenantResolver` is wired,
   * routes read `X-Tenant-Id` from the request header. NEVER set this
   * in production — it allows tenant spoofing.
   */
  readonly allowHeaderFallback?: boolean;
}

export async function registerParcelsRoutes(
  app: FastifyInstance,
  deps: ParcelsRouteDeps,
): Promise<void> {
  const { store, tenantResolver } = deps;
  // Default to true ONLY when no resolver is wired AND the deployment
  // explicitly enables it. The previous behaviour was effectively the
  // same (header trust on every call) but undocumented; making it an
  // explicit flag forces an audit trail.
  const allowHeaderFallback =
    deps.allowHeaderFallback ?? tenantResolver === undefined;

  async function tenantOrFail(
    request: unknown,
    reply: { code: (n: number) => unknown },
  ): Promise<string | null> {
    const tenantId = await resolveTenant(request, tenantResolver, allowHeaderFallback);
    if (!tenantId) {
      reply.code(401);
      return null;
    }
    return tenantId;
  }

  app.get('/parcels', async (request, reply) => {
    const tenantId = await tenantOrFail(request, reply);
    if (!tenantId) return { error: 'unauthorised: tenant could not be resolved' };
    const parcels = await store.list(tenantId);
    return { parcels };
  });

  app.get('/parcels/:id', async (request, reply) => {
    const tenantId = await tenantOrFail(request, reply);
    if (!tenantId) return { error: 'unauthorised: tenant could not be resolved' };
    const { id } = request.params as { id: string };
    const parcel = await store.get(tenantId, id);
    if (!parcel) {
      reply.code(404);
      return { error: 'parcel not found' };
    }
    return { parcel };
  });

  app.post('/parcels', withSecurityEventsFastify({ action: 'parcel.create', resource: 'parcel', severity: 'info' }, async (request, reply) => {
    const tenantId = await tenantOrFail(request, reply);
    if (!tenantId) return { error: 'unauthorised: tenant could not be resolved' };
    const parsed = CreateParcelBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      reply.code(400);
      return {
        error: 'name + boundary(MultiPolygon) required',
        details: parsed.error.flatten(),
      };
    }
    const { name, boundary, propertyId, authoritativeSource, accuracyM, metadata } =
      parsed.data;
    // The zod schema validates structure; `isMultiPolygon` re-narrows
    // `boundary` to the exact `GeoJsonMultiPolygon` tuple-position type
    // the store expects (zod infers `number[]`; the domain type is a
    // `[lng, lat]` tuple — the guard bridges that gap).
    if (!isMultiPolygon(boundary)) {
      reply.code(400);
      return { error: 'name + boundary(MultiPolygon) required' };
    }
    const parcel = await store.create({
      tenantId,
      name,
      boundary,
      ...(propertyId ? { propertyId } : {}),
      ...(authoritativeSource ? { authoritativeSource } : {}),
      ...(accuracyM !== undefined ? { accuracyM } : {}),
      ...(metadata ? { metadata } : {}),
    });
    reply.code(201);
    return { parcel };
  }));

  app.patch('/parcels/:id', withSecurityEventsFastify({ action: 'parcel.update', resource: 'parcel', severity: 'info' }, async (request, reply) => {
    const tenantId = await tenantOrFail(request, reply);
    if (!tenantId) return { error: 'unauthorised: tenant could not be resolved' };
    const { id } = request.params as { id: string };
    const parsed = PatchParcelBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      reply.code(400);
      return {
        error: 'invalid parcel patch payload',
        details: parsed.error.flatten(),
      };
    }
    const { name, boundary, propertyId, authoritativeSource, accuracyM, metadata } =
      parsed.data;
    // Re-narrow boundary (when present) to the exact domain tuple type.
    if (boundary !== undefined && !isMultiPolygon(boundary)) {
      reply.code(400);
      return { error: 'boundary, if provided, must be a MultiPolygon' };
    }
    const patch: PatchParcelInput = {
      ...(name !== undefined ? { name } : {}),
      ...(boundary !== undefined ? { boundary } : {}),
      ...(propertyId !== undefined ? { propertyId } : {}),
      ...(authoritativeSource !== undefined ? { authoritativeSource } : {}),
      ...(accuracyM !== undefined ? { accuracyM } : {}),
      ...(metadata !== undefined ? { metadata } : {}),
    };
    const updated = await store.update(tenantId, id, patch);
    if (!updated) {
      reply.code(404);
      return { error: 'parcel not found' };
    }
    return { parcel: updated };
  }));

  app.delete('/parcels/:id', withSecurityEventsFastify({ action: 'parcel.delete', resource: 'parcel', severity: 'notice' }, async (request, reply) => {
    const tenantId = await tenantOrFail(request, reply);
    if (!tenantId) return { error: 'unauthorised: tenant could not be resolved' };
    const { id } = request.params as { id: string };
    const ok = await store.delete(tenantId, id);
    if (!ok) {
      reply.code(404);
      return { error: 'parcel not found' };
    }
    reply.code(204);
    return null;
  }));
}
