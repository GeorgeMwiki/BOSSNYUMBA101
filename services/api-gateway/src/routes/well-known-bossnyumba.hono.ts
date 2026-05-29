/**
 * /.well-known/bossnyumba-capabilities.json + /.well-known/mcp.json
 *
 * Serves the public capability manifest + MCP discovery doc so external
 * agents (Claude Code, Cursor, Windsurf, partner platforms, the
 * bossnyumba CLI / SDK) can fetch one URL and learn the full surface:
 *
 *   transports     — stdio / http / sse
 *   primitives     — sampling, roots, logging, progress, subscriptions,
 *                    streaming, sessions, actions
 *   scopes         — owner:read / owner:write / owner:draft / ...
 *   rate-limits    — per-scope token-bucket defaults
 *   four-eye       — high-stakes action prefixes
 *   tools          — descriptors
 *   resources      — read-only side-data
 *   prompts        — pre-canned templates
 *
 * G2-B closure: the previous version referenced
 * `@bossnyumba/mcp-server-bossnyumba` — a package that does not exist
 * in this workspace (the actual MCP package is `@bossnyumba/mcp-server`
 * and exposes a different shape). To unblock api-gateway boot without
 * a cross-package build dependency, this router serves a self-contained
 * inline stub manifest. When the dedicated `mcp-server-bossnyumba`
 * package is published, swap the inline builder for the package
 * `buildManifest()` call — the response contract is identical.
 *
 * Cache-Control: public, max-age=300 (5 minutes) — clients can poll
 * cheaply. Versioned by the manifest's own `version` field.
 */

import { Hono } from 'hono';

// ---------------------------------------------------------------------------
// Inline stub manifest builder (G2-B fix)
//
// Shape mirrors what Borjie's `services/mcp-server-borjie/src/manifest.ts`
// returns so the FE / CLI / SDK contract stays identical. The data is
// intentionally minimal — full discovery still ships via /api/v1/mcp/*
// routes; this is just the well-known stub for static crawlers.
// ---------------------------------------------------------------------------

export interface BossNyumbaCapabilityManifest {
  readonly name: string;
  readonly version: string;
  readonly protocolVersion: string;
  readonly mcp: {
    readonly transports: ReadonlyArray<'stdio' | 'http' | 'sse'>;
    readonly httpEndpoint: string;
    readonly sseEndpoint: string;
    readonly primitives: Readonly<Record<string, unknown>>;
    readonly tools: ReadonlyArray<{ readonly name: string; readonly description: string }>;
    readonly resources: ReadonlyArray<{ readonly uri: string; readonly name: string }>;
    readonly prompts: ReadonlyArray<{ readonly name: string; readonly description: string }>;
  };
  readonly auth: {
    readonly flow: 'oauth2_device';
    readonly deviceCodeEndpoint: string;
    readonly tokenEndpoint: string;
    readonly revokeEndpoint: string;
  };
  readonly scopes: ReadonlyArray<{
    readonly scope: string;
    readonly displayNameEn: string;
    readonly displayNameSw: string;
    readonly descriptionEn: string;
    readonly descriptionSw: string;
    readonly grantableByOwner: boolean;
  }>;
}

function buildManifestStub(opts: { readonly publicBaseUrl: string }): BossNyumbaCapabilityManifest {
  const base = opts.publicBaseUrl.replace(/\/+$/, '');
  return Object.freeze({
    name: 'bossnyumba-mcp-server',
    version: '0.1.0',
    protocolVersion: '2024-11-05',
    mcp: Object.freeze({
      transports: Object.freeze(['stdio' as const, 'http' as const, 'sse' as const]),
      httpEndpoint: `${base}/mcp`,
      sseEndpoint: `${base}/mcp/sse`,
      primitives: Object.freeze({
        sampling: true,
        roots: true,
        logging: true,
        progress: true,
        resultPartial: true,
        subscriptions: true,
        sessions: true,
        sse: true,
        actions: Object.freeze(['navigate', 'prefill', 'share', 'undo'] as const),
        perScopeRateLimit: true,
      }),
      tools: Object.freeze([
        { name: 'listings.search', description: 'Search public rental listings.' },
        { name: 'tenancy.draft', description: 'Draft a tenancy agreement from a template.' },
        { name: 'maintenance.dispatch', description: 'Dispatch a maintenance work order.' },
        { name: 'rent.confirm', description: 'Confirm receipt of rent payment.' },
        { name: 'owner.brief', description: 'Generate the owner executive brief.' },
      ]),
      resources: Object.freeze([
        { uri: 'bossnyumba://property/{id}', name: 'Property record' },
        { uri: 'bossnyumba://unit/{id}', name: 'Unit record' },
        { uri: 'bossnyumba://lease/{id}', name: 'Lease record' },
      ]),
      prompts: Object.freeze([
        { name: 'eviction-notice', description: 'Draft a jurisdiction-aware eviction notice.' },
        { name: 'rent-comparable', description: 'Compute rent comparables for a unit.' },
      ]),
    }),
    auth: Object.freeze({
      flow: 'oauth2_device' as const,
      deviceCodeEndpoint: `${base}/oauth/device/code`,
      tokenEndpoint: `${base}/oauth/token`,
      revokeEndpoint: `${base}/oauth/revoke`,
    }),
    scopes: Object.freeze([
      {
        scope: 'owner:read',
        displayNameEn: 'Owner read',
        displayNameSw: 'Mmiliki: kusoma',
        descriptionEn: 'Read-only access to the owner cockpit.',
        descriptionSw: 'Ufikiaji wa kusoma tu wa cockpit ya mmiliki.',
        grantableByOwner: true,
      },
      {
        scope: 'owner:write',
        displayNameEn: 'Owner write',
        displayNameSw: 'Mmiliki: kuandika',
        descriptionEn: 'Mutate owner-managed records.',
        descriptionSw: 'Badilisha kumbukumbu zinazosimamiwa na mmiliki.',
        grantableByOwner: true,
      },
      {
        scope: 'staff:read',
        displayNameEn: 'Staff read',
        displayNameSw: 'Wafanyakazi: kusoma',
        descriptionEn: 'Read property staff records.',
        descriptionSw: 'Soma kumbukumbu za wafanyakazi.',
        grantableByOwner: true,
      },
    ]),
  });
}

export function createWellKnownBossNyumbaRouter(opts: { readonly publicBaseUrl: string }): Hono {
  const router = new Hono();

  const manifest = buildManifestStub({ publicBaseUrl: opts.publicBaseUrl });

  router.get('/.well-known/bossnyumba-capabilities.json', (c) => {
    c.header('Cache-Control', 'public, max-age=300');
    c.header('Content-Type', 'application/json; charset=utf-8');
    return c.json(manifest);
  });

  // MCP discovery doc — mirrors the `mcp` slice of the capability
  // manifest so a pure-MCP client can fetch only what it needs.
  router.get('/.well-known/mcp.json', (c) => {
    c.header('Cache-Control', 'public, max-age=300');
    c.header('Content-Type', 'application/json; charset=utf-8');
    return c.json({
      version: manifest.version,
      issuer: opts.publicBaseUrl,
      transports: manifest.mcp.transports,
      primitives: manifest.mcp.primitives,
      scopes: manifest.scopes,
      tools: manifest.mcp.tools,
      resources: manifest.mcp.resources,
      prompts: manifest.mcp.prompts,
    });
  });

  return router;
}
