/**
 * Kernel goals — Drizzle-backed GoalsPort.
 *
 * Adapts the `kernel_goals` table (migration 0123) to the kernel's
 * `GoalsPort` shape. Step decomposition rides as a JSON array on the
 * `steps` column; `updateStepStatus` rewrites the array immutably and
 * keeps `steps_total / steps_done` in sync.
 *
 * Hard DB failures degrade gracefully:
 *   - open      : logs + rethrows so the caller can surface the error
 *   - list      : returns [] on error
 *   - get       : returns null on error
 *   - update*   : logs + swallows (the executor records its own audit
 *                 trail, so a write failure doesn't lose the decision
 *                 history; it only loses the step-state mirror)
 *   - setStatus : logs + swallows
 */
import { randomUUID } from 'crypto';
import { and, desc, eq } from 'drizzle-orm';
import { kernelGoals } from '../schemas/kernel-goals.schema.js';
import type { DatabaseClient } from '../client.js';

export type GoalStatus =
  | 'active'
  | 'paused'
  | 'blocked'
  | 'completed'
  | 'abandoned';

export type GoalPriority = 'low' | 'medium' | 'high' | 'critical';

export type GoalStepStatus =
  | 'pending'
  | 'running'
  | 'done'
  | 'failed'
  | 'skipped';

export interface GoalStep {
  readonly id: string;
  readonly seq: number;
  readonly description: string;
  readonly toolName: string | null;
  readonly toolPayload: Record<string, unknown> | null;
  readonly status: GoalStepStatus;
  readonly startedAt: string | null;
  readonly endedAt: string | null;
  readonly outcome: string | null;
  readonly errorMessage: string | null;
}

export interface GoalMetrics {
  readonly stepsTotal: number;
  readonly stepsDone: number;
}

export interface Goal {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly threadId: string;
  readonly title: string;
  readonly description: string;
  readonly status: GoalStatus;
  readonly priority: GoalPriority;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt: string | null;
  readonly steps: ReadonlyArray<GoalStep>;
  readonly metrics: GoalMetrics;
}

export interface GoalStepDraft {
  readonly seq: number;
  readonly description: string;
  readonly toolName: string | null;
  readonly toolPayload: Record<string, unknown> | null;
}

export interface GoalOpenArgs {
  readonly tenantId: string;
  readonly userId: string;
  readonly threadId: string;
  readonly title: string;
  readonly description: string;
  readonly status: GoalStatus;
  readonly priority: GoalPriority;
  readonly steps: ReadonlyArray<GoalStepDraft>;
}

export interface GoalListArgs {
  readonly tenantId: string;
  readonly userId: string;
  readonly status?: GoalStatus;
  readonly limit?: number;
}

export interface GoalUpdateStepArgs {
  readonly goalId: string;
  readonly stepId: string;
  readonly status: GoalStepStatus;
  readonly outcome?: string;
  readonly errorMessage?: string;
}

export interface KernelGoalsService {
  open(args: GoalOpenArgs): Promise<{ id: string }>;
  list(args: GoalListArgs): Promise<ReadonlyArray<Goal>>;
  get(id: string): Promise<Goal | null>;
  updateStepStatus(args: GoalUpdateStepArgs): Promise<void>;
  setStatus(id: string, status: GoalStatus): Promise<void>;
}

const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 500;

export function createKernelGoalsService(
  db: DatabaseClient,
): KernelGoalsService {
  return {
    async open(args) {
      const id = randomUUID();
      const now = new Date();
      const steps: ReadonlyArray<GoalStep> = args.steps.map((draft) => ({
        id: randomUUID(),
        seq: draft.seq,
        description: draft.description,
        toolName: draft.toolName,
        toolPayload: draft.toolPayload,
        status: 'pending' as GoalStepStatus,
        startedAt: null,
        endedAt: null,
        outcome: null,
        errorMessage: null,
      }));
      try {
        await db.insert(kernelGoals).values({
          id,
          tenantId: args.tenantId,
          userId: args.userId,
          threadId: args.threadId,
          title: args.title,
          description: args.description,
          status: args.status,
          priority: args.priority,
          createdAt: now,
          updatedAt: now,
          steps: steps as unknown as Record<string, unknown>[],
          stepsTotal: steps.length,
          stepsDone: 0,
        } as never);
      } catch (error) {
        console.error('kernel-goals.open failed:', error);
        throw error instanceof Error
          ? error
          : new Error('kernel-goals.open failed');
      }
      return { id };
    },

    async list(args) {
      try {
        if (!args.tenantId || !args.userId) return [];
        const limit = clampLimit(args.limit, DEFAULT_LIST_LIMIT);
        const conditions = args.status
          ? and(
              eq(kernelGoals.tenantId, args.tenantId),
              eq(kernelGoals.userId, args.userId),
              eq(kernelGoals.status, args.status),
            )
          : and(
              eq(kernelGoals.tenantId, args.tenantId),
              eq(kernelGoals.userId, args.userId),
            );
        const rows = (await db
          .select()
          .from(kernelGoals)
          .where(conditions)
          .orderBy(desc(kernelGoals.createdAt))
          .limit(limit)) as ReadonlyArray<GoalRow>;
        return (rows ?? []).map(rowToGoal);
      } catch (error) {
        console.error('kernel-goals.list failed:', error);
        return [];
      }
    },

    async get(id) {
      try {
        if (!id) return null;
        const rows = (await db
          .select()
          .from(kernelGoals)
          .where(eq(kernelGoals.id, id))
          .limit(1)) as ReadonlyArray<GoalRow>;
        const row = rows?.[0];
        if (!row) return null;
        return rowToGoal(row);
      } catch (error) {
        console.error('kernel-goals.get failed:', error);
        return null;
      }
    },

    async updateStepStatus(args) {
      try {
        const existing = await this.get(args.goalId);
        if (!existing) return;
        const now = new Date();
        const nowIso = now.toISOString();
        const nextSteps: ReadonlyArray<GoalStep> = existing.steps.map((s) => {
          if (s.id !== args.stepId) return s;
          const startedAt =
            args.status === 'running' && !s.startedAt ? nowIso : s.startedAt;
          const endedAt =
            args.status === 'done' ||
            args.status === 'failed' ||
            args.status === 'skipped'
              ? nowIso
              : s.endedAt;
          return {
            ...s,
            status: args.status,
            startedAt,
            endedAt,
            outcome: args.outcome ?? s.outcome,
            errorMessage: args.errorMessage ?? s.errorMessage,
          };
        });
        const stepsDone = nextSteps.filter((s) => s.status === 'done').length;
        await db
          .update(kernelGoals)
          .set({
            steps: nextSteps as unknown as Record<string, unknown>[],
            stepsDone,
            updatedAt: now,
          } as never)
          .where(eq(kernelGoals.id, args.goalId));
      } catch (error) {
        console.error('kernel-goals.updateStepStatus failed:', error);
      }
    },

    async setStatus(id, status) {
      try {
        const now = new Date();
        const set: Record<string, unknown> = {
          status,
          updatedAt: now,
        };
        if (status === 'completed') set.completedAt = now;
        await db
          .update(kernelGoals)
          .set(set as never)
          .where(eq(kernelGoals.id, id));
      } catch (error) {
        console.error('kernel-goals.setStatus failed:', error);
      }
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

interface GoalRow {
  id: string;
  tenantId: string;
  userId: string;
  threadId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  completedAt: Date | string | null;
  steps: unknown;
  stepsTotal: number | null;
  stepsDone: number | null;
}

function rowToGoal(row: GoalRow): Goal {
  const steps = parseSteps(row.steps);
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    threadId: row.threadId,
    title: row.title,
    description: row.description ?? '',
    status: (row.status as GoalStatus) ?? 'active',
    priority: (row.priority as GoalPriority) ?? 'medium',
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    completedAt: row.completedAt ? toIso(row.completedAt) : null,
    steps,
    metrics: {
      stepsTotal: row.stepsTotal ?? steps.length,
      stepsDone:
        row.stepsDone ??
        steps.filter((s) => s.status === 'done').length,
    },
  };
}

function parseSteps(raw: unknown): ReadonlyArray<GoalStep> {
  if (!Array.isArray(raw)) return [];
  const out: GoalStep[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const id = typeof obj.id === 'string' ? obj.id : '';
    const seq = typeof obj.seq === 'number' ? obj.seq : 0;
    const description =
      typeof obj.description === 'string' ? obj.description : '';
    const toolName =
      typeof obj.toolName === 'string'
        ? obj.toolName
        : obj.toolName === null
          ? null
          : null;
    const toolPayload =
      obj.toolPayload && typeof obj.toolPayload === 'object'
        ? (obj.toolPayload as Record<string, unknown>)
        : null;
    const status = (typeof obj.status === 'string'
      ? obj.status
      : 'pending') as GoalStepStatus;
    const startedAt =
      typeof obj.startedAt === 'string' ? obj.startedAt : null;
    const endedAt =
      typeof obj.endedAt === 'string' ? obj.endedAt : null;
    const outcome = typeof obj.outcome === 'string' ? obj.outcome : null;
    const errorMessage =
      typeof obj.errorMessage === 'string' ? obj.errorMessage : null;
    if (!id) continue;
    out.push({
      id,
      seq,
      description,
      toolName,
      toolPayload,
      status,
      startedAt,
      endedAt,
      outcome,
      errorMessage,
    });
  }
  return out;
}

function toIso(input: Date | string): string {
  if (input instanceof Date) return input.toISOString();
  return String(input);
}

function clampLimit(input: number | undefined, fallback: number): number {
  if (typeof input !== 'number' || !Number.isFinite(input) || input <= 0) {
    return fallback;
  }
  return Math.min(Math.floor(input), MAX_LIST_LIMIT);
}

export { kernelGoals };
