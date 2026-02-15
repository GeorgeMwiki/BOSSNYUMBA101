/**
 * Vendor Matcher Service
 * AI-powered vendor matching for work orders
 */

import OpenAI from 'openai';
import { z } from 'zod';
import { VENDOR_MATCHING_PROMPT } from '../prompts/index.js';

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

export interface WorkOrderInput {
  id: string;
  title: string;
  description: string;
  category: string;
  urgency: 'emergency' | 'urgent' | 'high' | 'standard' | 'low';
  property: { id: string; name: string; address: string; type: string };
  estimatedComplexity?: number;
  requiredSkills?: string[];
  preferredSchedule?: { earliest: string; latest: string; timePreference?: 'morning' | 'afternoon' | 'evening' | 'any' };
  budget?: { min?: number; max?: number; currency: string };
}

export interface VendorProfile {
  id: string;
  name: string;
  specialties: VendorSpecialty[];
  serviceArea: string[];
  ratings: { overall: number; quality: number; reliability: number; communication: number; value: number };
  metrics: { completedJobs: number; averageResponseTime: number; onTimeCompletion: number; repeatCallRate: number };
  availability: { nextAvailable: string; emergencyAvailable: boolean; weekendAvailable: boolean };
  pricing: { hourlyRate?: number; callOutFee?: number; emergencyMultiplier?: number };
}

export interface VendorMatch {
  vendorId: string;
  vendorName: string;
  matchScore: number;
  confidence: number;
  ranking: number;
  matchReasons: string[];
  concerns: string[];
  estimatedCost?: { min: number; max: number; currency: string };
  estimatedSchedule?: { responseTime: string; completionTime: string };
  compatibilityFactors: {
    skillMatch: number;
    availabilityMatch: number;
    locationMatch: number;
    budgetMatch: number;
    performanceScore: number;
  };
}

export interface VendorMatchingResult {
  workOrderId: string;
  rankedVendors: VendorMatch[];
  topRecommendation: {
    vendor: VendorMatch;
    reasoning: string;
    alternativeScenarios: Array<{ scenario: string; recommendedVendor: string }>;
  };
  matchingInsights: {
    keyFactors: string[];
    marketAvailability: 'abundant' | 'adequate' | 'limited' | 'scarce';
    pricingContext: string;
    urgencyConsiderations: string[];
  };
  warnings: string[];
  autoAssignmentRecommended: boolean;
  autoAssignmentReason?: string;
}

const VendorMatchSchema = z.object({
  vendorId: z.string(),
  vendorName: z.string(),
  matchScore: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  ranking: z.number(),
  matchReasons: z.array(z.string()),
  concerns: z.array(z.string()),
  estimatedCost: z.object({ min: z.number(), max: z.number(), currency: z.string() }).optional(),
  estimatedSchedule: z.object({ responseTime: z.string(), completionTime: z.string() }).optional(),
  compatibilityFactors: z.object({
    skillMatch: z.number().min(0).max(1),
    availabilityMatch: z.number().min(0).max(1),
    locationMatch: z.number().min(0).max(1),
    budgetMatch: z.number().min(0).max(1),
    performanceScore: z.number().min(0).max(1),
  }),
});

const VendorMatchingResultSchema = z.object({
  workOrderId: z.string(),
  rankedVendors: z.array(VendorMatchSchema),
  topRecommendation: z.object({
    vendor: VendorMatchSchema,
    reasoning: z.string(),
    alternativeScenarios: z.array(z.object({ scenario: z.string(), recommendedVendor: z.string() })),
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

export interface VendorMatcherConfig {
  openaiApiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export class VendorMatcherService {
  private openai: OpenAI;
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor(config: VendorMatcherConfig) {
    this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    this.model = config.model ?? 'gpt-4-turbo-preview';
    this.temperature = config.temperature ?? 0.3;
    this.maxTokens = config.maxTokens ?? 2048;
  }

  async matchVendor(workOrder: WorkOrderInput, availableVendors?: VendorProfile[]): Promise<VendorMatchingResult> {
    const vendors = availableVendors ?? this.getMockVendors();

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: VENDOR_MATCHING_PROMPT.system },
        { role: 'user', content: `${VENDOR_MATCHING_PROMPT.user}\n\nWork Order:\n${JSON.stringify(workOrder, null, 2)}\n\nAvailable Vendors:\n${JSON.stringify(vendors, null, 2)}` },
      ],
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response from OpenAI');

    return VendorMatchingResultSchema.parse(JSON.parse(content));
  }

  private getMockVendors(): VendorProfile[] {
    return [
      {
        id: 'vendor-001',
        name: 'Premium Property Services',
        specialties: ['PLUMBING', 'ELECTRICAL', 'HVAC', 'GENERAL_MAINTENANCE'] as VendorSpecialty[],
        serviceArea: ['Nairobi', 'Kiambu'],
        ratings: { overall: 4.8, quality: 4.9, reliability: 4.7, communication: 4.8, value: 4.5 },
        metrics: { completedJobs: 250, averageResponseTime: 2, onTimeCompletion: 95, repeatCallRate: 5 },
        availability: { nextAvailable: new Date().toISOString(), emergencyAvailable: true, weekendAvailable: true },
        pricing: { hourlyRate: 2500, callOutFee: 500, emergencyMultiplier: 1.5 },
      },
      {
        id: 'vendor-002',
        name: 'Quick Fix Maintenance',
        specialties: ['GENERAL_MAINTENANCE', 'CARPENTRY', 'PAINTING'] as VendorSpecialty[],
        serviceArea: ['Nairobi'],
        ratings: { overall: 4.2, quality: 4.0, reliability: 4.3, communication: 4.5, value: 4.8 },
        metrics: { completedJobs: 180, averageResponseTime: 4, onTimeCompletion: 88, repeatCallRate: 12 },
        availability: { nextAvailable: new Date().toISOString(), emergencyAvailable: false, weekendAvailable: true },
        pricing: { hourlyRate: 1500, callOutFee: 300 },
      },
    ];
  }
}

export function createVendorMatcherService(config: VendorMatcherConfig): VendorMatcherService {
  return new VendorMatcherService(config);
}

export async function matchVendor(
  workOrder: WorkOrderInput,
  availableVendors?: VendorProfile[],
  config?: Partial<VendorMatcherConfig>
): Promise<VendorMatchingResult> {
  const apiKey = config?.openaiApiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key is required');
  const service = createVendorMatcherService({ openaiApiKey: apiKey, ...config });
  return service.matchVendor(workOrder, availableVendors);
}
