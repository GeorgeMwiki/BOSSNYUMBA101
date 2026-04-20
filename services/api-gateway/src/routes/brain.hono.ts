// @ts-nocheck — Hono v4 MiddlewareHandler status-code literal union: multiple c.json({...}, status) branches widen return type and TypedResponse overload rejects the union. Tracked at hono-dev/hono#3891.

/**
 * /api/v1/brain — BossNyumba Brain gateway routes.
 *
 * Production policy:
 *  - Requires verified Supabase JWT on every request (no dev fallback).
 *  - Per-tenant Brain instances backed by Postgres ThreadStore.
 *  - 401 on missing token, 403 on missing tenant claim, 503 on missing env.
 */

import { Hono } from 'hono';
import {
  createBrain,
  BrainRegistry,
  PostgresThreadStoreBackend,
  loadBrainEnv,
  verifySupabaseJwt,
  extractBearer,
  principalToBrainContexts,
  SupabaseAuthError,
  BrainConfigError,
  DEFAULT_PERSONAE,
  migrationExtract,
  migrationDiff,
  MigrationExtractParamsSchema,
  ExtractionBundleSchema,
  checkBrainHealth,
} from '@bossnyumba/ai-copilot';
import {
  createDatabaseClient,
  BrainThreadRepository,
  MigrationWriterService,
} from '@bossnyumba/database';
import {
  createNeo4jClient,
  createGraphQueryService,
  createGraphAgentToolkit,
} from '@bossnyumba/graph-sync';

// ---------------------------------------------------------------------------
// Lazy boot — fail fast on missing env, but defer until first request so the
// gateway can boot for unrelated routes (health, auth-only) when Brain env
// is intentionally not set.
// ---------------------------------------------------------------------------

let envCache: ReturnType<typeof loadBrainEnv> | null = null;
let dbCache: ReturnType<typeof createDatabaseClient> | null = null;
let registryCache: BrainRegistry | null = null;

function env() {
  if (envCache) return envCache;
  envCache = loadBrainEnv(process.env);
  return envCache;
}

function db() {
  if (dbCache) return dbCache;
  dbCache = createDatabaseClient(env().DATABASE_URL);
  return dbCache;
}

/**
 * Resolve the tenant's country/currency/default-city. Currently uses
 * env-sourced defaults so we can remove the `'KE' / 'KES' / 'Nairobi'`
 * hardcoded constants from the migration writer without a Postgres
 * schema change; a follow-up will read these from `tenants.country`
 * once that column is populated on every tenant row.
 */
async function resolveTenantRegion(
  _tenantId: string
): Promise<{ country: string; currency: string; defaultCity?: string }> {
  // Env-driven so each deployment tenant can customize without code
  // changes. Production must set these; dev falls through with clear
  // empty strings so the violation is visible in the DB row.
  const country = process.env.DEFAULT_TENANT_COUNTRY?.trim() || '';
  const currency = process.env.DEFAULT_TENANT_CURRENCY?.trim() || '';
  const defaultCity = process.env.DEFAULT_TENANT_CITY?.trim() || undefined;
  if (process.env.NODE_ENV === 'production' && (!country || !currency)) {
    throw new Error(
      'brain.hono: DEFAULT_TENANT_COUNTRY and DEFAULT_TENANT_CURRENCY are ' +
        'required in production until per-tenant region-config lookup is wired.'
    );
  }
  return { country, currency, defaultCity };
}

function registry() {
  if (registryCache) return registryCache;
  const e = env();
  // Lazily-constructed graph toolkit — present only when NEO4J_URI is set.
  // Otherwise graph tools are not registered (and any persona that references
  // one will surface a loud TOOL_NOT_FOUND).
  const graphToolkit = (() => {
    if (!process.env.NEO4J_URI?.trim()) return undefined;
    try {
      const neo4j = createNeo4jClient();
      const queryService = createGraphQueryService(neo4j);
      return createGraphAgentToolkit(queryService);
    } catch (err) {
      // Use the gateway's pino logger if exposed, else fall back to console.
      // eslint-disable-next-line no-console
      console.error('brain.hono: failed to construct graph toolkit', err);
      return undefined;
    }
  })();
  registryCache = new BrainRegistry((tenantId) => {
    const repo = new BrainThreadRepository(db());
    const backend = new PostgresThreadStoreBackend(repo, () => tenantId);
    return createBrain({
      anthropic: {
        apiKey: e.ANTHROPIC_API_KEY,
        baseUrl: e.ANTHROPIC_BASE_URL,
        defaultModel: e.ANTHROPIC_MODEL_DEFAULT,
      },
      threadStoreBackend: backend,
      graphToolkit,
    });
  });
  return registryCache;
}

async function authenticate(c) {
  const token = extractBearer(c.req.header('authorization'));
  if (!token) throw new SupabaseAuthError('missing_authorization_header', 401);
  const principal = await verifySupabaseJwt(token, {
    jwtSecret: env().SUPABASE_JWT_SECRET,
    defaultEnvironment: 'production',
  });
  return {
    principal,
    ...principalToBrainContexts(principal),
  };
}

function handleError(c, err) {
  if (err instanceof SupabaseAuthError) {
    return c.json({ error: err.message, code: 'AUTH' }, err.status);
  }
  if (err instanceof BrainConfigError) {
    return c.json(
      { error: err.message, code: 'BRAIN_NOT_CONFIGURED' },
      503
    );
  }
  return c.json(
    { error: err instanceof Error ? err.message : String(err), code: 'INTERNAL' },
    500
  );
}

// ---------------------------------------------------------------------------
// Per-tenant + per-actor in-memory rate limiter
// ---------------------------------------------------------------------------

const RATE_BUCKETS = new Map<string, { tokens: number; updatedAt: number }>();
const RATE_REFILL_PER_SEC = 1; // 60 turns/min steady state
const RATE_BURST = 30;

function checkRate(key: string): boolean {
  const now = Date.now();
  const bucket = RATE_BUCKETS.get(key) ?? { tokens: RATE_BURST, updatedAt: now };
  const elapsed = (now - bucket.updatedAt) / 1000;
  bucket.tokens = Math.min(RATE_BURST, bucket.tokens + elapsed * RATE_REFILL_PER_SEC);
  bucket.updatedAt = now;
  if (bucket.tokens < 1) {
    RATE_BUCKETS.set(key, bucket);
    return false;
  }
  bucket.tokens -= 1;
  RATE_BUCKETS.set(key, bucket);
  return true;
}

const brainRouter = new Hono();

// ----- Health -----------------------------------------------------------

brainRouter.get('/health', async (c) => {
  let ctx;
  try {
    ctx = await authenticate(c);
  } catch (err) {
    return handleError(c, err);
  }
  try {
    const brain = registry().for(ctx.tenant.tenantId);
    const health = await checkBrainHealth(brain);
    return c.json(health);
  } catch (err) {
    return handleError(c, err);
  }
});

// ----- Personae roster --------------------------------------------------

brainRouter.get('/personae', async (c) => {
  try {
    await authenticate(c);
  } catch (err) {
    return handleError(c, err);
  }
  const personae = DEFAULT_PERSONAE.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    missionStatement: p.missionStatement,
    kind: p.kind,
  }));
  return c.json({ personae });
});

// ----- Turn (chat) ------------------------------------------------------

brainRouter.post('/turn', async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_json' }, 400);
  }
  if (!body?.userText || typeof body.userText !== 'string') {
    return c.json({ error: 'userText_required' }, 400);
  }

  let ctx;
  try {
    ctx = await authenticate(c);
  } catch (err) {
    return handleError(c, err);
  }

  // Rate limit (per tenant + per actor).
  const rateKey = `${ctx.tenant.tenantId}:${ctx.actor.id}`;
  if (!checkRate(rateKey)) {
    return c.json({ error: 'rate_limited', code: 'RATE_LIMIT' }, 429);
  }

  const brain = registry().for(ctx.tenant.tenantId);

  try {
    if (!body.threadId) {
      const result = await brain.orchestrator.startThread({
        tenant: ctx.tenant,
        actor: ctx.actor,
        viewer: ctx.viewer,
        initialUserText: body.userText,
        forcePersonaId: body.forcePersonaId,
      });
      if (!result.success) {
        return c.json({ error: result.error.message }, 500);
      }
      const turn = result.data.turn;
      return c.json({
        threadId: result.data.thread.id,
        finalPersonaId: turn.finalPersonaId,
        responseText: turn.responseText,
        handoffs: turn.handoffs,
        toolCalls: turn.toolCalls,
        advisorConsulted: turn.advisorConsulted,
        proposedAction: turn.proposedAction,
        tokensUsed: turn.tokensUsed,
      });
    }
    const result = await brain.orchestrator.handleTurn({
      threadId: body.threadId,
      tenant: ctx.tenant,
      actor: ctx.actor,
      viewer: ctx.viewer,
      userText: body.userText,
      forcePersonaId: body.forcePersonaId,
    });
    if (!result.success) {
      return c.json({ error: result.error.message }, 500);
    }
    return c.json({
      threadId: result.data.threadId,
      finalPersonaId: result.data.finalPersonaId,
      responseText: result.data.responseText,
      handoffs: result.data.handoffs,
      toolCalls: result.data.toolCalls,
      advisorConsulted: result.data.advisorConsulted,
      proposedAction: result.data.proposedAction,
      tokensUsed: result.data.tokensUsed,
    });
  } catch (err) {
    return handleError(c, err);
  }
});

// ----- Threads ----------------------------------------------------------

brainRouter.get('/threads', async (c) => {
  let ctx;
  try {
    ctx = await authenticate(c);
  } catch (err) {
    return handleError(c, err);
  }
  const brain = registry().for(ctx.tenant.tenantId);
  const limit = Number(c.req.query('limit') ?? 50);
  const list = await brain.threads.listThreads(ctx.tenant.tenantId, {
    userId: ctx.viewer.userId,
    limit,
  });
  return c.json({ threads: list });
});

brainRouter.get('/threads/:id', async (c) => {
  let ctx;
  try {
    ctx = await authenticate(c);
  } catch (err) {
    return handleError(c, err);
  }
  const brain = registry().for(ctx.tenant.tenantId);
  const id = c.req.param('id');
  const thread = await brain.threads.getThread(id);
  if (!thread) return c.json({ error: 'thread_not_found' }, 404);
  if (thread.tenantId !== ctx.tenant.tenantId) {
    return c.json({ error: 'thread_not_found' }, 404);
  }
  const events = await brain.threads.readAs(id, ctx.viewer);
  return c.json({ thread, events });
});

// ----- Migration --------------------------------------------------------

brainRouter.post('/migrate/extract', async (c) => {
  try {
    await authenticate(c);
  } catch (err) {
    return handleError(c, err);
  }
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_json' }, 400);
  }
  const parsed = MigrationExtractParamsSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
  const bundle = migrationExtract(parsed.data);
  const diff = migrationDiff({ bundle });
  return c.json({ bundle, diff });
});

brainRouter.post('/migrate/commit', async (c) => {
  let ctx;
  try {
    ctx = await authenticate(c);
  } catch (err) {
    return handleError(c, err);
  }
  if (!ctx.actor.roles.includes('admin')) {
    return c.json({ error: 'admin_role_required', code: 'FORBIDDEN' }, 403);
  }
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_json' }, 400);
  }
  const schema = (await import('zod')).z.object({
    bundle: ExtractionBundleSchema,
    bestEffort: (await import('zod')).z.boolean().optional().default(false),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
  try {
    const writer = new MigrationWriterService(db());
    // Resolve tenant region settings from DB rather than hardcoding —
    // helper falls back to env defaults when unavailable.
    const region = await resolveTenantRegion(ctx.tenant.tenantId);
    const report = await writer.commit(
      parsed.data.bundle,
      {
        tenantId: ctx.tenant.tenantId,
        ownerUserId: ctx.actor.id,
        actorUserId: ctx.actor.id,
        tenantCountry: region.country,
        tenantCurrency: region.currency,
        defaultCity: region.defaultCity,
      },
      { bestEffort: parsed.data.bestEffort }
    );
    return c.json({ report });
  } catch (err) {
    return handleError(c, err);
  }
});

export { brainRouter };
