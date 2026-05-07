/**
 * Agency — autonomous executor.
 *
 * Walks the steps of a Goal, marking each `running` → `done|failed|
 * skipped|pending(awaiting-approval)`. High-stakes steps route through
 * the four-eye approval gate (a proposed action is created and the
 * step's outcome is set to `awaiting-approval:<actionId>`); the
 * executor does NOT block waiting for approval.
 *
 * On any tool failure (or unknown tool), the executor bails out of the
 * goal — subsequent steps stay `pending`.
 *
 * Every transition is audited via the injected sink. The audit sink is
 * a side-channel: failures are logged and swallowed so the executor
 * remains the source of truth for step state.
 */
import type { ApprovalGate } from '../../four-eye-approval.js';
import type {
  ActionAuditDecision,
  ActionAuditEntry,
  ActionAuditSink,
} from './audit-sink.js';
import { hashPayload } from './audit-sink.js';
import type { AutonomyPolicyPort } from './autonomy-policy.js';
import type {
  ActionToolDef,
  ActionToolRegistry,
  ActionToolStakes,
} from '../action-tools/types.js';
import type { Goal, GoalsPort, GoalStep } from '../goals/types.js';

export interface ExecutorDeps {
  readonly goals: GoalsPort;
  readonly tools: ActionToolRegistry;
  readonly approvalGate?: ApprovalGate;
  readonly autonomyPolicy?: AutonomyPolicyPort;
  readonly auditSink: ActionAuditSink;
  readonly clock?: () => Date;
}

export interface ExecutorOutcome {
  readonly goalId: string;
  readonly stepsRun: number;
  readonly stepsSucceeded: number;
  readonly stepsFailed: number;
  readonly stepsAwaitingApproval: number;
  readonly proposedActionIds: ReadonlyArray<string>;
  readonly failureMessages: ReadonlyArray<string>;
}

export interface Executor {
  executeGoal(goalId: string): Promise<ExecutorOutcome>;
}

/** Stake levels the four-eye gate accepts. `low` skips the gate. */
type ApprovalStake = 'medium' | 'high' | 'critical';

export function createExecutor(deps: ExecutorDeps): Executor {
  const clock = deps.clock ?? (() => new Date());

  return {
    async executeGoal(goalId: string): Promise<ExecutorOutcome> {
      const goal = await deps.goals.get(goalId);
      if (!goal) {
        return {
          goalId,
          stepsRun: 0,
          stepsSucceeded: 0,
          stepsFailed: 0,
          stepsAwaitingApproval: 0,
          proposedActionIds: [],
          failureMessages: [`unknown goal: ${goalId}`],
        };
      }

      let stepsRun = 0;
      let stepsSucceeded = 0;
      let stepsFailed = 0;
      let stepsAwaitingApproval = 0;
      const proposedActionIds: string[] = [];
      const failureMessages: string[] = [];

      const orderedSteps = [...goal.steps].sort((a, b) => a.seq - b.seq);

      let bailed = false;
      for (const step of orderedSteps) {
        if (bailed) break;
        if (step.status !== 'pending') {
          // Already ran on a prior cycle — leave it.
          continue;
        }
        stepsRun += 1;
        const startedAt = clock();
        await safeUpdateStep(deps, {
          goalId: goal.id,
          stepId: step.id,
          status: 'running',
        });
        await safeAudit(deps, {
          tenantId: goal.tenantId,
          userId: goal.userId,
          goalId: goal.id,
          stepId: step.id,
          toolName: step.toolName,
          decision: 'running',
          payloadHash: hashPayload(step.toolPayload),
          outcome: null,
          errorMessage: null,
          startedAt: startedAt.toISOString(),
          endedAt: null,
          latencyMs: null,
        });

        // Informational step → no-op done.
        if (step.toolName === null) {
          await safeUpdateStep(deps, {
            goalId: goal.id,
            stepId: step.id,
            status: 'done',
            outcome: 'informational-step',
          });
          await safeAudit(deps, {
            tenantId: goal.tenantId,
            userId: goal.userId,
            goalId: goal.id,
            stepId: step.id,
            toolName: null,
            decision: 'done',
            payloadHash: hashPayload(step.toolPayload),
            outcome: 'informational-step',
            errorMessage: null,
            startedAt: startedAt.toISOString(),
            endedAt: clock().toISOString(),
            latencyMs: clock().getTime() - startedAt.getTime(),
          });
          stepsSucceeded += 1;
          continue;
        }

        const tool = deps.tools.get(step.toolName);
        if (!tool) {
          const message = `unknown tool: ${step.toolName}`;
          await safeUpdateStep(deps, {
            goalId: goal.id,
            stepId: step.id,
            status: 'failed',
            errorMessage: message,
          });
          await safeAudit(deps, {
            tenantId: goal.tenantId,
            userId: goal.userId,
            goalId: goal.id,
            stepId: step.id,
            toolName: step.toolName,
            decision: 'unknown-tool',
            payloadHash: hashPayload(step.toolPayload),
            outcome: null,
            errorMessage: message,
            startedAt: startedAt.toISOString(),
            endedAt: clock().toISOString(),
            latencyMs: clock().getTime() - startedAt.getTime(),
          });
          stepsFailed += 1;
          failureMessages.push(message);
          bailed = true;
          continue;
        }

        // Autonomy policy check — may flip `requiresApproval`.
        let policyOutcome: {
          readonly authorized: boolean;
          readonly requiresApproval: boolean;
          readonly reason: string;
        } = {
          authorized: true,
          requiresApproval: false,
          reason: 'no-policy-default-autonomous',
        };
        if (deps.autonomyPolicy) {
          try {
            policyOutcome = await deps.autonomyPolicy.decide({
              tenantId: goal.tenantId,
              userId: goal.userId,
              toolName: step.toolName,
              stakes: tool.stakes,
            });
          } catch (err) {
            const message = `autonomy-policy error: ${
              err instanceof Error ? err.message : String(err)
            }`;
            await safeUpdateStep(deps, {
              goalId: goal.id,
              stepId: step.id,
              status: 'failed',
              errorMessage: message,
            });
            await safeAudit(deps, {
              tenantId: goal.tenantId,
              userId: goal.userId,
              goalId: goal.id,
              stepId: step.id,
              toolName: step.toolName,
              decision: 'failed',
              payloadHash: hashPayload(step.toolPayload),
              outcome: null,
              errorMessage: message,
              startedAt: startedAt.toISOString(),
              endedAt: clock().toISOString(),
              latencyMs: clock().getTime() - startedAt.getTime(),
            });
            stepsFailed += 1;
            failureMessages.push(message);
            bailed = true;
            continue;
          }
        }

        // Approval branch — propose, mark pending(awaiting-approval),
        // continue to next step.
        if (policyOutcome.requiresApproval && deps.approvalGate) {
          const approvalStake = approvalStakeFor(tool.stakes);
          let actionId = 'unknown';
          let approvalError: string | null = null;
          try {
            const record = await deps.approvalGate.propose({
              proposerUserId: 'kernel-agency',
              thoughtId: step.id,
              summary: shortSummary(step, goal),
              toolName: tool.name,
              payload: (step.toolPayload ?? {}) as Readonly<
                Record<string, unknown>
              >,
              stakes: approvalStake,
            });
            actionId = record.action.id;
          } catch (err) {
            approvalError = err instanceof Error ? err.message : String(err);
          }
          if (approvalError) {
            await safeUpdateStep(deps, {
              goalId: goal.id,
              stepId: step.id,
              status: 'failed',
              errorMessage: `approval-gate error: ${approvalError}`,
            });
            await safeAudit(deps, {
              tenantId: goal.tenantId,
              userId: goal.userId,
              goalId: goal.id,
              stepId: step.id,
              toolName: step.toolName,
              decision: 'failed',
              payloadHash: hashPayload(step.toolPayload),
              outcome: null,
              errorMessage: `approval-gate error: ${approvalError}`,
              startedAt: startedAt.toISOString(),
              endedAt: clock().toISOString(),
              latencyMs: clock().getTime() - startedAt.getTime(),
            });
            stepsFailed += 1;
            failureMessages.push(`approval-gate error: ${approvalError}`);
            bailed = true;
            continue;
          }
          proposedActionIds.push(actionId);
          stepsAwaitingApproval += 1;
          // Re-set the step's status back to 'pending' with an
          // outcome marker so the next executor pass / operator can
          // see it's gated.
          await safeUpdateStep(deps, {
            goalId: goal.id,
            stepId: step.id,
            status: 'pending',
            outcome: `awaiting-approval:${actionId}`,
          });
          await safeAudit(deps, {
            tenantId: goal.tenantId,
            userId: goal.userId,
            goalId: goal.id,
            stepId: step.id,
            toolName: step.toolName,
            decision: 'awaiting-approval',
            payloadHash: hashPayload(step.toolPayload),
            outcome: `awaiting-approval:${actionId}`,
            errorMessage: null,
            startedAt: startedAt.toISOString(),
            endedAt: clock().toISOString(),
            latencyMs: clock().getTime() - startedAt.getTime(),
          });
          continue;
        }

        // Autonomous branch — invoke the tool.
        let invokeError: string | null = null;
        let outcomeText: string | null = null;
        try {
          const result = await invokeTool(tool, step.toolPayload, {
            tenantId: goal.tenantId,
            userId: goal.userId,
          });
          if (result.ok) {
            outcomeText = stringifyOutput(result.output);
          } else {
            invokeError = result.message;
          }
        } catch (err) {
          invokeError = err instanceof Error ? err.message : String(err);
        }
        if (invokeError) {
          await safeUpdateStep(deps, {
            goalId: goal.id,
            stepId: step.id,
            status: 'failed',
            errorMessage: invokeError,
          });
          await safeAudit(deps, {
            tenantId: goal.tenantId,
            userId: goal.userId,
            goalId: goal.id,
            stepId: step.id,
            toolName: step.toolName,
            decision: 'failed',
            payloadHash: hashPayload(step.toolPayload),
            outcome: null,
            errorMessage: invokeError,
            startedAt: startedAt.toISOString(),
            endedAt: clock().toISOString(),
            latencyMs: clock().getTime() - startedAt.getTime(),
          });
          stepsFailed += 1;
          failureMessages.push(invokeError);
          bailed = true;
          continue;
        }
        await safeUpdateStep(deps, {
          goalId: goal.id,
          stepId: step.id,
          status: 'done',
          outcome: outcomeText ?? 'ok',
        });
        await safeAudit(deps, {
          tenantId: goal.tenantId,
          userId: goal.userId,
          goalId: goal.id,
          stepId: step.id,
          toolName: step.toolName,
          decision: 'done',
          payloadHash: hashPayload(step.toolPayload),
          outcome: outcomeText ?? 'ok',
          errorMessage: null,
          startedAt: startedAt.toISOString(),
          endedAt: clock().toISOString(),
          latencyMs: clock().getTime() - startedAt.getTime(),
        });
        stepsSucceeded += 1;
      }

      // If every step is now `done`, flip the goal to completed.
      const refreshed = await deps.goals.get(goalId);
      if (
        refreshed &&
        refreshed.steps.length > 0 &&
        refreshed.steps.every((s) => s.status === 'done')
      ) {
        await deps.goals.setStatus(goalId, 'completed');
      }

      return {
        goalId,
        stepsRun,
        stepsSucceeded,
        stepsFailed,
        stepsAwaitingApproval,
        proposedActionIds,
        failureMessages,
      };
    },
  };
}

async function invokeTool(
  tool: ActionToolDef,
  payload: Record<string, unknown> | null,
  ctx: { tenantId: string; userId: string },
): Promise<
  | { readonly ok: true; readonly output: unknown }
  | { readonly ok: false; readonly message: string }
> {
  return tool.invoke(payload ?? {}, ctx);
}

async function safeUpdateStep(
  deps: ExecutorDeps,
  args: Parameters<GoalsPort['updateStepStatus']>[0],
): Promise<void> {
  try {
    await deps.goals.updateStepStatus(args);
  } catch (err) {
    console.error('agency-executor: updateStepStatus failed', err);
  }
}

async function safeAudit(
  deps: ExecutorDeps,
  entry: ActionAuditEntry,
): Promise<void> {
  try {
    await deps.auditSink.record(entry);
  } catch (err) {
    console.error('agency-executor: audit-sink failed', err);
  }
}

function approvalStakeFor(stakes: ActionToolStakes): ApprovalStake {
  if (stakes === 'low') return 'medium';
  return stakes;
}

function shortSummary(step: GoalStep, goal: Goal): string {
  const head = goal.title ? `${goal.title} — ` : '';
  return `${head}${step.description}`.slice(0, 280);
}

function stringifyOutput(output: unknown): string {
  if (output === null || output === undefined) return 'ok';
  if (typeof output === 'string') return output.slice(0, 280);
  if (typeof output === 'number' || typeof output === 'boolean') {
    return String(output);
  }
  try {
    return JSON.stringify(output).slice(0, 280);
  } catch {
    return 'ok';
  }
}

// Tagged for forward use by the streaming agent-loop bridge — when
// streaming becomes the default, the loop will re-use this audit
// decision union.
export type { ActionAuditDecision };
