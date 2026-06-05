/**
 * Geo / geofencing brain tools (real-estate edition) — Gap-4 (a).
 *
 * Ported from Borjie's `composition/brain-tools/geo-tools.ts` and
 * retargeted mining → real estate:
 *   - `mining.geo.*`                  → `property.geo.*`
 *   - site / pit / region             → property / unit / block
 *   - mining title (licence) polygon  → property parcel / title boundary
 *   - hazard zone                     → site hazard zone (flood / works /
 *                                       restricted-access)
 *   - PCCB / NEMC / EITI zone         → planning / zoning authority area
 *
 * Five READ-ONLY tools, persona-gated, no audit chain (READ stakes = LOW).
 * Each tool would defer to a `/property/geo/*` (or `/property/portfolio-
 * map/*`) loopback endpoint so the LLM and the cockpit map render identical
 * data (no parallel data paths).
 *
 * HONEST-DEGRADE (CLAUDE.md hard rule + Gap-4 spec — "if BN lacks the
 * target map routes, honest-degrade (typed unavailable), do not invent"):
 * BN does NOT yet expose the per-property map loopback routes these tools
 * target (the only geo route shipped is `/geo-platform/area-insights`,
 * which is a different Solar/AirQuality/Pollen/drive-time surface). So
 * every tool returns a typed `available: false` shape with empty results
 * rather than a fabricated parcel / hazard / zone. The `MAP_ROUTES_WIRED`
 * flag below is the single switch that activates the real loopback once the
 * property-map routes land — flip it to `true` and the handlers call
 * `ctx.httpClient` with zero other changes. We deliberately do NOT call the
 * loopback while the routes are absent, because the loopback client throws
 * on a 404 (→ a tool DENIAL, which would read as an error, not the honest
 * "this is unavailable" the brain should relay).
 */

import { z } from 'zod';
import type {
  PersonaToolDescriptor,
  PersonaToolHandlerContext,
} from './types.js';

/**
 * Single switch: are the `/property/geo/*` map loopback routes mounted in
 * the api-gateway yet? While `false`, every geo tool honest-degrades to a
 * typed `available:false` shape (never fabricates). Flip to `true` when the
 * routes land — the per-tool loopback branches below then activate.
 */
const MAP_ROUTES_WIRED = false;

const OWNER_MANAGER: ReadonlyArray<
  'T1_owner_strategist' | 'T3_module_manager'
> = ['T1_owner_strategist', 'T3_module_manager'];

const OWNER_ADMIN: ReadonlyArray<
  'T1_owner_strategist' | 'T2_admin_strategist'
> = ['T1_owner_strategist', 'T2_admin_strategist'];

const MANAGER_STAFF: ReadonlyArray<
  'T3_module_manager' | 'T4_field_employee'
> = ['T3_module_manager', 'T4_field_employee'];

const MANAGER_ONLY: ReadonlyArray<'T3_module_manager'> = ['T3_module_manager'];

const PointInput = z.object({
  lat: z.number().gte(-90).lte(90),
  lon: z.number().gte(-180).lte(180),
});

/** True only when the loopback is BOTH wired AND a client is bound. */
function loopbackActive(ctx: PersonaToolHandlerContext): boolean {
  return MAP_ROUTES_WIRED && ctx.httpClient !== undefined;
}

// ---------------------------------------------------------------------------
// 1. property.geo.unit.nearby — owner's properties within R km of a point
// ---------------------------------------------------------------------------

const PropertyNearbyInput = PointInput.extend({
  radiusKm: z.number().positive().max(1000).default(50),
  limit: z.number().int().positive().max(50).default(20),
});

const PropertyNearbyOutput = z.object({
  available: z.boolean(),
  properties: z.array(
    z.object({
      propertyId: z.string(),
      propertyName: z.string(),
      distanceMeters: z.number(),
    }),
  ),
  point: PointInput,
});

export const geoPropertyNearbyTool: PersonaToolDescriptor<
  typeof PropertyNearbyInput,
  typeof PropertyNearbyOutput
> = {
  id: 'property.geo.unit.nearby',
  name: 'Geo — properties near a point (en) / Jiografia — mali zilizo karibu (sw)',
  description:
    "Return the owner's properties (buildings / units) within R km of the " +
    'supplied point. Read-only — would use PostGIS distance-to-nearest. ' +
    'Persona-gated to owner / manager. Honest-degrades to available:false ' +
    'with an empty list until the property-map routes are wired (never ' +
    'fabricates a property).',
  personaSlugs: OWNER_MANAGER,
  inputSchema: PropertyNearbyInput,
  outputSchema: PropertyNearbyOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const point = { lat: input.lat, lon: input.lon };
    if (!loopbackActive(ctx)) {
      return { available: false, properties: [], point };
    }
    const client = ctx.httpClient;
    if (!client) return { available: false, properties: [], point };
    const res = await client.get<{
      properties?: Array<{
        propertyId: string;
        propertyName: string;
        distanceMeters: number;
      }>;
    }>('/property/portfolio-map/nearest', {
      query: {
        tenantId: ctx.tenantId,
        lat: input.lat,
        lon: input.lon,
        radiusKm: input.radiusKm,
        limit: input.limit,
      },
    });
    const radiusMeters = input.radiusKm * 1000;
    const properties = (res.properties ?? []).filter(
      (p) => p.distanceMeters <= radiusMeters,
    );
    return { available: true, properties, point };
  },
};

// ---------------------------------------------------------------------------
// 2. property.geo.title.contains — does a point fall inside any parcel?
// ---------------------------------------------------------------------------

const TitleContainsInput = PointInput;
const TitleContainsOutput = z.object({
  available: z.boolean(),
  inside: z.boolean(),
  parcel: z
    .object({
      parcelId: z.string(),
      titleNumber: z.string(),
      blockId: z.string().nullable(),
      propertyId: z.string().nullable(),
    })
    .nullable(),
  point: PointInput,
});

export const geoTitleContainsTool: PersonaToolDescriptor<
  typeof TitleContainsInput,
  typeof TitleContainsOutput
> = {
  id: 'property.geo.title.contains',
  name: 'Geo — point inside a property parcel? (en) / Jiografia — eneo lipo ndani ya kiwanja? (sw)',
  description:
    "Check whether the supplied point falls inside any of the owner's " +
    'property parcel / title boundary polygons. Used for boundary-dispute ' +
    'checks and which-property-is-this lookups. Read-only. Honest-degrades ' +
    'to available:false (inside:false, parcel:null) until the property-map ' +
    'routes are wired (never fabricates a parcel).',
  personaSlugs: OWNER_ADMIN,
  inputSchema: TitleContainsInput,
  outputSchema: TitleContainsOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const point = { lat: input.lat, lon: input.lon };
    if (!loopbackActive(ctx)) {
      return { available: false, inside: false, parcel: null, point };
    }
    const client = ctx.httpClient;
    if (!client) {
      return { available: false, inside: false, parcel: null, point };
    }
    const res = await client.get<{
      parcel?: {
        parcelId: string;
        titleNumber: string;
        blockId: string | null;
        propertyId: string | null;
      } | null;
    }>('/property/portfolio-map/title-contains', {
      query: { tenantId: ctx.tenantId, lat: input.lat, lon: input.lon },
    });
    const parcel = res.parcel ?? null;
    return { available: true, inside: parcel !== null, parcel, point };
  },
};

// ---------------------------------------------------------------------------
// 3. property.geo.hazard.proximity — risk score from nearest site hazard
// ---------------------------------------------------------------------------

const HazardProximityInput = PointInput;
const HazardProximityOutput = z.object({
  available: z.boolean(),
  point: PointInput,
  riskScore: z.number().min(0).max(100),
  hazards: z.array(
    z.object({
      hazardId: z.string(),
      nameEn: z.string(),
      nameSw: z.string(),
      severity: z.enum(['advisory', 'caution', 'restricted']),
      category: z.string(),
      propertyId: z.string().nullable(),
    }),
  ),
  insideRestricted: z.boolean(),
});

export const geoHazardProximityTool: PersonaToolDescriptor<
  typeof HazardProximityInput,
  typeof HazardProximityOutput
> = {
  id: 'property.geo.hazard.proximity',
  name: 'Geo — site hazard proximity (en) / Jiografia — ukaribu wa hatari (sw)',
  description:
    'Return every site hazard zone (flood plain / active works / ' +
    'restricted-access) that contains the point plus a 0-100 risk score. ' +
    'restricted = 100, caution = 60, advisory = 10, no hits = 0. ' +
    'Persona-gated to manager / field staff. Honest-degrades to ' +
    'available:false (riskScore:0, empty hazards) until the property-map ' +
    'routes are wired (never fabricates a hazard).',
  personaSlugs: MANAGER_STAFF,
  inputSchema: HazardProximityInput,
  outputSchema: HazardProximityOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const point = { lat: input.lat, lon: input.lon };
    if (!loopbackActive(ctx)) {
      return {
        available: false,
        point,
        riskScore: 0,
        hazards: [],
        insideRestricted: false,
      };
    }
    const client = ctx.httpClient;
    if (!client) {
      return {
        available: false,
        point,
        riskScore: 0,
        hazards: [],
        insideRestricted: false,
      };
    }
    const res = await client.get<{
      hazards?: Array<{
        hazardId: string;
        nameEn: string;
        nameSw: string;
        severity: 'advisory' | 'caution' | 'restricted';
        category: string;
        propertyId: string | null;
      }>;
    }>('/property/hazard-zones/at-point', {
      query: { tenantId: ctx.tenantId, lat: input.lat, lon: input.lon },
    });
    const hazards = res.hazards ?? [];
    const riskScore = hazards.reduce((acc, h) => {
      if (h.severity === 'restricted') return Math.max(acc, 100);
      if (h.severity === 'caution') return Math.max(acc, 60);
      return Math.max(acc, 10);
    }, 0);
    return {
      available: true,
      point,
      riskScore,
      hazards,
      insideRestricted: hazards.some((h) => h.severity === 'restricted'),
    };
  },
};

// ---------------------------------------------------------------------------
// 4. property.geo.compliance.zone_of — planning / zoning authority area
// ---------------------------------------------------------------------------

const ComplianceZoneInput = PointInput.extend({
  authority: z.enum(['planning', 'zoning', 'environmental']).optional(),
});

const ComplianceZoneOutput = z.object({
  available: z.boolean(),
  point: PointInput,
  zones: z.array(
    z.object({
      zoneId: z.string(),
      authority: z.enum(['planning', 'zoning', 'environmental']),
      nameEn: z.string(),
      nameSw: z.string(),
      code: z.string(),
      attributes: z.record(z.unknown()),
    }),
  ),
  count: z.number().int().nonnegative(),
});

export const geoComplianceZoneTool: PersonaToolDescriptor<
  typeof ComplianceZoneInput,
  typeof ComplianceZoneOutput
> = {
  id: 'property.geo.compliance.zone_of',
  name: 'Geo — planning / zoning area of a point (en) / Jiografia — eneo la mipango (sw)',
  description:
    'Return the planning + zoning + environmental authority areas that ' +
    'contain the supplied point (e.g. which local-authority planning area ' +
    'a parcel sits in). Optional authority filter ' +
    '(planning|zoning|environmental). Read-only. Jurisdiction-neutral. ' +
    'Honest-degrades to available:false (empty zones) until the property-' +
    'map routes are wired (never fabricates a zone).',
  personaSlugs: OWNER_ADMIN,
  inputSchema: ComplianceZoneInput,
  outputSchema: ComplianceZoneOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const point = { lat: input.lat, lon: input.lon };
    if (!loopbackActive(ctx)) {
      return { available: false, point, zones: [], count: 0 };
    }
    const client = ctx.httpClient;
    if (!client) {
      return { available: false, point, zones: [], count: 0 };
    }
    const query: Record<string, string | number> = {
      lat: input.lat,
      lon: input.lon,
    };
    if (input.authority) query.authority = input.authority;
    const res = await client.get<{
      zones?: Array<{
        zoneId: string;
        authority: 'planning' | 'zoning' | 'environmental';
        nameEn: string;
        nameSw: string;
        code: string;
        attributes: Record<string, unknown>;
      }>;
    }>('/property/planning-zones/by-point', { query });
    const zones = res.zones ?? [];
    return { available: true, point, zones, count: zones.length };
  },
};

// ---------------------------------------------------------------------------
// 5. property.geo.route.optimize — A→B distance + ETA between properties
// ---------------------------------------------------------------------------

const RouteOptimizeInput = z.object({
  from: PointInput,
  to: PointInput,
  month: z.number().int().min(1).max(12).optional(),
});

const RouteOptimizeOutput = z.object({
  available: z.boolean(),
  distanceMeters: z.number(),
  estimatedMinutes: z.number(),
  wetSeasonPenalty: z.number(),
  note: z.string(),
});

export const geoRouteOptimizeTool: PersonaToolDescriptor<
  typeof RouteOptimizeInput,
  typeof RouteOptimizeOutput
> = {
  id: 'property.geo.route.optimize',
  name: 'Geo — route between two points (en) / Jiografia — njia kati ya maeneo mawili (sw)',
  description:
    'Return distance + ETA from A to B (e.g. between two properties a ' +
    'caretaker must visit) with a wet-season penalty applied for rainy ' +
    'months. Read-only. Honest-degrades to available:false (zeros) until ' +
    'the property-map routes are wired (never fabricates a route).',
  personaSlugs: MANAGER_ONLY,
  inputSchema: RouteOptimizeInput,
  outputSchema: RouteOptimizeOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    if (!loopbackActive(ctx)) {
      return {
        available: false,
        distanceMeters: 0,
        estimatedMinutes: 0,
        wetSeasonPenalty: 1,
        note: 'route optimizer unavailable — property-map routes not wired',
      };
    }
    const client = ctx.httpClient;
    if (!client) {
      return {
        available: false,
        distanceMeters: 0,
        estimatedMinutes: 0,
        wetSeasonPenalty: 1,
        note: 'route optimizer unavailable — no loopback client bound',
      };
    }
    const query: Record<string, string | number> = {
      tenantId: ctx.tenantId,
      fromLat: input.from.lat,
      fromLon: input.from.lon,
      toLat: input.to.lat,
      toLon: input.to.lon,
    };
    if (input.month !== undefined) query.month = input.month;
    const res = await client.get<{
      distanceMeters?: number;
      estimatedMinutes?: number;
      wetSeasonPenalty?: number;
      note?: string;
    }>('/property/portfolio-map/route-estimate', { query });
    return {
      available: true,
      distanceMeters: Number(res.distanceMeters ?? 0),
      estimatedMinutes: Number(res.estimatedMinutes ?? 0),
      wetSeasonPenalty: Number(res.wetSeasonPenalty ?? 1),
      note: String(res.note ?? ''),
    };
  },
};

// ---------------------------------------------------------------------------
// Catalog export — wired into composition/brain-tools/index.ts.
// ---------------------------------------------------------------------------

export const GEO_TOOLS: ReadonlyArray<
  PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>
> = Object.freeze([
  geoPropertyNearbyTool,
  geoTitleContainsTool,
  geoHazardProximityTool,
  geoComplianceZoneTool,
  geoRouteOptimizeTool,
] as unknown as ReadonlyArray<
  PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>
>);
