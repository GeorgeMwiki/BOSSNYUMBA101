/**
 * In-memory `LLMOrchestratorPort` — used for tests + dev.
 *
 * Production wires this against the Anthropic API with Opus 4.7 for
 * the lead + synthesizer. The in-memory version uses heuristics
 * over the question text to produce a deterministic plan + synthesis
 * so tests don't burn tokens.
 */

import type {
  LLMOrchestratorPort,
  PlannerInput,
  PlannerOutput,
  SynthesizerInput,
  SynthesizerOutput,
} from './index.js';
import type { SubQuestion, WorkerOutput } from '../types/index.js';
import { suggestWorkerCount } from '../orchestrator-worker/decompose.js';

const LEAD_COST_USD = 0.05;
const SYNTH_COST_USD = 0.15;

export interface InMemoryLLMOrchestratorConfig {
  /** Optional override of the heuristic planner. */
  readonly planOverride?: (input: PlannerInput) => PlannerOutput;
  /** Optional override of the heuristic synthesizer. */
  readonly synthOverride?: (input: SynthesizerInput) => SynthesizerOutput;
  /** Wall-clock for elapsedMs. */
  readonly clock: { readonly nowMs: () => number };
}

export function createInMemoryLLMOrchestrator(
  config: InMemoryLLMOrchestratorConfig,
): LLMOrchestratorPort {
  return {
    plan: async (input: PlannerInput): Promise<PlannerOutput> => {
      if (config.planOverride !== undefined) {
        return config.planOverride(input);
      }
      const startMs = config.clock.nowMs();
      const proposed = Math.min(suggestWorkerCount(input.question, input.depth), input.maxWorkers);
      const subs = synthesizeSubQuestions(input.question, proposed);
      return Object.freeze({
        subQuestions: subs,
        costUsd: LEAD_COST_USD,
        elapsedMs: config.clock.nowMs() - startMs,
      });
    },
    synthesize: async (input: SynthesizerInput): Promise<SynthesizerOutput> => {
      if (config.synthOverride !== undefined) {
        return config.synthOverride(input);
      }
      const startMs = config.clock.nowMs();
      const okOutputs = input.workerOutputs.filter((o) => o.status === 'ok');
      const facts = okOutputs.flatMap((o) =>
        o.summary.length > 0
          ? [`- (${o.subQuestionId}) ${o.summary}`]
          : [],
      );
      const report =
        facts.length === 0
          ? `Research on "${input.question}" returned no usable results.`
          : `Research findings for "${input.question}":\n\n${facts.join('\n')}`;

      const citations = flattenCitations(input.workerOutputs);
      return Object.freeze({
        report,
        citations,
        costUsd: SYNTH_COST_USD,
        elapsedMs: config.clock.nowMs() - startMs,
      });
    },
  };
}

function synthesizeSubQuestions(
  question: string,
  n: number,
): ReadonlyArray<SubQuestion> {
  // Splits on " and "/"?"; if too few facets, generates per-aspect
  // sub-questions ("market rate", "regulation", "compliance gaps").
  const facets = question
    .split(/\s*(?:\s+and\s+|\?)\s*/iu)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);

  const subs: SubQuestion[] = [];
  for (let i = 0; i < n; i++) {
    const baseFacet = facets[i % Math.max(1, facets.length)] ?? question;
    const id = `sq-${i + 1}`;
    const preferred: ReadonlyArray<'tavily' | 'exa' | 'anthropic' | 'browser-use'> =
      i === 0
        ? ['tavily', 'anthropic']
        : i === 1
          ? ['exa', 'anthropic']
          : ['anthropic'];
    subs.push(
      Object.freeze({
        id,
        question: facets.length > 1 ? `${baseFacet}?` : `Aspect ${i + 1}: ${baseFacet}`,
        rationale: `Decomposes "${question}" — facet ${i + 1} of ${n}.`,
        preferredProviders: preferred,
        dependsOn: i === n - 1 && n > 2 ? [`sq-${i}`] : [],
      }),
    );
  }
  return Object.freeze(subs);
}

function flattenCitations(
  outputs: ReadonlyArray<WorkerOutput>,
): SynthesizerOutput['citations'] {
  const seen = new Set<string>();
  const out: Array<{
    readonly url: string;
    readonly title: string;
    readonly snippet: string;
    readonly fromSubQuestion: string;
    readonly provider: 'tavily' | 'exa' | 'anthropic' | 'browser-use';
  }> = [];
  for (const o of outputs) {
    for (const h of o.hits) {
      if (seen.has(h.url)) {
        continue;
      }
      seen.add(h.url);
      out.push(
        Object.freeze({
          url: h.url,
          title: h.title,
          snippet: h.snippet,
          fromSubQuestion: o.subQuestionId,
          provider: h.provider,
        }),
      );
    }
  }
  return Object.freeze(out);
}
