/**
 * Durable-execution barrel — the public surface of the
 * `@bossnyumba/central-intelligence` durable subsystem.
 *
 * Wires the Inngest-based wrapper around the legacy
 * `TaskAgentExecutor` (see `inngest-executor.ts`) and the multi-day
 * eviction flow skeleton (see `functions/eviction-flow.ts`).
 *
 * Feature-flag: `DURABLE_EXEC_ENABLED=true` (read at the composition
 * root). When unset the wrapper short-circuits and callers fall back to
 * the legacy sync executor — backward compatibility is preserved by
 * construction.
 *
 * Env vars:
 *   - `INNGEST_EVENT_KEY`     (producer)
 *   - `INNGEST_SIGNING_KEY`   (consumer / serve handler)
 *   - `DURABLE_EXEC_ENABLED`  (master kill-switch)
 */

export {
  createInngestComposition,
  createNoopInngestClient,
  createLocalDevInngestClient,
  INNGEST_LOCAL_DEV_URL,
  INNGEST_LOCAL_DEV_APP_ID,
  type DurableFunctionContext,
  type DurableFunctionDefinition,
  type DurableStepLike,
  type FetchLike,
  type InngestClientConfig,
  type InngestClientFactory,
  type InngestClientLike,
  type InngestComposition,
  type LocalDevInngestClientOpts,
} from './inngest-client.js';

export {
  createDurableTaskAgentExecutor,
  TASK_AGENT_RUN_EVENT,
  type DurableExecutorDeps,
  type DurableTaskAgentExecutor,
  type TaskAgentExecuteOptionsLike,
  type TaskAgentExecuteOutputLike,
  type TaskAgentExecutorLike,
  type TaskAgentRunRequestedEvent,
} from './inngest-executor.js';

export {
  registerEvictionFlow,
  EVICTION_FLOW_STARTED_EVENT,
  type EvictionFlowDeps,
  type EvictionFlowServices,
  type EvictionFlowStartedEvent,
} from './functions/eviction-flow.js';

// PART A — durable loop actuators. Production impls of the orchestrator's
// `SubAgentSpawner` / `WakeScheduler` / `MonitorRegistry` ports over the
// Inngest durable-execution layer. Composed at the api-gateway root and
// threaded into `createRegistryDispatcher({ loopActuators })`. Degrades to
// in-process / recorded fallbacks when `DURABLE_EXEC_ENABLED` is off.
export {
  createDurableLoopActuators,
  DEFAULT_MONITOR_POLL_INTERVAL_MS,
  SUB_MD_SPAWN_EVENT,
  ORCHESTRATOR_WAKE_EVENT,
  ORCHESTRATOR_MONITOR_EVENT,
  type DurableLoopActuators,
  type DurableLoopActuatorsDeps,
  type DurableDegradeRecorder,
  type ChildTurnRunner,
  type ResumeTurnRunner,
  type MonitorChecker,
  type SubMdSpawnRequestedEvent,
  type OrchestratorWakeRequestedEvent,
  type OrchestratorMonitorArmedEvent,
} from './durable-loop-actuators.js';

// PART A (PRIMARY) — in-process wake/monitor supervisor. The DEPLOY-FREE
// `WakeScheduler` (+ `MonitorRegistry`) the registry dispatcher uses by
// default: `schedule_wake` arms a real process-local timer that resumes the
// orchestrator turn at `wakeAt` with NO Inngest dependency. Monitor arms a
// real in-process poll only when a predicate source is attested; honest
// degrade-record otherwise. Driven by `start()`'s internal interval and/or an
// external heartbeat `tick()`.
export {
  createInProcessWakeScheduler,
  type InProcessWakeSupervisor,
  type InProcessWakeSchedulerDeps,
  type InProcessSupervisorLogger,
  type InProcessTickOutcome,
  type RehydrateOutcome,
  // Durable backing-store port (PURE). The api-gateway composition root binds
  // a Postgres impl so armed wakes/monitors survive a process restart; the
  // storeless supervisor is the explicit fallback only.
  type DurableWakeStore,
  type PersistedWakeRecord,
  type PersistedMonitorRecord,
  type PersistedPendingSet,
} from './in-process-wake-scheduler.js';

// PART A (SECONDARY) — in-process Inngest runtime. The consumer/serve side the
// hand-rolled `/api/v1/inngest` webhook dispatches to: maps `event.name` →
// registered `DurableFunctionDefinition` and runs its body. Makes the durable
// producer/consumer path code-complete; crash-resilient suspend still needs a
// deployed Inngest worker (see the module header).
export {
  createInProcessInngestRuntime,
  type InProcessInngestRuntime,
  type InProcessInngestRuntimeDeps,
  type InProcessInngestRuntimeLogger,
  type InngestRuntimeEvent,
  type InngestRuntimeResult,
} from './in-process-inngest-runtime.js';
