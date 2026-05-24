/**
 * Parcel MCP wrapper — exposes parcel-service capabilities to the
 * AI copilot. Three tools per spec Part E §3:
 *
 *   1. `parcel.search_by_address` — geocode → bbox query → GeoJSON
 *      list (returns up to N parcels whose centroid is near the
 *      geocoded point).
 *   2. `parcel.trace_from_satellite` — snap a click point to the
 *      nearest reference building footprint (Overture / Open
 *      Buildings). Phase F upgrades this to call SAM 2.1 server-side
 *      for true magic-trace.
 *   3. `parcel.list_in_bbox` — list every parcel whose centroid falls
 *      inside `[minLon,minLat,maxLon,maxLat]`.
 *
 * Tenant scoping is mandatory on every tool (matches the kernel-wide
 * per-tenant allowlist guard pattern from mcp-server-nin /
 * mcp-server-nggis).
 *
 * Spec: `.audit/litfin-sota-2026-05-23/17-spatial-parcel-engine.md`
 * Part E §3.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type {
  BoundingBox,
  GeoJsonPoint,
  Parcel,
} from '../_spatial-engine-shim.js';
import type { GeocoderChain } from '../geocoder/chain.js';
import type { ParcelStore } from '../routes/parcels.js';
import type { SnapCandidateSource } from '../snap/nearest-building.js';
import { snapNearest } from '../snap/nearest-building.js';

const DEFAULT_NAME = 'bossnyumba-mcp-parcel';
const DEFAULT_VERSION = '0.1.0';
const ALLOWLIST_ENV_VAR = 'MCP_TENANT_ALLOWLIST';
const DEFAULT_BBOX_RADIUS_M = 1500;

// ---------------------------------------------------------------------------
// Tool descriptors
// ---------------------------------------------------------------------------

interface ParcelToolDescriptor {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
}

const PARCEL_TOOLS: ReadonlyArray<ParcelToolDescriptor> = Object.freeze([
  {
    name: 'parcel.search_by_address',
    description:
      'Geocode an address (Google → Plus Codes → what3words → Nominatim) and return parcels whose centroid is within `bboxRadiusM` of the resolved point.',
    inputSchema: {
      type: 'object',
      properties: {
        tenantId: { type: 'string', description: 'Tenant scope' },
        address: { type: 'string', description: 'Free-form address query' },
        bboxRadiusM: {
          type: 'number',
          description: `Search radius in metres around the geocoded point (default ${DEFAULT_BBOX_RADIUS_M}).`,
        },
        countryCode: {
          type: 'string',
          description: 'ISO-3166-1 alpha-2 country hint (e.g. "KE")',
        },
      },
      required: ['tenantId', 'address'],
      additionalProperties: false,
    },
  },
  {
    name: 'parcel.trace_from_satellite',
    description:
      'Snap a click-on-satellite (lat,lng) to the nearest reference building footprint (Overture / Google Open Buildings). Phase F upgrades this to a SAM 2.1 magic-trace.',
    inputSchema: {
      type: 'object',
      properties: {
        tenantId: { type: 'string' },
        lat: { type: 'number', minimum: -90, maximum: 90 },
        lng: { type: 'number', minimum: -180, maximum: 180 },
        radiusM: {
          type: 'number',
          description: 'Snap radius in metres (default 25)',
        },
      },
      required: ['tenantId', 'lat', 'lng'],
      additionalProperties: false,
    },
  },
  {
    name: 'parcel.list_in_bbox',
    description:
      'List parcels whose centroid falls inside the given WGS84 bounding box.',
    inputSchema: {
      type: 'object',
      properties: {
        tenantId: { type: 'string' },
        minLon: { type: 'number' },
        minLat: { type: 'number' },
        maxLon: { type: 'number' },
        maxLat: { type: 'number' },
      },
      required: ['tenantId', 'minLon', 'minLat', 'maxLon', 'maxLat'],
      additionalProperties: false,
    },
  },
]);

export function listParcelMcpTools(): ReadonlyArray<ParcelToolDescriptor> {
  return PARCEL_TOOLS;
}

// ---------------------------------------------------------------------------
// Adapter contract (composition root injects real deps)
// ---------------------------------------------------------------------------

export interface ParcelMcpDeps {
  readonly store: ParcelStore;
  readonly chain: GeocoderChain;
  readonly snapSource: SnapCandidateSource;
}

export interface ParcelMcpServerConfig extends ParcelMcpDeps {
  readonly name?: string;
  readonly version?: string;
  /** Per-tenant allowlist (CRITICAL #4) — see mcp-server-nin/src/index.ts. */
  readonly allowlist?: ReadonlyArray<string>;
}

export interface ParcelMcpServerHandle {
  readonly server: Server;
  readonly tools: ReadonlyArray<ParcelToolDescriptor>;
}

function readEnvAllowlist(): ReadonlyArray<string> | null {
  const raw = process.env[ALLOWLIST_ENV_VAR];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, ReadonlyArray<string>>;
    const list = parsed?.parcel;
    return Array.isArray(list) ? list : null;
  } catch {
    return null;
  }
}

function errorResponse(message: string): {
  isError: true;
  content: ReadonlyArray<{ type: 'text'; text: string }>;
} {
  return {
    isError: true,
    content: [{ type: 'text', text: message }],
  };
}

function okResponse(payload: unknown): {
  content: ReadonlyArray<{ type: 'text'; text: string }>;
} {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload) }],
  };
}

// ---------------------------------------------------------------------------
// Server factory
// ---------------------------------------------------------------------------

export function createParcelMcpServer(
  config: ParcelMcpServerConfig,
): ParcelMcpServerHandle {
  const server = new Server(
    {
      name: config.name ?? DEFAULT_NAME,
      version: config.version ?? DEFAULT_VERSION,
    },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: PARCEL_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  }));

  const allowlist: ReadonlyArray<string> | null =
    config.allowlist ?? readEnvAllowlist() ?? null;

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArgs, _meta } = request.params;
    const args = (rawArgs ?? {}) as Record<string, unknown>;

    // Tenant scoping (mirrors mcp-server-nin / mcp-server-nggis pattern).
    const tenantId = pickTenantId(args, _meta);
    if (!tenantId) {
      return errorResponse(
        'parcel: missing tenantId — required in args.tenantId or request._meta.tenantId',
      );
    }
    const resolvedAllowlist =
      allowlist ??
      (process.env.NODE_ENV === 'production'
        ? ([] as ReadonlyArray<string>)
        : null);
    if (resolvedAllowlist && !resolvedAllowlist.includes(tenantId)) {
      return errorResponse(
        `parcel: tenant '${tenantId}' is not in the per-tenant allowlist`,
      );
    }

    try {
      switch (name) {
        case 'parcel.search_by_address':
          return okResponse(await searchByAddress(args, tenantId, config));
        case 'parcel.trace_from_satellite':
          return okResponse(await traceFromSatellite(args, config));
        case 'parcel.list_in_bbox':
          return okResponse(await listInBbox(args, tenantId, config));
        default:
          return errorResponse(
            `Unknown tool: ${name}. Known tools: ${PARCEL_TOOLS.map((t) => t.name).join(', ')}`,
          );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      return errorResponse(`parcel error in ${name}: ${message}`);
    }
  });

  return Object.freeze({ server, tools: PARCEL_TOOLS });
}

function pickTenantId(
  args: Record<string, unknown>,
  meta: unknown,
): string | null {
  if (typeof args.tenantId === 'string' && args.tenantId.length > 0) {
    return args.tenantId;
  }
  if (meta && typeof meta === 'object') {
    const m = meta as { tenantId?: unknown };
    if (typeof m.tenantId === 'string' && m.tenantId.length > 0) {
      return m.tenantId;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

interface SearchByAddressArgs {
  readonly address: string;
  readonly bboxRadiusM?: number;
  readonly countryCode?: string;
}

interface SearchByAddressResult {
  readonly resolved: {
    readonly lat: number;
    readonly lng: number;
    readonly source: string;
    readonly confidence: number;
  };
  readonly parcels: ReadonlyArray<Parcel>;
}

async function searchByAddress(
  raw: Record<string, unknown>,
  tenantId: string,
  deps: ParcelMcpDeps,
): Promise<SearchByAddressResult> {
  const args = raw as Partial<SearchByAddressArgs>;
  if (typeof args.address !== 'string' || !args.address.trim()) {
    throw new Error('parcel.search_by_address requires args.address');
  }
  const geocoded = await deps.chain.geocode({
    address: args.address,
    ...(args.countryCode ? { countryCode: args.countryCode } : {}),
  });
  if (!geocoded) {
    return {
      resolved: { lat: 0, lng: 0, source: 'none', confidence: 0 },
      parcels: [],
    };
  }
  const [lng, lat] = geocoded.point.coordinates;
  const radiusM =
    typeof args.bboxRadiusM === 'number' && args.bboxRadiusM > 0
      ? args.bboxRadiusM
      : DEFAULT_BBOX_RADIUS_M;
  const bbox = bboxFromPoint(geocoded.point, radiusM);
  const all = await deps.store.list(tenantId);
  const filtered = all.filter((p) => pointInBbox(p.centroid, bbox));
  return {
    resolved: {
      lat,
      lng,
      source: geocoded.provider,
      confidence: geocoded.confidence,
    },
    parcels: filtered,
  };
}

interface TraceArgs {
  readonly lat: number;
  readonly lng: number;
  readonly radiusM?: number;
}

async function traceFromSatellite(
  raw: Record<string, unknown>,
  deps: ParcelMcpDeps,
): Promise<unknown> {
  const args = raw as Partial<TraceArgs>;
  if (typeof args.lat !== 'number' || typeof args.lng !== 'number') {
    throw new Error('parcel.trace_from_satellite requires lat + lng');
  }
  const result = await snapNearest(
    {
      point: { type: 'Point', coordinates: [args.lng, args.lat] },
      ...(typeof args.radiusM === 'number' && args.radiusM > 0
        ? { radiusM: args.radiusM }
        : {}),
    },
    deps.snapSource,
  );
  if (!result) return { snapped: false };
  return {
    snapped: true,
    buildingId: result.building.id,
    source: result.building.source,
    footprint: result.building.footprint,
    distanceM: result.distanceM,
  };
}

interface ListBboxArgs {
  readonly minLon: number;
  readonly minLat: number;
  readonly maxLon: number;
  readonly maxLat: number;
}

async function listInBbox(
  raw: Record<string, unknown>,
  tenantId: string,
  deps: ParcelMcpDeps,
): Promise<{ readonly parcels: ReadonlyArray<Parcel> }> {
  const args = raw as Partial<ListBboxArgs>;
  if (
    typeof args.minLon !== 'number' ||
    typeof args.minLat !== 'number' ||
    typeof args.maxLon !== 'number' ||
    typeof args.maxLat !== 'number'
  ) {
    throw new Error('parcel.list_in_bbox requires minLon/minLat/maxLon/maxLat');
  }
  const bbox: BoundingBox = {
    minLon: args.minLon,
    minLat: args.minLat,
    maxLon: args.maxLon,
    maxLat: args.maxLat,
  };
  const all = await deps.store.list(tenantId);
  return { parcels: all.filter((p) => pointInBbox(p.centroid, bbox)) };
}

// ---------------------------------------------------------------------------
// Internal geo helpers
// ---------------------------------------------------------------------------

function pointInBbox(p: GeoJsonPoint, bbox: BoundingBox): boolean {
  const [lon, lat] = p.coordinates;
  return (
    lon >= bbox.minLon &&
    lon <= bbox.maxLon &&
    lat >= bbox.minLat &&
    lat <= bbox.maxLat
  );
}

/**
 * Crude metres→degrees expansion (good enough for tenant-scale
 * < 5 km bbox queries; PostGIS replaces this in Phase F).
 */
function bboxFromPoint(point: GeoJsonPoint, radiusM: number): BoundingBox {
  const [lon, lat] = point.coordinates;
  const degLat = radiusM / 111_320;
  const denom = Math.cos((lat * Math.PI) / 180) || 1e-6;
  const degLon = radiusM / (111_320 * denom);
  return {
    minLon: lon - degLon,
    maxLon: lon + degLon,
    minLat: lat - degLat,
    maxLat: lat + degLat,
  };
}

// ---------------------------------------------------------------------------
// Optional stdio entrypoint (mirrors mcp-server-nin/src/index.ts main()).
// Not invoked from the Fastify server — composition root calls
// createParcelMcpServer + plugs it into whichever transport is desired.
// ---------------------------------------------------------------------------

export async function runStdio(config: ParcelMcpServerConfig): Promise<void> {
  const { server } = createParcelMcpServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  const shutdown = (): void => process.exit(0);
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
