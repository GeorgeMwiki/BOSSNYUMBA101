/**
 * Vendor Matcher Service
 *
 * Ranks vendors against a work order on skills, location (service area),
 * SLA / availability, rating and price band. Uses the AnthropicProvider
 * with Haiku as the default (classification/matching is a cheap, high
 * throughput use case). Falls back to OpenAI when an openaiApiKey is
 * provided, preserving legacy callers.
 *
 * All LLM output is validated with zod before it reaches the caller; if
 * the model returns something malformed the service falls back to a
 * deterministic scoring heuristic so the work order is never left
 * unassigned because of a parser failure.
 */

import OpenAI from 'openai';
import { z } from 'zod';
import { VENDOR_MATCHING_PROMPT } from '../prompts/index.js';
import {
  AnthropicProvider,
  type AnthropicProviderConfig,
} from '../providers/anthropic-provider.js';
import { DEFAULT_MODEL_DEFAULTS, ModelTask, modelForTask } from '../providers/model-defaults.js';
import { asPromptId } from '../types/core.types.js';
import type { CompiledPrompt } from '../types/prompt.types.js';

export const VendorSpecialty = {
  PLUMBING: 'PLUMBING',
  ELECTRICAL: 'ELECTRICAL',
  HVAC: 'HVAC',
  APPLIANCE_REPAIR: 'APPLIANCE_REPAIR',
  GENERAL_MAINTENANCE: 'GENERAL_MAINTENANCE',
  CARPENTRY: 'CARPENTRY',
  PAINTING: 'PAINTING',
  ROOFING: 'ROOFING',
  FLOORING: 'FLOORING',
  PEST_CONTROL: 'PEST_CONTROL',
  LANDSCAPING: 'LANDSCAPING',
  CLEANING: 'CLEANING',
  LOCKSMITH: 'LOCKSMITH',
} as const;

export type VendorSpecialty = (typeof VendorSpecialty)[keyof typeof VendorSpecialty];

// ---------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------

export const WorkOrderInputSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  urgency: z.enum(['emergency', 'urgent', 'high', 'standard', 'low']),
  property: z.object({
    id: z.string(),
    name: z.string(),
    address: z.string(),
    type: z.string(),
  }),
  estimatedComplexity: z.number().int().min(1).max(5).optional(),
  requiredSkills: z.array(z.string()).optional(),
  preferredSchedule: z
    .object({
      earliest: z.string(),
      latest: z.string(),
      timePreference: z
        .enum(['morning', 'afternoon', 'evening', 'any'])
        .optional(),
    })
    .optional(),
  budget: z
    .object({
      min: z.number().nonnegative().optional(),
      max: z.number().nonnegative().optional(),
      currency: z.string().min(3).max(3),
    })
    .optional(),
  /** SLA target in hours for response/first-attendance; used in heuristic rank */
  slaHoursTarget: z.number().positive().optional(),
});

export type WorkOrderInput = z.infer<typeof WorkOrderInputSchema>;

export const VendorProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  specialties: z.array(z.string()),
  serviceArea: z.array(z.string()).min(1),
  ratings: z.object({
    overall: z.number().min(0).max(5),
    quality: z.number().min(0).max(5),
    reliability: z.number().min(0).max(5),
    communication: z.number().min(0).max(5),
    value: z.number().min(0).max(5),
  }),
  metrics: z.object({
    completedJobs: z.number().int().nonnegative(),
    /** Average hours from request to on-site */
    averageResponseTime: z.number().nonnegative(),
    /** Percent 0-100 */
    onTimeCompletion: z.number().min(0).max(100),
    /** Percent 0-100: callbacks for the same issue */
    repeatCallRate: z.number().min(0).max(100),
  }),
  availability: z.object({
    nextAvailable: z.string(),
    emergencyAvailable: z.boolean(),
    weekendAvailable: z.boolean(),
  }),
  pricing: z.object({
    hourlyRate: z.number().nonnegative().optional(),
    callOutFee: z.number().nonnegative().optional(),
    emergencyMultiplier: z.number().positive().optional(),
  }),
});

export type VendorProfile = z.infer<typeof VendorProfileSchema>;

// ---------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------

const VendorMatchSchema = z.object({
  vendorId: z.string(),
  vendorName: z.string(),
  matchScore: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  ranking: z.number().int().positive(),
  matchReasons: z.array(z.string()),
  concerns: z.array(z.string()),
  estimatedCost: z
    .object({
      min: z.number(),
      max: z.number(),
      currency: z.string(),
    })
    .optional(),
  estimatedSchedule: z
    .object({ responseTime: z.string(), completionTime: z.string() })
    .optional(),
  compatibilityFactors: z.object({
    skillMatch: z.number().min(0).max(1),
    availabilityMatch: z.number().min(0).max(1),
    locationMatch: z.number().min(0).max(1),
    budgetMatch: z.number().min(0).max(1),
    performanceScore: z.number().min(0).max(1),
  }),
});

export type VendorMatch = z.infer<typeof VendorMatchSchema>;

const VendorMatchingResultSchema = z.object({
  workOrderId: z.string(),
  rankedVendors: z.array(VendorMatchSchema),
  topRecommendation: z.object({
    vendor: VendorMatchSchema,
    reasoning: z.string(),
    alternativeScenarios: z.array(
      z.object({ scenario: z.string(), recommendedVendor: z.string() })
    ),
  }),
  matchingInsights: z.object({
    keyFactors: z.array(z.string()),
    marketAvailability: z.enum(['abundant', 'adequate', 'limited', 'scarce']),
    pricingContext: z.string(),
    urgencyConsiderations: z.array(z.string()),
  }),
  warnings: z.array(z.string()),
  autoAssignmentRecommended: z.boolean(),
  autoAssignmentReason: z.string().optional(),
});

export type VendorMatchingResult = z.infer<typeof VendorMatchingResultSchema>;

// ---------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------

export interface VendorMatcherConfig {
  /** Anthropic API key - preferred. */
  anthropicApiKey?: string;
  /** Legacy OpenAI key; only used if anthropicApiKey is not provided. */
  openaiApiKey?: string;
  /** Override the default model (Haiku for matching). */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Injectable AnthropicProvider, primarily for tests. */
  anthropicProvider?: AnthropicProvider;
  /** Extra Anthropic config (base URL, beta headers, etc). */
  anthropicConfig?: Partial<AnthropicProviderConfig>;
}

// ---------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------

export class VendorMatcherService {
  private readonly anthropic?: AnthropicProvider;
  private readonly openai?: OpenAI;
  private readonly model: string;
  private readonly temperature: number;
  private readonly maxTokens: number;

  constructor(config: VendorMatcherConfig) {
    if (config.anthropicProvider) {
      this.anthropic = config.anthropicProvider;
    } else if (config.anthropicApiKey) {
      this.anthropic = new AnthropicProvider({
        apiKey: config.anthropicApiKey,
        ...config.anthropicConfig,
      });
    } else if (config.openaiApiKey) {
      this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    } else {
      throw new Error(
        'VendorMatcherService requires anthropicApiKey, openaiApiKey, or an anthropicProvider.'
      );
    }

    this.model =
      config.model ??
      (this.anthropic
        ? modelForTask(ModelTask.MATCHING, DEFAULT_MODEL_DEFAULTS)
        : 'gpt-4-turbo-preview');
    this.temperature = config.temperature ?? 0.2;
    this.maxTokens = config.maxTokens ?? 2048;
  }

  async matchVendor(
    rawWorkOrder: WorkOrderInput,
    availableVendors?: VendorProfile[]
  ): Promise<VendorMatchingResult> {
    const workOrder = WorkOrderInputSchema.parse(rawWorkOrder);
    const vendors = (availableVendors ?? this.getMockVendors()).map((v) =>
      VendorProfileSchema.parse(v)
    );

    const userPrompt =
      `${VENDOR_MATCHING_PROMPT.user}\n\nWork Order:\n${JSON.stringify(
        workOrder,
        null,
        2
      )}\n\nAvailable Vendors:\n${JSON.stringify(vendors, null, 2)}\n\n` +
      `Respond ONLY with a JSON object matching the schema above. Do not include any prose outside the JSON.`;

    const raw = this.anthropic
      ? await this.callAnthropic(userPrompt)
      : await this.callOpenAI(userPrompt);

    const parsed = VendorMatchingResultSchema.safeParse(this.safeJsonParse(raw));
    if (parsed.success) return parsed.data;

    // Deterministic fallback on model/parse failure so the caller still
    // gets a usable ranking.
    return this.heuristicMatch(workOrder, vendors, parsed.error.issues);
  }

  // -----------------------------------------------------------------
  // LLM call paths
  // -----------------------------------------------------------------

  private async callAnthropic(userPrompt: string): Promise<string> {
    const compiled: CompiledPrompt = {
      promptId: asPromptId('vendor-matching'),
      version: '1.0.0',
      systemPrompt: VENDOR_MATCHING_PROMPT.system,
      userPrompt,
      modelConfig: {
        modelId: this.model,
        maxTokens: this.maxTokens,
        temperature: this.temperature,
      },
      guardrails: {},
    };
    const result = await this.anthropic!.complete({
      prompt: compiled,
      jsonMode: true,
    });
    if (result.success === false) {
      throw new Error(
        `Anthropic vendor-matcher call failed: ${result.error.message}`
      );
    }
    return result.data.content;
  }

  private async callOpenAI(userPrompt: string): Promise<string> {
    const response = await this.openai!.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: VENDOR_MATCHING_PROMPT.system },
        { role: 'user', content: userPrompt },
      ],
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      response_format: { type: 'json_object' },
    });
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response from OpenAI');
    return content;
  }

  private safeJsonParse(raw: string): unknown {
    try {
      return JSON.parse(raw);
    } catch {
      // Try to extract the first {...} block; models occasionally wrap
      // JSON in markdown fences despite instructions.
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return null;
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
  }

  // -----------------------------------------------------------------
  // Heuristic fallback (also used when no vendors pass model filtering)
  // -----------------------------------------------------------------

  private heuristicMatch(
    workOrder: WorkOrderInput,
    vendors: VendorProfile[],
    validationIssues: unknown[] = []
  ): VendorMatchingResult {
    const priceBand = workOrder.budget;
    const scored = vendors.map((v) => {
      const skillMatch = this.skillAffinity(workOrder, v);
      const locationMatch = v.serviceArea.some((a) =>
        workOrder.property.address.toLowerCase().includes(a.toLowerCase())
      )
        ? 1
        : 0.4;
      const availabilityMatch =
        workOrder.urgency === 'emergency'
          ? v.availability.emergencyAvailable
            ? 1
            : 0.1
          : 0.8;
      const performanceScore = Math.min(
        1,
        (v.ratings.overall / 5) * 0.5 +
          (v.metrics.onTimeCompletion / 100) * 0.35 +
          Math.max(0, 1 - v.metrics.repeatCallRate / 100) * 0.15
      );
      const budgetMatch = this.priceBandFit(v, priceBand);
      const matchScore =
        (skillMatch * 0.3 +
          availabilityMatch * 0.2 +
          locationMatch * 0.15 +
          performanceScore * 0.25 +
          budgetMatch * 0.1) *
        100;
      return {
        vendor: v,
        skillMatch,
        availabilityMatch,
        locationMatch,
        performanceScore,
        budgetMatch,
        matchScore,
      };
    });
    scored.sort((a, b) => b.matchScore - a.matchScore);

    const rankedVendors: VendorMatch[] = scored.map((s, idx) => ({
      vendorId: s.vendor.id,
      vendorName: s.vendor.name,
      matchScore: Number(s.matchScore.toFixed(1)),
      confidence: 0.6,
      ranking: idx + 1,
      matchReasons: this.heuristicReasons(s),
      concerns:
        s.budgetMatch < 0.5
          ? ['Vendor pricing may exceed stated budget band.']
          : [],
      compatibilityFactors: {
        skillMatch: s.skillMatch,
        availabilityMatch: s.availabilityMatch,
        locationMatch: s.locationMatch,
        budgetMatch: s.budgetMatch,
        performanceScore: s.performanceScore,
      },
    }));

    const top = rankedVendors[0];
    const warnings =
      validationIssues.length > 0
        ? [
            'Model response failed validation; served deterministic heuristic ranking.',
          ]
        : [];

    return {
      workOrderId: workOrder.id,
      rankedVendors,
      topRecommendation: {
        vendor: top,
        reasoning: `Top match based on skill coverage (${(scored[0].skillMatch * 100).toFixed(
          0
        )}%), service-area fit and historical performance (${scored[0].performanceScore.toFixed(
          2
        )}).`,
        alternativeScenarios: rankedVendors.slice(1, 3).map((v) => ({
          scenario: `If ${top.vendorName} is unavailable`,
          recommendedVendor: v.vendorName,
        })),
      },
      matchingInsights: {
        keyFactors: [
          'skill match',
          'service-area coverage',
          'SLA and availability',
          'historical ratings',
          'price band fit',
        ],
        marketAvailability:
          vendors.length >= 5
            ? 'abundant'
            : vendors.length >= 3
              ? 'adequate'
              : vendors.length >= 1
                ? 'limited'
                : 'scarce',
        pricingContext:
          priceBand?.max !== undefined
            ? `Budget ceiling ${priceBand.max} ${priceBand.currency}`
            : 'No explicit budget provided',
        urgencyConsiderations:
          workOrder.urgency === 'emergency'
            ? ['Prefer vendors with emergencyAvailable = true']
            : [],
      },
      warnings,
      autoAssignmentRecommended:
        top?.matchScore >= 80 &&
        scored[0].skillMatch === 1 &&
        scored[0].availabilityMatch >= 0.8,
      autoAssignmentReason:
        top?.matchScore >= 80
          ? 'High-confidence heuristic match with strong skill and availability alignment.'
          : undefined,
    };
  }

  private skillAffinity(
    workOrder: WorkOrderInput,
    vendor: VendorProfile
  ): number {
    const required = (workOrder.requiredSkills ?? [workOrder.category]).map(
      (s) => s.toUpperCase()
    );
    const covered = vendor.specialties.map((s) => s.toUpperCase());
    if (required.length === 0) return 0.5;
    const matched = required.filter((r) =>
      covered.some((c) => c === r || c.includes(r) || r.includes(c))
    );
    return matched.length / required.length;
  }

  private priceBandFit(
    vendor: VendorProfile,
    band: WorkOrderInput['budget']
  ): number {
    if (!band?.max || !vendor.pricing.hourlyRate) return 0.75;
    const estimate = vendor.pricing.hourlyRate * 2 +
      (vendor.pricing.callOutFee ?? 0);
    if (estimate <= band.max) return 1;
    const overrun = (estimate - band.max) / band.max;
    return Math.max(0, 1 - overrun);
  }

  private heuristicReasons(s: {
    skillMatch: number;
    availabilityMatch: number;
    locationMatch: number;
    performanceScore: number;
    budgetMatch: number;
  }): string[] {
    const reasons: string[] = [];
    if (s.skillMatch >= 0.9) reasons.push('Full skill coverage for this job');
    else if (s.skillMatch >= 0.5) reasons.push('Partial skill coverage');
    if (s.availabilityMatch >= 0.9) reasons.push('Available within SLA window');
    if (s.locationMatch === 1) reasons.push('Serves this location directly');
    if (s.performanceScore >= 0.8)
      reasons.push('Strong historical performance and ratings');
    if (s.budgetMatch >= 0.9) reasons.push('Within stated price band');
    return reasons;
  }

  private getMockVendors(): VendorProfile[] {
    return [
      {
        id: 'vendor-001',
        name: 'Premium Property Services',
        specialties: [
          'PLUMBING',
          'ELECTRICAL',
          'HVAC',
          'GENERAL_MAINTENANCE',
        ],
        serviceArea: ['Nairobi', 'Kiambu'],
        ratings: {
          overall: 4.8,
          quality: 4.9,
          reliability: 4.7,
          communication: 4.8,
          value: 4.5,
        },
        metrics: {
          completedJobs: 250,
          averageResponseTime: 2,
          onTimeCompletion: 95,
          repeatCallRate: 5,
        },
        availability: {
          nextAvailable: new Date().toISOString(),
          emergencyAvailable: true,
          weekendAvailable: true,
        },
        pricing: {
          hourlyRate: 2500,
          callOutFee: 500,
          emergencyMultiplier: 1.5,
        },
      },
      {
        id: 'vendor-002',
        name: 'Quick Fix Maintenance',
        specialties: ['GENERAL_MAINTENANCE', 'CARPENTRY', 'PAINTING'],
        serviceArea: ['Nairobi'],
        ratings: {
          overall: 4.2,
          quality: 4.0,
          reliability: 4.3,
          communication: 4.5,
          value: 4.8,
        },
        metrics: {
          completedJobs: 180,
          averageResponseTime: 4,
          onTimeCompletion: 88,
          repeatCallRate: 12,
        },
        availability: {
          nextAvailable: new Date().toISOString(),
          emergencyAvailable: false,
          weekendAvailable: true,
        },
        pricing: { hourlyRate: 1500, callOutFee: 300 },
      },
    ];
  }
}

export function createVendorMatcherService(
  config: VendorMatcherConfig
): VendorMatcherService {
  return new VendorMatcherService(config);
}

export async function matchVendor(
  workOrder: WorkOrderInput,
  availableVendors?: VendorProfile[],
  config?: Partial<VendorMatcherConfig>
): Promise<VendorMatchingResult> {
  const anthropicApiKey =
    config?.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY;
  const openaiApiKey = config?.openaiApiKey ?? process.env.OPENAI_API_KEY;
  if (!anthropicApiKey && !openaiApiKey && !config?.anthropicProvider) {
    throw new Error(
      'ANTHROPIC_API_KEY or OPENAI_API_KEY is required for vendor matching.'
    );
  }
  const service = createVendorMatcherService({
    anthropicApiKey,
    openaiApiKey,
    ...config,
  });
  return service.matchVendor(workOrder, availableVendors);
}
