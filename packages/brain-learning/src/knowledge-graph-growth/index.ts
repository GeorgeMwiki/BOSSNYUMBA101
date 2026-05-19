/**
 * Module 7 — knowledge-graph-growth
 *
 * Daily growth + pruning pass on K-D TemporalKG: ingest PI-A
 * observations, decay edges older than 180d, archive orphan nodes
 * (no edge in 365d), evict over-ceiling per tenant.
 */

export {
  runKGGrowthCycle,
  type KGGrowthPorts,
  type TemporalKGPort,
  type KGObservationCandidate,
  type KGEdgeForDecay,
  type KGNodeForArchive,
} from './run-growth.js';

export {
  decayConfidence,
  resolveKGConflict,
  defaultGrowthConfig,
  EDGE_HALF_LIFE_DAYS,
  ORPHAN_NODE_ARCHIVE_DAYS,
  DEFAULT_PER_TENANT_NODE_CEILING,
} from './growth-config.js';
export type {
  KGGrowthConfig,
  KGObservation,
} from './growth-config.js';
