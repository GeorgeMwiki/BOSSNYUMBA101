/**
 * Stage 03 — Reflect.
 *
 * For each cluster, run an LLM critic that writes a 1-paragraph
 * "what went well / what failed / what to do next time" reflection.
 * Production wires a Haiku-backed critic at the composition root;
 * the default in-worker implementation produces a deterministic stub
 * so unit tests can verify the orchestrator wiring.
 */

import type {
  ReflectionCritic,
  ReflectionResult,
  StageLogger,
  TraceCluster,
} from './types.js';

export interface ReflectArgs {
  readonly clusters: ReadonlyArray<TraceCluster>;
  readonly critic?: ReflectionCritic;
  readonly logger: StageLogger;
}

export async function runReflectStage(
  args: ReflectArgs,
): Promise<ReadonlyArray<ReflectionResult>> {
  const critic = args.critic ?? createStubCritic();
  const out: ReflectionResult[] = [];
  for (const cluster of args.clusters) {
    try {
      const r = await critic.reflect(cluster);
      out.push(r);
    } catch (error) {
      args.logger.warn(
        {
          stage: '03-reflect',
          clusterId: cluster.clusterId,
          err: asMessage(error),
        },
        'reflect stage critic threw — skipping cluster',
      );
    }
  }
  args.logger.info(
    {
      stage: '03-reflect',
      clusters: args.clusters.length,
      reflections: out.length,
    },
    'reflect stage complete',
  );
  return out;
}

/**
 * Deterministic stub critic. The text is concrete enough to be
 * recognisable in audit dashboards ("stub-haiku: ...") so an operator
 * can tell at a glance whether the real critic is wired.
 */
export function createStubCritic(): ReflectionCritic {
  return {
    async reflect(cluster) {
      const verb =
        cluster.outcome === 'success'
          ? 'worked well'
          : cluster.outcome === 'failure'
            ? 'failed'
            : 'was mixed';
      const text =
        `stub-haiku: cluster '${cluster.intentLabel}' (${cluster.traces.length} traces, score=${cluster.score.toFixed(2)}) ${verb}. ` +
        `Next time, run the typed action with explicit grounding.`;
      return {
        clusterId: cluster.clusterId,
        tenantId: cluster.tenantId,
        text,
        outcome: cluster.outcome,
        intentLabel: cluster.intentLabel,
      };
    },
  };
}

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
