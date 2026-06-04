/**
 * `@bossnyumba/learning-signal-emitter` — shared types.
 *
 * A captured action + a measured outcome together yield a {@link LearningSignal}:
 * the unified plumbing the brain layer (Mr. Mwikila) uses to update every
 * downstream learning primitive in lock-step. Re-skinned to the BossNyumba
 * real-estate domain (org → tenant, actor = manager / owner / agent; NO
 * lending / PD / credit outcome dimensions).
 *
 * Per CLAUDE.md hard rules:
 *   - belief writes route through the belief sink (convince-loop) only;
 *     the emitter NEVER writes a belief directly.
 *   - tenant scope is enforced by the per-tier isolation gate before any
 *     persistence layer.
 *   - currency-agnostic: the cost dimension is a ratio over minor units;
 *     no jurisdiction currency (KES / TZS / UGX / NGN) is hard-coded.
 *
 * All domain types here are `readonly`. Zod schemas validate at boundaries:
 *   - {@link emitRequestSchema} guards the emit facade input shape.
 *   - {@link rewardWeightsSchema} guards a numeric weight override.
 */

import { z } from 'zod';

/**
 * The kind of action the brain layer took. Real-estate operating-system
 * verbs: a decision, an approval/rejection (e.g. a lease application), a
 * scheduled job, a dispatched maintenance task, a chat turn, a nudge, a
 * generated report, or a property valuation/appraisal.
 */
export type ActionKind =
  | 'decide'
  | 'approve'
  | 'reject'
  | 'schedule'
  | 'dispatch'
  | 'chat'
  | 'nudge'
  | 'report'
  | 'appraisal'
  | 'other';

/** The three power tiers a signal can be isolated to. */
export type TenantScope = 'user' | 'org' | 'platform';

/** An action captured by the action-data layer. Minimal surface. */
export interface ActionEvent {
  readonly id: string;
  readonly kind: ActionKind;
  readonly capturedAt: string;
  /** Tenant (org) id when the action is org-scoped. */
  readonly tenantOrgId?: string | null;
  /** End-user id when the action is user-scoped. */
  readonly tenantUserId?: string | null;
  readonly actorId: string;
  /** Power tier of the actor (manager / owner / agent / system / ...). */
  readonly actorTier: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly decisionTraceId?: string | null;
}

/**
 * An outcome observation — measured (SLA hit, complaint filed) or inferred
 * (override detected). Real-estate re-skin of the outcome dimensions:
 *   - managerOverride   — a portfolio manager flips the brain's decision.
 *   - ownerComplaint    — the property owner pushes back on the outcome.
 *   - complianceFinding — a housing/compliance authority (rent tribunal,
 *                         building-safety inspector) flags the outcome.
 *
 * Cost is expressed in currency MINOR units (cents) so the reward model
 * stays currency-agnostic — it only ever uses the cost/budget RATIO.
 */
export interface OutcomeEvent {
  readonly id: string;
  readonly actionRef: string;
  readonly observedAt: string;
  readonly slaHit?: boolean;
  readonly slaDelaySeconds?: number;
  readonly managerOverride?: boolean;
  readonly ownerComplaint?: boolean;
  readonly complianceFinding?: boolean;
  /** Actual cost in currency minor units (cents). Currency-agnostic. */
  readonly costMinor?: number;
  /** Budgeted cost in the same currency minor units (cents). */
  readonly budgetMinor?: number;
  /** [-1, 1] explicit satisfaction (thumbs / NPS). */
  readonly explicitSatisfaction?: number;
}

export interface RewardComponents {
  readonly sla: number;
  readonly override: number;
  readonly complaint: number;
  readonly compliance: number;
  readonly cost: number;
  readonly satisfaction: number;
}

export type RewardWeights = RewardComponents;

export interface ScoredAction {
  readonly reward: number;
  readonly components: RewardComponents;
  readonly weights: RewardWeights;
}

/**
 * The single unit the brain layer emits per (action, outcome) pair. The
 * emitter routes it to belief / reflexion / mastery / pattern / persona /
 * preference sinks.
 */
export interface LearningSignal {
  readonly signalHash: string;
  readonly actionRef: string;
  readonly actionKind: ActionKind;
  readonly outcomeRef?: string;
  readonly reward: number;
  readonly components: RewardComponents;
  readonly tenantScope: TenantScope;
  readonly subjectUserId?: string | null;
  readonly subjectOrgId?: string | null;
  readonly emittedBy: string;
  readonly decisionTraceId?: string | null;
  readonly capturedAt: string;
}

export type SignalRoute =
  | 'belief-store'
  | 'reflexion-lessons'
  | 'mastery-tracker'
  | 'pattern-store'
  | 'persona-prompt-bridge'
  | 'preference-learner'
  | 'isolation-blocked'
  | 'no-route';

export interface EmissionResult {
  readonly signal: LearningSignal;
  readonly routedTo: ReadonlyArray<SignalRoute>;
  readonly notes: ReadonlyArray<string>;
}

// ----------------------------------------------------------------------------
// Boundary schemas (zod). Validation happens at the wire facade, not in the
// pure core — the parse is the boundary guard.
// ----------------------------------------------------------------------------

const actionEventSchema = z.object({
  id: z.string().min(1),
  kind: z.enum([
    'decide',
    'approve',
    'reject',
    'schedule',
    'dispatch',
    'chat',
    'nudge',
    'report',
    'appraisal',
    'other',
  ]),
  capturedAt: z.string().min(1),
  tenantOrgId: z.string().nullable().optional(),
  tenantUserId: z.string().nullable().optional(),
  actorId: z.string().min(1),
  actorTier: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  decisionTraceId: z.string().nullable().optional(),
});

const outcomeEventSchema = z.object({
  id: z.string().min(1),
  actionRef: z.string().min(1),
  observedAt: z.string().min(1),
  slaHit: z.boolean().optional(),
  slaDelaySeconds: z.number().finite().optional(),
  managerOverride: z.boolean().optional(),
  ownerComplaint: z.boolean().optional(),
  complianceFinding: z.boolean().optional(),
  costMinor: z.number().finite().nonnegative().optional(),
  budgetMinor: z.number().finite().nonnegative().optional(),
  explicitSatisfaction: z.number().finite().min(-1).max(1).optional(),
});

/**
 * Numeric-input schema: each reward weight is a finite number in [0, 1].
 * Used to validate a caller-supplied weight override before it touches the
 * pure reward model.
 */
export const rewardWeightsSchema = z.object({
  sla: z.number().finite().min(0).max(1),
  override: z.number().finite().min(0).max(1),
  complaint: z.number().finite().min(0).max(1),
  compliance: z.number().finite().min(0).max(1),
  cost: z.number().finite().min(0).max(1),
  satisfaction: z.number().finite().min(0).max(1),
});

/**
 * Request schema for the emit facade. Validates the (action, outcome) pair
 * plus the optional weight override and isolation knobs at the boundary.
 */
export const emitRequestSchema = z.object({
  action: actionEventSchema,
  outcome: outcomeEventSchema,
  weights: rewardWeightsSchema.optional(),
  cohortSize: z.number().int().nonnegative().optional(),
  kAnonymity: z.number().int().positive().optional(),
});

export type EmitRequest = z.infer<typeof emitRequestSchema>;
