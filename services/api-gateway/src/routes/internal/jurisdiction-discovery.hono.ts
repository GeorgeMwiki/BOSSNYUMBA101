// other .hono routers in this directory.
/**
 * /api/v1/internal/jurisdiction-discovery — JC-1 loopback endpoint
 * (real-estate edition).
 *
 *   POST /api/v1/internal/jurisdiction-discovery/discover
 *     Body: { tenantId?: string, country: string }
 *     Returns the canonical `DiscoveryResult` shape consumed by
 *     `bossnyumba.jurisdiction.discover` brain tool (see
 *     services/api-gateway/src/composition/brain-tools/
 *     jurisdiction-discovery-tools.ts).
 *
 *     Pipeline:
 *       1. seeded short-circuit  (jurisdiction-resolver SNAPSHOTS map)
 *       2. cache lookup          (discovered_jurisdictions table, 0295)
 *       3. parallel web + corpus probes
 *       4. synthesize JurisdictionProfile
 *       5. best-effort cache write
 *
 * Tenant scope: the cache table is GLOBAL with `is_bossnyumba_internal_admin`
 * RLS. The loopback dispatcher mints a `PLATFORM_ADMIN` JWT so the
 * upstream auth middleware accepts the request and the discovery
 * worker can fill the cache transparently.
 *
 * NOT MOUNTED in services/api-gateway/src/index.ts — phase 3 of the
 * launch-green wave wires the internal route mount. Until then the
 * brain-tool descriptor falls back to its degraded stub (validityScore
 * = 0.2) and the file is a no-op import target. Ported from Borjie
 * (`tenant-jurisdiction.hono.ts` companion pattern).
 *
 * Hard rules respected:
 *   - No `console.*` — Pino only.
 *   - `databaseMiddleware` binds the tenant context for any reads
 *     against `intelligence_corpus_chunks` (global rows are
 *     tenant_id IS NULL so they leak through regardless).
 *   - `authMiddleware` requires the loopback service JWT; non-admin
 *     callers are 403-rejected at the role-check below.
 *   - HTML-shaped fields (snippets) are length-clipped at the
 *     synthesizer; the response carries plain JSON only — no raw
 *     HTML interpolation reaches the user.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import pino from 'pino';

import { authMiddleware } from '../../middleware/hono-auth.js';
import { databaseMiddleware } from '../../middleware/database.js';
import { getSharedPerTenantRateBudget } from '../../middleware/per-tenant-rate-budget.js';
import {
  createDrizzleCorpusSearch,
  createDrizzleDiscoveryCache,
  createJurisdictionDiscoveryService,
  type BrainWebSearchAdapter,
} from '../../services/jurisdiction-discovery/index.js';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  name: 'jurisdiction-discovery-route',
});

const DiscoverBody = z.object({
  tenantId: z.string().optional(),
  country: z.string().min(2).max(60),
});

/**
 * No-op web-search adapter used when no live web-search tool is wired
 * into the gateway composition (test / dev / staging without an
 * external integration). The discovery pipeline still runs — corpus
 * hits drive the synthesis and the response surfaces `lowConfidence`
 * when both streams are empty. Production wiring substitutes a real
 * adapter (e.g. brain's Brave / SerpAPI gateway tool) at boot time.
 */
const NOOP_WEB_SEARCH: BrainWebSearchAdapter = {
  async search() {
    return [];
  },
};

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);
app.use('*', getSharedPerTenantRateBudget({ surface: 'brain' }).handler);

/**
 * Role guard — only the loopback service token (PLATFORM_ADMIN) or
 * an admin user reaches this surface. Returns 403 otherwise.
 */
app.use('*', async (c, next) => {
  const auth = c.get('auth');
  if (!auth) {
    return c.json(
      {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Auth context missing' },
      },
      401,
    );
  }
  const role = String(auth.role ?? '').toUpperCase();
  if (role !== 'PLATFORM_ADMIN' && role !== 'ADMIN') {
    return c.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Internal discovery surface — admin role required',
        },
      },
      403,
    );
  }
  await next();
});

app.post(
  '/discover',
  zValidator('json', DiscoverBody),
  async (c) => {
    const body = c.req.valid('json');
    const db = c.get('db');

    const cache = createDrizzleDiscoveryCache(db ?? null);
    const corpus = createDrizzleCorpusSearch(db ?? null);
    const service = createJurisdictionDiscoveryService({
      webSearch: NOOP_WEB_SEARCH,
      corpus,
      cache,
    });

    try {
      const result = await service.discover(body.country);
      // Flatten into the shape `bossnyumba.jurisdiction.discover` brain
      // tool consumes — profile fields hoisted alongside origin /
      // lowConfidence / sources + bilingual promotion hint.
      const promotionHint = result.lowConfidence
        ? 'Discovery returned low confidence — once I see corroborating evidence I can offer to permanently add this jurisdiction (requires BossNyumba internal admin approval).'
        : 'Discovery succeeded. If you want this jurisdiction added to the curated seed (so every tenant inherits it without a discovery hit), I can draft the request — final approval is a BossNyumba internal admin step.';
      return c.json({
        success: true,
        data: {
          countryCode: result.profile.countryCode,
          countryName: result.profile.countryName,
          regulators: result.profile.regulators,
          currency: result.profile.currency,
          languages: result.profile.languages,
          legalFramework: result.profile.legalFramework,
          validityScore: result.profile.validityScore,
          origin: result.origin,
          lowConfidence: result.lowConfidence,
          sources: result.sources,
          promotionHint,
        },
      });
    } catch (err) {
      logger.warn(
        {
          err: err instanceof Error ? err.message : String(err),
          country: body.country,
        },
        'jurisdiction-discovery: discover failed',
      );
      return c.json(
        {
          success: false,
          error: {
            code: 'DISCOVERY_FAILED',
            message: 'Jurisdiction discovery pipeline failed',
          },
        },
        500,
      );
    }
  },
);

export default app;
