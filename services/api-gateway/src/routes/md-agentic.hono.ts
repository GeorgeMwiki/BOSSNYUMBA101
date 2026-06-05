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
      return c.json(
        {
          success: true,
          data: {
            teamRunId: result.teamRunId,
            status: 'pending',
            aggregation: body.aggregation ?? 'merge_all',
            memberCount: members.length,
            memberIds: result.memberIds,
            totalTokenBudget: members.reduce((s, m) => s + m.tokenBudget, 0),
            message:
              `Team dispatched (${members.length} members). Runs persisted at ` +
              "status 'pending'; results aggregate once an executor completes them.",
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
