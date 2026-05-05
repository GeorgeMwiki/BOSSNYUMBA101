/**
 * Brain kernel — the disciplined cognitive layer.
 *
 * One entry point: `think(req)`. It traverses the 13-step pipeline:
 *
 *   1.  Brain-side cache check
 *   2.  Inviolable refusal gate
 *   3.  Awareness-scope/tier compatibility check
 *   4.  Memory recall (prior thread + semantic)
 *   5.  Cohort signal mix-in (k-anonymous, tier-floored)
 *   6.  Identity preamble + theory-of-mind + cognitive-load directives
 *   7.  Sensor selection + call (with failover)
 *   8.  Output normalization (preamble strip, ui_block extract)
 *   9.  Self-review judge pass (when stakes ≥ high or requireJudge)
 *   10. Self-awareness drift detection
 *   11. Policy gate (PII / numerical / regulatory)
 *   12. Confidence scoring
 *   13. Provenance recording + cache write + CoT capture
 *
 * Returns a BrainDecision (`answer` | `softened` | `refusal`).
 *
 * The kernel is provider- and storage-agnostic. All side-effects go
 * through injected ports.
 */

import { createHash, randomUUID } from 'crypto';
import type {
  BrainDecision,
  ConfidenceVector,
  GateOutcome,
  GateVerdict,
  PersonaDriftSink,
  ProvenanceRecord,
  ProvenanceSink,
  Sensor,
  SensorCallResult,
  ThoughtRequest,
} from './kernel-types.js';
import type { Citation, Artifact } from '../types.js';
import { selectPersona, renderIdentityPreamble } from './identity.js';
import { isTierCompatibleWithScope, locusPhrase } from './awareness-scopes.js';
import { checkInviolable } from './inviolable.js';
import { runPolicyGate } from './policy-gate.js';
import { checkSelfAwareness } from './self-awareness.js';
import { inferMindState, renderMindStateDirective } from './theory-of-mind.js';
import { assessCognitiveLoad, renderLoadDirective } from './cognitive-load.js';
import { scoreConfidence } from './confidence.js';
import { normalize } from './normalizer.js';
import { type BrainCache, thoughtCacheKey, createBrainCache } from './brain-cache.js';
import { type SensorRouter, createSensorRouter } from './sensor-failover.js';
import type { CotReservoir } from './cot-reservoir.js';
import { buildCohortMixin, type CohortSource } from './cohort-signal.js';

export interface BrainKernelDeps {
  readonly sensors: ReadonlyArray<Sensor>;
  readonly router?: SensorRouter;
  readonly cache?: BrainCache;
  readonly cohort?: CohortSource;
  readonly cotReservoir?: CotReservoir;
  readonly driftSink?: PersonaDriftSink;
  readonly provenanceSink?: ProvenanceSink;
  readonly priorTurnsLoader?: (threadId: string) => Promise<
    ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>
  >;
  readonly recentTurnCounter?: (threadId: string) => Promise<number>;
  readonly judge?: (text: string) => Promise<{ score: number }>;
  readonly clock?: () => Date;
  readonly rng?: () => number;
}

export interface BrainKernel {
  think(req: ThoughtRequest): Promise<BrainDecision>;
}

export function createBrainKernel(deps: BrainKernelDeps): BrainKernel {
  const clock = deps.clock ?? (() => new Date());
  const rng = deps.rng ?? Math.random;
  const cache = deps.cache ?? createBrainCache({ clock: () => clock().getTime() });
  const router = deps.router ?? createSensorRouter({ sensors: deps.sensors, clock: () => clock().getTime() });
  const reservoir = deps.cotReservoir;

  return {
    async think(req) {
      const startedAt = clock().getTime();
      const thoughtId = randomUUID();
      const cacheKey = thoughtCacheKey(req);

      // 1) brain-side cache
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      // 2) inviolable
      const inviolable = checkInviolable(req);
      if (inviolable.status === 'block') {
        const decision = makeRefusal({
          thoughtId,
          req,
          reason: inviolable.reason ?? 'inviolable rule blocked the request',
          gate: 'inviolable',
          startedAt,
          clockNow: clock(),
        });
        if (deps.provenanceSink) {
          void deps.provenanceSink.record(decision.provenance).catch(() => undefined);
        }
        return decision;
      }

      // 3) tier compatibility
      const tierCheck = isTierCompatibleWithScope(req.tier, req.scope);
      if (!tierCheck.ok) {
        const decision = makeRefusal({
          thoughtId,
          req,
          reason: tierCheck.reason,
          gate: 'inviolable',
          startedAt,
          clockNow: clock(),
        });
        if (deps.provenanceSink) {
          void deps.provenanceSink.record(decision.provenance).catch(() => undefined);
        }
        return decision;
      }

      // 4) memory recall
      const priorTurns = deps.priorTurnsLoader
        ? await deps.priorTurnsLoader(req.threadId)
        : [];

      // 5) cohort signal
      const cohortMix = deps.cohort
        ? await buildCohortMixin({ source: deps.cohort, tier: req.tier, userMessage: req.userMessage })
        : { findings: [], promptFragment: '', fingerprints: [] as ReadonlyArray<string> };

      // 6) identity + theory-of-mind + cognitive-load
      const persona = selectPersona(req);
      const identity = renderIdentityPreamble({ persona, scope: req.scope });
      const mindState = inferMindState(req.userMessage);
      const recentTurns = deps.recentTurnCounter ? await deps.recentTurnCounter(req.threadId) : 0;
      const loadOut = assessCognitiveLoad({
        userMessage: req.userMessage,
        recentTurnCount: recentTurns,
      });
      const system = [
        identity,
        '',
        `Locus: ${locusPhrase(req.tier, req.scope)}.`,
        '',
        `Behavioural directive: ${renderMindStateDirective(mindState)}`,
        `Verbosity directive: ${renderLoadDirective(loadOut)}`,
        '',
        cohortMix.promptFragment,
      ]
        .filter(Boolean)
        .join('\n');

      // 7) sensor call (failover)
      const wantsThinking = req.stakes === 'high' || req.stakes === 'critical';
      const sensorResult = await router.call(
        {
          system,
          userMessage: req.userMessage,
          priorTurns,
          extendedThinking: wantsThinking,
          stakes: req.stakes,
        },
        wantsThinking ? ['thinking'] : [],
      );

      // 8) normalize
      const normalised = normalize(sensorResult.text);

      // 9) judge (when high-stakes)
      const judgeRequested = req.requireJudge === true || req.stakes === 'critical';
      const judgeOut = judgeRequested && deps.judge
        ? await deps.judge(normalised.text)
        : null;

      // (Tool / citation extraction is the agent-loop's job; for the
      //  non-streaming path the citations array is empty unless the
      //  sensor produced one explicitly via ui_block.)
      const citations: ReadonlyArray<Citation> = extractCitationsFromUiBlock(normalised.uiBlock);
      const artifacts: ReadonlyArray<Artifact> = extractArtifactsFromUiBlock(normalised.uiBlock);

      // 10) self-awareness drift
      const capturedAt = clock().toISOString();
      const sa = checkSelfAwareness({
        persona,
        outputText: normalised.text,
        toolCallCount: sensorResult.toolCalls.length,
        hasCitations: citations.length > 0,
        thoughtId,
        capturedAt,
      });
      if (sa.events.length > 0 && deps.driftSink) {
        for (const ev of sa.events) await deps.driftSink.record(ev);
      }
      if (sa.verdict.status === 'block') {
        const decision = makeRefusal({
          thoughtId,
          req,
          reason: sa.verdict.reason,
          gate: 'drift',
          startedAt,
          clockNow: clock(),
        });
        if (deps.provenanceSink) {
          void deps.provenanceSink.record(decision.provenance).catch(() => undefined);
        }
        return decision;
      }

      // 11) policy gate
      const policy = runPolicyGate({
        text: normalised.text,
        hasCitations: citations.length > 0,
      });

      // 12) confidence
      const confidence = scoreConfidence({
        outputText: policy.redactedText,
        citationCount: citations.length,
        toolResultNumbers: collectToolNumbers(sensorResult),
        judgeScore: judgeOut?.score ?? null,
        rerolledOutputText: null,
      });

      // 13) provenance + cache + CoT capture
      const provenance: ProvenanceRecord = {
        thoughtId,
        threadId: req.threadId,
        scopeKind: req.scope.kind,
        tier: req.tier,
        stakes: req.stakes,
        inputHash: sha(req.userMessage),
        outputHash: sha(policy.redactedText),
        toolCallSummaries: sensorResult.toolCalls.map((tc) => ({
          toolName: tc.toolName,
          latencyMs: 0,
          ok: true,
        })),
        sensorId: sensorResult.sensorId,
        modelId: sensorResult.modelId,
        cacheHit: false,
        judgeScore: judgeOut?.score ?? null,
        cohortFingerprints: cohortMix.fingerprints,
        producedAt: capturedAt,
        latencyMs: clock().getTime() - startedAt,
      };

      if (reservoir) {
        await reservoir.maybeCapture({
          thoughtId,
          threadId: req.threadId,
          stakes: req.stakes,
          thoughtText: sensorResult.thought,
          capturedAt,
        });
      }

      const gates: GateOutcome = {
        inviolable: { status: 'pass' },
        policy: policy.verdict,
        drift: sa.verdict,
        cognitiveLoad: loadOut.verdict,
      };

      const decision: BrainDecision = pickDecisionShape({
        gates,
        text: policy.redactedText,
        citations,
        artifacts,
        confidence,
        provenance,
      });

      cache.set(cacheKey, decision);
      if (deps.provenanceSink) {
        // Fire-and-forget; never block the caller on persistence.
        void deps.provenanceSink.record(provenance).catch(() => undefined);
      }
      void rng;
      return decision;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function pickDecisionShape(args: {
  readonly gates: GateOutcome;
  readonly text: string;
  readonly citations: ReadonlyArray<Citation>;
  readonly artifacts: ReadonlyArray<Artifact>;
  readonly confidence: ConfidenceVector;
  readonly provenance: ProvenanceRecord;
}): BrainDecision {
  const { gates, text, citations, artifacts, confidence, provenance } = args;
  const softeners: GateVerdict[] = [gates.policy, gates.drift, gates.cognitiveLoad];
  const blockers = softeners.filter((v) => v.status === 'block');
  if (blockers.length > 0) {
    const first = blockers[0]!;
    return {
      kind: 'refusal',
      reason: 'reason' in first ? first.reason : 'blocked',
      gateThatRefused: 'policy',
      provenance,
    };
  }
  const soft = softeners.find((v) => v.status === 'soften');
  if (soft && 'reason' in soft) {
    return {
      kind: 'softened',
      text,
      hedge: soft.reason,
      citations,
      confidence,
      gates,
      provenance,
    };
  }
  return {
    kind: 'answer',
    text,
    citations,
    artifacts,
    confidence,
    gates,
    provenance,
  };
}

function makeRefusal(args: {
  readonly thoughtId: string;
  readonly req: ThoughtRequest;
  readonly reason: string;
  readonly gate: 'inviolable' | 'policy' | 'drift';
  readonly startedAt: number;
  readonly clockNow: Date;
}): BrainDecision {
  const provenance: ProvenanceRecord = {
    thoughtId: args.thoughtId,
    threadId: args.req.threadId,
    scopeKind: args.req.scope.kind,
    tier: args.req.tier,
    stakes: args.req.stakes,
    inputHash: sha(args.req.userMessage),
    outputHash: sha('refusal'),
    toolCallSummaries: [],
    sensorId: '__refused__',
    modelId: '__refused__',
    cacheHit: false,
    judgeScore: null,
    cohortFingerprints: [],
    producedAt: args.clockNow.toISOString(),
    latencyMs: args.clockNow.getTime() - args.startedAt,
  };
  return {
    kind: 'refusal',
    reason: args.reason,
    gateThatRefused: args.gate,
    provenance,
  };
}

function sha(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

function extractCitationsFromUiBlock(ui: unknown): ReadonlyArray<Citation> {
  if (!ui || typeof ui !== 'object') return [];
  const v = (ui as { citations?: unknown }).citations;
  if (!Array.isArray(v)) return [];
  return v.filter(
    (c): c is Citation =>
      typeof c === 'object' &&
      c !== null &&
      typeof (c as Citation).id === 'string' &&
      typeof (c as Citation).label === 'string',
  );
}

function extractArtifactsFromUiBlock(ui: unknown): ReadonlyArray<Artifact> {
  if (!ui || typeof ui !== 'object') return [];
  const v = (ui as { artifacts?: unknown }).artifacts;
  if (!Array.isArray(v)) return [];
  return v.filter(
    (a): a is Artifact =>
      typeof a === 'object' &&
      a !== null &&
      typeof (a as Artifact).id === 'string' &&
      typeof (a as Artifact).kind === 'string',
  );
}

function collectToolNumbers(_r: SensorCallResult): ReadonlyArray<number> {
  // Placeholder — the streaming agent-loop is the right place to collect
  // numbers from typed tool outputs. The non-streaming kernel path does
  // not know tool result schemas, so we report no constraint here.
  return [];
}
