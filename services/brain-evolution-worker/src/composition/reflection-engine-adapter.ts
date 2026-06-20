/**
 * Reflection engine adapter — the day-reflection stage (stage-02).
 *
 * The production reflection engine is the 3-LLM jury
 * (`createMultiLLMSynthesizer` from `@bossnyumba/ai-copilot`). That
 * package is NOT a dependency of this worker and wiring it would change
 * the worker's dependency surface; the api-gateway composition root is the
 * correct place to inject the LLM jury (pass it via `runNightlySweep`'s
 * `reflectionEngine` dep). Until that injection lands, this module ships a
 * deterministic, fully-functional heuristic engine so the nightly sweep
 * produces real reflection signal instead of no-oping.
 *
 * The heuristic derives genuine structure from trace OUTCOMES:
 *   - `success` traces            → worked patterns (topic-bucketed)
 *   - `failure` / `corrected`     → failed patterns
 *   - `abandoned`                 → failed patterns (user disengaged)
 *   - first-seen topics           → novel patterns
 *
 * `agreement` is the share of traces with a determinate (non-null)
 * outcome — a proxy for "how legible was the day". Below 0.5 we escalate,
 * mirroring the jury's low-agreement escalation signal.
 */

import type { ReflectionEngine } from '../pipeline/stage-02-reflect.js';
import type { InteractionTrace } from '../types.js';

const MAX_PATTERNS = 8;
const ESCALATE_AGREEMENT_THRESHOLD = 0.5;

/**
 * Build the heuristic reflection engine. Deterministic: the same trace
 * set always yields the same reflection.
 */
export function createHeuristicReflectionEngine(): ReflectionEngine {
  return {
    async reflect(args) {
      const worked = new Map<string, number>();
      const failed = new Map<string, number>();
      const seenTopics = new Set<string>();
      const novelTopics: string[] = [];

      let determinate = 0;
      for (const trace of args.traces) {
        const topic = topicOf(trace);
        if (!seenTopics.has(topic)) {
          seenTopics.add(topic);
          novelTopics.push(topic);
        }
        switch (trace.outcome) {
          case 'success':
            bump(worked, topic);
            determinate += 1;
            break;
          case 'failure':
          case 'corrected':
          case 'abandoned':
            bump(failed, topic);
            determinate += 1;
            break;
          default:
            break;
        }
      }

      const total = args.traces.length;
      const agreement = total === 0 ? 1 : determinate / total;

      return {
        synthesis: buildSynthesis({
          total,
          worked: worked.size,
          failed: failed.size,
          novel: novelTopics.length,
          agreement,
        }),
        worked: topPatterns(worked, 'worked'),
        failed: topPatterns(failed, 'failed'),
        novel: novelTopics.slice(0, MAX_PATTERNS).map((t) => `novel topic: ${t}`),
        agreement,
        escalate: agreement < ESCALATE_AGREEMENT_THRESHOLD,
      };
    },
  };
}

function topicOf(trace: InteractionTrace): string {
  const explicit = trace.payload['topic'];
  if (typeof explicit === 'string' && explicit.trim().length > 0) {
    return explicit.trim().toLowerCase();
  }
  const tokens = trace.summary.trim().split(/\s+/).slice(0, 2);
  return tokens.length > 0 && tokens[0] ? tokens.join(' ').toLowerCase() : 'general';
}

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function topPatterns(map: Map<string, number>, label: string): ReadonlyArray<string> {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_PATTERNS)
    .map(([topic, n]) => `${label} pattern: ${topic} (${n}x)`);
}

function buildSynthesis(stats: {
  total: number;
  worked: number;
  failed: number;
  novel: number;
  agreement: number;
}): string {
  return (
    `Sleep-time heuristic reflection over ${stats.total} traces: ` +
    `${stats.worked} worked-pattern topics, ${stats.failed} failed-pattern ` +
    `topics, ${stats.novel} novel topics. Outcome legibility ` +
    `${stats.agreement.toFixed(2)}.`
  );
}
