/**
 * Payment Risk Predictor Service
 * AI-powered payment risk assessment
 */

import OpenAI from 'openai';
import { z } from 'zod';
import { PAYMENT_RISK_PROMPT } from '../prompts/index.js';

export const PaymentRiskLevel = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  ELEVATED: 'ELEVATED',
  MODERATE: 'MODERATE',
  LOW: 'LOW',
} as const;

export type PaymentRiskLevel = (typeof PaymentRiskLevel)[keyof typeof PaymentRiskLevel];

export const PaymentPattern = {
  CONSISTENT_EARLY: 'CONSISTENT_EARLY',
  CONSISTENT_ON_TIME: 'CONSISTENT_ON_TIME',
  OCCASIONAL_LATE: 'OCCASIONAL_LATE',
  FREQUENTLY_LATE: 'FREQUENTLY_LATE',
  DETERIORATING: 'DETERIORATING',
  IMPROVING: 'IMPROVING',
  ERRATIC: 'ERRATIC',
  NEW_TENANT: 'NEW_TENANT',
} as const;

export type PaymentPattern = (typeof PaymentPattern)[keyof typeof PaymentPattern];

export interface PaymentCustomerData {
  customerId: string;
  currentBalance: number;
  monthlyRent: number;
  paymentsDue: number;
  paymentHistory: {
    last12Months: Array<{
      month: string;
      dueDate: string;
      paidDate?: string;
      amount: number;
      daysLate?: number;
      partialPayment?: boolean;
    }>;
    totalOnTime: number;
    totalLate: number;
    totalMissed: number;
    averageDaysLate: number;
  };
  financialIndicators?: {
    incomeToRentRatio?: number;
    employmentStatus?: 'employed' | 'self-employed' | 'unemployed' | 'retired' | 'unknown';
    recentJobChange?: boolean;
  };
  communicationSignals?: {
    paymentPlanRequests: number;
    hardshipMentions: number;
    unresponsivePeriods: number;
  };
}

export interface PaymentRiskFactor {
  factor: string;
  weight: number;
  category: 'behavioral' | 'financial' | 'communication' | 'external';
  trend: 'improving' | 'stable' | 'worsening';
  details: string;
}

export interface PaymentIntervention {
  action: string;
  type: 'preventive' | 'corrective' | 'escalation';
  timing: 'immediate' | 'before_due_date' | 'after_due_date' | 'ongoing';
  priority: 'critical' | 'high' | 'medium' | 'low';
  expectedOutcome: string;
  automatable: boolean;
}

export interface PaymentRiskResult {
  score: number;
  riskLevel: PaymentRiskLevel;
  confidence: number;
  pattern: PaymentPattern;
  factors: PaymentRiskFactor[];
  riskTrend: 'improving' | 'stable' | 'worsening';
  nextPaymentPrediction: {
    likelihood: 'on_time' | 'late' | 'at_risk' | 'likely_missed';
    expectedDaysLate?: number;
    confidence: number;
  };
  interventions: PaymentIntervention[];
  financialExposure: {
    currentExposure: number;
    projectedExposure30Days: number;
    projectedExposure90Days: number;
  };
  earlyWarningSignals: string[];
  reasoning: string;
}

const PaymentRiskResultSchema = z.object({
  score: z.number().min(0).max(100),
  riskLevel: z.enum(['CRITICAL', 'HIGH', 'ELEVATED', 'MODERATE', 'LOW']),
  confidence: z.number().min(0).max(1),
  pattern: z.enum(['CONSISTENT_EARLY', 'CONSISTENT_ON_TIME', 'OCCASIONAL_LATE',
    'FREQUENTLY_LATE', 'DETERIORATING', 'IMPROVING', 'ERRATIC', 'NEW_TENANT']),
  factors: z.array(z.object({
    factor: z.string(),
    weight: z.number().min(0).max(1),
    category: z.enum(['behavioral', 'financial', 'communication', 'external']),
    trend: z.enum(['improving', 'stable', 'worsening']),
    details: z.string(),
  })),
  riskTrend: z.enum(['improving', 'stable', 'worsening']),
  nextPaymentPrediction: z.object({
    likelihood: z.enum(['on_time', 'late', 'at_risk', 'likely_missed']),
    expectedDaysLate: z.number().optional(),
    confidence: z.number().min(0).max(1),
  }),
  interventions: z.array(z.object({
    action: z.string(),
    type: z.enum(['preventive', 'corrective', 'escalation']),
    timing: z.enum(['immediate', 'before_due_date', 'after_due_date', 'ongoing']),
    priority: z.enum(['critical', 'high', 'medium', 'low']),
    expectedOutcome: z.string(),
    automatable: z.boolean(),
  })),
  financialExposure: z.object({
    currentExposure: z.number(),
    projectedExposure30Days: z.number(),
    projectedExposure90Days: z.number(),
  }),
  earlyWarningSignals: z.array(z.string()),
  reasoning: z.string(),
});

export interface PaymentRiskConfig {
  openaiApiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export class PaymentRiskService {
  private openai: OpenAI;
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor(config: PaymentRiskConfig) {
    this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    this.model = config.model ?? 'gpt-4-turbo-preview';
    this.temperature = config.temperature ?? 0.2;
    this.maxTokens = config.maxTokens ?? 2048;
  }

  async predictPaymentRisk(customerId: string, data?: Partial<PaymentCustomerData>): Promise<PaymentRiskResult> {
    const customerData = this.buildCustomerData(customerId, data);

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: PAYMENT_RISK_PROMPT.system },
        { role: 'user', content: `${PAYMENT_RISK_PROMPT.user}\n\nCustomer Data:\n${JSON.stringify(customerData, null, 2)}` },
      ],
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response from OpenAI');

    return PaymentRiskResultSchema.parse(JSON.parse(content));
  }

  private buildCustomerData(customerId: string, data?: Partial<PaymentCustomerData>): PaymentCustomerData {
    return {
      customerId,
      currentBalance: data?.currentBalance ?? 0,
      monthlyRent: data?.monthlyRent ?? 0,
      paymentsDue: data?.paymentsDue ?? 0,
      paymentHistory: data?.paymentHistory ?? {
        last12Months: [],
        totalOnTime: 0,
        totalLate: 0,
        totalMissed: 0,
        averageDaysLate: 0,
      },
      financialIndicators: data?.financialIndicators,
      communicationSignals: data?.communicationSignals,
    };
  }
}

export function createPaymentRiskService(config: PaymentRiskConfig): PaymentRiskService {
  return new PaymentRiskService(config);
}

export async function predictPaymentRisk(
  customerId: string,
  data?: Partial<PaymentCustomerData>,
  config?: Partial<PaymentRiskConfig>
): Promise<PaymentRiskResult> {
  const apiKey = config?.openaiApiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key is required');
  const service = createPaymentRiskService({ openaiApiKey: apiKey, ...config });
  return service.predictPaymentRisk(customerId, data);
}
