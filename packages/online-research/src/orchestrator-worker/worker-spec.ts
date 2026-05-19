/**
 * Worker SubAgent spec builder.
 *
 * Each worker receives an isolated K-C subagent context with:
 *
 *   - Its own sub-question + preferred providers
 *   - Tool allowlist: web search, web fetch, code execution
 *   - System prompt that pins it to one sub-question + structured output
 *   - max_turns budget proportional to depth
 *   - isolated_context: true (K-C contract)
 *   - No `Agent` tool — workers cannot spawn workers
 */

import type { SubQuestion, SearchDepth } from '../types/index.js';
import type { SubAgentSpec, SubAgentInput } from '../ports/index.js';

const SYSTEM_PROMPT_TEMPLATE = `You are a BOSSNYUMBA research worker. Your single objective:
answer ONE sub-question for the property-management Managing Director.

RULES:
1. Use web_search + web_fetch + code_execution ONLY. You do NOT have
   access to tenant data or any K-C parent context.
2. Return findings in the structured shape requested. No prose outside
   the schema.
3. Cite every factual claim with a source URL.
4. Stop after gathering enough to answer the question — do not "go
   wide". Your wall-time and tool-call budget are tight.
5. If your sub-question cannot be answered from public sources,
   return status='insufficient_evidence' and explain why.

You have NO ability to spawn other agents. Your output flows back to
the lead synthesizer; do not assume the user reads you directly.`;

const TOOLS_BY_PROVIDER: Readonly<
  Record<'tavily' | 'exa' | 'anthropic' | 'browser-use', ReadonlyArray<string>>
> = {
  tavily: ['web_search_tavily'],
  exa: ['web_search_exa'],
  anthropic: ['web_search', 'web_fetch'],
  'browser-use': ['browser_use_runtask'],
};

const MAX_TURNS_BY_DEPTH: Readonly<Record<SearchDepth, number>> = {
  quick: 8,
  standard: 15,
  deep: 25,
};

/**
 * Build the K-C-shaped SubAgentSpec for one sub-question.
 *
 * `model: 'sonnet'` matches Anthropic's research-system pattern — lead
 * is Opus, workers are Sonnet for cost efficiency.
 */
export function buildWorkerSpec(args: {
  readonly subQuestion: SubQuestion;
  readonly depth: SearchDepth;
}): SubAgentSpec {
  const { subQuestion, depth } = args;
  const tools = new Set<string>([
    'web_search',
    'web_fetch',
    'code_execution',
  ]);
  for (const provider of subQuestion.preferredProviders) {
    for (const t of TOOLS_BY_PROVIDER[provider]) {
      tools.add(t);
    }
  }

  return Object.freeze({
    name: `research-worker-${subQuestion.id}`,
    description: `Answer sub-question: ${subQuestion.question}`,
    allowed_tools: Object.freeze(Array.from(tools).sort()),
    system_prompt: SYSTEM_PROMPT_TEMPLATE,
    max_turns: MAX_TURNS_BY_DEPTH[depth],
    isolated_context: true as const,
    model: 'sonnet' as const,
    effort: depth === 'deep' ? 'high' : depth === 'standard' ? 'medium' : 'low',
  });
}

/**
 * Build the structured input the worker receives. The parent's
 * conversation history NEVER flows here — the K-C contract guarantees
 * the worker sees only this input.
 */
export function buildWorkerInput(args: {
  readonly subQuestion: SubQuestion;
  readonly correlationId: string;
}): SubAgentInput<{
  readonly subQuestionId: string;
  readonly preferredProviders: ReadonlyArray<string>;
  readonly rationale: string;
}> {
  const { subQuestion, correlationId } = args;
  return Object.freeze({
    prompt: subQuestion.question,
    structured_input: Object.freeze({
      subQuestionId: subQuestion.id,
      preferredProviders: Object.freeze([...subQuestion.preferredProviders]),
      rationale: subQuestion.rationale,
    }),
    correlation_id: correlationId,
  });
}
