/**
 * Introspection layer — the brain's "self-knowledge" pattern.
 *
 * Two pieces:
 *   1. Decision-trace replay: re-run historical kernel turns through
 *      the current kernel logic to detect drift / regression /
 *      fairness anomalies.
 *   2. Capability cards: per-persona "model cards" describing what the
 *      persona reliably does, refuses, and is uncertain about.
 *
 * Together these close the assessment gap "the brain doesn't know
 * what it can do."
 */

export {
  runDecisionReplay,
  type ReplayDelta,
  type ReplayDeps,
  type ReplayInput,
  type ReplaySource,
  type ReplaySummary,
  type ReplayThinkFn,
} from './trace-replay.js';

export {
  createPostgresReplaySource,
  type PostgresProvenanceQueryClient,
} from './trace-replay-postgres-source.js';

export {
  CAPABILITY_CARDS,
  type CapabilityCard,
  type CapabilityCardEvalSummary,
  type CapabilityClaim,
  type RefusalCategory,
  type RefusalClaim,
  type UncertaintyClaim,
} from './capability-cards.js';

export { renderCapabilityCardMarkdown } from './render-capability-card.js';
