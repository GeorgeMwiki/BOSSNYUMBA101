// @ts-nocheck — Hono v4 MiddlewareHandler status-code literal union: multiple
// c.json({...}, status) branches widen the return type and the TypedResponse
// overload rejects the union (hono-dev/hono#3891). Same pragma as the other
// .hono routers in this directory (org-admin.hono.ts, cases.hono.ts).
/**
 * /api/v1/md-agentic — agentic plan / subagent + sandbox-preview write
 * surface (migration 0306).
 *
 * Claude-Code-parity "plan mode" + "agent teams" + a worktree-style
 * sandbox. The owner tells Mr. Mwikila "draft a Q3 hiring plan", "stage a
 * new caretaker for my review", then reviews the staged payload and
 * commits or rejects it. Nothing the brain stages touches a real table
 * until the owner commits.
 *
 * Routes (all tenant-scoped via JWT + RLS; owner/admin role only):
 *   POST  /plans                       propose a multi-step plan
 *   POST  /subagents/dispatch          dispatch a subagent team (honest-
 *                                      degrade: persists 'pending' runs)
 *   GET   /subagents/:teamRunId/aggregate  aggregate persisted run results
 *   POST  /sandbox/writes              stage a sandbox write
 *   GET   /sandbox/writes              list staged writes for review
 *   POST  /sandbox/writes/:id/commit   validate + atomic real-table write
 *   POST  /sandbox/writes/:id/reject   reject + rejection log
 *
 * The chat-as-OS brain reads / writes via the `plan.*` / `sandbox.*` brain
 * tools (md-agentic-tools.ts), which loopback-dispatch to these routes so
 * the SAME auth + RLS + observability guards apply as a browser request.
 *
 * Honest-degrade (CLAUDE.md hard rule): when the database client is not
 * configured the route returns 503 SERVICE_UNAVAILABLE rather than
 * fabricating a row. Subagent aggregation returns a typed 'unavailable'
 * (HTTP 409) when no executor is wired — it NEVER fabricates results.
 *
 * Commit validation (task spec): commit VALIDATES the staged payload
 * (zod shape via md-sandbox-payload.ts + FK existence) BEFORE the atomic
 * real-table write, then writes a md_sandbox_commits audit row.
 *
 * Ported from LitFin's iter-32 plan-mode + iter-36 agent-teams / sandbox-
 * writes tools and retargeted lending → real estate.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import { withSecurityEvents } from '@bossnyumba/observability';
import {
  MdAgenticRepository,
  type ProvenanceLike,
  type MdRepoFailure,
} from '../composition/md-agentic-repository.js';
import { SANDBOX_TARGET_TABLES } from '../composition/md-sandbox-payload.js';
import {
  runSubagentTeam,
  type ExecutorLogger,
} from '../composition/md-subagent-executor.js';
import { resolveSubagentBrain } from '../composition/md-subagent-brain-resolver.js';
import { logger as gatewayLogger } from '../utils/logger.js';

// Pino-shaped (`(meta, msg)`) adapter over the gateway logger (`(msg, meta)`)
// so the executor — which logs Pino-style — gets a uniform sink. No console:
// the gateway logger is the structured sink (CLAUDE.md hard rule).
const logger: ExecutorLogger = {
  info: (meta, msg) => gatewayLogger.info(msg, meta),
  warn: (meta, msg) => gatewayLogger.warn(msg, meta),
  error: (meta, msg) => gatewayLogger.error(msg, meta),
};

// ── role gate ────────────────────────────────────────────────────────────
// Tier-gate (task spec): owner / admin only. Mirrors org-admin.hono.ts.
const WRITE_ROLES = new Set([
  'OWNER',
  'TENANT_ADMIN',
  'PLATFORM_ADMIN',
  'ADMIN',
]);

const MAX_STEPS = 25;
const MAX_TEAM = 8;
const MIN_TEAM = 2;
const DEFAULT_LIST_LIMIT = 50;

// ── shared zod fragments ─────────────────────────────────────────────────

const ProvenanceSchema = z
  .object({
    via: z.string(),
    actorId: z.string().nullable().optional(),
    sessionId: z.string().nullable().optional(),
    turnId: z.string().nullable().optional(),
    requestedAt: z.string().optional(),
  })
  .optional();

const PlanStepSchema = z.object({
  tool: z.string().min(1).max(200),
  input: z.record(z.unknown()),
  rationale: z.string().min(1).max(1000),
});

const ProposePlanSchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(4000),
  steps: z.array(PlanStepSchema).min(1).max(MAX_STEPS),
  estimatedImpact: z.string().max(4000).optional(),
  provenance: ProvenanceSchema,
});

const SubagentMemberSchema = z.object({
  role: z.enum([
    'explorer',
    'reviewer',
    'synthesizer',
    'researcher',
    'executor',
  ]),
  brief: z.string().min(20).max(12000),
  allowedTools: z.array(z.string().min(1)).optional(),
  tokenBudget: z.number().int().positive().max(80000).optional(),
});

const DispatchSchema = z.object({
  brief: z.string().min(20).max(12000),
  aggregation: z
    .enum(['majority_vote', 'best_of_n', 'merge_all', 'first_success'])
    .optional(),
  members: z.array(SubagentMemberSchema).min(MIN_TEAM).max(MAX_TEAM),
  planId: z.string().uuid().optional(),
  provenance: ProvenanceSchema,
});

const SandboxWriteSchema = z.object({
  targetTable: z.enum(SANDBOX_TARGET_TABLES),
  operation: z.enum(['insert', 'update']),
  targetRowId: z.string().uuid().optional(),
  proposedPayload: z.record(z.unknown()),
  rationale: z.string().max(4000).optional(),
  planId: z.string().uuid().optional(),
  provenance: ProvenanceSchema,
});

const RejectSchema = z.object({
  reason: z.string().min(1).max(4000),
  provenance: ProvenanceSchema,
});

const ROLE_DEFAULT_BUDGET: Record<string, number> = {
  explorer: 8000,
  reviewer: 12000,
  synthesizer: 16000,
  researcher: 12000,
  executor: 20000,
};

// ── helpers ──────────────────────────────────────────────────────────────

function notConfigured(c) {
  return c.json(
    {
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'MdAgenticRepository not configured — DATABASE_URL unset',
      },
    },
    503,
  );
}

function forbidden(c) {
  return c.json(
    {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'md-agentic write requires the owner or admin role',
      },
    },
    403,
  );
}

/** Map a repository failure code to an HTTP status. */
function statusForFailure(failure: MdRepoFailure): number {
  switch (failure.code) {
    case 'NOT_FOUND':
      return 404;
    case 'CONFLICT':
      return 409;
    case 'EXPIRED':
      return 410;
    case 'NOT_READY':
    case 'UNAVAILABLE':
      return 409;
    case 'INVALID_INPUT':
      return 422;
    default:
      return 500;
  }
}

function provenanceFrom(body, fallbackActor: string): ProvenanceLike {
  const p = body?.provenance;
  return {
    via: typeof p?.via === 'string' ? p.via : 'api',
    actorId: typeof p?.actorId === 'string' ? p.actorId : fallbackActor,
    sessionId: typeof p?.sessionId === 'string' ? p.sessionId : null,
    turnId: typeof p?.turnId === 'string' ? p.turnId : null,
    requestedAt:
      typeof p?.requestedAt === 'string'
        ? p.requestedAt
        : new Date().toISOString(),
  };
}

// ── subagent-team executor kick ───────────────────────────────────────────
// The runner that ends the dead-end: it claims pending members and runs each
// through the INJECTED brain port (resolved per-tenant off c.get('services')).
// When no brain is wired (no ANTHROPIC_API_KEY) the resolver returns null and
// we honest-degrade — members stay 'pending' and aggregate reports
// 'unavailable'. Output is NEVER fabricated.

/**
 * Run the team's pending members to terminal state. Idempotent + race-safe
 * (the repository claim is the concurrency guard), so it is safe to call on
 * dispatch AND again on aggregate — a second call simply claims zero members.
 * Returns false when no brain is wired (caller honest-degrades).
 */
async function kickSubagentExecutor(repo, services, tenantId, teamRunId) {
  const brain = resolveSubagentBrain(services, tenantId);
  if (!brain) {
    logger.info(
      { tenantId, teamRunId },
      'md-agentic: no brain wired — subagent executor honest-degrades',
    );
    return false;
  }
  await runSubagentTeam({ repo, brain, tenantId, teamRunId, logger });
  return true;
}

/**
 * Fire the executor without blocking the HTTP response. Errors are logged,
 * never thrown — a kick failure must not turn a successful 201 dispatch into a
 * 500. The aggregate read path re-kicks (idempotent), so a dropped background
 * kick is self-healing.
 */
function kickSubagentExecutorDetached(repo, services, tenantId, teamRunId) {
  void kickSubagentExecutor(repo, services, tenantId, teamRunId).catch((err) => {
    logger.error(
      {
        tenantId,
        teamRunId,
        error: err instanceof Error ? err.message : String(err),
      },
      'md-agentic: detached subagent executor kick failed',
    );
  });
}

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

// Owner/admin role gate on every endpoint in this router.
app.use('*', async (c, next) => {
  const auth = c.get('auth') as { role?: string } | undefined;
  if (!auth || !WRITE_ROLES.has(String(auth.role))) return forbidden(c);
  await next();
});

// ── POST /plans — propose a multi-step plan ──────────────────────────────

app.post(
  '/plans',
  zValidator('json', ProposePlanSchema),
  withSecurityEvents(
    { action: 'md-agentic.plan.propose', resource: 'md_plan', severity: 'info' },
    async (c) => {
      const auth = c.get('auth');
      const db = c.get('db');
      if (!db) return notConfigured(c);
      const body = c.req.valid('json');

      const repo = new MdAgenticRepository(db);
      const result = await repo.proposePlan(
        auth.tenantId,
        {
          title: body.title.trim(),
          summary: body.summary.trim().slice(0, 4000),
          steps: body.steps.map((s) => ({
            tool: s.tool.trim(),
            input: s.input,
            rationale: s.rationale.trim().slice(0, 1000),
          })),
          estimatedImpact: body.estimatedImpact?.trim().slice(0, 4000) ?? null,
        },
        auth.userId,
        provenanceFrom(body, auth.userId).sessionId,
        provenanceFrom(body, auth.userId),
      );
      if (!result.ok) {
        return c.json(
          { success: false, error: { code: result.code, message: result.message } },
          statusForFailure(result),
        );
      }
      return c.json({ success: true, data: result.plan }, 201);
    },
  ),
);

// ── POST /subagents/dispatch — dispatch a subagent team ──────────────────

app.post(
  '/subagents/dispatch',
  zValidator('json', DispatchSchema),
  withSecurityEvents(
    {
      action: 'md-agentic.subagents.dispatch',
      resource: 'md_subagent_runs',
      severity: 'info',
    },
    async (c) => {
      const auth = c.get('auth');
      const db = c.get('db');
      if (!db) return notConfigured(c);
      const body = c.req.valid('json');

      // executor role requires non-empty allowedTools (mirrors LitFin).
      for (let i = 0; i < body.members.length; i += 1) {
        const m = body.members[i];
        if (m.role === 'executor' && (m.allowedTools ?? []).length === 0) {
          return c.json(
            {
              success: false,
              error: {
                code: 'INVALID_INPUT',
                message: `member ${i}: role='executor' requires non-empty allowedTools.`,
              },
            },
            422,
          );
        }
      }

      const members = body.members.map((m) => ({
        role: m.role,
        brief: m.brief.trim(),
        allowedTools: (m.allowedTools ?? []).map((t) => t.trim()),
        tokenBudget: m.tokenBudget ?? ROLE_DEFAULT_BUDGET[m.role] ?? 8000,
      }));

      const repo = new MdAgenticRepository(db);
      const result = await repo.dispatchSubagentTeam(
        auth.tenantId,
        {
          brief: body.brief.trim(),
          aggregation: body.aggregation ?? 'merge_all',
          members,
          planId: body.planId ?? null,
        },
        auth.userId,
        provenanceFrom(body, auth.userId).sessionId,
        provenanceFrom(body, auth.userId),
      );
      if (!result.ok) {
        return c.json(
          { success: false, error: { code: result.code, message: result.message } },
          statusForFailure(result),
        );
      }

      // Kick the executor in the background so the 201 returns immediately.
      // The runner claims the just-persisted 'pending' members and runs each
      // through the injected brain; the aggregate read path re-kicks
      // (idempotent) so a dropped kick is self-healing. honest-degrade: when
      // no brain is wired the runner is a no-op and members stay 'pending'.
      const services = c.get('services');
      const executorWired = resolveSubagentBrain(services, auth.tenantId) !== null;
      if (executorWired) {
        kickSubagentExecutorDetached(
          repo,
          services,
          auth.tenantId,
          result.teamRunId,
        );
      }

      return c.json(
        {
          success: true,
          data: {
            teamRunId: result.teamRunId,
            status: executorWired ? 'running' : 'pending',
            aggregation: body.aggregation ?? 'merge_all',
            memberCount: members.length,
            memberIds: result.memberIds,
            totalTokenBudget: members.reduce((s, m) => s + m.tokenBudget, 0),
            executorWired,
            message: executorWired
              ? `Team dispatched (${members.length} members). The executor is ` +
                'running each member through the brain; poll ' +
                `/subagents/${result.teamRunId}/aggregate for results.`
              : `Team dispatched (${members.length} members). Runs persisted ` +
                "at status 'pending'; no executor brain is wired so results " +
                'aggregate as unavailable until one is configured.',
          },
        },
        201,
      );
    },
  ),
);

// ── GET /subagents/:teamRunId/aggregate — aggregate run results ──────────

app.get(
  '/subagents/:teamRunId/aggregate',
  withSecurityEvents(
    {
      action: 'md-agentic.subagents.aggregate',
      resource: 'md_subagent_runs',
      severity: 'info',
    },
    async (c) => {
      const auth = c.get('auth');
      const db = c.get('db');
      if (!db) return notConfigured(c);
      const teamRunId = c.req.param('teamRunId');
      if (!/^[0-9a-f-]{36}$/i.test(teamRunId)) {
        return c.json(
          {
            success: false,
            error: { code: 'INVALID_INPUT', message: 'teamRunId must be a uuid.' },
          },
          422,
        );
      }

      const repo = new MdAgenticRepository(db);

      // Self-healing read: kick the executor (idempotent) before reading so a
      // dropped dispatch-time kick still completes the team. When a brain is
      // wired this awaits the run so the aggregate reflects fresh results; when
      // none is wired it is a no-op and the read honest-degrades to
      // 'unavailable'. A kick error must not fail the read — log + continue.
      try {
        await kickSubagentExecutor(
          repo,
          c.get('services'),
          auth.tenantId,
          teamRunId,
        );
      } catch (kickErr) {
        logger.error(
          {
            tenantId: auth.tenantId,
            teamRunId,
            error: kickErr instanceof Error ? kickErr.message : String(kickErr),
          },
          'md-agentic: aggregate-time executor kick failed; reading as-is',
        );
      }

      const result = await repo.aggregateSubagentResults(auth.tenantId, teamRunId);
      if (!result.ok) {
        return c.json(
          { success: false, error: { code: result.code, message: result.message } },
          statusForFailure(result),
        );
      }
      return c.json({ success: true, data: result }, 200);
    },
  ),
);

// ── POST /sandbox/writes — stage a sandbox write ─────────────────────────

app.post(
  '/sandbox/writes',
  zValidator('json', SandboxWriteSchema),
  withSecurityEvents(
    {
      action: 'md-agentic.sandbox.write',
      resource: 'md_sandbox_writes',
      severity: 'info',
    },
    async (c) => {
      const auth = c.get('auth');
      const db = c.get('db');
      if (!db) return notConfigured(c);
      const body = c.req.valid('json');

      if (body.operation === 'update' && !body.targetRowId) {
        return c.json(
          {
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: "operation='update' requires targetRowId.",
            },
          },
          422,
        );
      }
      if (body.operation === 'insert' && body.targetRowId) {
        return c.json(
          {
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: "operation='insert' must not carry a targetRowId.",
            },
          },
          422,
        );
      }
      if (Object.keys(body.proposedPayload).length === 0) {
        return c.json(
          {
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'proposedPayload must contain at least one field.',
            },
          },
          422,
        );
      }

      const repo = new MdAgenticRepository(db);
      const result = await repo.stageSandboxWrite(
        auth.tenantId,
        {
          targetTable: body.targetTable,
          operation: body.operation,
          targetRowId: body.targetRowId ?? null,
          proposedPayload: body.proposedPayload,
          rationale: body.rationale?.trim().slice(0, 4000) ?? null,
          planId: body.planId ?? null,
        },
        auth.userId,
        provenanceFrom(body, auth.userId).sessionId,
        provenanceFrom(body, auth.userId),
      );
      if (!result.ok) {
        return c.json(
          { success: false, error: { code: result.code, message: result.message } },
          statusForFailure(result),
        );
      }
      return c.json({ success: true, data: result.sandbox }, 201);
    },
  ),
);

// ── GET /sandbox/writes — list staged writes for review ──────────────────

app.get(
  '/sandbox/writes',
  withSecurityEvents(
    {
      action: 'md-agentic.sandbox.list',
      resource: 'md_sandbox_writes',
      severity: 'info',
    },
    async (c) => {
      const auth = c.get('auth');
      const db = c.get('db');
      if (!db) return notConfigured(c);

      const statusFilter = (c.req.query('status') ?? 'pending').toLowerCase();
      const tableFilter = (c.req.query('targetTable') ?? 'all').toLowerCase();
      const VALID_STATUS = ['pending', 'committed', 'rejected', 'expired', 'all'];
      const VALID_TABLE = [...SANDBOX_TARGET_TABLES, 'all'];
      if (!VALID_STATUS.includes(statusFilter)) {
        return c.json(
          {
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: `status must be one of: ${VALID_STATUS.join(', ')}`,
            },
          },
          422,
        );
      }
      if (!VALID_TABLE.includes(tableFilter)) {
        return c.json(
          {
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: `targetTable must be one of: ${VALID_TABLE.join(', ')}`,
            },
          },
          422,
        );
      }
      let limit = DEFAULT_LIST_LIMIT;
      const limitRaw = Number(c.req.query('limit'));
      if (Number.isFinite(limitRaw) && limitRaw > 0) {
        limit = Math.min(200, Math.floor(limitRaw));
      }

      const repo = new MdAgenticRepository(db);
      const rows = await repo.listSandboxWrites(auth.tenantId, {
        status: statusFilter,
        targetTable: tableFilter,
        limit,
      });
      return c.json(
        {
          success: true,
          data: {
            statusFilter,
            tableFilter,
            count: rows.length,
            sandboxWrites: rows,
          },
        },
        200,
      );
    },
  ),
);

// ── POST /sandbox/writes/:id/commit — validate + atomic write + audit ────

app.post(
  '/sandbox/writes/:id/commit',
  withSecurityEvents(
    {
      action: 'md-agentic.sandbox.commit',
      resource: 'md_sandbox_writes',
      severity: 'warning',
    },
    async (c) => {
      const auth = c.get('auth');
      const db = c.get('db');
      if (!db) return notConfigured(c);
      const id = c.req.param('id');
      if (!/^[0-9a-f-]{36}$/i.test(id)) {
        return c.json(
          {
            success: false,
            error: { code: 'INVALID_INPUT', message: 'id must be a uuid.' },
          },
          422,
        );
      }

      const repo = new MdAgenticRepository(db);
      const result = await repo.commitSandboxWrite(
        auth.tenantId,
        id,
        auth.userId,
        null,
        provenanceFrom({}, auth.userId),
      );
      if (!result.ok) {
        return c.json(
          { success: false, error: { code: result.code, message: result.message } },
          statusForFailure(result),
        );
      }
      return c.json({ success: true, data: result }, 200);
    },
  ),
);

// ── POST /sandbox/writes/:id/reject — reject + rejection log ─────────────

app.post(
  '/sandbox/writes/:id/reject',
  zValidator('json', RejectSchema),
  withSecurityEvents(
    {
      action: 'md-agentic.sandbox.reject',
      resource: 'md_sandbox_writes',
      severity: 'info',
    },
    async (c) => {
      const auth = c.get('auth');
      const db = c.get('db');
      if (!db) return notConfigured(c);
      const id = c.req.param('id');
      if (!/^[0-9a-f-]{36}$/i.test(id)) {
        return c.json(
          {
            success: false,
            error: { code: 'INVALID_INPUT', message: 'id must be a uuid.' },
          },
          422,
        );
      }
      const body = c.req.valid('json');

      const repo = new MdAgenticRepository(db);
      const result = await repo.rejectSandboxWrite(
        auth.tenantId,
        id,
        body.reason.trim().slice(0, 4000),
        auth.userId,
        provenanceFrom(body, auth.userId).sessionId,
        provenanceFrom(body, auth.userId),
      );
      if (!result.ok) {
        return c.json(
          { success: false, error: { code: result.code, message: result.message } },
          statusForFailure(result),
        );
      }
      return c.json(
        { success: true, data: { ...result, status: 'rejected' } },
        200,
      );
    },
  ),
);

export default app;
