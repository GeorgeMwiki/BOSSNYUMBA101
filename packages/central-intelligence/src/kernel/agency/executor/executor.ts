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
 *
 * Sovereign-tier ledger (K7 wave-K wiring): in addition to the legacy
 * `auditSink`, sovereign-tier tool invocations are written to the new
 * hash-chained sovereign action ledger via the optional
 * `sovereignLedger` port. A tool is considered sovereign-tier when
 * EITHER its `stakes === 'critical'` OR its `name` is in
 * `SOVEREIGN_TIER_ACTION_NAMES` (a deny-list of irreversible / high-
 * regulatory-impact actions: tenant eviction, owner payout, KRA
 * filings, GePG control-number revocations, market-rate-band overrides,
 * inspection major-damage flags). Ledger write failure is logged but
 * NEVER thrown — we don't want a logging error to roll back a tool that
 * already succeeded. TODO: revisit this policy if/when an external
 * regulator requires fail-closed semantics.
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

/**
 * Minimal port shape the executor needs from the sovereign action
 * ledger. The Drizzle-backed adapter lives in `@bossnyumba/database`
 * (`createSovereignActionLedgerService`); kernel callers depend only on
 * the structural surface defined here so the kernel package keeps zero
 * runtime imports of the database package.
 */
export interface SovereignActionLedgerPort {
  appendLedgerEntry(args: {
    readonly tenantId: string;
    readonly actionType: string;
    readonly payloadJson: Record<string, unknown>;
    readonly proposer: string;
    readonly approvers: ReadonlyArray<string>;
    readonly executedAt: Date;
  }): Promise<unknown>;
}

/** Minimal observability hook the executor uses when the sovereign
 *  ledger write fails. Mirrors the wake-loop logger shape (info/warn/
 *  error) so the same composition-root logger can be threaded in. */
export interface ExecutorLogger {
  error?(obj: Record<string, unknown>, msg?: string): void;
  warn?(obj: Record<string, unknown>, msg?: string): void;
}

/**
 * Deny-list of action names treated as sovereign-tier even when their
 * `stakes` discriminator says otherwise. These are irreversible /
 * regulator-touching actions — every invocation MUST be recorded in
 * the hash-chained sovereign ledger so an external audit can reconstruct
 * the chain after the fact.
 */
export const SOVEREIGN_TIER_ACTION_NAMES: ReadonlyArray<string> = [
  'tenant-eviction-proposed',
  'owner-payout-executed',
  'kra-mri-filed',
  'gepg-control-number-revoked',
  'market-rate-band-overridden',
  'inspection-flagged-as-major-damage',
];

/**
 * A tool is considered sovereign-tier when either:
 *   1. its `stakes` value is `'critical'` (the in-tree discriminator), OR
 *   2. its `name` appears in {@link SOVEREIGN_TIER_ACTION_NAMES} (the
 *      deny-list for irreversible regulator-touching actions whose
 *      stakes have not yet been re-graded to critical).
 *
 * The deny-list is a deliberate redundancy — it lets the ledger pick up
 * sovereign actions even if a future contributor introduces a new tool
 * with the wrong stakes classification.
 */
export function isSovereignTier(tool: Pick<ActionToolDef, 'name' | 'stakes'>): boolean {
  if (tool.stakes === 'critical') return true;
  return SOVEREIGN_TIER_ACTION_NAMES.includes(tool.name);
}

export interface ExecutorDeps {
  readonly goals: GoalsPort;
  readonly tools: ActionToolRegistry;
  readonly approvalGate?: ApprovalGate;
  readonly autonomyPolicy?: AutonomyPolicyPort;
  readonly auditSink: ActionAuditSink;
  /**
   * Optional hash-chained ledger for sovereign-tier actions. When
   * present, every sovereign-tier tool invocation (success AND failure)
   * is appended. Ledger write failures are logged via `logger` and
   * swallowed — they never roll back a successful tool invocation.
   */
  readonly sovereignLedger?: SovereignActionLedgerPort;
  /** Optional structured logger used for ledger write failures. */
  readonly logger?: ExecutorLogger;
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
        let invokeOutput: unknown = null;
        try {
          const result = await invokeTool(tool, step.toolPayload, {
            tenantId: goal.tenantId,
            userId: goal.userId,
          });
          if (result.ok) {
            outcomeText = stringifyOutput(result.output);
            invokeOutput = result.output;
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
          await safeSovereignLedger(deps, tool, {
            tenantId: goal.tenantId,
            userId: goal.userId,
            input: step.toolPayload,
            output: null,
            outcome: 'failure',
            errorMessage: invokeError,
            executedAt: clock(),
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
        await safeSovereignLedger(deps, tool, {
          tenantId: goal.tenantId,
          userId: goal.userId,
          input: step.toolPayload,
          output: invokeOutput,
          outcome: 'success',
          errorMessage: null,
          executedAt: clock(),
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

/**
 * Append a sovereign-tier execution to the hash-chained ledger.
 *
 * Guard rails:
 *   - no-op when `deps.sovereignLedger` is missing (kernel can run
 *     without the ledger bound — useful in tests and in dev runs).
 *   - no-op for non-sovereign tools (see {@link isSovereignTier}).
 *   - ledger errors are logged but NEVER rethrown — sovereign-tier
 *     audit is non-negotiable BUT a logging failure must not roll back
 *     a tool execution that already succeeded. TODO: re-evaluate this
 *     policy once we have an external regulator demanding fail-closed
 *     semantics — a configurable `failClosed` flag would be the natural
 *     extension.
 */
async function safeSovereignLedger(
  deps: ExecutorDeps,
  tool: ActionToolDef,
  args: {
    readonly tenantId: string;
    readonly userId: string;
    readonly input: Record<string, unknown> | null;
    readonly output: unknown;
    readonly outcome: 'success' | 'failure';
    readonly errorMessage: string | null;
    readonly executedAt: Date;
  },
): Promise<void> {
  if (!deps.sovereignLedger) return;
  if (!isSovereignTier(tool)) return;
  const payload: Record<string, unknown> = {
    input: args.input ?? {},
    output: args.output ?? null,
    outcome: args.outcome,
  };
  if (args.errorMessage) payload.error = args.errorMessage;
  try {
    await deps.sovereignLedger.appendLedgerEntry({
      tenantId: args.tenantId,
      actionType: tool.name,
      payloadJson: payload,
      proposer: args.userId,
      approvers: [],
      executedAt: args.executedAt,
    });
  } catch (err) {
    const log = deps.logger?.error ?? deps.logger?.warn;
    if (log) {
      log(
        {
          err: err instanceof Error ? err.message : String(err),
          tenantId: args.tenantId,
          actionType: tool.name,
        },
        'sovereign-ledger.appendLedgerEntry failed',
      );
    } else {
      console.error(
        'agency-executor: sovereign-ledger.appendLedgerEntry failed',
        err,
      );
    }
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
