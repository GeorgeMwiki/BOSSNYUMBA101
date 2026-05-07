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
  AgencyKernelPort,
  BrainDecision,
  ConfidenceVector,
  GateOutcome,
  GateVerdict,
  GroundingFact,
  GroundingFactsProvider,
  KernelStreamEvent,
  MemoryHierarchy,
  PersonaDriftSink,
  ProvenanceRecord,
  ProvenanceSink,
  Sensor,
  SensorCallArgs,
  SensorCallResult,
  ThoughtRequest,
} from './kernel-types.js';
import type { Goal } from './agency/index.js';
import type {
  ReflectiveDigest,
  SemanticFact,
} from './memory/types.js';
import type {
  FeedbackEntry,
  FeedbackMemoryPort,
} from './feedback/types.js';
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
import type { DebateOutcome } from './debate/debate-types.js';

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
  /**
   * Optional LITFIN-style four-tier memory hierarchy. When supplied,
   * the kernel:
   *   - reads `semantic.search(...)` and `reflective.latest(...)` at
   *     step 4 (memory recall) and mixes the results into the system
   *     prompt as "What I remember about you" + "Recent reflection";
   *   - writes two `episodic.record(...)` entries at step 13 (one for
   *     the user message, one for the agent action).
   * Every call is wrapped in try/catch; memory is a side-channel and
   * must never break the main turn.
   */
  readonly memory?: MemoryHierarchy;
  /**
   * Optional online-learning feedback port. When supplied, the kernel
   * fetches the user's last 10 feedback entries at step 4 (memory
   * recall) and mixes a "What I've learned from your feedback:"
   * fragment into the system prompt, listing recent verbatim
   * corrections + a per-category negative-rate. When the
   * negative-rate exceeds 0.25 the kernel also appends a directive
   * telling the sensor to be more conservative on the next turn.
   * Failures are swallowed — the side-channel never breaks the turn.
   */
  readonly feedback?: FeedbackMemoryPort;
  /**
   * Optional internal-debate hook. When supplied AND
   * `shouldDebate(req)` returns true (default: stakes ≥ 'high'), the
   * kernel replaces the single sensor call at step 7 with a multi-
   * voice debate and uses the synthesis text as the sensor output.
   * Currently honoured by the non-streaming `think(req)` path only;
   * `thinkStream(req)` falls back to the single-shot sensor path.
   */
  readonly debate?: {
    shouldDebate(req: ThoughtRequest): boolean;
    runDebate(question: string, context: string): Promise<DebateOutcome>;
  };
  /**
   * Optional agency port. When supplied, step 4 (memory recall) also
   * reads the user's ACTIVE goals via `agency.goals.list(...)` and
   * mixes them into the system prompt as a "What you've asked me to
   * work on" fragment. Errors from the goals reader are swallowed —
   * the agency channel is a side-channel, never breaks the turn. The
   * full executor + wake-loop live above the kernel.
   */
  readonly agency?: AgencyKernelPort;
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

      // 4b) hierarchical memory recall — semantic facts + the latest
      // reflective digest. Both ports are optional; failures are
      // swallowed so the side-channel never breaks the turn.
      const memTenantId =
        req.scope.kind === 'tenant' ? req.scope.tenantId : null;
      const memUserId = req.scope.actorUserId;
      const semanticFacts = await loadSemanticFacts(deps.memory, memTenantId, memUserId);
      const reflectiveDigest = await loadReflectiveDigest(deps.memory, memTenantId, memUserId);

      // 4c) online-learning feedback recall — the user's last
      // 10 thumbs / corrections / flags so the next turn can
      // apologise, learn, and bias toward conservative output when
      // the negative-rate is elevated.
      const feedbackRecent = await loadFeedbackRecent(
        deps.feedback,
        memTenantId,
        memUserId,
      );

      // 4d) agency — active goals for the (tenant, user) pair.
      const activeGoals = await loadActiveGoals(
        deps.agency,
        memTenantId,
        memUserId,
      );

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
        renderSemanticMemoryFragment(semanticFacts),
        '',
        renderReflectiveDigestFragment(reflectiveDigest),
        '',
        renderFeedbackFragment(feedbackRecent),
        '',
        renderActiveGoalsFragment(activeGoals),
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
      //
      // Optional debate detour: when `deps.debate` is wired and
      // `shouldDebate(req)` returns true (default: stakes ∈ {high,
      // critical}), we replace the single sensor call with a multi-
      // voice debate and use the synthesis text as the sensor output.
      const wantsThinking = req.stakes === 'high' || req.stakes === 'critical';
      const hasAttachments = (req.attachments?.length ?? 0) > 0;
      const required: Array<'vision' | 'thinking' | 'fast' | 'batch'> = [];
      if (wantsThinking) required.push('thinking');
      if (hasAttachments) required.push('vision');

      const debateEligible =
        deps.debate &&
        (req.stakes === 'high' || req.stakes === 'critical') &&
        deps.debate.shouldDebate(req);

      let sensorResult: SensorCallResult;
      let debateRoundsCompleted: number | undefined;
      let debateConverged: boolean | undefined;
      if (debateEligible && deps.debate) {
        const debateStart = clock().getTime();
        try {
          const outcome = await deps.debate.runDebate(req.userMessage, system);
          // The runner stamps the synthesis with `maxRounds + 1`,
          // and every other contribution carries a round in
          // [1, maxRounds]. Count distinct rounds excluding the
          // final synthesis stamp.
          const allRounds = outcome.contributions.map((c) => c.round);
          const synthesisStamp = allRounds.length > 0
            ? Math.max(...allRounds)
            : 0;
          const debateRounds = new Set(
            outcome.contributions
              .filter((c) => c.round < synthesisStamp)
              .map((c) => c.round),
          );
          debateRoundsCompleted = debateRounds.size;
          debateConverged = outcome.converged;
          sensorResult = {
            text: outcome.synthesis,
            thought: null,
            toolCalls: [],
            latencyMs: clock().getTime() - debateStart,
            modelId: '__debate__',
            sensorId: '__debate__',
          };
        } catch {
          // On debate failure, fall back to the single-shot path.
          sensorResult = await router.call(
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
        }
      } else {
        sensorResult = await router.call(
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
      }

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
        ...(debateRoundsCompleted !== undefined
          ? { debateRoundsCompleted }
          : {}),
        ...(debateConverged !== undefined ? { debateConverged } : {}),
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
      // Episodic memory writes — fire-and-forget, never blocks the
      // caller, errors swallowed.
      writeEpisodicTurnTrace({
        memory: deps.memory,
        tenantId: memTenantId,
        userId: memUserId,
        threadId: req.threadId,
        turnId: thoughtId,
        userMessage: req.userMessage,
        agentText: pickAgentTraceText(decision),
      });
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

      // 4b) hierarchical memory recall — semantic + reflective.
      const memTenantId =
        req.scope.kind === 'tenant' ? req.scope.tenantId : null;
      const memUserId = req.scope.actorUserId;
      const semanticFacts = await loadSemanticFacts(deps.memory, memTenantId, memUserId);
      const reflectiveDigest = await loadReflectiveDigest(deps.memory, memTenantId, memUserId);

      // 4c) online-learning feedback recall.
      const feedbackRecent = await loadFeedbackRecent(
        deps.feedback,
        memTenantId,
        memUserId,
      );

      // 4d) agency — active goals for the (tenant, user) pair.
      const activeGoals = await loadActiveGoals(
        deps.agency,
        memTenantId,
        memUserId,
      );

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
        renderSemanticMemoryFragment(semanticFacts),
        '',
        renderReflectiveDigestFragment(reflectiveDigest),
        '',
        renderFeedbackFragment(feedbackRecent),
        '',
        renderActiveGoalsFragment(activeGoals),
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
      // Episodic memory writes — fire-and-forget.
      writeEpisodicTurnTrace({
        memory: deps.memory,
        tenantId: memTenantId,
        userId: memUserId,
        threadId: req.threadId,
        turnId: thoughtId,
        userMessage: req.userMessage,
        agentText: pickAgentTraceText(decision),
      });

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

// ─────────────────────────────────────────────────────────────────────
// Memory hierarchy helpers — read at step 4, write at step 13.
// Every entry point is wrapped: a failing memory port must NOT break
// the main turn.
// ─────────────────────────────────────────────────────────────────────

const MEMORY_SEMANTIC_LIMIT = 10;
const MEMORY_EPISODIC_SUMMARY_MAX = 500;

async function loadSemanticFacts(
  memory: MemoryHierarchy | undefined,
  tenantId: string | null,
  userId: string,
): Promise<ReadonlyArray<SemanticFact>> {
  if (!memory?.semantic || !userId) return [];
  try {
    return await memory.semantic.search({
      tenantId,
      userId,
      limit: MEMORY_SEMANTIC_LIMIT,
    });
  } catch {
    return [];
  }
}

async function loadReflectiveDigest(
  memory: MemoryHierarchy | undefined,
  tenantId: string | null,
  userId: string,
): Promise<ReflectiveDigest | null> {
  if (!memory?.reflective || !userId) return null;
  try {
    const digests = await memory.reflective.latest({
      tenantId,
      userId,
      periodKind: 'weekly',
      n: 1,
    });
    return digests[0] ?? null;
  } catch {
    return null;
  }
}

const FEEDBACK_RECALL_LIMIT = 10;
const FEEDBACK_NEGATIVE_RATE_THRESHOLD = 0.25;
const FEEDBACK_MAX_VERBATIM_CORRECTIONS = 3;
const FEEDBACK_CORRECTION_TEXT_MAX = 200;

async function loadFeedbackRecent(
  feedback: FeedbackMemoryPort | undefined,
  tenantId: string | null,
  userId: string,
): Promise<ReadonlyArray<FeedbackEntry>> {
  if (!feedback || !tenantId || !userId) return [];
  try {
    return await feedback.recallRecent({
      tenantId,
      userId,
      limit: FEEDBACK_RECALL_LIMIT,
    });
  } catch {
    return [];
  }
}

/**
 * Render the "What I've learned from your feedback" fragment.
 *
 * Lists up to 3 verbatim recent corrections, then a per-category
 * negative-rate sentence, and (when negativeRate > 0.25) appends a
 * conservative directive instructing the sensor to cite every
 * numerical claim and ask clarifying questions when uncertain.
 *
 * Empty / undefined input ⇒ empty fragment (compose() filters falsy
 * lines, so the system prompt stays clean).
 */
function renderFeedbackFragment(
  entries: ReadonlyArray<FeedbackEntry>,
): string {
  if (!entries || entries.length === 0) return '';

  const corrections = entries
    .filter((e) => e.signal === 'correction' && !!e.correctionText)
    .slice(0, FEEDBACK_MAX_VERBATIM_CORRECTIONS);

  const total = entries.length;
  const negativeCount = entries.filter(
    (e) => e.signal === 'thumbs-down' || e.signal === 'correction',
  ).length;
  const negativeRate = total > 0 ? negativeCount / total : 0;

  // Per-category bucket. We only enumerate the negative buckets the
  // user has actually tagged so the fragment stays compact.
  const categoryCounts: Record<string, number> = {};
  for (const e of entries) {
    if (e.category && (e.signal === 'thumbs-down' || e.signal === 'correction')) {
      categoryCounts[e.category] = (categoryCounts[e.category] ?? 0) + 1;
    }
  }
  const dominantCategory = pickDominantCategory(categoryCounts);

  const lines: string[] = ["What I've learned from your feedback:"];

  if (corrections.length > 0) {
    lines.push('  Recent corrections you gave me:');
    for (const c of corrections) {
      const text = (c.correctionText ?? '').slice(
        0,
        FEEDBACK_CORRECTION_TEXT_MAX,
      );
      lines.push(`    - "${text}"`);
    }
  }

  // Always render the rate sentence so the model knows the weight
  // even when no verbatim corrections were given (e.g. only thumbs).
  if (dominantCategory) {
    lines.push(
      `  You've flagged ${negativeCount} of my ${total} recent answers as "${dominantCategory}" — be especially careful about that.`,
    );
  } else {
    lines.push(
      `  You've flagged ${negativeCount} of my ${total} recent answers as negative.`,
    );
  }

  if (negativeRate > FEEDBACK_NEGATIVE_RATE_THRESHOLD) {
    lines.push(
      "  You've had a higher-than-usual rate of negative feedback. Be conservative; cite every numerical claim; ask clarifying questions when uncertain.",
    );
  }

  return lines.join('\n');
}

function pickDominantCategory(
  counts: Record<string, number>,
): string | null {
  let best: string | null = null;
  let bestCount = 0;
  for (const [cat, n] of Object.entries(counts)) {
    if (n > bestCount) {
      best = cat;
      bestCount = n;
    }
  }
  return best;
}

function renderSemanticMemoryFragment(
  facts: ReadonlyArray<SemanticFact>,
): string {
  if (facts.length === 0) return '';
  const lines = facts.map((f) => {
    const valueStr = stringifyFactValue(f.value);
    const conf = Math.round((Number(f.confidence) || 0) * 100);
    return `  - ${f.key}: ${valueStr} (conf ${conf}%)`;
  });
  return ['What I remember about you:', ...lines].join('\n');
}

function renderReflectiveDigestFragment(
  digest: ReflectiveDigest | null,
): string {
  if (!digest || !digest.summary) return '';
  return ['Recent reflection:', `  - ${digest.summary}`].join('\n');
}

function stringifyFactValue(v: unknown): string {
  if (v === null || v === undefined) return 'unknown';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v).slice(0, 200);
  } catch {
    return String(v);
  }
}

interface EpisodicTurnTraceArgs {
  readonly memory: MemoryHierarchy | undefined;
  readonly tenantId: string | null;
  readonly userId: string;
  readonly threadId: string;
  readonly turnId: string;
  readonly userMessage: string;
  readonly agentText: string;
}

function writeEpisodicTurnTrace(args: EpisodicTurnTraceArgs): void {
  const { memory, tenantId, userId, threadId, turnId, userMessage, agentText } = args;
  if (!memory?.episodic || !userId) return;
  // Fire-and-forget — never await; never let the side-channel break
  // the main turn. Each call self-catches; we wrap in try anyway in
  // case the port adapter throws synchronously.
  try {
    void memory.episodic
      .record({
        tenantId,
        userId,
        threadId,
        turnId,
        kind: 'user-message',
        summary: (userMessage ?? '').slice(0, MEMORY_EPISODIC_SUMMARY_MAX),
      })
      .catch(() => undefined);
  } catch {
    // ignored
  }
  try {
    void memory.episodic
      .record({
        tenantId,
        userId,
        threadId,
        turnId,
        kind: 'agent-action',
        summary: (agentText ?? '').slice(0, MEMORY_EPISODIC_SUMMARY_MAX),
      })
      .catch(() => undefined);
  } catch {
    // ignored
  }
}

function pickAgentTraceText(decision: BrainDecision): string {
  if (decision.kind === 'answer' || decision.kind === 'softened') {
    return decision.text ?? '';
  }
  // Refusals: carry the reason instead so the trail still records WHY
  // the agent acted (or refused to act).
  return decision.reason ?? 'refusal';
}

// ─────────────────────────────────────────────────────────────────────
// Agency helpers — read at step 4 (memory recall) for the prompt mix-
// in. The agency port is optional; failures are swallowed so the
// side-channel never breaks the turn.
// ─────────────────────────────────────────────────────────────────────

const AGENCY_GOAL_LIMIT = 5;

async function loadActiveGoals(
  agency: AgencyKernelPort | undefined,
  tenantId: string | null,
  userId: string,
): Promise<ReadonlyArray<Goal>> {
  if (!agency || !tenantId || !userId) return [];
  try {
    return await agency.goals.list({
      tenantId,
      userId,
      status: 'active',
      limit: AGENCY_GOAL_LIMIT,
    });
  } catch {
    return [];
  }
}

function renderActiveGoalsFragment(goals: ReadonlyArray<Goal>): string {
  if (!goals || goals.length === 0) return '';
  const lines = goals.map((g) => {
    const total = g.metrics.stepsTotal;
    const done = g.metrics.stepsDone;
    return `  - ${g.title} (${g.priority}, ${done}/${total} steps done)`;
  });
  return ["**What you've asked me to work on:**", ...lines].join('\n');
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
