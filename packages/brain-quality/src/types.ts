/**
 * @bossnyumba/brain-quality — shared types.
 *
 * Phase K-D — Brain Quality Cluster. Closes four R3 frontier patterns:
 *   - R3 #2  Three-tier memory + reflection synthesis
 *   - R3 #3  Reflexion outer loop
 *   - R3 #5  tau-bench-style eval suite in Inspect (UK AISI) framework
 *   - R3 #10 Prefix-cached agent prompts
 *
 * Source of truth: .research/r3-brain-sota-architecture-audit.md
 *
 * Everything in this package is jurisdiction- and currency-neutral.
 * No KE / TZ / USD / KES literals in business logic.
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────
// Generic helpers
// ─────────────────────────────────────────────────────────────────────

/** ISO-8601 timestamp string (e.g. `2026-05-19T10:30:00Z`). */
export type IsoTimestamp = string;

/** Embedding vector — dense float array. Dimension is provider-dependent. */
export type Embedding = readonly number[];

/** A frozen record — by convention every domain object in this package is immutable. */
export type Immutable<T> = Readonly<T>;

/** Outcome bucket for any task run — used by Reflexion + eval harness. */
export type TaskOutcome = 'success' | 'partial' | 'failure';

export const TaskOutcomeSchema = z.enum(['success', 'partial', 'failure']);

// ─────────────────────────────────────────────────────────────────────
// Memory — turn-scoped Context tier
// ─────────────────────────────────────────────────────────────────────

export interface ContextMessage {
  readonly role: 'user' | 'assistant' | 'system' | 'tool';
  readonly content: string;
  /** Approximate token count, used for budgeting. */
  readonly tokens: number;
  readonly at: IsoTimestamp;
}

export const ContextMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string(),
  tokens: z.number().int().nonnegative(),
  at: z.string(),
});

// ─────────────────────────────────────────────────────────────────────
// Memory — session-scoped Core tier (MemGPT / Letta)
// ─────────────────────────────────────────────────────────────────────

/**
 * A single core-memory block. The MD reads/writes via tool calls
 * (appendCore / replaceCore / searchCore). Block kind matches the
 * existing 0151_core_memory_blocks.sql schema where applicable.
 */
export interface CoreBlock {
  readonly id: string;
  readonly kind: 'persona' | 'human' | 'preferences' | 'project' | 'scratchpad';
  readonly text: string;
  readonly tokens: number;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
  /** Optional structured side-channel (validated by callers). */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export const CoreBlockSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['persona', 'human', 'preferences', 'project', 'scratchpad']),
  text: z.string(),
  tokens: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

// ─────────────────────────────────────────────────────────────────────
// Memory — persistent Temporal Knowledge Graph (Zep / Cognee)
// ─────────────────────────────────────────────────────────────────────

export interface KGNode {
  readonly id: string;
  readonly entityType: string;
  readonly properties: Readonly<Record<string, unknown>>;
  readonly createdAt: IsoTimestamp;
}

/**
 * Temporal edge — time-validity columns are the heart of Zep-style
 * "as-of date X" queries. validTo === null means "currently true".
 */
export interface KGEdge {
  readonly id: string;
  readonly subjectId: string;
  readonly predicate: string;
  readonly objectId: string;
  readonly properties: Readonly<Record<string, unknown>>;
  readonly validFrom: IsoTimestamp;
  readonly validTo: IsoTimestamp | null;
  readonly invalidatedAt: IsoTimestamp | null;
  readonly invalidationReason: string | null;
  readonly createdAt: IsoTimestamp;
}

export const KGNodeSchema = z.object({
  id: z.string().min(1),
  entityType: z.string().min(1),
  properties: z.record(z.unknown()),
  createdAt: z.string(),
});

export const KGEdgeSchema = z.object({
  id: z.string().min(1),
  subjectId: z.string().min(1),
  predicate: z.string().min(1),
  objectId: z.string().min(1),
  properties: z.record(z.unknown()),
  validFrom: z.string(),
  validTo: z.string().nullable(),
  invalidatedAt: z.string().nullable(),
  invalidationReason: z.string().nullable(),
  createdAt: z.string(),
});

// ─────────────────────────────────────────────────────────────────────
// Memory — Reflection (Generative Agents) + Reflexion (Shinn et al.)
// ─────────────────────────────────────────────────────────────────────

/**
 * Periodic reflection synthesis — Generative-Agents style.
 * Condenses recent core-memory + KG nodes into a higher-order insight.
 */
export interface ReflectionSynthesis {
  readonly id: string;
  readonly subjectType: 'tenant' | 'building' | 'vendor' | 'portfolio' | 'platform';
  readonly subjectId: string;
  readonly summary: string;
  readonly evidenceIds: readonly string[];
  /** Importance score in [0,1] — used at retrieval time. */
  readonly importance: number;
  readonly createdAt: IsoTimestamp;
  readonly periodStart: IsoTimestamp;
  readonly periodEnd: IsoTimestamp;
}

export const ReflectionSynthesisSchema = z.object({
  id: z.string().min(1),
  subjectType: z.enum(['tenant', 'building', 'vendor', 'portfolio', 'platform']),
  subjectId: z.string().min(1),
  summary: z.string().min(1),
  evidenceIds: z.array(z.string()),
  importance: z.number().min(0).max(1),
  createdAt: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
});

/**
 * Reflexion note — verbal self-reinforcement per Shinn et al., 2023.
 * Stored against task_type; retrieved by embedding similarity next time
 * the MD encounters a similar task.
 */
export interface ReflectionNote {
  readonly id: string;
  readonly taskType: string;
  readonly taskInput: string;
  readonly outcome: TaskOutcome;
  readonly critique: string;
  readonly lesson: string;
  readonly embedding: Embedding;
  readonly createdAt: IsoTimestamp;
}

export const ReflectionNoteSchema = z.object({
  id: z.string().min(1),
  taskType: z.string().min(1),
  taskInput: z.string(),
  outcome: TaskOutcomeSchema,
  critique: z.string(),
  lesson: z.string(),
  embedding: z.array(z.number()),
  createdAt: z.string(),
});

// ─────────────────────────────────────────────────────────────────────
// Inspect-harness types (tau-bench triangle: policy + tool + dialog)
// ─────────────────────────────────────────────────────────────────────

export type InspectScenarioFamily = 'policy_compliance' | 'tool_use' | 'dialog';

export const InspectScenarioFamilySchema = z.enum(['policy_compliance', 'tool_use', 'dialog']);

/**
 * Single Inspect scenario file shape. Mirrors UK AISI conventions.
 * Each scenario is execution-graded: a `grade()` runs against an
 * environment state, not a text-match against the model output.
 */
export interface InspectScenario {
  readonly id: string;
  readonly family: InspectScenarioFamily;
  readonly title: string;
  readonly description: string;
  readonly input: {
    readonly userMessages: readonly string[];
    readonly toolManifest: readonly string[];
    readonly initialState: Readonly<Record<string, unknown>>;
  };
  readonly target: {
    readonly forbiddenActions: readonly string[];
    readonly requiredActions: readonly string[];
    readonly expectedFinalState?: Readonly<Record<string, unknown>>;
  };
  readonly metadata: {
    readonly severity: 'low' | 'medium' | 'high' | 'critical';
    readonly tags: readonly string[];
  };
}

export const InspectScenarioSchema = z.object({
  id: z.string().min(1),
  family: InspectScenarioFamilySchema,
  title: z.string().min(1),
  description: z.string(),
  input: z.object({
    userMessages: z.array(z.string()),
    toolManifest: z.array(z.string()),
    initialState: z.record(z.unknown()),
  }),
  target: z.object({
    forbiddenActions: z.array(z.string()),
    requiredActions: z.array(z.string()),
    expectedFinalState: z.record(z.unknown()).optional(),
  }),
  metadata: z.object({
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    tags: z.array(z.string()),
  }),
});

export interface InspectScenarioResult {
  readonly scenarioId: string;
  readonly family: InspectScenarioFamily;
  readonly passed: boolean;
  readonly outcome: TaskOutcome;
  readonly forbiddenActionsTaken: readonly string[];
  readonly requiredActionsMissed: readonly string[];
  readonly score: number;
  readonly reason: string;
  readonly durationMs: number;
}

export interface InspectRunReport {
  readonly runId: string;
  readonly startedAt: IsoTimestamp;
  readonly finishedAt: IsoTimestamp;
  readonly results: readonly InspectScenarioResult[];
  readonly summary: {
    readonly total: number;
    readonly passed: number;
    readonly failed: number;
    readonly passRate: number;
    readonly perFamily: Readonly<
      Record<InspectScenarioFamily, { passed: number; total: number }>
    >;
  };
}

// ─────────────────────────────────────────────────────────────────────
// Prefix-cache types (Anthropic ephemeral cache_control)
// ─────────────────────────────────────────────────────────────────────

export interface PrefixSegment {
  readonly id: string;
  /** Marker so the SDK can attach cache_control to the right segment. */
  readonly cacheable: boolean;
  readonly text: string;
}

export interface PromptShape {
  /** Stable segments — system prompt, constitution, tool manifest, top reflections. */
  readonly prefix: readonly PrefixSegment[];
  /** Dynamic segments — current turn + working memory. */
  readonly suffix: readonly PrefixSegment[];
}

export interface PrefixCacheTelemetry {
  readonly turnId: string;
  readonly prefixHash: string;
  readonly cacheHit: boolean;
  readonly inputTokens: number;
  readonly cachedTokens: number;
  /** Ratio in [0,1] — cached / input. */
  readonly cacheHitRatio: number;
  readonly at: IsoTimestamp;
}
