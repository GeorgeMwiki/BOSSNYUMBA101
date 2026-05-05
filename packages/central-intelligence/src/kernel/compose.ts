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
  type ApprovalStore,
} from './four-eye-approval.js';
import { createBriefingComposer } from './briefing.js';
import { createNudgeRouter, createInMemoryNudgeDedupe, type NudgeDedupeStore } from './proactive-nudge.js';
import {
  ANTHROPIC_SENSOR_PRESETS,
  type AnthropicMessagesClient,
} from './sensors/anthropic-sensor.js';
import type {
  CotReservoirSink,
  GroundingFactsProvider,
  PersonaDriftSink,
  ProvenanceSink,
  Sensor,
} from './kernel-types.js';
import type { CohortSource } from './cohort-signal.js';
import { createAnthropicJudge } from './sensors/anthropic-judge.js';

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
  readonly priorTurnsLoader?: (
    threadId: string,
  ) => Promise<ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>>;
  readonly recentTurnCounter?: (threadId: string) => Promise<number>;
  /**
   * Custom judge override. When omitted and `anthropicClient` is
   * provided, compose wires a Haiku-backed judge automatically.
   */
  readonly judge?: (text: string) => Promise<{ score: number }>;
  /**
   * Set false to disable the auto-Haiku judge even when the
   * Anthropic client is present (e.g. cost-sensitive surfaces).
   * Default: true.
   */
  readonly autoHaikuJudge?: boolean;
  readonly clock?: () => Date;
  readonly rng?: () => number;
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
  const kernel = createBrainKernel(kernelDeps);

  const approvals = createApprovalGate({
    store: config.approvalStore ?? createInMemoryApprovalStore(),
    clock,
  });

  const briefing = createBriefingComposer({ kernel });

  const nudges = createNudgeRouter({
    kernel,
    dedupe: config.nudgeDedupe ?? createInMemoryNudgeDedupe(),
    clock,
  });

  return { kernel, approvals, briefing, nudges, router };
}
