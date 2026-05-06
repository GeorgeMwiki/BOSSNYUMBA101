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
  GroundingFact,
  GroundingFactsProvider,
  KernelStreamEvent,
  PersonaDriftSink,
  ProvenanceRecord,
  ProvenanceSink,
  Sensor,
  SensorCallArgs,
  SensorCallResult,
  ThoughtRequest,
} from './kernel-types.js';
import type { PersonaIdentity } from './identity.js';
import type { Citation, Artifact } from '../types.js';
import { selectPersona, renderIdentityPreamble } from './identity.js';
import { applyBrandingOverride, type PersonaBrandingResolver } from './branding.js';
import { isTierCompatibleWithScope, locusPhrase } from './awareness-scopes.js';
import { checkInviolable } from './inviolable.js';
import { checkPublicInviolable } from './public-inviolable.js';
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
  readonly groundingFacts?: GroundingFactsProvider;
  readonly priorTurnsLoader?: (threadId: string) => Promise<
    ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>
  >;
  readonly recentTurnCounter?: (threadId: string) => Promise<number>;
  readonly judge?: (text: string) => Promise<{ score: number }>;
  readonly clock?: () => Date;
  readonly rng?: () => number;
  /**
   * Optional per-tenant persona-branding resolver. When supplied, the
   * kernel looks up a {@link PersonaBrandingOverride} keyed by tenantId
   * + surface BEFORE rendering the identity preamble, so an agency can
   * re-skin the AI's displayName / openingPreamble without touching
   * the surface-default personas.
   */
  readonly brandingResolver?: PersonaBrandingResolver;
}

export interface BrainKernel {
  think(req: ThoughtRequest): Promise<BrainDecision>;
  /**
   * Token-level streaming counterpart to `think()`. Runs the full
   * disciplined pipeline:
   *   - pre-sensor steps run synchronously before any token is yielded
   *   - sensor token deltas are forwarded to the consumer in real time
   *   - post-sensor steps (normalize, judge, drift, policy, confidence,
   *     provenance, cache.set, CoT capture) run after the sensor stops
   *   - the consumer always sees a final `done` event with a fully-
   *     formed `BrainDecision`
   *
   * Pre-sensor refusals (inviolable / tier) collapse to `turn_start +
   * done(refusal)` with no deltas. Post-sensor refusals (drift / policy
   * block) emit deltas, then a `gate_verdict` event, then `done(refusal)`.
   */
  thinkStream(req: ThoughtRequest): AsyncIterable<KernelStreamEvent>;
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

      // 2b) public-tier inviolable (marketing surface only).
      // The unauthenticated marketing surface gets a stricter input
      // filter: prompt-injection markers, oversized messages, cross-
      // tenant probes, phishing-content asks, authority impersonation,
      // and system-prompt extraction attempts all hard-refuse here
      // BEFORE any sensor budget is spent.
      if (req.surface === 'marketing') {
        const publicVerdict = checkPublicInviolable({
          userMessage: req.userMessage,
          ipHash: req.ipHash ?? '',
        });
        if (publicVerdict.status === 'block') {
          const decision = makeRefusal({
            thoughtId,
            req,
            reason:
              publicVerdict.reason ??
              `public marketing inviolable category: ${publicVerdict.category ?? 'unknown'}`,
            gate: 'inviolable',
            startedAt,
            clockNow: clock(),
          });
          if (deps.provenanceSink) {
            void deps.provenanceSink.record(decision.provenance).catch(() => undefined);
          }
          return decision;
        }
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

      // 5b) grounding facts (tenant-internal data points)
      const groundingFacts: ReadonlyArray<GroundingFact> = deps.groundingFacts
        ? await deps.groundingFacts
            .fetch({ userMessage: req.userMessage, tier: req.tier, limit: 6 })
            .catch(() => [])
        : [];

      // 6) identity + theory-of-mind + cognitive-load.
      // Branding override (if any) is applied BEFORE personalisation /
      // preamble rendering so an agency-level rename or preamble flows
      // through the rest of the pipeline (drift detection, audit) under
      // the rebranded id.
      const baseSurfacePersona = selectPersona(req);
      const branding = deps.brandingResolver
        ? await deps.brandingResolver
            .resolve({
              tenantId: req.scope.kind === 'tenant' ? req.scope.tenantId : null,
              surface: req.surface,
            })
            .catch(() => null)
        : null;
      const persona = applyBrandingOverride(baseSurfacePersona, branding);
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
        renderGroundingFragment(groundingFacts),
        '',
        cohortMix.promptFragment,
      ]
        .filter(Boolean)
        .join('\n');

      // 7) sensor call (failover). When attachments are present we add
      // 'vision' to the required-capabilities array so only vision-capable
      // sensors are eligible. The attachments themselves are forwarded
      // verbatim and the adapter rebuilds the user message into a
      // multipart content array.
      const wantsThinking = req.stakes === 'high' || req.stakes === 'critical';
      const hasAttachments = (req.attachments?.length ?? 0) > 0;
      const required: Array<'vision' | 'thinking' | 'fast' | 'batch'> = [];
      if (wantsThinking) required.push('thinking');
      if (hasAttachments) required.push('vision');
      const sensorResult = await router.call(
        {
          system,
          userMessage: req.userMessage,
          priorTurns,
          extendedThinking: wantsThinking,
          stakes: req.stakes,
          ...(req.attachments ? { attachments: req.attachments } : {}),
        },
        required,
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

    /**
     * Token-level streaming counterpart to `think`. Mirrors the same
     * 13-step pipeline:
     *   - pre-sensor steps run synchronously (no deltas yet)
     *   - on pre-sensor refusal, yields turn_start + done(refusal)
     *   - on cache hit, yields turn_start, the cached text in one
     *     text_delta, confidence (when present), then done
     *   - on a stream-capable sensor, forwards text_delta /
     *     thought_delta events live; accumulates internally for the
     *     post-sensor pipeline
     *   - on a non-stream-capable sensor, calls `router.call(...)` and
     *     emits the final text as one text_delta (legacy fallback)
     *   - on stop, runs normalize → judge → drift → policy → confidence
     *     → provenance → cache.set, emitting gate_verdict events for
     *     drift/policy soften+block and a confidence event before done
     */
    async *thinkStream(req: ThoughtRequest): AsyncIterable<KernelStreamEvent> {
      const startedAt = clock().getTime();
      const thoughtId = randomUUID();
      const cacheKey = thoughtCacheKey(req);

      // Pre-sensor persona — needed for the turn_start event below.
      const baseSurfacePersona = selectPersona(req);
      const branding = deps.brandingResolver
        ? await deps.brandingResolver
            .resolve({
              tenantId: req.scope.kind === 'tenant' ? req.scope.tenantId : null,
              surface: req.surface,
            })
            .catch(() => null)
        : null;
      const persona = applyBrandingOverride(baseSurfacePersona, branding);

      yield personaStartEvent(persona);

      // 1) brain-side cache. On hit, replay as a single delta + done.
      const cached = cache.get(cacheKey);
      if (cached) {
        if (cached.kind !== 'refusal') {
          if (cached.text) {
            yield { kind: 'text_delta', text: cached.text };
          }
          yield { kind: 'confidence', vector: cached.confidence };
        }
        yield { kind: 'done', decision: cached };
        return;
      }

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
        yield {
          kind: 'gate_verdict',
          gate: 'inviolable',
          verdict: { status: 'block', reason: inviolable.reason ?? 'blocked' },
        };
        yield { kind: 'done', decision };
        return;
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
        yield {
          kind: 'gate_verdict',
          gate: 'inviolable',
          verdict: { status: 'block', reason: tierCheck.reason },
        };
        yield { kind: 'done', decision };
        return;
      }

      // 4) memory recall
      const priorTurns = deps.priorTurnsLoader
        ? await deps.priorTurnsLoader(req.threadId)
        : [];

      // 5) cohort signal
      const cohortMix = deps.cohort
        ? await buildCohortMixin({ source: deps.cohort, tier: req.tier, userMessage: req.userMessage })
        : { findings: [], promptFragment: '', fingerprints: [] as ReadonlyArray<string> };

      // 5b) grounding facts
      const groundingFacts: ReadonlyArray<GroundingFact> = deps.groundingFacts
        ? await deps.groundingFacts
            .fetch({ userMessage: req.userMessage, tier: req.tier, limit: 6 })
            .catch(() => [])
        : [];

      // 6) identity + ToM + cognitive-load
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
        renderGroundingFragment(groundingFacts),
        '',
        cohortMix.promptFragment,
      ]
        .filter(Boolean)
        .join('\n');

      // 7) sensor selection. Prefer `callStream` when an eligible sensor
      // exposes it; otherwise fall back to `router.call(...)` and emit
      // the result as a single delta (legacy fallback for sensors that
      // pre-date the streaming protocol).
      const wantsThinking = req.stakes === 'high' || req.stakes === 'critical';
      const hasAttachments = (req.attachments?.length ?? 0) > 0;
      const required: Array<'vision' | 'thinking' | 'fast' | 'batch'> = [];
      if (wantsThinking) required.push('thinking');
      if (hasAttachments) required.push('vision');

      const sensorArgs: SensorCallArgs = {
        system,
        userMessage: req.userMessage,
        priorTurns,
        extendedThinking: wantsThinking,
        stakes: req.stakes,
        ...(req.attachments ? { attachments: req.attachments } : {}),
      };

      const streamingSensor = pickStreamingSensor(deps.sensors, required);

      let accumulatedText = '';
      let accumulatedThought: string | null = null;
      let toolCalls: Array<{ toolName: string; input: unknown; callId: string }> = [];
      let sensorId = '__unknown__';
      let modelId = '__unknown__';
      let sensorLatencyMs = 0;

      if (streamingSensor && streamingSensor.callStream) {
        sensorId = streamingSensor.id;
        modelId = streamingSensor.modelId;
        const sensorStart = clock().getTime();
        try {
          for await (const ev of streamingSensor.callStream(sensorArgs)) {
            if (ev.kind === 'turn_start') {
              modelId = ev.modelId;
              sensorId = ev.sensorId;
              continue;
            }
            if (ev.kind === 'text_delta') {
              accumulatedText += ev.text;
              yield { kind: 'text_delta', text: ev.text };
              continue;
            }
            if (ev.kind === 'thought_delta') {
              accumulatedThought = (accumulatedThought ?? '') + ev.text;
              yield { kind: 'thought_delta', text: ev.text };
              continue;
            }
            if (ev.kind === 'tool_call') {
              toolCalls.push({
                toolName: ev.toolName,
                input: ev.input,
                callId: ev.callId,
              });
              continue;
            }
            if (ev.kind === 'stop') {
              sensorLatencyMs = ev.latencyMs;
              break;
            }
          }
        } catch {
          sensorLatencyMs = clock().getTime() - sensorStart;
        }
      } else {
        const single = await router.call(sensorArgs, required);
        sensorId = single.sensorId;
        modelId = single.modelId;
        accumulatedText = single.text;
        accumulatedThought = single.thought;
        toolCalls = [...single.toolCalls];
        sensorLatencyMs = single.latencyMs;
        if (accumulatedText) {
          yield { kind: 'text_delta', text: accumulatedText };
        }
      }

      // 8) normalize
      const normalised = normalize(accumulatedText);

      // 9) judge
      const judgeRequested = req.requireJudge === true || req.stakes === 'critical';
      const judgeOut = judgeRequested && deps.judge
        ? await deps.judge(normalised.text)
        : null;

      const citations: ReadonlyArray<Citation> = extractCitationsFromUiBlock(normalised.uiBlock);
      const artifacts: ReadonlyArray<Artifact> = extractArtifactsFromUiBlock(normalised.uiBlock);

      // 10) self-awareness drift
      const capturedAt = clock().toISOString();
      const sa = checkSelfAwareness({
        persona,
        outputText: normalised.text,
        toolCallCount: toolCalls.length,
        hasCitations: citations.length > 0,
        thoughtId,
        capturedAt,
      });
      if (sa.events.length > 0 && deps.driftSink) {
        for (const ev of sa.events) await deps.driftSink.record(ev);
      }
      if (sa.verdict.status === 'soften' || sa.verdict.status === 'block') {
        yield { kind: 'gate_verdict', gate: 'drift', verdict: sa.verdict };
      }
      if (sa.verdict.status === 'block') {
        const decision = makeRefusal({
          thoughtId,
          req,
          reason: 'reason' in sa.verdict ? sa.verdict.reason : 'drift blocked',
          gate: 'drift',
          startedAt,
          clockNow: clock(),
        });
        if (deps.provenanceSink) {
          void deps.provenanceSink.record(decision.provenance).catch(() => undefined);
        }
        yield { kind: 'done', decision };
        return;
      }

      // 11) policy gate
      const policy = runPolicyGate({
        text: normalised.text,
        hasCitations: citations.length > 0,
      });
      if (policy.verdict.status === 'soften' || policy.verdict.status === 'block') {
        yield { kind: 'gate_verdict', gate: 'policy', verdict: policy.verdict };
      }

      // 12) confidence
      const sensorResultLike: SensorCallResult = {
        text: accumulatedText,
        thought: accumulatedThought,
        toolCalls,
        latencyMs: sensorLatencyMs,
        modelId,
        sensorId,
      };
      const confidence = scoreConfidence({
        outputText: policy.redactedText,
        citationCount: citations.length,
        toolResultNumbers: collectToolNumbers(sensorResultLike),
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
        toolCallSummaries: toolCalls.map((tc) => ({
          toolName: tc.toolName,
          latencyMs: 0,
          ok: true,
        })),
        sensorId,
        modelId,
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
          thoughtText: accumulatedThought,
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
        void deps.provenanceSink.record(provenance).catch(() => undefined);
      }

      if (decision.kind !== 'refusal') {
        yield { kind: 'confidence', vector: decision.confidence };
      }
      yield { kind: 'done', decision };
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Streaming helpers
// ─────────────────────────────────────────────────────────────────────

function personaStartEvent(persona: PersonaIdentity): KernelStreamEvent {
  return {
    kind: 'turn_start',
    persona: {
      id: persona.id,
      displayName: persona.displayName,
      firstPersonNoun: persona.firstPersonNoun,
    },
  };
}

function pickStreamingSensor(
  sensors: ReadonlyArray<Sensor>,
  required: ReadonlyArray<'vision' | 'thinking' | 'fast' | 'batch'>,
): Sensor | null {
  // Iterate in priority order (lower wins) and pick the first sensor
  // that satisfies all required capabilities AND exposes `callStream`.
  // Mirrors the failover router's eligibility filter; we don't reuse
  // the router itself because streaming requires holding the iterator
  // open across the post-sensor pipeline.
  const eligible = [...sensors]
    .filter((s) => required.every((cap) => s.capabilities.includes(cap)))
    .filter((s) => typeof s.callStream === 'function')
    .sort((a, b) => a.priority - b.priority);
  return eligible[0] ?? null;
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

function renderGroundingFragment(facts: ReadonlyArray<GroundingFact>): string {
  if (facts.length === 0) return '';
  const lines = facts.map((f) => {
    const value = formatGroundingValue(f);
    return `  - [${f.id}] ${f.label}: ${value} (source: ${f.source}, as-of ${f.asOf})`;
  });
  return [
    'Grounding facts (tenant-internal; cite by id when you use these):',
    ...lines,
  ].join('\n');
}

function formatGroundingValue(f: GroundingFact): string {
  if (typeof f.value === 'string') return f.value;
  switch (f.unit) {
    case 'pct':           return `${(f.value * 100).toFixed(1)}%`;
    case 'count':         return f.value.toFixed(0);
    case 'currency-tzs':  return `TZS ${f.value.toLocaleString('en-US')}`;
    case 'currency-kes':  return `KES ${f.value.toLocaleString('en-US')}`;
    case 'days':          return `${f.value.toFixed(1)} days`;
    default:              return String(f.value);
  }
}
