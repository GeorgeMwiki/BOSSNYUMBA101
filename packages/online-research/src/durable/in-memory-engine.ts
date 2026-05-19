/**
 * In-memory `DurableEnginePort` — used for tests + dev. Drives the
 * same control flow as Inngest (per-step checkpointing, idempotency
 * keys, simulated approval gates) without a queue.
 *
 * Production wraps `inngest`'s `step.run`, `step.sleep`, and
 * `step.waitForEvent`. The contract is identical so flow definitions
 * port unchanged.
 *
 * Capabilities:
 *   - Per-step retry (configurable per step or per engine default).
 *   - Per-step idempotency — a duplicate invocation with the same
 *     idempotency key short-circuits and returns the prior run.
 *   - `simulateCrash` — pause the run mid-step; subsequent `resume`
 *     replays from the next pending step (last-completed semantic).
 *   - Approval-gated steps defer via the K-A defer hook and pause
 *     until `resume(runId, { approved: true })` is called.
 */

import type {
  DurableEnginePort,
  DeferHookPort,
} from '../ports/index.js';
import type {
  DurableFlowDefinition,
  DurableFlowRun,
  DurableStepContext,
  DurableStepSnapshot,
} from '../types/index.js';

interface RunState {
  readonly runId: string;
  readonly tenantId: string;
  readonly flowName: string;
  readonly version: string;
  readonly correlationId: string;
  args: unknown;
  status: 'running' | 'completed' | 'failed' | 'paused' | 'cancelled';
  startedAt: string;
  endedAt?: string;
  stepStates: DurableStepSnapshot[];
  stepOutputs: unknown[];
  /**
   * Per-step approval flag — set when `resume` is called against an
   * `awaiting_approval` step. The gate check honours this flag so the
   * step is not re-deferred when execution re-enters via `runFrom`.
   */
  approvedSteps: Set<number>;
  output?: unknown;
  error?: { readonly code: string; readonly message: string };
  pausedAtIndex?: number;
  crashed?: boolean;
}

export interface InMemoryDurableEngineDeps {
  readonly clock: { readonly nowMs: () => number };
  readonly correlationIdGen: () => string;
  readonly deferHook: DeferHookPort;
  /** Default retries per step when the step doesn't specify. Default 3. */
  readonly defaultRetries?: number;
}

export function createInMemoryDurableEngine(
  deps: InMemoryDurableEngineDeps,
): DurableEnginePort {
  const flows = new Map<string, DurableFlowDefinition>();
  const runs = new Map<string, RunState>();
  const idempotency = new Map<string, string>(); // key -> runId
  const defaultRetries = deps.defaultRetries ?? 3;

  const snapshot = (state: RunState): DurableFlowRun =>
    Object.freeze({
      runId: state.runId,
      flowName: state.flowName,
      version: state.version,
      status: state.status,
      startedAt: state.startedAt,
      ...(state.endedAt !== undefined ? { endedAt: state.endedAt } : {}),
      steps: Object.freeze(state.stepStates.map((s) => Object.freeze({ ...s }))),
      ...(state.output !== undefined ? { output: state.output } : {}),
      ...(state.error !== undefined ? { error: state.error } : {}),
    });

  const runFrom = async (state: RunState, fromIndex: number): Promise<DurableFlowRun> => {
    const flow = flows.get(state.flowName);
    if (flow === undefined) {
      state.status = 'failed';
      state.endedAt = new Date(deps.clock.nowMs()).toISOString();
      state.error = { code: 'flow_not_registered', message: state.flowName };
      return snapshot(state);
    }

    for (let i = fromIndex; i < flow.steps.length; i++) {
      const step = flow.steps[i];
      if (step === undefined) {
        continue;
      }
      const stepState = state.stepStates[i];
      if (stepState === undefined) {
        continue;
      }

      // Approval gate — pause + emit defer token unless already approved
      // by a prior `resume(...)` call.
      if (
        step.requiresApproval !== undefined &&
        stepState.status !== 'completed' &&
        !state.approvedSteps.has(i)
      ) {
        const defer = await deps.deferHook.requestDefer({
          tenantId: state.tenantId,
          correlationId: state.correlationId,
          reason: step.requiresApproval.description,
          payload: { runId: state.runId, stepIndex: i },
        });
        state.stepStates[i] = Object.freeze({
          ...stepState,
          status: 'awaiting_approval',
          resumeToken: defer.resumeToken,
        });
        state.status = 'paused';
        state.pausedAtIndex = i;
        return snapshot(state);
      }

      state.stepStates[i] = Object.freeze({
        ...stepState,
        status: 'running',
        startedAt: new Date(deps.clock.nowMs()).toISOString(),
      });

      const retries = step.retries ?? defaultRetries;
      let attempt = 0;
      let lastErr: Error | null = null;
      let output: unknown = undefined;
      const startMs = deps.clock.nowMs();

      while (attempt <= retries) {
        if (state.crashed === true) {
          // Crashed — leave step in `running` state so resume picks it up.
          state.status = 'paused';
          state.pausedAtIndex = i;
          state.crashed = false;
          return snapshot(state);
        }

        try {
          const prevOutput = i === 0 ? state.args : state.stepOutputs[i - 1];
          const ctx: DurableStepContext = Object.freeze({
            runId: state.runId,
            tenantId: state.tenantId,
            correlationId: state.correlationId,
            stepIndex: i,
            log: () => {},
            sleep: async (ms: number) => {
              if (ms > 0) {
                await new Promise<void>((resolve) => setTimeout(resolve, ms));
              }
            },
          });
          const stepTimeoutMs = step.timeoutMs;
          if (stepTimeoutMs !== undefined && stepTimeoutMs > 0) {
            const timeoutErr = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`step_timeout:${step.name}`)), stepTimeoutMs),
            );
            output = await Promise.race([step.run(prevOutput, ctx), timeoutErr]);
          } else {
            output = await step.run(prevOutput, ctx);
          }
          break;
        } catch (e) {
          lastErr = e as Error;
          attempt++;
          state.stepStates[i] = Object.freeze({
            ...state.stepStates[i]!,
            attempts: attempt,
          });
        }
      }

      void startMs;

      if (lastErr !== null && output === undefined) {
        state.stepStates[i] = Object.freeze({
          ...state.stepStates[i]!,
          status: 'failed',
          endedAt: new Date(deps.clock.nowMs()).toISOString(),
        });
        state.status = 'failed';
        state.endedAt = new Date(deps.clock.nowMs()).toISOString();
        state.error = { code: 'step_failed', message: `${step.name}: ${lastErr.message}` };
        return snapshot(state);
      }

      state.stepOutputs[i] = output;
      state.stepStates[i] = Object.freeze({
        ...state.stepStates[i]!,
        status: 'completed',
        endedAt: new Date(deps.clock.nowMs()).toISOString(),
      });
    }

    state.status = 'completed';
    state.endedAt = new Date(deps.clock.nowMs()).toISOString();
    state.output = state.stepOutputs[state.stepOutputs.length - 1];
    return snapshot(state);
  };

  return {
    register: async (definition) => {
      const key = `${definition.name}@${definition.version}`;
      flows.set(key, definition as DurableFlowDefinition);
      flows.set(definition.name, definition as DurableFlowDefinition); // latest by name
    },
    invoke: async (flowName, args, opts) => {
      const idemKey = `${opts.tenantId}:${flowName}:${opts.idempotencyKey}`;
      const existingRunId = idempotency.get(idemKey);
      if (existingRunId !== undefined) {
        const existing = runs.get(existingRunId);
        if (existing !== undefined) {
          return snapshot(existing);
        }
      }
      const flow = flows.get(flowName);
      if (flow === undefined) {
        throw new Error(`Flow not registered: ${flowName}`);
      }
      // Validate args
      flow.argsSchema.parse(args);

      const runId = `run_${deps.correlationIdGen()}`;
      const state: RunState = {
        runId,
        tenantId: opts.tenantId,
        flowName,
        version: flow.version,
        correlationId: deps.correlationIdGen(),
        args,
        status: 'running',
        startedAt: new Date(deps.clock.nowMs()).toISOString(),
        stepStates: flow.steps.map((step) =>
          Object.freeze({
            name: step.name,
            status: 'pending' as const,
            attempts: 0,
          }),
        ),
        stepOutputs: new Array(flow.steps.length),
        approvedSteps: new Set<number>(),
      };
      runs.set(runId, state);
      idempotency.set(idemKey, runId);
      return runFrom(state, 0);
    },
    resume: async (runId, _payload) => {
      const state = runs.get(runId);
      if (state === undefined) {
        throw new Error(`Run not found: ${runId}`);
      }
      const fromIndex = state.pausedAtIndex ?? 0;
      // Mark approval and clear the awaiting_approval status so the
      // step is treated as pending + approved for the next gate check.
      const stepState = state.stepStates[fromIndex];
      if (stepState !== undefined && stepState.status === 'awaiting_approval') {
        state.stepStates[fromIndex] = Object.freeze({
          ...stepState,
          status: 'pending',
        });
        state.approvedSteps.add(fromIndex);
      }
      state.status = 'running';
      return runFrom(state, fromIndex);
    },
    snapshot: async (runId) => {
      const state = runs.get(runId);
      if (state === undefined) {
        return null;
      }
      return snapshot(state);
    },
    simulateCrash: async (runId) => {
      const state = runs.get(runId);
      if (state === undefined) {
        throw new Error(`Run not found: ${runId}`);
      }
      state.crashed = true;
    },
  };
}
