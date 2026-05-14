/**
 * Agency layer — the brain's "acts in full control" kernel slice.
 *
 *   goals/            persistent objectives + plan decomposer
 *   action-tools/     typed write-tool registry + 5 stubs
 *   executor/         autonomous executor + audit + autonomy policy
 *   initiative/       wake-loop + default triggers
 *
 * The kernel namespace re-exports this module under `agency` so callers
 * can write `import { agency } from '@bossnyumba/central-intelligence'`
 * and reach every public type without deep imports.
 */
export * from './goals/index.js';
export * from './action-tools/index.js';
export * from './executor/index.js';
export * from './initiative/index.js';

// Real (non-stub) action-tool adapters and wake-trigger detectors.
// Composition roots wire these when domain-service ports / Drizzle DB
// are present; tests pass hand-rolled stubs.
export {
  createRentSendReminderRealTool,
  createWorkOrderCreateRealTool,
  createInspectionScheduleRealTool,
  createArrearsEscalateRealTool,
  createListingPublishRealTool,
  createRealActionTools,
  type ArrearsPortLike,
  type InspectionsPortLike,
  type MarketplacePortLike,
  type NotificationsPortLike,
  type RealActionToolDeps,
  type WorkOrdersPortLike,
} from './action-tools/real-adapters.js';

export {
  createArrears30dDetector,
  createLeaseExpiring30dDetector,
  createVacancy30dDetector,
  createRealWakeTriggers,
  type ArrearsCaseRow,
  type ArrearsReadPort,
  type LeaseExpiringRow,
  type LeaseReadPort,
  type RealDetectorDeps,
  type VacancyReadPort,
  type VacancyRow,
} from './initiative/real-detectors.js';

// Stall detector (K7 parity-litfin Gap G) — pure detector that scans
// `active` goals where the latest step activity exceeds a per-category
// stall threshold and emits self-heal proposals (continue/block/
// abandon). Storage- and side-effect-agnostic; the gateway composition
// root wires `eventSink.emit` to the in-process event bus + routes the
// chosen proposal through the existing four-eye approval flow.
export {
  categoriseGoal,
  lastActivityAt,
  runStallDetection,
  thresholdFor,
  type StallAuditEntryShape,
  type StallAuditReader,
  type StallCategory,
  type StallDetectorDeps,
  type StallDetectorRunArgs,
  type StallDetectorRunOutcome,
  type StallEventSink,
  type StallProposal,
  type StallProposalKind,
  type StallThresholds,
  type StalledGoalReport,
} from './stall-detector.js';
