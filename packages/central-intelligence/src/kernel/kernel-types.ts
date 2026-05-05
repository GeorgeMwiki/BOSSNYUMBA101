/**
 * Kernel types — the disciplined cognitive layer above the streaming
 * agent loop. A single `think(request)` call traverses a 13-step
 * pipeline and returns a BrainDecision with provenance, confidence,
 * and gating verdicts attached.
 *
 * The kernel is provider-agnostic and storage-agnostic. Every side-
 * effect (LLM calls, audit writes, CoT sampling, drift recording) is
 * routed through an injected port so unit tests run pure.
 */

import type { ScopeContext, Citation, Artifact } from '../types.js';

// ─────────────────────────────────────────────────────────────────────
// Awareness scopes — tier-scoped visibility bubbles richer than the
// binary tenant/platform split. A request lives at exactly one tier;
// the kernel uses the tier to gate which tools, memory indexes, and
// cohort signals are reachable.
// ─────────────────────────────────────────────────────────────────────

export type AwarenessTier =
  | 'tenant'           // single tenant inside one lease
  | 'lease'            // one lease (one or more tenants)
  | 'unit'             // one unit (multiple leases over time)
  | 'block'            // one block (multiple units)
  | 'property'         // one property (one or more blocks)
  | 'portfolio'        // one owner's properties
  | 'org'              // one estate-management org
  | 'industry';        // platform-wide DP-aggregate scope

// ─────────────────────────────────────────────────────────────────────
// ThoughtRequest — the single input to think().
// ─────────────────────────────────────────────────────────────────────

export interface ThoughtRequest {
  readonly threadId: string;
  readonly userMessage: string;
  readonly scope: ScopeContext;
  readonly tier: AwarenessTier;
  /** Stakes drives extended-thinking, judge pass, full CoT capture. */
  readonly stakes: 'low' | 'medium' | 'high' | 'critical';
  /** Surface where the reply will render — affects voice + verbosity. */
  readonly surface:
    | 'marketing'
    | 'tenant-app'
    | 'owner-portal'
    | 'estate-manager-app'
    | 'admin-portal'
    | 'platform-hq'
    | 'classroom';
  /** When true, request a self-review judge pass before returning. */
  readonly requireJudge?: boolean;
}

// ─────────────────────────────────────────────────────────────────────
// Confidence vector — composite scoring attached to every decision.
// All components ∈ [0,1]; overall = min(components) by default.
// ─────────────────────────────────────────────────────────────────────

export interface ConfidenceVector {
  readonly groundedness: number;       // fraction of claims with citations
  readonly stability: number;          // similarity to a re-roll of the same prompt
  readonly review: number;             // judge pass score, 1 if no judge ran
  readonly numericalConsistency: number; // numbers match tool outputs
  readonly overall: number;            // min(...components)
}

// ─────────────────────────────────────────────────────────────────────
// Gating verdicts — each layer that may block / soften / pass an output.
// ─────────────────────────────────────────────────────────────────────

export type GateVerdict =
  | { readonly status: 'pass' }
  | { readonly status: 'soften'; readonly reason: string }
  | { readonly status: 'block';  readonly reason: string };

export interface GateOutcome {
  readonly inviolable: GateVerdict;
  readonly policy: GateVerdict;
  readonly drift: GateVerdict;
  readonly cognitiveLoad: GateVerdict;
}

// ─────────────────────────────────────────────────────────────────────
// Provenance — what went into the decision. Hashed + redacted before
// storage by the audit recorder.
// ─────────────────────────────────────────────────────────────────────

export interface ProvenanceRecord {
  readonly thoughtId: string;
  readonly threadId: string;
  readonly scopeKind: ScopeContext['kind'];
  readonly tier: AwarenessTier;
  readonly stakes: ThoughtRequest['stakes'];
  readonly inputHash: string;
  readonly outputHash: string;
  readonly toolCallSummaries: ReadonlyArray<{
    readonly toolName: string;
    readonly latencyMs: number;
    readonly ok: boolean;
  }>;
  readonly sensorId: string;
  readonly modelId: string;
  readonly cacheHit: boolean;
  readonly judgeScore: number | null;
  readonly cohortFingerprints: ReadonlyArray<string>;
  readonly producedAt: string;
  readonly latencyMs: number;
}

// ─────────────────────────────────────────────────────────────────────
// BrainDecision — the single output of think(). Closed shape so
// callers can pattern-match without ambiguity.
// ─────────────────────────────────────────────────────────────────────

export type BrainDecision =
  | {
      readonly kind: 'answer';
      readonly text: string;
      readonly citations: ReadonlyArray<Citation>;
      readonly artifacts: ReadonlyArray<Artifact>;
      readonly confidence: ConfidenceVector;
      readonly gates: GateOutcome;
      readonly provenance: ProvenanceRecord;
    }
  | {
      readonly kind: 'refusal';
      readonly reason: string;
      readonly gateThatRefused: 'inviolable' | 'policy' | 'drift';
      readonly provenance: ProvenanceRecord;
    }
  | {
      readonly kind: 'softened';
      readonly text: string;
      readonly hedge: string;
      readonly citations: ReadonlyArray<Citation>;
      readonly confidence: ConfidenceVector;
      readonly gates: GateOutcome;
      readonly provenance: ProvenanceRecord;
    };

// ─────────────────────────────────────────────────────────────────────
// Sensor — a multi-provider abstraction over LlmAdapter. Health is
// tracked externally by sensor-failover.
// ─────────────────────────────────────────────────────────────────────

export interface SensorCallArgs {
  readonly system: string;
  readonly userMessage: string;
  readonly priorTurns: ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>;
  readonly extendedThinking: boolean;
  readonly stakes: ThoughtRequest['stakes'];
}

export interface SensorCallResult {
  readonly text: string;
  readonly thought: string | null;
  readonly toolCalls: ReadonlyArray<{ toolName: string; input: unknown; callId: string }>;
  readonly latencyMs: number;
  readonly modelId: string;
  readonly sensorId: string;
}

export interface Sensor {
  readonly id: string;
  readonly modelId: string;
  readonly priority: number;          // lower wins
  readonly capabilities: ReadonlyArray<'vision' | 'thinking' | 'fast' | 'batch'>;
  call(args: SensorCallArgs): Promise<SensorCallResult>;
}

// ─────────────────────────────────────────────────────────────────────
// CoT reservoir — sampled chain-of-thought for audit replay.
// ─────────────────────────────────────────────────────────────────────

export interface CotSample {
  readonly thoughtId: string;
  readonly threadId: string;
  readonly stakes: ThoughtRequest['stakes'];
  readonly thoughtText: string;
  readonly capturedAt: string;
}

export interface CotReservoirSink {
  capture(sample: CotSample): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────
// Persona drift — recorded when self-awareness flags voice violations.
// ─────────────────────────────────────────────────────────────────────

export interface PersonaDriftEvent {
  readonly thoughtId: string;
  readonly personaId: string;
  readonly violationType: 'taboo' | 'first-person-loss' | 'tone' | 'fabrication';
  readonly excerpt: string;
  readonly severity: 'low' | 'medium' | 'high';
  readonly detectedAt: string;
}

export interface PersonaDriftSink {
  record(event: PersonaDriftEvent): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────
// Provenance sink — persists ProvenanceRecord. Production binds the
// `kernel_provenance` Postgres table; tests use an in-memory recorder.
// ─────────────────────────────────────────────────────────────────────

export interface ProvenanceSink {
  record(record: ProvenanceRecord): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────
// Grounding facts — domain-specific data points the kernel pre-fetches
// and mixes into the system prompt so the sensor answers from real
// state, not from training memory. Distinct from cohort signals: these
// are tenant-internal (occupancy, arrears, work-orders), not DP-
// aggregate cross-tenant statistics.
// ─────────────────────────────────────────────────────────────────────

export interface GroundingFact {
  /** Stable id; used as a citation token in the rendered prompt. */
  readonly id: string;
  readonly label: string;
  readonly value: string | number;
  /** Optional unit for numeric values. */
  readonly unit?: 'pct' | 'count' | 'currency-tzs' | 'currency-kes' | 'days';
  /** Source identifier — table name, service name, etc. */
  readonly source: string;
  readonly asOf: string;
}

export interface GroundingFactsProvider {
  fetch(args: {
    readonly userMessage: string;
    readonly tier: AwarenessTier;
    readonly limit: number;
  }): Promise<ReadonlyArray<GroundingFact>>;
}
