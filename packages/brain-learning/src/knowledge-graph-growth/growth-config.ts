/**
 * Knowledge-graph growth + pruning configuration.
 *
 * §4 R-LEARNING + N-E spec:
 *
 *   Daily growth:
 *     - new edges from PI-A confirmed observations
 *     - new edges from K-D Reflexion notes
 *     - new edges from decision events
 *
 *   Pruning rules:
 *     - edge half-life = 180 days; older edges decay confidence by 50%
 *     - nodes with no edge in 365 days → archived
 *
 *   Per-tenant ceiling: 50,000 nodes (configurable)
 *     - over-limit triggers oldest-archived-first eviction
 *
 *   Conflict resolution:
 *     - when two sources contradict, prefer higher source-confidence
 *       and more recent timestamp
 */

/** Edge half-life. After this many days, confidence is multiplied by 0.5. */
export const EDGE_HALF_LIFE_DAYS = 180;
/** Node with no touched edge in N days → archived. */
export const ORPHAN_NODE_ARCHIVE_DAYS = 365;
/** Per-tenant node ceiling. Configurable; this is the default. */
export const DEFAULT_PER_TENANT_NODE_CEILING = 50_000;

export interface KGGrowthConfig {
  readonly edgeHalfLifeDays: number;
  readonly orphanArchiveDays: number;
  readonly perTenantNodeCeiling: number;
}

export function defaultGrowthConfig(
  overrides?: Partial<KGGrowthConfig>,
): KGGrowthConfig {
  return Object.freeze({
    edgeHalfLifeDays: overrides?.edgeHalfLifeDays ?? EDGE_HALF_LIFE_DAYS,
    orphanArchiveDays:
      overrides?.orphanArchiveDays ?? ORPHAN_NODE_ARCHIVE_DAYS,
    perTenantNodeCeiling:
      overrides?.perTenantNodeCeiling ?? DEFAULT_PER_TENANT_NODE_CEILING,
  });
}

/**
 * Apply half-life decay to a confidence score. Pure.
 *
 *   newConfidence = oldConfidence × 0.5 ^ (ageDays / halfLife)
 */
export function decayConfidence(args: {
  currentConfidence: number;
  ageDays: number;
  halfLifeDays: number;
}): number {
  if (args.halfLifeDays <= 0) return args.currentConfidence;
  const halfLives = args.ageDays / args.halfLifeDays;
  return args.currentConfidence * Math.pow(0.5, halfLives);
}

/**
 * Conflict resolution. Returns the winning observation when two sources
 * disagree. Tie-breaks toward more recent observation.
 */
export interface KGObservation {
  readonly sourceConfidence: number;
  readonly observedAt: Date;
  readonly content: string;
}

export function resolveKGConflict(
  a: KGObservation,
  b: KGObservation,
): KGObservation {
  if (a.sourceConfidence !== b.sourceConfidence) {
    return a.sourceConfidence > b.sourceConfidence ? a : b;
  }
  return a.observedAt.getTime() >= b.observedAt.getTime() ? a : b;
}
