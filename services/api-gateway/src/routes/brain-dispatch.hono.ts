// @ts-nocheck — Hono v4 MiddlewareHandler status-code literal union: multiple
// c.json({...}, status) branches widen the return type and the TypedResponse
// overload rejects the union (same root cause as brain.hono.ts). Tracked at
// hono-dev/hono#3891.

/**
 * /api/v1/brain/dispatch — VP department-head dispatch (Gap 6).
 *
 * Owner/admin chat-only command surface. Accepts a VP name + a free-form
 * instruction and:
 *   1. Resolves the VP via `createVpByName` (the five orphan VPs are now
 *      wired behind the registry).
 *   2. Asks the VP to `orchestrate()` the instruction into a plan of
 *      line-worker spawns + capability gaps.
 *   3. Runs each spawn's sub-MD through its full four-stage pipeline
 *      (observe -> map -> redesign -> automate) with a REAL Anthropic-backed
 *      LLM port (honest-degrade to the deterministic fallback when no key).
 *   4. Returns the plan + per-sub-MD results + the gaps the VP recorded.
 *
 * Request body (Zod-validated):
 *   {
 *     vp: "vp.operations" | "vp.finance" | "vp.growth" | "vp.people" | "vp.risk-compliance",
 *     instruction: string,           // 1..4000 chars
 *     threadId?: string,             // optional chat-thread continuity id
 *     kind?: "status-check" | "investigate" | "remediate" | "weekly-report-request" | "wake-from-monitor"
 *   }
 *
 * Guards (mirrors brain.hono.ts):
 *   - Verified Supabase JWT on every request (no dev fallback).
 *   - Owner/admin tier gate on the dispatch surface (403 otherwise).
 *   - Per-tenant + per-actor rate limit.
 *
 * Honest-degrade everywhere: a line-worker with no sub-MD is reported
 * `skipped:unknown_sub_md`; a sub-MD that throws is reported `failed` with
 * its error; nothing is fabricated. Pino logger only.
 *
 * Mounted ADDITIVELY in services/api-gateway/src/index.ts; does NOT touch
 * the base /brain router.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import pino from 'pino';
import {
  loadBrainEnv,
  verifySupabaseJwt,
  extractBearer,
  principalToBrainContexts,
  SupabaseAuthError,
  BrainConfigError,
} from '@bossnyumba/ai-copilot';
import {
  createVpByName,
  isVpName,
  createRegistryLineWorkerCatalogue,
  getSubMdFactory,
  VP_REGISTRY_NAMES,
  DEFAULT_SUB_MD_BUDGET,
  type VpName,
  type OwnerIntent,
  type OwnerIntentKind,
  type VpOrchestrationPlan,
  type ScopeContext,
  type ScopeFilter,
  type SubMdContext,
  type SubMdLlmPort,
  type ObservedEvent,
} from '@bossnyumba/central-intelligence';
import {
  createBrainLlmClient,
  BRAIN_LLM_MODELS,
} from '../services/brain/llm-call';
import { scrubMessage } from '../utils/safe-error';
import { rateLimiter as sharedRateLimiter } from '../middleware/rate-limiter';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  name: 'brain-dispatch',
});

// ---------------------------------------------------------------------------
// Lazy boot — fail fast on missing env, deferred until first request so the
// gateway boots for unrelated routes when Brain env is intentionally unset.
// ---------------------------------------------------------------------------

let envCache: ReturnType<typeof loadBrainEnv> | null = null;
function env() {
  if (envCache) return envCache;
  envCache = loadBrainEnv(process.env);
  return envCache;
}

// ---------------------------------------------------------------------------
// Auth — verified Supabase JWT, mirrors brain.hono.ts (JWKS-first, HS256
// fallback). The owner/admin tier gate runs on top of the verified roles.
// ---------------------------------------------------------------------------

async function authenticate(c) {
  const token = extractBearer(c.req.header('authorization'));
  if (!token) throw new SupabaseAuthError('missing_authorization_header', 401);
  const e = env();
  const supabaseUrl = e.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '');
  const principal = await verifySupabaseJwt(token, {
    jwksUrl: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
    jwtSecret: e.SUPABASE_JWT_SECRET,
    defaultEnvironment: 'production',
  });
  return {
    principal,
    ...principalToBrainContexts(principal),
  };
}

/**
 * Owner/admin gate. Central-command dispatch is reserved for the owner and
 * org-admin tiers — a tenant or staff role cannot fan out the VP cluster.
 * Case-insensitive on the role string so `OWNER` / `owner` both pass.
 */
const ALLOWED_DISPATCH_ROLES: ReadonlySet<string> = new Set([
  'owner',
  'admin',
  'org_admin',
  'org-admin',
  'super_admin',
]);

function isDispatchAuthorized(roles: ReadonlyArray<string>): boolean {
  return roles.some((r) => ALLOWED_DISPATCH_ROLES.has(r.toLowerCase()));
}

function handleError(c, err) {
  if (err instanceof SupabaseAuthError) {
    return c.json({ success: false, error: err.message, code: 'AUTH' }, err.status);
  }
  if (err instanceof BrainConfigError) {
    return c.json(
      { success: false, error: err.message, code: 'BRAIN_NOT_CONFIGURED' },
      503,
    );
  }
  return c.json(
    { success: false, error: scrubMessage(err, 'Internal error'), code: 'INTERNAL' },
    500,
  );
}

// ---------------------------------------------------------------------------
// Rate limit (per tenant + per actor) — same primitive brain.hono.ts uses.
// ---------------------------------------------------------------------------

const DISPATCH_RATE_CONFIG = { maxRequests: 20, windowSizeSeconds: 60 } as const;

function checkRate(key: string): boolean {
  return sharedRateLimiter.check(`perUser:brain-dispatch:${key}`, DISPATCH_RATE_CONFIG)
    .allowed;
}

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const DispatchBodySchema = z.object({
  vp: z.enum(VP_REGISTRY_NAMES),
  instruction: z.string().min(1).max(4000),
  threadId: z.string().min(1).max(128).optional(),
  kind: z
    .enum([
      'status-check',
      'investigate',
      'remediate',
      'weekly-report-request',
      'wake-from-monitor',
    ])
    .default('remediate'),
});

// ---------------------------------------------------------------------------
// Anthropic-backed sub-MD LLM port. Honest-degrade: when no key is set (or
// the call throws) the port returns empty text, so the redesign stage's
// deterministic fallback proposal takes over rather than fabricating output.
// ---------------------------------------------------------------------------

function buildSubMdLlmPort(): SubMdLlmPort {
  const client = createBrainLlmClient({
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: BRAIN_LLM_MODELS.SONNET,
    logger,
  });
  return Object.freeze({
    async generate(args: {
      readonly system: string;
      readonly user: string;
      readonly maxTokens?: number;
    }): Promise<{ readonly text: string }> {
      if (!client) return { text: '' };
      try {
        const response = await client.sdk.messages.create({
          model: client.model,
          max_tokens: args.maxTokens ?? 800,
          temperature: 0.3,
          system: args.system,
          messages: [{ role: 'user', content: args.user }],
        });
        const text = Array.isArray(response.content)
          ? response.content
              .filter((b) => b.type === 'text' && typeof b.text === 'string')
              .map((b) => b.text as string)
              .join('')
          : '';
        return { text };
      } catch (err) {
        logger.warn(
          { err: err instanceof Error ? err.message : String(err) },
          'brain-dispatch: sub-MD LLM call failed — using deterministic fallback',
        );
        return { text: '' };
      }
    },
  });
}

// ---------------------------------------------------------------------------
// ScopeContext (brain auth) -> ScopeFilter (sub-MD bubble).
// ---------------------------------------------------------------------------

function toScopeFilter(scope: ScopeContext): ScopeFilter {
  // Only tenant-scoped dispatch reaches here (the gate enforces a tenant
  // principal); platform scope has no tenantId so it cannot run line-workers.
  if (scope.kind !== 'tenant') {
    throw new SupabaseAuthError('dispatch_requires_tenant_scope', 403);
  }
  return Object.freeze({ tenantId: scope.tenantId });
}

// ---------------------------------------------------------------------------
// Sub-MD chain executor — runs each spawn's four-stage pipeline. Fail-soft
// per step: an unknown line-worker is `skipped`, a throwing sub-MD is
// `failed`, and the remaining spawns still run.
// ---------------------------------------------------------------------------

interface SubMdStepResult {
  readonly subMdId: string;
  readonly status: 'completed' | 'failed' | 'skipped';
  readonly description?: string;
  readonly proposal?: {
    readonly summary: string;
    readonly steps: ReadonlyArray<{
      readonly id: string;
      readonly description: string;
      readonly expectedImpact: string;
    }>;
    readonly predicted: { readonly metric: string; readonly value: number; readonly unit: string };
  };
  readonly artifact?: {
    readonly skillName: string;
    readonly cronExpression?: string;
    readonly draftStatus: 'draft' | 'review-requested';
  };
  readonly error?: string;
}

async function runSubMdChain(args: {
  readonly plan: VpOrchestrationPlan;
  readonly scope: ScopeContext;
  readonly llm: SubMdLlmPort;
  readonly correlationId: string;
}): Promise<ReadonlyArray<SubMdStepResult>> {
  const { plan, scope, llm, correlationId } = args;
  const scopeFilter = toScopeFilter(scope);
  const results: SubMdStepResult[] = [];

  for (const spawn of plan.spawns) {
    const factory = getSubMdFactory(spawn.subMdId);
    if (!factory) {
      results.push(
        Object.freeze({
          subMdId: spawn.subMdId,
          status: 'skipped',
          ...(spawn.description ? { description: spawn.description } : {}),
          error: `unknown_sub_md:${spawn.subMdId}`,
        }),
      );
      continue;
    }
    try {
      const subMd = factory({ scope: scopeFilter });
      const ctx: SubMdContext = Object.freeze({
        scope: scopeFilter,
        nowMs: Date.now(),
        correlationId:
          typeof spawn.initialInput?.['correlationId'] === 'string'
            ? (spawn.initialInput['correlationId'] as string)
            : correlationId,
        budget: DEFAULT_SUB_MD_BUDGET,
        llm,
      });

      // Four-stage pipeline. With no event-bus port the observe stage yields
      // an empty in-scope window; map produces an empty graph; redesign still
      // calls the LLM port (real or degraded); automate compiles a DRAFT
      // artifact — never auto-promoted.
      const events: ObservedEvent[] = [];
      for await (const evt of subMd.observe(ctx)) events.push(evt);
      const graph = await subMd.map(Object.freeze(events), ctx);
      const proposal = await subMd.redesign(graph, ctx);
      const artifact = await subMd.automate(proposal, ctx);

      results.push(
        Object.freeze({
          subMdId: spawn.subMdId,
          status: 'completed',
          ...(spawn.description ? { description: spawn.description } : {}),
          proposal: Object.freeze({
            summary: proposal.summary,
            steps: proposal.steps,
            predicted: proposal.predicted,
          }),
          artifact: Object.freeze({
            skillName: artifact.skillName,
            ...(artifact.cronExpression ? { cronExpression: artifact.cronExpression } : {}),
            draftStatus: artifact.draftStatus,
          }),
        }),
      );
    } catch (err) {
      logger.error(
        {
          subMdId: spawn.subMdId,
          err: err instanceof Error ? err.message : String(err),
        },
        'brain-dispatch: sub-MD pipeline failed (fail-soft)',
      );
      results.push(
        Object.freeze({
          subMdId: spawn.subMdId,
          status: 'failed',
          ...(spawn.description ? { description: spawn.description } : {}),
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  return Object.freeze(results);
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

const brainDispatchRouter = new Hono();

brainDispatchRouter.post('/dispatch', async (c) => {
  // 1) Parse body
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'invalid_json', code: 'BAD_REQUEST' }, 400);
  }
  const parsed = DispatchBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: 'invalid_request',
        code: 'BAD_REQUEST',
        details: parsed.error.flatten(),
      },
      400,
    );
  }
  const { vp, instruction, threadId, kind } = parsed.data;

  // 2) Authenticate
  let ctx;
  try {
    ctx = await authenticate(c);
  } catch (err) {
    return handleError(c, err);
  }

  // 3) Owner/admin tier gate
  if (!isDispatchAuthorized(ctx.actor.roles)) {
    return c.json(
      { success: false, error: 'forbidden_not_owner_or_admin', code: 'FORBIDDEN' },
      403,
    );
  }

  // 4) Rate limit (per tenant + per actor)
  const rateKey = `${ctx.tenant.tenantId}:${ctx.actor.id}`;
  if (!checkRate(rateKey)) {
    return c.json({ success: false, error: 'rate_limited', code: 'RATE_LIMIT' }, 429);
  }

  // Defensive: schema already constrains `vp`, but keep the registry as the
  // single source of truth.
  if (!isVpName(vp)) {
    return c.json({ success: false, error: 'unknown_vp', code: 'BAD_REQUEST' }, 400);
  }

  const correlationId = threadId ?? `dispatch-${Date.now()}`;
  const scope: ScopeContext = Object.freeze({
    kind: 'tenant',
    tenantId: ctx.tenant.tenantId,
    actorUserId: ctx.actor.id,
    roles: [...ctx.actor.roles],
    personaId: 'manager-chat',
  });

  // 5) Build the VP + orchestrate the instruction into a plan
  let plan: VpOrchestrationPlan;
  try {
    const head = createVpByName(vp as VpName, {
      lineWorkerCatalogue: createRegistryLineWorkerCatalogue(),
    });
    const intent: OwnerIntent = {
      kind: kind as OwnerIntentKind,
      text: instruction,
      scope,
      correlationId,
    };
    plan = await head.orchestrate(intent);
  } catch (err) {
    logger.error(
      { vp, err: err instanceof Error ? err.message : String(err) },
      'brain-dispatch: VP orchestrate failed',
    );
    return c.json(
      { success: false, error: 'orchestrate_failed', code: 'INTERNAL' },
      500,
    );
  }

  // 6) Run the sub-MD chain (fail-soft per step)
  let subMdResults: ReadonlyArray<SubMdStepResult> = Object.freeze([]);
  try {
    subMdResults = await runSubMdChain({
      plan,
      scope,
      llm: buildSubMdLlmPort(),
      correlationId,
    });
  } catch (err) {
    // toScopeFilter throws a typed 403 for non-tenant scope; surface it.
    if (err instanceof SupabaseAuthError) return handleError(c, err);
    logger.error(
      { vp, err: err instanceof Error ? err.message : String(err) },
      'brain-dispatch: sub-MD chain failed',
    );
  }

  const completed = subMdResults.filter((r) => r.status === 'completed').length;

  return c.json({
    success: true,
    vp,
    correlationId,
    plan: {
      vpName: plan.vpName,
      intentKind: plan.intentKind,
      rationale: plan.rationale,
      spawnCount: plan.spawns.length,
      ...(plan.summary ? { summary: plan.summary } : {}),
    },
    gaps: plan.gaps,
    subMdResults,
    summary: {
      spawns: plan.spawns.length,
      completed,
      skipped: subMdResults.filter((r) => r.status === 'skipped').length,
      failed: subMdResults.filter((r) => r.status === 'failed').length,
      gaps: plan.gaps.length,
    },
    knownVps: VP_REGISTRY_NAMES,
  });
});

export { brainDispatchRouter };
export default brainDispatchRouter;
