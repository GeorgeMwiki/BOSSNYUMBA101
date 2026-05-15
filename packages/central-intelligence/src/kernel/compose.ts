/**
 * Composition root — wires the kernel from a small high-level config
 * into a fully-configured BrainKernel + ApprovalGate + briefing
 * composer + nudge router.
 *
 * Most consumers only need:
 *
 *   const sov = composeSovereign({
 *     anthropicClient,
 *     substrateSinks,                  // from @bossnyumba/database
 *     cohortSource,                    // optional
 *     approvalStore,                   // optional, defaults in-memory
 *     priorTurnsLoader,                // optional
 *   });
 *   sov.kernel.think(...);
 *   sov.briefing.compose(...);
 *   sov.nudges.route(...);
 *   sov.approvals.propose(...) / sign(...);
 *
 * Provider-agnostic at the Sensor port; you can pass any Sensor[] if
 * you don't have an Anthropic client (e.g. tests).
 */

import { createBrainKernel, type BrainKernel } from './kernel.js';
import { createBrainCache } from './brain-cache.js';
import type { PersonaBrandingResolver } from './branding.js';
import { createSensorRouter, type SensorRouter } from './sensor-failover.js';
import {
  createCotReservoir,
  createInMemoryCotReservoirSink,
  createInMemoryPersonaDriftSink,
  createInMemoryProvenanceSink,
} from './cot-reservoir.js';
import {
  createApprovalGate,
  createInMemoryApprovalStore,
  type ApprovalGate,
  type ApprovalPolicyResolver,
  type ApprovalStore,
} from './four-eye-approval.js';
import { createBriefingComposer } from './briefing.js';
import { createNudgeRouter, createInMemoryNudgeDedupe, type NudgeDedupeStore } from './proactive-nudge.js';
import {
  ANTHROPIC_SENSOR_PRESETS,
  type AnthropicMessagesClient,
} from './sensors/anthropic-sensor.js';
import type {
  AgencyKernelPort,
  CotReservoirSink,
  FeedbackMemoryPort,
  GroundingFactsProvider,
  MemoryHierarchy,
  PersonaDriftSink,
  ProvenanceSink,
  Sensor,
} from './kernel-types.js';
import type { CohortSource } from './cohort-signal.js';
import { createAnthropicJudge } from './sensors/anthropic-judge.js';
import type { KillswitchPort } from './killswitch.js';
import type { DecisionTraceRecorder } from './decision-trace.js';
import {
  createAffectiveAccumulator,
  type AffectiveAccumulator,
} from './theory-of-mind.js';
import {
  createCognitiveLoadAccumulator,
  type CognitiveLoadAccumulator,
} from './cognitive-load.js';
import type { BrainToolRegistry } from './tool-spec.js';
import type { TextEmbedder } from './kernel-types.js';

export interface SubstrateSinks {
  readonly cot: CotReservoirSink;
  readonly drift: PersonaDriftSink;
  readonly provenance: ProvenanceSink;
}

export interface ComposeSovereignConfig {
  readonly anthropicClient?: AnthropicMessagesClient;
  readonly extraSensors?: ReadonlyArray<Sensor>;
  readonly substrateSinks?: SubstrateSinks;
  readonly cohortSource?: CohortSource;
  readonly groundingFacts?: GroundingFactsProvider;
  readonly approvalStore?: ApprovalStore;
  readonly nudgeDedupe?: NudgeDedupeStore;
  /**
   * Optional per-tenant persona-branding resolver. The kernel calls
   * this before rendering the identity preamble so an agency can
   * re-skin the AI's displayName / openingPreamble / voice profile id
   * without touching the surface-default personas.
   */
  readonly brandingResolver?: PersonaBrandingResolver;
  /**
   * Optional LITFIN-style four-tier memory hierarchy. When provided,
   * the kernel reads semantic facts + the latest reflective digest at
   * step 4 and writes episodic rows at step 13. Composition roots in
   * the api-gateway pass the Drizzle-backed services from
   * `@bossnyumba/database`; tests pass in-memory fakes.
   */
  readonly memory?: MemoryHierarchy;
  /**
   * Optional online-learning feedback port. When provided, the kernel
   * fetches the user's last 10 feedback entries at step 4 (memory
   * recall) and mixes the verbatim corrections + per-category
   * negative-rate into the system prompt. Adapters live in
   * `@bossnyumba/database` (Drizzle service `createFeedbackService`);
   * tests pass in-memory fakes.
   */
  readonly feedback?: FeedbackMemoryPort;
  /**
   * Optional agency port — the brain's "acts in full control" stack.
   * When provided the kernel mixes ACTIVE goals into its system prompt
   * at step 4, so the next turn references the persistent objective
   * stack. The full executor + wake-loop live above the kernel.
   */
  readonly agency?: AgencyKernelPort;
  readonly priorTurnsLoader?: (
    threadId: string,
  ) => Promise<ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>>;
  readonly recentTurnCounter?: (threadId: string) => Promise<number>;
  /**
   * Custom judge override. When omitted and `anthropicClient` is
   * provided, compose wires a Haiku-backed judge automatically.
   */
  readonly judge?: (text: string) => Promise<{
    readonly score: number;
    readonly reasonText?: string;
    readonly suggestedFix?: string;
  }>;
  /**
   * Set false to disable the auto-Haiku judge even when the
   * Anthropic client is present (e.g. cost-sensitive surfaces).
   * Default: true.
   */
  readonly autoHaikuJudge?: boolean;
  readonly clock?: () => Date;
  readonly rng?: () => number;
  /**
   * Optional administrative killswitch. When wired, the kernel runs a
   * Step 0 short-circuit before any sensor / memory / cohort work. The
   * api-gateway composition root constructs an env-backed port via
   * `createEnvKillswitchPort(process.env)`.
   */
  readonly killswitch?: KillswitchPort;
  /**
   * Optional decision-trace recorder. When wired, every `think()` call
   * captures the ordered step breadcrumb (durations, summaries, errors)
   * for ops audit. Failures are swallowed.
   */
  readonly traceRecorder?: DecisionTraceRecorder;
  /**
   * Uncertainty-policy switch. Default: `'off'` for back-compat. When
   * `'on'`, step 11a runs after confidence scoring and may caveat /
   * ask-back / escalate based on confidence and stakes. The api-
   * gateway wiring resolves this from the `BOSSNYUMBA_UNCERTAINTY_POLICY`
   * env var.
   */
  readonly uncertaintyPolicy?: 'off' | 'on';
  /**
   * Optional resolver for per-action role-group approval policies.
   * Passed through to `createApprovalGate` so high-stakes write
   * actions (eviction.propose, owner_payout.disburse, etc.) consult
   * a DB-backed policy table at propose-time instead of the legacy
   * "any 2 distinct admins" default.
   */
  readonly approvalPolicyResolver?: ApprovalPolicyResolver;
  /**
   * Optional per-(tenant, user) cognitive-load accumulator. When
   * supplied, the kernel observes each turn's per-turn score against
   * the accumulator and renders a cross-turn directive
   * (`renderLoadDirectiveWithProfile`) instead of the per-turn one.
   * Defaults to a fresh in-memory accumulator when omitted.
   */
  readonly cognitiveLoadAccumulator?: CognitiveLoadAccumulator;
  /**
   * Optional per-(tenant, user) affective (theory-of-mind)
   * accumulator. When supplied, the kernel observes each turn's
   * per-turn MindState against the accumulator and renders a
   * cross-turn behavioural directive
   * (`renderMindStateDirectiveWithProfile`). Defaults to a fresh
   * in-memory accumulator when omitted.
   */
  readonly affectiveAccumulator?: AffectiveAccumulator;
  /**
   * Optional brain-tool registry. When supplied and the kernel
   * decides to invoke one of the 5 PM seed tools, the registry runs
   * the deterministic executor and the kernel mixes the result into
   * the prompt context for the next sensor call.
   */
  readonly toolRegistry?: BrainToolRegistry;
  /**
   * Optional text embedder. When wired, the memory-recall step
   * produces a query embedding from the user message (when the
   * caller did not supply one) and prefers `searchByEmbedding`.
   */
  readonly embedder?: TextEmbedder;
  // ── C5 (Progressive Intelligence) coordination zone ────────────────
  /**
   * Optional Voyager-style skill retriever. Wired by the api-gateway
   * composition root from the Drizzle-backed `skill_registry` table.
   */
  readonly skillRetriever?: import('./skill-library/skill-retriever.js').SkillRetriever;
  /**
   * Optional Reflexion retriever (read-at-session-start). Wired by the
   * api-gateway composition root from the Drizzle-backed
   * `reflexion_buffer` table.
   */
  readonly reflexionRetriever?: import('./reflexion/reflexion-retriever.js').ReflexionRetriever;
  /**
   * Optional Reflexion writer (write-at-session-end). Same composition
   * source as the retriever.
   */
  readonly reflexionWriter?: import('./reflexion/reflexion-writer.js').ReflexionWriterPort;
  /**
   * Optional Self-RAG critic. When wired, the kernel runs IsREL /
   * IsSUP / IsUSE reflection tokens after the sensor result is
   * normalised. Same shape as the legacy judge port.
   */
  readonly selfRagJudge?: import('./self-rag/self-rag.js').SelfRagJudge;
  // ── C4 (Sensorium / Brain Skin) coordination zone ──────────────────
  /**
   * Optional behaviour-signal source. When wired (production: by the
   * api-gateway composition root, backed by the Drizzle sensorium-
   * event-log service via `createBehaviorSignalSource(...)` in
   * `@bossnyumba/ai-copilot`), step 4 (memory recall) reads recent
   * derived signals (`engagement.high`, `frustration.detected`,
   * `task.completed-without-AI`, `dwell.deep`) and mixes them into
   * the system prompt as the brain's mind-state inference channel.
   * Failures are swallowed — the brain-skin is a side-channel.
   */
  readonly behaviorSignalSource?: import('./kernel-types.js').BehaviorSignalSourcePort;
}

export interface SovereignBrain {
  readonly kernel: BrainKernel;
  readonly approvals: ApprovalGate;
  readonly briefing: ReturnType<typeof createBriefingComposer>;
  readonly nudges: ReturnType<typeof createNudgeRouter>;
  readonly router: SensorRouter;
}

export function composeSovereign(config: ComposeSovereignConfig): SovereignBrain {
  const sensors: Sensor[] = [];
  if (config.anthropicClient) {
    sensors.push(
      ANTHROPIC_SENSOR_PRESETS.opus47(config.anthropicClient),
      ANTHROPIC_SENSOR_PRESETS.sonnet46(config.anthropicClient),
      ANTHROPIC_SENSOR_PRESETS.haiku45(config.anthropicClient),
    );
  }
  if (config.extraSensors) sensors.push(...config.extraSensors);
  if (sensors.length === 0) {
    throw new Error('composeSovereign requires at least one sensor (anthropicClient or extraSensors)');
  }

  const clock = config.clock ?? (() => new Date());
  const router = createSensorRouter({ sensors, clock: () => clock().getTime() });
  const cache = createBrainCache({ clock: () => clock().getTime() });

  const sinks: SubstrateSinks =
    config.substrateSinks ?? {
      cot: createInMemoryCotReservoirSink(),
      drift: createInMemoryPersonaDriftSink(),
      provenance: createInMemoryProvenanceSink(),
    };

  const reservoirDeps: { sink: typeof sinks.cot; rng?: () => number } = { sink: sinks.cot };
  if (config.rng) reservoirDeps.rng = config.rng;
  const reservoir = createCotReservoir(reservoirDeps);

  // Auto-Haiku judge when Anthropic client present and no override.
  let resolvedJudge = config.judge;
  if (!resolvedJudge && config.anthropicClient && config.autoHaikuJudge !== false) {
    resolvedJudge = createAnthropicJudge(config.anthropicClient);
  }

  const kernelDeps: Parameters<typeof createBrainKernel>[0] = {
    sensors,
    router,
    cache,
    cotReservoir: reservoir,
    driftSink: sinks.drift,
    provenanceSink: sinks.provenance,
    clock,
  };
  if (config.cohortSource)      (kernelDeps as any).cohort = config.cohortSource;
  if (config.groundingFacts)    (kernelDeps as any).groundingFacts = config.groundingFacts;
  if (config.priorTurnsLoader)  (kernelDeps as any).priorTurnsLoader = config.priorTurnsLoader;
  if (config.recentTurnCounter) (kernelDeps as any).recentTurnCounter = config.recentTurnCounter;
  if (resolvedJudge)            (kernelDeps as any).judge = resolvedJudge;
  if (config.rng)               (kernelDeps as any).rng = config.rng;
  if (config.brandingResolver)  (kernelDeps as any).brandingResolver = config.brandingResolver;
  if (config.memory)            (kernelDeps as any).memory = config.memory;
  if (config.feedback)          (kernelDeps as any).feedback = config.feedback;
  if (config.agency)            (kernelDeps as any).agency = config.agency;
  if (config.killswitch)        (kernelDeps as any).killswitch = config.killswitch;
  if (config.traceRecorder)     (kernelDeps as any).traceRecorder = config.traceRecorder;
  if (config.uncertaintyPolicy) (kernelDeps as any).uncertaintyPolicy = config.uncertaintyPolicy;
  if (config.toolRegistry)      (kernelDeps as any).toolRegistry = config.toolRegistry;
  if (config.embedder)          (kernelDeps as any).embedder = config.embedder;
  // C5 — Progressive Intelligence.
  if (config.skillRetriever)    (kernelDeps as any).skillRetriever = config.skillRetriever;
  if (config.reflexionRetriever) (kernelDeps as any).reflexionRetriever = config.reflexionRetriever;
  if (config.reflexionWriter)   (kernelDeps as any).reflexionWriter = config.reflexionWriter;
  if (config.selfRagJudge)      (kernelDeps as any).selfRagJudge = config.selfRagJudge;
  // C4 — Sensorium / Brain Skin.
  if (config.behaviorSignalSource) (kernelDeps as any).behaviorSignalSource = config.behaviorSignalSource;
  // Cognitive-load + affective accumulators are always wired so the
  // kernel can render cross-turn directives. Callers that pass their
  // own instance (e.g. tests asserting cross-call state) win;
  // otherwise we mint a fresh in-memory accumulator per kernel.
  (kernelDeps as any).cognitiveLoadAccumulator =
    config.cognitiveLoadAccumulator ?? createCognitiveLoadAccumulator();
  (kernelDeps as any).affectiveAccumulator =
    config.affectiveAccumulator ?? createAffectiveAccumulator();
  const kernel = createBrainKernel(kernelDeps);

  const approvalGateDeps: Parameters<typeof createApprovalGate>[0] = {
    store: config.approvalStore ?? createInMemoryApprovalStore(),
    clock,
  };
  if (config.approvalPolicyResolver) {
    (approvalGateDeps as { policyResolver?: ApprovalPolicyResolver }).policyResolver =
      config.approvalPolicyResolver;
  }
  const approvals = createApprovalGate(approvalGateDeps);

  const briefing = createBriefingComposer({ kernel });

  const nudges = createNudgeRouter({
    kernel,
    dedupe: config.nudgeDedupe ?? createInMemoryNudgeDedupe(),
    clock,
  });

  return { kernel, approvals, briefing, nudges, router };
}
