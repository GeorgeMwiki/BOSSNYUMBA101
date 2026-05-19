/**
 * @bossnyumba/brain-learning — public types.
 *
 * Phase N-E shared types for the runtime learning + self-improvement
 * substrate. These types are the public contracts between the 9 modules
 * (trace-logger, owner-reaction-capture, preference-pair-builder,
 * active-learning-queue, eval-driven-iteration, skill-curation,
 * knowledge-graph-growth, distilled-student-infra, 90-day-cycle-tracker).
 *
 * Wire-side persistence (J1 entities `trace_event`, `feedback_event`,
 * `active_learning_item`) is delegated to ports in each module — this
 * package has no direct dependency on the database substrate.
 */

/**
 * A unique identifier for a single conversation turn. Stable across
 * re-logs (so `logTrace` is idempotent per turn).
 */
export type TurnId = string;

/**
 * Storage tier for a trace event. Drives lifecycle policy:
 *   - `hot`  → last 7 days, Postgres + Redis index (sub-ms read)
 *   - `warm` → 8–90 days, Postgres compressed (~10ms read)
 *   - `cold` → 91+ days, S3 Parquet (~1s read), partitioned by tenant/date
 */
export type StorageTier = 'hot' | 'warm' | 'cold';

/**
 * Role of the actor producing a turn. Mirrors the kernel's tool-spec
 * RoleKind but is repeated here as a string-literal union — substrate
 * has no dependency on `@bossnyumba/central-intelligence`.
 */
export type TurnRole =
  | 'owner'
  | 'agent'
  | 'system'
  | 'tool'
  | 'admin';

/**
 * Outcome of a turn, as observed by the kernel or human reviewer.
 */
export type TurnOutcome =
  | 'closed-success'
  | 'closed-rolled-back'
  | 'closed-with-handoff'
  | 'in-progress'
  | 'errored';

/**
 * Raw trace event written by `logTrace`. Persisted to the J1
 * `trace_event` entity. Idempotent per (tenantId, turnId).
 */
export interface TraceEvent {
  readonly tenantId: string;
  readonly conversationId: string;
  readonly turnId: TurnId;
  /** Position of this turn within the conversation. */
  readonly turn: number;
  readonly role: TurnRole;
  /** Already-redacted content. Raw content is never persisted. */
  readonly content: string;
  /** Optional tool calls made by this turn. */
  readonly toolCalls?: ReadonlyArray<TraceToolCall>;
  readonly outcome?: TurnOutcome;
  readonly storageTier: StorageTier;
  /** Per-tenant opt-in: may this turn be used as training data? */
  readonly consentForTraining: boolean;
  /** ISO-8601 timestamp the trace was written. */
  readonly loggedAt: string;
  /** Audit fields stamped by the redaction pipeline at the boundary. */
  readonly redaction: RedactionAudit;
}

export interface TraceToolCall {
  readonly toolName: string;
  /** Redacted argument JSON. */
  readonly argsRedacted: string;
  readonly success: boolean;
}

/**
 * Audit fields stamped by the 4-layer PII redaction pipeline. NIST AI
 * RMF compliance: model_version, policy_version, redaction_action,
 * timestamp, actor_id, layer.
 */
export interface RedactionAudit {
  readonly modelVersion: string;
  readonly policyVersion: string;
  /** Which redaction layers fired, in order: regex, ml, canary, consent. */
  readonly layersFired: ReadonlyArray<RedactionLayer>;
  readonly action: 'redacted' | 'pass-through' | 'quarantined';
  readonly redactedAt: string;
  /** Actor whose write triggered the boundary; usually the kernel adapter. */
  readonly actorId: string;
}

export type RedactionLayer = 'regex' | 'ml' | 'canary' | 'consent';

/**
 * Reaction kinds drive preference-pair generation. The 9 kinds mirror
 * the §2 R-LEARNING playbook rows.
 */
export type ReactionKind =
  | 'thumbs_up'
  | 'thumbs_down'
  | 'star_rating'
  | 'regenerated'
  | 'accepted_as_is'
  | 'edited_by_owner'
  | 'paused_skill'
  | 'resumed_skill'
  | 'manual_override';

/**
 * Owner feedback event. Persisted to the J1 `feedback_event` entity.
 * One row per owner reaction. Drives preference-pair generation.
 */
export interface FeedbackEvent {
  readonly tenantId: string;
  readonly turnId: TurnId;
  readonly kind: ReactionKind;
  readonly payload: FeedbackPayload;
  readonly capturedAt: string;
}

/**
 * Discriminated by ReactionKind. Star rating carries 1-5, edits carry
 * the diff text, regenerated carries the regenerated content.
 */
export type FeedbackPayload =
  | { readonly kind: 'thumbs_up' | 'thumbs_down' | 'accepted_as_is' }
  | { readonly kind: 'star_rating'; readonly stars: 1 | 2 | 3 | 4 | 5 }
  | { readonly kind: 'regenerated'; readonly newContent: string }
  | { readonly kind: 'edited_by_owner'; readonly editedContent: string }
  | { readonly kind: 'paused_skill' | 'resumed_skill'; readonly skillId: string }
  | { readonly kind: 'manual_override'; readonly overrideReason: string };

/**
 * Algorithm a preference pair targets. Drives JSONL serialisation
 * shape.
 *   - `dpo`   chosen/rejected paired data — Rafailov 2023
 *   - `kto`   binary/scalar single-response — Ethayarajh 2024
 *   - `simpo` chosen/rejected, reference-free — Meng 2024
 *   - `prm-step-dpo` step-level chosen/rejected — V-STaR pattern
 */
export type PreferenceAlgo = 'dpo' | 'kto' | 'simpo' | 'prm-step-dpo';

/**
 * One row of preference-tuning data. Output of preference-pair-builder.
 */
export interface PreferencePair {
  readonly tenantId: string;
  readonly sourceTurnId: TurnId;
  readonly algo: PreferenceAlgo;
  readonly prompt: string;
  /** Chosen response (or scalar=good signal for KTO). */
  readonly chosen: string;
  /** Rejected response (or scalar=bad signal for KTO). */
  readonly rejected: string;
  /** KTO scalar label if applicable. */
  readonly ktoLabel?: 'good' | 'bad';
  /** Quality score from M-G PRM substrate, 0-1. */
  readonly chosenQuality: number;
  /** Rejected quality percentile across corpus, 0-1. */
  readonly rejectedPercentile: number;
  readonly generatedAt: string;
}

/**
 * Lifecycle stages for the active-learning queue. Mirrors §6 R-LEARNING.
 */
export type ActiveLearningStatus =
  | 'pending'
  | 'in-review'
  | 'labelled'
  | 'declined'
  | 'expired';

/**
 * Item awaiting human labelling. Persisted to J1
 * `active_learning_item` entity.
 */
export interface ActiveLearningItem {
  readonly tenantId: string;
  readonly turnId: TurnId;
  readonly status: ActiveLearningStatus;
  readonly verbalisedConfidence: number;
  readonly prmStepScore: number | null;
  /** Why this item was queued (which trigger fired). */
  readonly reason: ActiveLearningTrigger;
  readonly queuedAt: string;
  readonly assignedLabeller?: string;
  /** Decline count — used by anti-fatigue logic. */
  readonly declineCount: number;
}

export type ActiveLearningTrigger =
  | 'confidence-low'
  | 'prm-step-low'
  | 'consistency-disagreement'
  | 'debate-split';

/** Skill lifecycle stage (§5 R-LEARNING). */
export type SkillLifecycle =
  | 'draft'
  | 'promoted'
  | 'quarantined'
  | 'deprecated'
  | 'banned';

export interface SkillCurationVerdict {
  readonly skillId: string;
  readonly tenantId: string;
  readonly currentLifecycle: SkillLifecycle;
  readonly proposedLifecycle: SkillLifecycle;
  readonly reason: string;
  readonly gatedByHitl: boolean;
  readonly stats: SkillCurationStats;
}

export interface SkillCurationStats {
  readonly successfulRuns: number;
  readonly catastrophicFailures: number;
  readonly positiveFeedbackRatio: number;
  readonly confidenceTrend: number;
}

/** Knowledge-graph growth pass outcome (§4 R-LEARNING). */
export interface KGGrowthResult {
  readonly tenantId: string;
  readonly nodesAdded: number;
  readonly edgesAdded: number;
  readonly edgesDecayed: number;
  readonly nodesArchived: number;
  readonly evictedDueToCeiling: number;
  readonly ceilingHit: boolean;
}

/** Eval cycle result (§7 R-LEARNING). */
export interface EvalCycleResult {
  readonly cycleId: string;
  readonly scenariosRun: number;
  readonly currentPassRate: number;
  readonly rollingPassRate: number;
  /** True when current passRate drops more than 5pp vs 4-week rolling. */
  readonly regressionAlert: boolean;
  readonly failedScenarios: ReadonlyArray<EvalFailedScenario>;
  readonly evaluatedAt: string;
}

export interface EvalFailedScenario {
  readonly scenarioId: string;
  readonly expectedAction: string;
  readonly actualAction: string;
  readonly traceId: TurnId;
}

/** 90-day-cycle weekly digest line item (§10 R-LEARNING). */
export interface WeeklyDigest {
  readonly weekIso: string;
  readonly pairsCollected: { dpo: number; kto: number; simpo: number; prmStepDpo: number };
  readonly activeLearningQueueDepth: number;
  readonly activeLearningLabelRate: number;
  readonly inspectPassRateTrend: ReadonlyArray<number>;
  readonly skillPromotions: number;
  readonly skillQuarantines: number;
  readonly kgGrowth: { added: number; pruned: number };
  readonly npsDelta: number;
  readonly costPerConversationDelta: number;
}
