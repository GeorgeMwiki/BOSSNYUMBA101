/**
 * PORT-SHIM: @bossnyumba/agent-platform lacks the `junior-spawner`
 * subpath (its exports are only ".", "./a2a", "./planning"; the
 * junior-spawner lifecycle module was never ported into BossNyumba's
 * agent-platform). The sibling-repo source exported the junior
 * lifecycle deciders + repository/audit contracts from
 * '@bossnyumba/agent-platform/junior-spawner'.
 *
 * This module is a minimal LOCAL stub of ONLY the symbols the two
 * lifecycle sweeps (promotion.ts, deprecation.ts) consume, so the
 * born-dark worker builds green. Reconcile at live-wiring: when the
 * real junior-spawner is ported into agent-platform, delete this file
 * and repoint the imports back to the published subpath.
 *
 * Types are kept honest to the call-sites: every member declared here
 * is actually read by promotion.ts / deprecation.ts; nothing is `any`.
 */

/** Lifecycle status of a spawned/tenant-authored junior. */
export type JuniorLifecycleStatus =
  | 'candidate'
  | 'active'
  | 'locked'
  | 'deprecated';

/** Where a junior came from (spawned by the cortex vs. tenant-authored). */
export type JuniorProvenance = 'spawned' | 'tenant_authored';

/**
 * A persisted junior row, narrowed to the fields the lifecycle sweeps
 * read. The real record carries more columns; only these are touched.
 */
export interface PersistedJuniorRecord {
  readonly id: string;
  readonly tenant_id: string | null;
  readonly provenance: JuniorProvenance;
  readonly lifecycle_status: JuniorLifecycleStatus;
}

/**
 * Tunable thresholds for the pure deciders. Opaque pass-through at this
 * layer — the sweeps forward it untouched into the decider functions.
 */
export interface LifecycleThresholds {
  readonly promote_min_satisfaction?: number;
  readonly promote_min_runs?: number;
  readonly deprecate_max_satisfaction?: number;
  readonly deprecate_min_runs?: number;
}

/** Aggregated stats feeding the promotion decider. */
export interface PromotionStats {
  readonly runs: number;
  readonly avg_satisfaction: number;
}

/** Aggregated stats feeding the deprecation decider. */
export interface DeprecationStats {
  readonly runs: number;
  readonly avg_satisfaction: number;
}

/** Outcome of the promotion decider. */
export type PromotionDecision =
  | { readonly kind: 'promote'; readonly to: JuniorLifecycleStatus; readonly reason: string }
  | { readonly kind: 'hold'; readonly reason: string };

/** Outcome of the deprecation decider. */
export type DeprecationDecision =
  | { readonly kind: 'propose_deprecation'; readonly reason: string }
  | { readonly kind: 'keep'; readonly reason: string };

/**
 * Repository contract, narrowed to the single mutation the promotion
 * sweep performs. Returns the updated record (truthy) or `null` when
 * the row vanished / the transition was a no-op.
 */
export interface JuniorRepository {
  setLifecycleStatus(
    id: string,
    to: JuniorLifecycleStatus,
    at: Date,
  ): Promise<PersistedJuniorRecord | null>;
}

/** Append-only audit event emitted for every lifecycle transition. */
export interface JuniorLifecycleAuditEvent {
  readonly kind: 'junior_lifecycle_transition';
  readonly junior_id: string;
  readonly tenant_id: string | null;
  readonly provenance: JuniorProvenance;
  readonly from_status: JuniorLifecycleStatus;
  readonly to_status: JuniorLifecycleStatus;
  readonly reason: string;
  readonly at: Date;
  readonly actor: string;
}

/** Hash-chained, append-only audit emitter. */
export type AuditChainEmitter = (
  event: JuniorLifecycleAuditEvent,
) => Promise<void>;

/**
 * PORT-SHIM decider: decide whether a junior should be promoted.
 *
 * The real pure decider lived in the sibling junior-spawner; this stub
 * keeps the born-dark worker building. It holds by default (never
 * auto-promotes without real stats wiring), preserving the safe
 * append-only invariant until live-wiring reconnects the real decider.
 */
export function decidePromotion(
  _junior: PersistedJuniorRecord,
  _stats: PromotionStats,
  _thresholds?: LifecycleThresholds,
): PromotionDecision {
  return { kind: 'hold', reason: 'port-shim: decider not yet wired' };
}

/**
 * PORT-SHIM decider: decide whether a junior should be proposed for
 * deprecation. Keeps by default for the same born-dark safety reason
 * as {@link decidePromotion}; reconcile at live-wiring.
 */
export function decideDeprecation(
  _junior: PersistedJuniorRecord,
  _stats: DeprecationStats,
  _thresholds?: LifecycleThresholds,
): DeprecationDecision {
  return { kind: 'keep', reason: 'port-shim: decider not yet wired' };
}
