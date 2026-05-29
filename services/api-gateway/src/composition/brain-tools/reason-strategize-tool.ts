/**
 * RT-7 — bossnyumba.reason.strategize (real-estate edition).
 *
 * Orchestrates multi-step strategic reasoning for owner questions of
 * the form "what should I do?". Returns a structured StrategyTrace
 * the chat turn uses AS CONTEXT — Mr. Mwikila composes the narrative
 * reply himself.
 *
 * Design rules:
 *   - LOW stakes, read-only. No money path. No write side effects.
 *   - Available to T1 owner, T2 admin, T3 manager (anyone who might
 *     be asked "what should we do here?"). Worker + customer kept out.
 *   - Deterministic at the tool layer: the scaffolding is built from
 *     the question + scope filter + recent activity, all visible to
 *     the test harness. Variation happens at the model layer.
 *   - The compose_guidance field instructs the model how to render
 *     the StrategyTrace into a warm, persona-consistent narrative.
 *
 * The tool does NOT call out to external services — it provides the
 * SHAPE the model fills in by reasoning. The model is the strategist;
 * the tool is the scaffold.
 *
 * Ported from Borjie — real-estate retailored. Entity types swapped
 * from mining (site / licence / vendor / mineral / royalty) to
 * real-estate (unit / lease / tenant / vendor / building / regulator).
 */

import { z } from 'zod';

import type { PersonaToolDescriptor } from './types.js';

const ReasonStrategizeInput = z
  .object({
    /**
     * The owner's strategic question, in their own words.
     * Examples: "should I raise rent across the block",
     * "what do I do about the late KRA filing",
     * "should I evict 9C or restructure".
     */
    question: z.string().min(3).max(500),
    /**
     * Optional scope filter — narrows the reasoning to a specific
     * entity (unit, lease, tenant, vendor, building). The model may use
     * this to focus the entity-search calls that ground each strategy.
     */
    scope_filter: z
      .object({
        entity_type: z
          .enum([
            'unit',
            'lease',
            'tenant',
            'vendor',
            'workforce',
            'building',
            'contract',
            'work_order',
          ])
          .optional(),
        entity_id: z.string().min(1).max(120).optional(),
      })
      .optional(),
    /**
     * Reasoning depth. 'quick' returns 2 strategies; 'thorough' returns
     * 3-4 with deeper evidence prompts. Defaults to 'quick' to keep
     * latency tight on the common path.
     */
    depth: z.enum(['quick', 'thorough']).optional().default('quick'),
    /**
     * Language hint for the bilingual prompts. Defaults to 'en'.
     */
    language: z.enum(['en', 'sw']).optional().default('en'),
  })
  .strict();

const StrategySchema = z
  .object({
    name: z.string().min(1),
    pros: z.array(z.string().min(1)).min(1).max(5),
    cons: z.array(z.string().min(1)).min(1).max(5),
    evidence_prompt: z.string().min(1),
    confidence: z.number().min(0).max(1),
  })
  .strict();
export type StrategyShape = z.infer<typeof StrategySchema>;

const StrategyTraceSchema = z
  .object({
    current_state_prompt: z.string().min(1),
    constraints: z.array(z.string().min(1)).min(1).max(8),
    strategies: z.array(StrategySchema).min(2).max(4),
    recommended_index: z.number().int().min(0),
    why_prompt: z.string().min(1),
    downsides_prompt: z.string().min(1),
    retrospective_grade_plan: z.string().min(1),
  })
  .strict();

const ReasonStrategizeOutput = z
  .object({
    question: z.string(),
    scope_filter: z
      .object({
        entity_type: z.string().optional(),
        entity_id: z.string().optional(),
      })
      .nullable(),
    depth: z.enum(['quick', 'thorough']),
    trace: StrategyTraceSchema,
    /**
     * The grounding tools the MODEL should call to fill in the
     * `*_prompt` fields with live data. The tool itself does not
     * call them — naming them here lets the orchestrator decide.
     */
    grounding_tools: z.array(z.string().min(1)).min(1),
    /**
     * RT-5 — REASONING DIRECTIVE. The StrategyTrace is a SCAFFOLD
     * for the model's fresh, owner-facing composition. Not a script.
     */
    compose_guidance: z.string().min(1),
  })
  .strict();

const ALLOWED_PERSONAS = [
  'T1_owner_strategist',
  'T2_admin_strategist',
  'T3_module_manager',
] as const;

const COMPOSE_GUIDANCE =
  'REASON: This StrategyTrace is a SCAFFOLD. Fill in the *_prompt fields ' +
  'using the grounding tools (entity search, scope query, recent ' +
  'decisions, jurisdiction context). Compose a warm, plain-text ' +
  "narrative for the owner in their active language. Walk them through: " +
  '(1) the current state from THEIR data, (2) the constraints, (3) the ' +
  'strategies with tradeoffs, (4) your recommendation with explicit ' +
  "WHY, (5) a retrospective grade plan ('here is how we will know we " +
  "picked right in 30 days'). NEVER quote this scaffold verbatim. Vary " +
  'phrasing per turn — the owner expects a thinking advisor, not a ' +
  'template.';

const GROUNDING_TOOLS: ReadonlyArray<string> = Object.freeze([
  'bossnyumba.scope.search',
  'bossnyumba.entity.find',
  'bossnyumba.jurisdiction.show_current',
  'bossnyumba.opportunity.scan',
  'bossnyumba.risk.scan',
]);

const QUICK_STRATEGIES: ReadonlyArray<StrategyShape> = Object.freeze([
  Object.freeze({
    name: 'Hold and verify',
    pros: Object.freeze([
      'Lowest cash and litigation risk',
      'Buys time for missing evidence (rent ledger, lease, KYC)',
    ]) as unknown as string[],
    cons: Object.freeze([
      'May miss the window if the tenant relationship deteriorates',
      'Owner perceived as slow',
    ]) as unknown as string[],
    evidence_prompt:
      'Pull recent decisions and communications for this tenant / unit / lease scope and check whether key evidence is still missing. Cite specific entity ids.',
    confidence: 0.65,
  }),
  Object.freeze({
    name: 'Move now with the data we have',
    pros: Object.freeze([
      'Captures the window (renewal, vacancy, market shift)',
      'Signals decisiveness to the tenant or market',
    ]) as unknown as string[],
    cons: Object.freeze([
      'Exposed to legal risk if evidence weak (RERA notices, KYC)',
      'Cash drawdown on vendor mobilisation or vacancy gap',
    ]) as unknown as string[],
    evidence_prompt:
      "Summarise the available evidence (rent history, lease terms, deposit position, recent communications) for THIS owner / tenant from the scope tool. Cite ids.",
    confidence: 0.55,
  }),
]) as unknown as StrategyShape[];

const THOROUGH_EXTRA_STRATEGIES: ReadonlyArray<StrategyShape> = Object.freeze([
  Object.freeze({
    name: 'Partial commitment — pilot then expand',
    pros: Object.freeze([
      'De-risks the move with a smaller bet (single unit, single building)',
      'Generates real data for the bigger portfolio decision',
    ]) as unknown as string[],
    cons: Object.freeze([
      'Slower than full portfolio commitment',
      'Pilot may not generalise across rent bands',
    ]) as unknown as string[],
    evidence_prompt:
      'Identify a smallest viable pilot from the scope. Cite the unit / lease / building id that would be the pilot.',
    confidence: 0.7,
  }),
  Object.freeze({
    name: 'Decline and pivot',
    pros: Object.freeze([
      'Preserves capital for higher-EV moves (renewal, refit, refinance)',
      'Avoids commitment to a thinning thesis',
    ]) as unknown as string[],
    cons: Object.freeze([
      'Forgone upside if this turned out to be the right move',
      'Owner needs a credible alternative to stay decisive',
    ]) as unknown as string[],
    evidence_prompt:
      'Surface 1-2 higher-EV opportunities from bossnyumba.opportunity.scan (rent uplift, lease renewal, refit) and contrast their evidence.',
    confidence: 0.5,
  }),
]) as unknown as StrategyShape[];

const buildTrace = (
  depth: 'quick' | 'thorough',
): z.infer<typeof StrategyTraceSchema> => {
  const strategies: StrategyShape[] =
    depth === 'thorough'
      ? [...QUICK_STRATEGIES, ...THOROUGH_EXTRA_STRATEGIES]
      : [...QUICK_STRATEGIES];
  // Pick the strategy with the highest confidence as the default
  // recommendation. The model may override after grounding with live
  // data — this is a starting point.
  let recommendedIndex = 0;
  let topConfidence = -Infinity;
  strategies.forEach((s, i) => {
    if (s.confidence > topConfidence) {
      topConfidence = s.confidence;
      recommendedIndex = i;
    }
  });
  return {
    current_state_prompt:
      "Describe the current state from the owner's OWN data: which units are leased, which are vacant, what the rent ledger looks like, which leases end soon, which work-orders are open. Cite entity ids.",
    constraints: [
      'Cash on hand, 30-day burn, and deposit-in-escrow position',
      'Active compliance windows (KRA / RERA / fire / lift certificates)',
      'Workforce capacity (caretakers, managers, contractors on retainer)',
      'Tenant relationship history (arrears, complaints, prior notices)',
    ],
    strategies,
    recommended_index: recommendedIndex,
    why_prompt:
      'Explain WHY the recommended strategy fits THIS owner THIS week. Reference the constraints by name and the evidence gathered from grounding tools.',
    downsides_prompt:
      'Name 1-2 specific things that could go wrong with the recommendation and what early warning signs to watch for (new arrears, vacancy spike, regulator inquiry).',
    retrospective_grade_plan:
      'Tell the owner how we will know in 30 / 60 / 90 days whether the recommendation was right. Cite the specific metric (collection rate, vacancy days, NOI, audit findings) that grades this decision.',
  };
};

export const reasonStrategizeTool: PersonaToolDescriptor<
  typeof ReasonStrategizeInput,
  typeof ReasonStrategizeOutput
> = {
  id: 'bossnyumba.reason.strategize',
  name: 'Multi-step strategic reasoning scaffold',
  description:
    'Use when the owner asks any strategic question of the form ' +
    '"what should I do?" / "should I X or Y?" / "is now the right time?" / ' +
    'Swahili "nifanyeje?" / "ni wakati sahihi?". Returns a STRUCTURED ' +
    'STRATEGY TRACE the chat turn uses as CONTEXT — the model composes ' +
    'the warm, owner-facing narrative itself using live entity / scope / ' +
    'jurisdiction grounding. The trace contains: current state prompt, ' +
    'constraints, 2-4 plausible strategies with pros / cons / confidence / ' +
    'evidence prompt, a recommended_index, a why prompt, a downsides ' +
    'prompt, and a retrospective grade plan. Use depth="thorough" for ' +
    'high-stakes decisions; default depth="quick" for fast turns.',
  personaSlugs: ALLOWED_PERSONAS,
  inputSchema: ReasonStrategizeInput,
  outputSchema: ReasonStrategizeOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, _ctx) {
    const depth = input.depth ?? 'quick';
    const trace = buildTrace(depth);
    return {
      question: input.question,
      scope_filter: input.scope_filter
        ? {
            ...(input.scope_filter.entity_type !== undefined && {
              entity_type: input.scope_filter.entity_type,
            }),
            ...(input.scope_filter.entity_id !== undefined && {
              entity_id: input.scope_filter.entity_id,
            }),
          }
        : null,
      depth,
      trace,
      grounding_tools: [...GROUNDING_TOOLS],
      compose_guidance: COMPOSE_GUIDANCE,
    };
  },
};

export const REASON_STRATEGIZE_TOOLS: ReadonlyArray<
  PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>
> = Object.freeze([
  reasonStrategizeTool,
] as unknown as readonly PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>[]);
