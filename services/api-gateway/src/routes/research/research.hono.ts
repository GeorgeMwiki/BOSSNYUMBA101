/**
 * Research router (BossNyumba) — makes the deep-research engine reachable.
 *
 * Mounted at `/api/v1/research`. Drives the BossNyumba research engine
 * end-to-end (plan → execute corpus + live web in parallel → score →
 * synthesize with citations → cross-reference verify → audit-anchored
 * cited result):
 *
 *   POST /v1/research/reactive   — quick cited answer (reactive mode)
 *   POST /v1/research/deep-dive  — multi-step deep dive (deep-dive mode)
 *
 * Tenant id + actor id come from `c.get('auth')` (JWT-derived). The client
 * never supplies these in the body — that would let a caller forge a tenant.
 * Bodies are zod-validated; only the `query`/`topic` text is trusted from
 * the client.
 *
 * Both routes are state-touching (they read the tenant corpus + emit an
 * audit anchor) so each is wrapped in `withSecurityEvents` for the audit
 * trail. The engine is read off `c.get('services').researchEngine` — the
 * composition root (`research-wiring.ts` + index.ts) wires it. When the
 * engine is missing every route returns 503 rather than crashing.
 *
 * `databaseMiddleware` binds the tenant GUC so the corpus adapter's reads
 * against `intelligence_corpus_chunks` are RLS-scoped (global `tenant_id
 * IS NULL` rows leak through regardless). Pino-only logging upstream.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { withSecurityEvents } from '@bossnyumba/observability';

import { authMiddleware } from '../../middleware/hono-auth.js';
import { databaseMiddleware } from '../../middleware/database.js';
import type { ResearchEngine } from '../../composition/research/research-engine.js';

type AnyCtx = {
  get(key: string): unknown;
  req: { json(): Promise<unknown> };
  json(body: unknown, status?: number): Response;
};

function getEngine(c: AnyCtx): ResearchEngine | undefined {
  const services = (c.get('services') ?? {}) as Record<string, unknown>;
  return services.researchEngine as ResearchEngine | undefined;
}

const ENGINE_MISSING = 'RESEARCH_ENGINE_MISSING';
const ENGINE_MISSING_MSG = 'research engine is not wired in this environment';

function unavailable(c: AnyCtx): Response {
  return c.json(
    { success: false, error: { code: ENGINE_MISSING, message: ENGINE_MISSING_MSG } },
    503,
  );
}

function badJson(c: AnyCtx): Response {
  return c.json(
    { success: false, error: { code: 'INVALID_JSON', message: 'invalid JSON body' } },
    400,
  );
}

function badRequest(c: AnyCtx, message: string): Response {
  return c.json({ success: false, error: { code: 'BAD_REQUEST', message } }, 400);
}

function missingTenant(c: AnyCtx): Response {
  return c.json(
    {
      success: false,
      error: { code: 'MISSING_TENANT_OR_USER', message: 'auth context missing tenantId/userId' },
    },
    401,
  );
}

const PARSE_FAILED = Symbol('parse_failed');

async function parseJsonBody(c: AnyCtx): Promise<unknown | symbol> {
  try {
    return await c.req.json();
  } catch {
    return PARSE_FAILED;
  }
}

// ────────────────────────────────────────────────────────────────────
// Request schemas
// ────────────────────────────────────────────────────────────────────

const ReactiveBodySchema = z
  .object({
    query: z.string().min(1).max(4000),
  })
  .strict();

const DeepDiveBodySchema = z
  .object({
    query: z.string().min(1).max(4000),
    /** Short topic label for traceability. */
    topic: z.string().min(1).max(200),
  })
  .strict();

function resultPayload(out: Awaited<ReturnType<ResearchEngine['reactiveQuery']>>) {
  return {
    summaryMd: out.summaryMd,
    confidence: out.confidence,
    citations: out.citations,
    corroboratingSources: out.corroboratingSources,
    auditHash: out.auditHash,
    mode: out.mode,
    durationMs: out.durationMs,
    llmSynthesized: out.llmSynthesized,
  };
}

// ────────────────────────────────────────────────────────────────────
// Router
// ────────────────────────────────────────────────────────────────────

const router = new Hono();
router.use('*', authMiddleware);
router.use('*', databaseMiddleware);

router.post(
  '/reactive',
  withSecurityEvents(
    { action: 'research.reactive', resource: 'research', severity: 'notice' },
    async (c: AnyCtx): Promise<Response> => {
      const engine = getEngine(c);
      if (!engine) return unavailable(c);

      const body = await parseJsonBody(c);
      if (body === PARSE_FAILED) return badJson(c);

      const parsed = ReactiveBodySchema.safeParse(body);
      if (!parsed.success) return badRequest(c, parsed.error.message);

      const auth = c.get('auth') as { tenantId?: string; userId?: string } | undefined;
      if (!auth?.tenantId || !auth?.userId) return missingTenant(c);

      try {
        const out = await engine.reactiveQuery({
          tenantId: auth.tenantId,
          query: parsed.data.query,
        });
        return c.json({ success: true, data: resultPayload(out) });
      } catch (err) {
        return c.json(
          {
            success: false,
            error: {
              code: 'RESEARCH_FAILED',
              message: err instanceof Error ? err.message : 'unknown error',
            },
          },
          500,
        );
      }
    },
  ),
);

router.post(
  '/deep-dive',
  withSecurityEvents(
    { action: 'research.deep-dive', resource: 'research', severity: 'notice' },
    async (c: AnyCtx): Promise<Response> => {
      const engine = getEngine(c);
      if (!engine) return unavailable(c);

      const body = await parseJsonBody(c);
      if (body === PARSE_FAILED) return badJson(c);

      const parsed = DeepDiveBodySchema.safeParse(body);
      if (!parsed.success) return badRequest(c, parsed.error.message);

      const auth = c.get('auth') as { tenantId?: string; userId?: string } | undefined;
      if (!auth?.tenantId || !auth?.userId) return missingTenant(c);

      try {
        const out = await engine.deepDive({
          tenantId: auth.tenantId,
          query: parsed.data.query,
          topic: parsed.data.topic,
        });
        return c.json({ success: true, data: resultPayload(out) });
      } catch (err) {
        return c.json(
          {
            success: false,
            error: {
              code: 'RESEARCH_FAILED',
              message: err instanceof Error ? err.message : 'unknown error',
            },
          },
          500,
        );
      }
    },
  ),
);

export default router;
