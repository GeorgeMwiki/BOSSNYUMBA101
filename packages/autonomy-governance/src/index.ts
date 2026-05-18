/**
 * @bossnyumba/autonomy-governance
 *
 * Per-tenant autonomy-caps + per-sub-MD quality SLOs + auto-rollback +
 * canary controller + handoff queue. The Klarna-defense substrate.
 *
 * R1 + R3 architectural framing: sub-MDs are *scoped, reversible task
 * contracts* — not autonomous juniors. Every contract is gated by:
 *
 *   1. A tenant-wide autonomy cap   (caps/)
 *   2. A per-(subMd, metric) SLO    (slo/sub-md-slo.ts)
 *   3. A canary stage ladder        (slo/canary-controller.ts)
 *   4. An auto-rollback engine      (slo/auto-rollback.ts)
 *   5. A handoff-to-human queue     (handoff/)
 *
 * This package is wire-agnostic: all I/O is delegated to ports. The
 * kernel-side hook that calls `evaluateAutonomyCap` before any mutate-tier
 * action is a follow-up — out of scope for this substrate wave.
 */

export * from './types.js';

// Caps
export {
  parseCapPolicy,
  defaultCap,
  capPolicySchema,
  evaluateAutonomyCap,
  type CapPolicyInput,
  type TenantAutonomyCapStore,
  type AutonomyRollingStateStore,
} from './caps/tenant-autonomy-cap.js';

// SLO
export {
  parseSubMdSlo,
  subMdSloSchema,
  computeDelta,
  isLowerBetterMetric,
  type SubMdSloInput,
} from './slo/sub-md-slo.js';
export {
  evaluateSlo,
  subscribeSloStream,
  type SloMonitorOptions,
  type SloResolver,
  type SloStreamConsumer,
  type SloWindowBuffer,
  type SubscribeSloStreamArgs,
} from './slo/slo-monitor.js';
export {
  STAGE_TRAFFIC_SHARE,
  stageIndex,
  demoteStage,
  promoteStage,
  shouldRouteToCanary,
} from './slo/canary-controller.js';
export {
  executeAutoRollback,
  type AutoRollbackDeps,
  type AutoRollbackInput,
  type CanaryStageStore,
  type HandoffQueuePort,
  type SubMdRevertPort,
} from './slo/auto-rollback.js';

// Handoff
export {
  InMemoryHandoffQueue,
  type HandoffQueueReader,
} from './handoff/handoff-queue.js';
export {
  handoffToHuman,
  type HandoffRequest,
  type HandoffDeps,
} from './handoff/handoff-to-human.js';
