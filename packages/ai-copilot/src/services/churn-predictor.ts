/**
 * Churn Predictor Service
 * AI-powered tenant churn risk prediction
 */

import OpenAI from 'openai';
import { z } from 'zod';
import { CHURN_PREDICTION_PROMPT } from '../prompts/index.js';

export const ChurnRiskLevel = {
  VERY_HIGH: 'VERY_HIGH',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  VERY_LOW: 'VERY_LOW',
} as const;

export type ChurnRiskLevel = (typeof ChurnRiskLevel)[keyof typeof ChurnRiskLevel];

export interface CustomerData {
  customerId: string;
  tenantSince: string;
  leaseEndDate: string;
  rentAmount: number;
  paymentHistory: {
    onTimePayments: number;
    latePayments: number;
    missedPayments: number;
    averageDaysLate?: number;
  };
  maintenanceRequests: {
    total: number;
    openCount: number;
    averageResolutionDays: number;
    satisfactionRating?: number;
  };
  communicationHistory: {
    complaintsCount: number;
    inquiriesCount: number;
    lastContactDate?: string;
    sentimentTrend?: 'positive' | 'neutral' | 'negative' | 'declining';
  };
  renewalHistory?: { previousRenewals: number; declinedOffers: number };
  marketContext?: {
    areaRentTrend: 'increasing' | 'stable' | 'decreasing';
    competitorAvailability: 'high' | 'medium' | 'low';
    marketRentComparison: number;
  };
}

export interface ChurnDriver {
  factor: string;
  impact: 'high' | 'medium' | 'low';
  direction: 'increases_risk' | 'decreases_risk';
  details: string;
  actionable: boolean;
}

export interface RetentionRecommendation {
  action: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  expectedImpact: string;
  estimatedCost?: string;
  timeframe: string;
}

export interface ChurnPredictionResult {
  score: number;
  riskLevel: ChurnRiskLevel;
  confidence: number;
  drivers: ChurnDriver[];
  positiveFactors: string[];
  warningSignals: string[];
  retentionRecommendations: RetentionRecommendation[];
  predictedChurnWindow?: string;
  lifetimeValueAtRisk: number;
  renewalProbability: number;
  reasoning: string;
}

const ChurnPredictionResultSchema = z.object({
  score: z.number().min(0).max(100),
  riskLevel: z.enum(['VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW', 'VERY_LOW']),
  confidence: z.number().min(0).max(1),
  drivers: z.array(z.object({
    factor: z.string(),
    impact: z.enum(['high', 'medium', 'low']),
    direction: z.enum(['increases_risk', 'decreases_risk']),
    details: z.string(),
    actionable: z.boolean(),
  })),
  positiveFactors: z.array(z.string()),
  warningSignals: z.array(z.string()),
  retentionRecommendations: z.array(z.object({
    action: z.string(),
    priority: z.enum(['critical', 'high', 'medium', 'low']),
    expectedImpact: z.string(),
    estimatedCost: z.string().optional(),
    timeframe: z.string(),
  })),
  predictedChurnWindow: z.string().optional(),
  lifetimeValueAtRisk: z.number(),
  renewalProbability: z.number().min(0).max(1),
  reasoning: z.string(),
});

export interface ChurnPredictorConfig {
  openaiApiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export class ChurnPredictorService {
  private openai: OpenAI;
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor(config: ChurnPredictorConfig) {
    this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    this.model = config.model ?? 'gpt-4-turbo-preview';
    this.temperature = config.temperature ?? 0.3;
    this.maxTokens = config.maxTokens ?? 2048;
  }

  async predictChurnRisk(customerId: string, data?: Partial<CustomerData>): Promise<ChurnPredictionResult> {
    const customerContext = this.buildCustomerContext(customerId, data);

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: CHURN_PREDICTION_PROMPT.system },
        { role: 'user', content: `${CHURN_PREDICTION_PROMPT.user}\n\nCustomer Data:\n${JSON.stringify(customerContext, null, 2)}` },
      ],
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response from OpenAI');

    return ChurnPredictionResultSchema.parse(JSON.parse(content));
  }

  private buildCustomerContext(customerId: string, data?: Partial<CustomerData>): CustomerData {
    return {
      customerId,
      tenantSince: data?.tenantSince ?? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
      leaseEndDate: data?.leaseEndDate ?? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      rentAmount: data?.rentAmount ?? 0,
      paymentHistory: data?.paymentHistory ?? { onTimePayments: 0, latePayments: 0, missedPayments: 0 },
      maintenanceRequests: data?.maintenanceRequests ?? { total: 0, openCount: 0, averageResolutionDays: 0 },
      communicationHistory: data?.communicationHistory ?? { complaintsCount: 0, inquiriesCount: 0 },
      renewalHistory: data?.renewalHistory,
      marketContext: data?.marketContext,
    };
  }
}

export function createChurnPredictorService(config: ChurnPredictorConfig): ChurnPredictorService {
  return new ChurnPredictorService(config);
}

export async function predictChurnRisk(
  customerId: string,
  data?: Partial<CustomerData>,
  config?: Partial<ChurnPredictorConfig>
): Promise<ChurnPredictionResult> {
  const apiKey = config?.openaiApiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key is required');
  const service = createChurnPredictorService({ openaiApiKey: apiKey, ...config });
  return service.predictChurnRisk(customerId, data);
}
