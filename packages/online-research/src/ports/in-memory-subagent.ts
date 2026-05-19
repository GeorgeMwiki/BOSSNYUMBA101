/**
 * In-memory `SubAgentRunnerPort` — used for tests + dev.
 *
 * Production wires this against K-C's
 * `@bossnyumba/skill-library/subagent-spawn` runner. The in-memory
 * version simulates the K-C isolation contract:
 *
 *   - The runner only sees the spec + input the caller supplies.
 *     No parent conversation history can leak through (we don't
 *     accept any such param).
 *
 *   - Only the typed `SubAgentResult` flows back. Transcripts +
 *     intermediate tool calls are discarded.
 *
 *   - `isolated_context: true` is enforced — we throw when caller
 *     attempts `false`. Matches K-C's contract guard.
 */

import type {
  SubAgentInput,
  SubAgentRunnerPort,
  SubAgentResult,
  SubAgentSpec,
} from './index.js';

export type WorkerSimulator<TOutput> = (
  spec: SubAgentSpec,
  input: SubAgentInput,
) => Promise<{
  readonly output: TOutput;
  readonly turns_used: number;
  readonly cost_usd: number;
  readonly status?: 'ok' | 'error' | 'budget_exceeded' | 'turn_limit';
  readonly error?: { readonly code: string; readonly message: string };
}>;

export interface InMemorySubAgentRunnerConfig {
  /** Returns a worker simulator keyed by spec name. */
  readonly simulator: WorkerSimulator<unknown>;
}

export function createInMemorySubAgentRunner(
  config: InMemorySubAgentRunnerConfig,
): SubAgentRunnerPort {
  return {
    spawnSubAgent: async <TOutput = unknown>(
      spec: SubAgentSpec,
      input: SubAgentInput,
    ): Promise<SubAgentResult<TOutput>> => {
      // Enforce isolation contract.
      if (spec.isolated_context !== true) {
        throw new Error(
          'SubAgentSpec.isolated_context must be true (K-C contract)',
        );
      }
      // Subagents cannot spawn subagents.
      if (spec.allowed_tools.includes('Agent')) {
        throw new Error('Subagents cannot have `Agent` in allowed_tools');
      }

      try {
        const sim = await config.simulator(spec, input);
        return Object.freeze({
          name: spec.name,
          status: sim.status ?? 'ok',
          output: sim.output as TOutput,
          turns_used: sim.turns_used,
          cost_usd: sim.cost_usd,
          correlation_id: input.correlation_id,
          ...(sim.error ? { error: sim.error } : {}),
        });
      } catch (e) {
        return Object.freeze({
          name: spec.name,
          status: 'error' as const,
          output: undefined as unknown as TOutput,
          turns_used: 0,
          cost_usd: 0,
          correlation_id: input.correlation_id,
          error: {
            code: 'simulator_threw',
            message: (e as Error).message,
          },
        });
      }
    },
  };
}
