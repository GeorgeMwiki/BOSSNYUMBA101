// @ts-nocheck — Hono v4 MiddlewareHandler status-code literal union: multiple
// c.json({...}, status) branches widen the return type and the TypedResponse
// overload rejects the union (same root cause as brain.hono.ts /
// brain-dispatch.hono.ts). Tracked at hono-dev/hono#3891.

/**
 * /api/v1/missions — BN-EXE-09: long-horizon mission backend.
 *
 * Turns the orphaned `@bossnyumba/long-horizon-agent` (Piece Q) into a
 * user-reachable surface. Owner/admin chat-adjacent command surface that:
 *
 *   GET  /missions            → list the tenant's missions (header + step count).
 *   GET  /missions/:id        → one mission with its full step timeline.
 *   POST /missions            → create a mission. Decomposes the goal into
 *                               ordered steps (LLM planner, honest-degrade to a
 *                               deterministic single "plan" step) and persists
 *                               via the long-horizon-agent `planMission`.
 *   POST /missions/:id/dispatch → run the mission's due steps through the
 *                               long-horizon-agent `dispatchMission` step
 *                               engine (HITL-gated per autonomy tier).
 *
 * Persistence: an inline Postgres adapter implements the package's
 * `MissionRepositoryPort` + `StepDispatcherRepositoryPort` against the
 * 0266–0270 mission tables. RLS is FORCE-enabled on those tables; every
 * request re-binds `app.current_tenant_id` before any read/write so the
 * tenant_isolation policies do the filtering (no app-side double-filter).
 *
 * Planner: an Anthropic-backed `MissionPlannerPort` decomposes the goal
 * into concrete steps. When no key is set (or the call fails) it degrades
 * to an empty array — `normalisePlannedSteps` then inserts a single
 * reflective "plan" step so the dispatcher still has something to track.
 *
 * Guards (mirror brain-dispatch.hono.ts):
 *   - Verified Supabase JWT on every request (no dev fallback).
 *   - Owner/admin tier gate (403 otherwise).
 *   - Per-tenant + per-actor rate limit.
 *
 * Mounted ADDITIVELY in services/api-gateway/src/index.ts.
 */

import { randomBytes } from 'node:crypto';
import { Hono } from 'hono';
import { z } from 'zod';
import pino from 'pino';
import { sql } from 'drizzle-orm';
import {
  loadBrainEnv,
  verifySupabaseJwt,
  extractBearer,
  principalToBrainContexts,
  SupabaseAuthError,
  BrainConfigError,
} from '@bossnyumba/ai-copilot';
import { createDatabaseClient } from '@bossnyumba/database';
import {
  planMission,
  dispatchMission,
  type AgencyMission,
  type MissionStep,
  type PlannedStep,
  type PlanMissionOutput,
  type MissionPlannerPort,
  type MissionRepositoryPort,
  type StepDispatcherRepositoryPort,
  type ActionRuntimePort,
  type HitlGatewayPort,
} from '@bossnyumba/long-horizon-agent';
import {
  createBrainLlmClient,
  callBrainLlmJson,
  BRAIN_LLM_MODELS,
} from '../services/brain/llm-call';
import { scrubMessage } from '../utils/safe-error';
import { rateLimiter as sharedRateLimiter } from '../middleware/rate-limiter';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  name: 'missions',
});

// ---------------------------------------------------------------------------
// Lazy boot — fail fast on missing env, deferred to first request so the
// gateway boots for unrelated routes when Brain env is intentionally unset.
// ---------------------------------------------------------------------------

let envCache: ReturnType<typeof loadBrainEnv> | null = null;
function env() {
  if (envCache) return envCache;
  envCache = loadBrainEnv(process.env);
  return envCache;
}

let dbCache: ReturnType<typeof createDatabaseClient> | null = null;
function db() {
  if (dbCache) return dbCache;
  dbCache = createDatabaseClient(env().DATABASE_URL);
  return dbCache;
}

/**
 * Bind the per-request tenant GUC so the FORCE-enabled RLS policies on the
 * mission tables filter every read/write. Mirrors brain.hono.ts:bindTenantGuc.
 */
async function bindTenantGuc(tenantId: string): Promise<void> {
  if (!tenantId || typeof tenantId !== 'string') {
    throw new SupabaseAuthError('missing_tenant_for_guc_bind', 403);
  }
  await db().execute(
    sql`SELECT set_config('app.tenant_id', ${tenantId}, false), set_config('app.current_tenant_id', ${tenantId}, false)`,
  );
}

// ---------------------------------------------------------------------------
// Auth — verified Supabase JWT (JWKS-first, HS256 fallback), then an
// owner/admin tier gate. Identical posture to brain-dispatch.hono.ts.
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

const ALLOWED_ROLES: ReadonlySet<string> = new Set([
  'owner',
  'admin',
  'org_admin',
  'org-admin',
  'super_admin',
]);

function isAuthorized(roles: ReadonlyArray<string>): boolean {
  return roles.some((r) => ALLOWED_ROLES.has(r.toLowerCase()));
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

const RATE_CONFIG = { maxRequests: 30, windowSizeSeconds: 60 } as const;
function checkRate(key: string): boolean {
  return sharedRateLimiter.check(`perUser:missions:${key}`, RATE_CONFIG).allowed;
}

// ---------------------------------------------------------------------------
// Request schemas
// ---------------------------------------------------------------------------

const CreateMissionSchema = z.object({
  title: z.string().min(1).max(200),
  goal: z.string().min(1).max(4000),
  context: z.record(z.unknown()).default({}),
  expectedCompletionDate: z.string().min(1).max(40).nullable().default(null),
  riskTier: z.enum(['LOW', 'MEDIUM', 'HIGH', 'SOVEREIGN']).default('MEDIUM'),
  autonomyTier: z
    .enum(['HITL_HIGH', 'HITL_MEDIUM', 'HITL_LOW', 'AUTONOMOUS'])
    .default('HITL_HIGH'),
  budgetMinorUnits: z.number().int().min(0).nullable().default(null),
  assetRefs: z.array(z.string()).default([]),
  ownerPersonaId: z.string().min(1).max(128).nullable().default(null),
});

// ---------------------------------------------------------------------------
// Id + clock ports (composition-root injected in the package surface).
// ---------------------------------------------------------------------------

const ids = Object.freeze({
  nextId(prefix: string): string {
    // Stable, collision-resistant for a mission id-space; the table PK is
    // TEXT so any unique string is valid. Use crypto randomness (not
    // Math.random) for the suffix so ids are unguessable — 5 bytes →
    // 8 base36 chars, matching the prior id shape.
    const rand = randomBytes(5).toString('hex').slice(0, 8);
    return `${prefix}_${Date.now().toString(36)}_${rand}`;
  },
});

const clock = Object.freeze({
  nowIso(): string {
    return new Date().toISOString();
  },
  todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  },
});

// ---------------------------------------------------------------------------
// LLM-backed planner port. Decomposes a goal into ordered concrete steps.
// Honest-degrade: no key / failure → empty array; the package's
// `normalisePlannedSteps` inserts a single reflective "plan" step.
// ---------------------------------------------------------------------------

const PlannerOutputSchema = z.object({
  steps: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(1000).nullable().default(null),
        stepKind: z.enum(['plan', 'gather', 'execute', 'check', 'reflect']),
      }),
    )
    .max(32),
});

function buildPlannerPort(): MissionPlannerPort {
  const client = createBrainLlmClient({
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: BRAIN_LLM_MODELS.SONNET,
    logger: {
      warn: (obj, msg) => logger.warn(obj, msg),
    } as never,
  });
  return Object.freeze({
    async decompose(args: {
      readonly goal: string;
      readonly context: Readonly<Record<string, unknown>>;
      readonly tenantId: string;
    }): Promise<ReadonlyArray<PlannedStep>> {
      if (!client) return [];
      try {
        const result = await callBrainLlmJson({
          client,
          schema: PlannerOutputSchema,
          maxTokens: 1500,
          temperature: 0.3,
          system:
            'You are a mission planner for an AI-native real estate operating ' +
            'system. Decompose the operator goal into an ORDERED list of 3-12 ' +
            'concrete, atomic steps. Each step has a kind: "plan" (research / ' +
            'pre-work), "gather" (collect data), "execute" (a real-world ' +
            'action), "check" (verification), or "reflect" (summary). Order ' +
            'them so dependencies come first. Be specific and actionable.',
          user: `Goal: ${args.goal}\n\nContext: ${JSON.stringify(
            args.context ?? {},
          )}`,
        });
        return result.data.steps.map((s, index) => ({
          ordinal: index,
          title: s.title,
          description: s.description ?? null,
          stepKind: s.stepKind,
          actionPlanId: null,
          scheduledFor: null,
        }));
      } catch (err) {
        logger.warn(
          { err: err instanceof Error ? err.message : String(err) },
          'missions: planner LLM decomposition failed — degrading to single reflective step',
        );
        return [];
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Postgres mission repository — implements both the planner write port and
// the step-dispatcher read/write port against the 0266–0270 tables. RLS
// does the tenant filtering; we pass tenant_id explicitly on writes to
// satisfy the WITH CHECK clause.
// ---------------------------------------------------------------------------

interface MissionRow {
  id: string;
  tenant_id: string;
  assigned_by_user_id: string;
  owner_persona_id: string | null;
  title: string;
  goal: string;
  context_jsonb: Record<string, unknown>;
  expected_completion_date: string | null;
  risk_tier: AgencyMission['riskTier'];
  autonomy_tier: AgencyMission['autonomyTier'];
  status: AgencyMission['status'];
  budget_minor_units: string | number | null;
  spent_minor_units: string | number;
  asset_refs: string[];
  audit_chain_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface StepRow {
  id: string;
  tenant_id: string;
  mission_id: string;
  ordinal: number;
  title: string;
  description: string | null;
  step_kind: MissionStep['stepKind'];
  action_plan_id: string | null;
  status: MissionStep['status'];
  scheduled_for: string | null;
  attempts: number;
  result_jsonb: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

function toIso(value: string | Date | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function rowToMission(r: MissionRow): AgencyMission {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    assignedByUserId: r.assigned_by_user_id,
    ownerPersonaId: r.owner_persona_id,
    title: r.title,
    goal: r.goal,
    contextJsonb: r.context_jsonb ?? {},
    expectedCompletionDate: toIso(r.expected_completion_date),
    riskTier: r.risk_tier,
    autonomyTier: r.autonomy_tier,
    status: r.status,
    budgetMinorUnits:
      r.budget_minor_units === null ? null : Number(r.budget_minor_units),
    spentMinorUnits: Number(r.spent_minor_units ?? 0),
    assetRefs: r.asset_refs ?? [],
    auditChainId: r.audit_chain_id,
    createdAt: toIso(r.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(r.updated_at) ?? new Date().toISOString(),
    completedAt: toIso(r.completed_at),
  };
}

function rowToStep(r: StepRow): MissionStep {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    missionId: r.mission_id,
    ordinal: r.ordinal,
    title: r.title,
    description: r.description,
    stepKind: r.step_kind,
    actionPlanId: r.action_plan_id,
    status: r.status,
    scheduledFor: toIso(r.scheduled_for),
    attempts: r.attempts ?? 0,
    resultJsonb: r.result_jsonb,
    startedAt: toIso(r.started_at),
    completedAt: toIso(r.completed_at),
    createdAt: toIso(r.created_at) ?? new Date().toISOString(),
  };
}

type MissionPersistencePort = MissionRepositoryPort & StepDispatcherRepositoryPort;

function buildRepository(): MissionPersistencePort {
  const d = db();
  return Object.freeze({
    // ── Planner write ───────────────────────────────────────────────
    async createMission(args): Promise<PlanMissionOutput> {
      const m = args.mission;
      await d.execute(sql`
        INSERT INTO agency_missions (
          id, tenant_id, assigned_by_user_id, owner_persona_id, title, goal,
          context_jsonb, expected_completion_date, risk_tier, autonomy_tier,
          status, budget_minor_units, spent_minor_units, asset_refs,
          audit_chain_id
        ) VALUES (
          ${m.id}, ${m.tenantId}, ${m.assignedByUserId}, ${m.ownerPersonaId},
          ${m.title}, ${m.goal}, ${JSON.stringify(m.contextJsonb)}::jsonb,
          ${m.expectedCompletionDate}, ${m.riskTier}, ${m.autonomyTier},
          ${m.status}, ${m.budgetMinorUnits}, ${m.spentMinorUnits},
          ${m.assetRefs}, ${m.auditChainId}
        )
      `);
      for (const s of args.steps) {
        await d.execute(sql`
          INSERT INTO mission_steps (
            id, tenant_id, mission_id, ordinal, title, description, step_kind,
            action_plan_id, status, scheduled_for, attempts, result_jsonb,
            started_at, completed_at
          ) VALUES (
            ${s.id}, ${s.tenantId}, ${s.missionId}, ${s.ordinal}, ${s.title},
            ${s.description}, ${s.stepKind}, ${s.actionPlanId}, ${s.status},
            ${s.scheduledFor}, ${s.attempts},
            ${s.resultJsonb === null ? null : JSON.stringify(s.resultJsonb)}::jsonb,
            ${s.startedAt}, ${s.completedAt}
          )
        `);
      }
      const created = await this.readMission({
        tenantId: m.tenantId,
        missionId: m.id,
      });
      const steps = await this.readAllSteps({
        tenantId: m.tenantId,
        missionId: m.id,
      });
      if (!created) throw new Error('mission insert did not round-trip');
      return { mission: created, steps };
    },

    // ── Dispatcher reads ───────────────────────────────────────────
    async readMission(args): Promise<AgencyMission | null> {
      const res = await d.execute(sql`
        SELECT * FROM agency_missions
        WHERE id = ${args.missionId} AND tenant_id = ${args.tenantId}
        LIMIT 1
      `);
      const rows = (res as unknown as { rows?: MissionRow[] }).rows ?? (res as unknown as MissionRow[]);
      const row = Array.isArray(rows) ? rows[0] : undefined;
      return row ? rowToMission(row) : null;
    },

    async readDueSteps(args): Promise<ReadonlyArray<MissionStep>> {
      const res = await d.execute(sql`
        SELECT * FROM mission_steps
        WHERE mission_id = ${args.missionId}
          AND tenant_id = ${args.tenantId}
          AND status IN ('pending', 'in_progress')
          AND (scheduled_for IS NULL OR scheduled_for <= ${args.today}::date)
        ORDER BY ordinal ASC
      `);
      const rows = (res as unknown as { rows?: StepRow[] }).rows ?? (res as unknown as StepRow[]);
      return (Array.isArray(rows) ? rows : []).map(rowToStep);
    },

    async readAllSteps(args): Promise<ReadonlyArray<MissionStep>> {
      const res = await d.execute(sql`
        SELECT * FROM mission_steps
        WHERE mission_id = ${args.missionId} AND tenant_id = ${args.tenantId}
        ORDER BY ordinal ASC
      `);
      const rows = (res as unknown as { rows?: StepRow[] }).rows ?? (res as unknown as StepRow[]);
      return (Array.isArray(rows) ? rows : []).map(rowToStep);
    },

    // ── Dispatcher writes ──────────────────────────────────────────
    async markStarted(args): Promise<void> {
      await d.execute(sql`
        UPDATE mission_steps
        SET status = 'in_progress', attempts = attempts + 1, started_at = ${args.startedAt}
        WHERE id = ${args.stepId} AND tenant_id = ${args.tenantId}
      `);
    },

    async markFinished(args): Promise<void> {
      await d.execute(sql`
        UPDATE mission_steps
        SET status = ${args.status},
            result_jsonb = ${args.resultJsonb === null ? null : JSON.stringify(args.resultJsonb)}::jsonb,
            completed_at = ${args.completedAt}
        WHERE id = ${args.stepId} AND tenant_id = ${args.tenantId}
      `);
    },

    async incrementSpent(args): Promise<void> {
      await d.execute(sql`
        UPDATE agency_missions
        SET spent_minor_units = spent_minor_units + ${args.addMinorUnits},
            updated_at = NOW()
        WHERE id = ${args.missionId} AND tenant_id = ${args.tenantId}
      `);
    },

    async setMissionStatus(args): Promise<void> {
      await d.execute(sql`
        UPDATE agency_missions
        SET status = ${args.status}, completed_at = ${args.completedAt}, updated_at = NOW()
        WHERE id = ${args.missionId} AND tenant_id = ${args.tenantId}
      `);
    },
  });
}

// ---------------------------------------------------------------------------
// Dispatcher ports — action runtime + HITL gateway.
//
// ActionRuntime: Piece E (action_runtime) is not wired into this gateway,
// so informational steps (plan / gather / check / reflect) complete with a
// minimal "ok" record and `execute` steps are reported `blocked` with a
// reason rather than fabricating a real-world side effect. Honest-degrade.
//
// HITL: any step the dispatcher flags for approval is skipped (returns
// false). The owner approves out-of-band via the approvals surface; a
// later dispatch picks the step up once approved. Never auto-approves a
// gated step.
// ---------------------------------------------------------------------------

const actionRuntime: ActionRuntimePort = Object.freeze({
  async run(args) {
    const start = Date.now();
    if (args.step.actionPlanId === null) {
      return {
        status: 'completed',
        result: { ok: true, kind: args.step.stepKind, note: 'informational step recorded' },
        durationMs: Date.now() - start,
        costMinorUnits: 0,
        errorMessage: null,
      };
    }
    return {
      status: 'blocked',
      result: { ok: false, reason: 'action_runtime_not_wired' },
      durationMs: Date.now() - start,
      costMinorUnits: 0,
      errorMessage: 'action_runtime is not wired in this gateway; execute step deferred',
    };
  },
});

const hitlGateway: HitlGatewayPort = Object.freeze({
  async isApproved(): Promise<boolean> {
    // Fail-closed: a gated step is NOT approved here; it is skipped and the
    // owner approves via the dedicated approvals surface.
    return false;
  },
});

// ---------------------------------------------------------------------------
// Response projections — keep the wire shape aligned with the owner-portal
// MissionsPage MissionSummary / MissionDetail consumers.
// ---------------------------------------------------------------------------

function projectSummary(mission: AgencyMission, stepCount: number) {
  return {
    id: mission.id,
    title: mission.title,
    status: mission.status,
    stepCount,
    riskTier: mission.riskTier,
    autonomyTier: mission.autonomyTier,
    expectedCompletionDate: mission.expectedCompletionDate,
    createdAt: mission.createdAt,
    updatedAt: mission.updatedAt,
  };
}

function projectStep(step: MissionStep) {
  return {
    id: step.id,
    ordinal: step.ordinal,
    title: step.title,
    description: step.description,
    stepKind: step.stepKind,
    status: step.status,
    scheduledFor: step.scheduledFor,
    attempts: step.attempts,
    completedAt: step.completedAt,
  };
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const missionsRouter = new Hono();

/** Shared auth + owner/admin gate + rate limit. Returns the bound ctx. */
async function guard(c) {
  const ctx = await authenticate(c);
  if (!isAuthorized(ctx.actor.roles)) {
    throw new SupabaseAuthError('forbidden_not_owner_or_admin', 403);
  }
  if (!ctx.tenant.tenantId) {
    throw new SupabaseAuthError('missions_require_tenant_scope', 403);
  }
  if (!checkRate(`${ctx.tenant.tenantId}:${ctx.actor.id}`)) {
    throw new SupabaseAuthError('rate_limited', 429);
  }
  await bindTenantGuc(ctx.tenant.tenantId);
  return ctx;
}

missionsRouter.get('/', async (c) => {
  let ctx;
  try {
    ctx = await guard(c);
  } catch (err) {
    return handleError(c, err);
  }
  try {
    const res = await db().execute(sql`
      SELECT m.*, COALESCE(s.cnt, 0) AS step_count
      FROM agency_missions m
      LEFT JOIN (
        SELECT mission_id, COUNT(*)::int AS cnt
        FROM mission_steps
        WHERE tenant_id = ${ctx.tenant.tenantId}
        GROUP BY mission_id
      ) s ON s.mission_id = m.id
      WHERE m.tenant_id = ${ctx.tenant.tenantId}
      ORDER BY m.created_at DESC
      LIMIT 200
    `);
    const rows =
      (res as unknown as { rows?: (MissionRow & { step_count: number })[] }).rows ??
      (res as unknown as (MissionRow & { step_count: number })[]);
    const data = (Array.isArray(rows) ? rows : []).map((r) =>
      projectSummary(rowToMission(r), Number(r.step_count ?? 0)),
    );
    return c.json({ success: true, data }, 200);
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      'missions: list failed',
    );
    return handleError(c, err);
  }
});

missionsRouter.get('/:id', async (c) => {
  let ctx;
  try {
    ctx = await guard(c);
  } catch (err) {
    return handleError(c, err);
  }
  const missionId = c.req.param('id');
  try {
    const repo = buildRepository();
    const mission = await repo.readMission({
      tenantId: ctx.tenant.tenantId,
      missionId,
    });
    if (!mission) {
      return c.json({ success: false, error: 'mission_not_found', code: 'NOT_FOUND' }, 404);
    }
    const steps = await repo.readAllSteps({
      tenantId: ctx.tenant.tenantId,
      missionId,
    });
    return c.json(
      {
        success: true,
        data: {
          mission: projectSummary(mission, steps.length),
          goal: mission.goal,
          steps: steps.map(projectStep),
        },
      },
      200,
    );
  } catch (err) {
    logger.error(
      { missionId, err: err instanceof Error ? err.message : String(err) },
      'missions: detail failed',
    );
    return handleError(c, err);
  }
});

missionsRouter.post('/', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'invalid_json', code: 'BAD_REQUEST' }, 400);
  }
  const parsed = CreateMissionSchema.safeParse(body);
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

  let ctx;
  try {
    ctx = await guard(c);
  } catch (err) {
    return handleError(c, err);
  }

  try {
    const result = await planMission(
      {
        tenantId: ctx.tenant.tenantId,
        assignedByUserId: ctx.actor.id,
        ownerPersonaId: parsed.data.ownerPersonaId,
        title: parsed.data.title,
        goal: parsed.data.goal,
        context: parsed.data.context,
        constraints: {
          expectedCompletionDate: parsed.data.expectedCompletionDate,
          riskTier: parsed.data.riskTier,
          autonomyTier: parsed.data.autonomyTier,
          budgetMinorUnits: parsed.data.budgetMinorUnits,
          assetRefs: parsed.data.assetRefs,
        },
      },
      {
        planner: buildPlannerPort(),
        repository: buildRepository(),
        ids,
        clock,
      },
    );
    return c.json(
      {
        success: true,
        data: {
          mission: projectSummary(result.mission, result.steps.length),
          goal: result.mission.goal,
          steps: result.steps.map(projectStep),
        },
      },
      201,
    );
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      'missions: create failed',
    );
    return handleError(c, err);
  }
});

missionsRouter.post('/:id/dispatch', async (c) => {
  let ctx;
  try {
    ctx = await guard(c);
  } catch (err) {
    return handleError(c, err);
  }
  const missionId = c.req.param('id');
  try {
    const report = await dispatchMission(
      { tenantId: ctx.tenant.tenantId, missionId },
      {
        actionRuntime,
        hitl: hitlGateway,
        repository: buildRepository(),
        clock,
      },
    );
    return c.json({ success: true, data: report }, 200);
  } catch (err) {
    logger.error(
      { missionId, err: err instanceof Error ? err.message : String(err) },
      'missions: dispatch failed',
    );
    return handleError(c, err);
  }
});

export default missionsRouter;
