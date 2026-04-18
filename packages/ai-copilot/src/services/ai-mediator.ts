/**
 * ai-mediator — shared Anthropic-backed wrappers for mediation,
 * negotiation, report narration, and letter drafting. Services import
 * these functions to avoid each re-implementing the prompt + schema
 * plumbing. Fall back to deterministic stubs when ANTHROPIC_API_KEY
 * is unset.
 */

import { z } from 'zod';
import {
  createAnthropicClient,
  generateStructured,
  ModelTier,
  type AnthropicClient,
} from '../providers/anthropic-client.js';

function getClient(): AnthropicClient | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    return createAnthropicClient({
      apiKey,
      defaultModel: ModelTier.SONNET,
    });
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// 1. Damage-deduction mediator turn
// ─────────────────────────────────────────────────────────────

export const DamageMediatorTurnSchema = z.object({
  proposedDeductionMinor: z.number().int().nonnegative(),
  rationale: z.string().min(1),
  turnText: z.string().min(1),
  escalate: z.boolean(),
});
export type DamageMediatorTurn = z.infer<typeof DamageMediatorTurnSchema>;

export interface DamageMediatorInput {
  readonly claimedDeductionMinor: number;
  readonly tenantCounterMinor: number | null;
  readonly findings: ReadonlyArray<{ component: string; severity: string; note?: string }>;
  readonly priorTurns: ReadonlyArray<{ actor: string; text: string }>;
  readonly floorMinor: number;
  readonly ceilingMinor: number;
  readonly advisorGate?: boolean;
}

export async function draftDamageMediatorTurn(
  input: DamageMediatorInput
): Promise<DamageMediatorTurn> {
  const client = getClient();
  if (!client) {
    // Deterministic fallback — split-the-difference.
    const counter = input.tenantCounterMinor ?? 0;
    const proposed = Math.max(
      input.floorMinor,
      Math.min(input.ceilingMinor, Math.round((input.claimedDeductionMinor + counter) / 2))
    );
    return {
      proposedDeductionMinor: proposed,
      rationale:
        'Deterministic fallback (no ANTHROPIC_API_KEY). Used midpoint of claim and tenant counter, clamped to floor/ceiling.',
      turnText: `Proposed settlement: ${proposed} (midpoint). Agree to close the case?`,
      escalate: proposed < input.floorMinor || proposed > input.ceilingMinor,
    };
  }

  const prompt = JSON.stringify(input, null, 2);
  const result = await generateStructured(client, {
    prompt,
    schema: DamageMediatorTurnSchema,
    systemPrompt:
      'You are a neutral Harvard-trained property mediator. Propose a fair deduction based on evidence, prior turns, and the statutory floor/ceiling. Always return JSON matching the schema.',
    advisorGate: input.advisorGate ?? false,
  });
  return result.data;
}

// ─────────────────────────────────────────────────────────────
// 2. Negotiation counter-offer (policy-sandboxed; caller enforces floor)
// ─────────────────────────────────────────────────────────────

export const NegotiationCounterSchema = z.object({
  offerMinor: z.number().int().positive(),
  concessions: z.array(z.string()).default([]),
  rationale: z.string().min(1),
  walkAway: z.boolean(),
});
export type NegotiationCounter = z.infer<typeof NegotiationCounterSchema>;

export interface NegotiationCounterInput {
  readonly listPriceMinor: number;
  readonly floorPriceMinor: number;
  readonly lowerBoundMinor: number;
  readonly currentOfferMinor: number;
  readonly prospectReply: string;
  readonly toneGuide: 'firm' | 'warm' | 'flexible';
  readonly roundCount: number;
}

export async function draftNegotiationCounter(
  input: NegotiationCounterInput
): Promise<NegotiationCounter> {
  const client = getClient();
  if (!client) {
    const step = Math.max(
      1,
      Math.round((input.listPriceMinor - input.lowerBoundMinor) / 10)
    );
    const offer = Math.max(input.lowerBoundMinor, input.currentOfferMinor - step);
    return {
      offerMinor: offer,
      concessions: [],
      rationale: 'Deterministic fallback (no ANTHROPIC_API_KEY). Reduced current offer by 10% of list-to-floor range.',
      walkAway: false,
    };
  }

  const result = await generateStructured(client, {
    prompt: JSON.stringify(input, null, 2),
    schema: NegotiationCounterSchema,
    systemPrompt: `You are a professional leasing broker with a ${input.toneGuide} tone. Propose a counter-offer strictly at or above ${input.lowerBoundMinor}. Never go below that number. Return JSON.`,
  });
  return result.data;
}

// ─────────────────────────────────────────────────────────────
// 3. Conditional-survey narrative
// ─────────────────────────────────────────────────────────────

export const SurveyNarrativeSchema = z.object({
  headline: z.string(),
  narrative: z.string(),
  riskFlags: z.array(z.string()),
  recommendedActions: z.array(
    z.object({
      component: z.string(),
      priority: z.enum(['low', 'medium', 'high', 'critical']),
      action: z.string(),
      estimatedCostMinor: z.number().int().nonnegative().optional(),
      slaDays: z.number().int().positive().optional(),
    })
  ),
});
export type SurveyNarrative = z.infer<typeof SurveyNarrativeSchema>;

export async function composeSurveyNarrative(input: {
  readonly findings: ReadonlyArray<{ component: string; severity: string; note?: string }>;
  readonly priorSurveyFindings?: ReadonlyArray<{ component: string; severity: string }>;
  readonly criticalPresent: boolean;
}): Promise<SurveyNarrative> {
  const client = getClient();
  if (!client) {
    const flags = input.findings
      .filter((f) => f.severity === 'critical' || f.severity === 'major')
      .map((f) => `${f.component}: ${f.severity}`);
    return {
      headline: `Conditional Survey — ${input.findings.length} findings`,
      narrative: `Deterministic fallback narrative. ${input.findings.length} findings detected.`,
      riskFlags: flags,
      recommendedActions: input.findings.map((f) => ({
        component: f.component,
        priority:
          f.severity === 'critical'
            ? 'critical'
            : f.severity === 'major'
              ? 'high'
              : 'medium',
        action: `Investigate ${f.component}`,
      })),
    };
  }

  const result = await generateStructured(client, {
    prompt: JSON.stringify(input, null, 2),
    schema: SurveyNarrativeSchema,
    systemPrompt:
      'You are a Harvard-trained estate manager. Compose a conditional-survey report narrative with prioritized action plans. Compare to prior survey when provided. Return JSON.',
    advisorGate: input.criticalPresent,
  });
  return result.data;
}

// ─────────────────────────────────────────────────────────────
// 4. Tenant risk narrative
// ─────────────────────────────────────────────────────────────

export const RiskNarrativeSchema = z.object({
  tier: z.enum(['low', 'medium', 'high', 'unacceptable']),
  drivers: z.array(z.object({ factor: z.string(), impact: z.enum(['positive', 'negative']) })),
  narrative: z.string(),
  interventions: z.array(z.string()),
});
export type RiskNarrative = z.infer<typeof RiskNarrativeSchema>;

export async function composeRiskNarrative(input: {
  readonly paymentRiskScore: number;
  readonly churnScore: number;
  readonly financialSummary?: string;
  readonly litigationSummary?: string;
}): Promise<RiskNarrative> {
  const client = getClient();
  if (!client) {
    const tier =
      input.paymentRiskScore >= 75
        ? 'low'
        : input.paymentRiskScore >= 60
          ? 'medium'
          : input.paymentRiskScore >= 40
            ? 'high'
            : 'unacceptable';
    return {
      tier,
      drivers: [
        { factor: `payment_risk:${input.paymentRiskScore}`, impact: input.paymentRiskScore >= 60 ? 'positive' : 'negative' },
        { factor: `churn:${input.churnScore}`, impact: input.churnScore < 50 ? 'positive' : 'negative' },
      ],
      narrative: 'Deterministic fallback narrative (no ANTHROPIC_API_KEY).',
      interventions: [],
    };
  }

  const result = await generateStructured(client, {
    prompt: JSON.stringify(input, null, 2),
    schema: RiskNarrativeSchema,
    systemPrompt:
      'You are a Harvard-trained credit analyst specializing in East African real estate. Compose a narrative risk report from the quantitative scores and qualitative summaries. Return JSON.',
    advisorGate: true,
  });
  return result.data;
}

// ─────────────────────────────────────────────────────────────
// 5. Tenant letter drafting
// ─────────────────────────────────────────────────────────────

export const LetterDraftSchema = z.object({
  subject: z.string(),
  body: z.string(),
  signOff: z.string(),
});
export type LetterDraft = z.infer<typeof LetterDraftSchema>;

export async function draftTenantLetter(input: {
  readonly letterType: 'residency_proof' | 'tenancy_confirmation' | 'payment_confirmation' | 'reference';
  readonly customer: { name: string; unit?: string };
  readonly lease?: { startDate?: string; endDate?: string };
  readonly purpose: string;
  readonly orgName: string;
}): Promise<LetterDraft> {
  const client = getClient();
  if (!client) {
    return {
      subject: `${input.letterType.replace(/_/g, ' ')} — ${input.customer.name}`,
      body: `This is a ${input.letterType.replace(/_/g, ' ')} letter for ${input.customer.name} issued by ${input.orgName} for the purpose of: ${input.purpose}. Deterministic fallback — set ANTHROPIC_API_KEY for AI drafting.`,
      signOff: `Regards,\n${input.orgName}`,
    };
  }

  const result = await generateStructured(client, {
    prompt: JSON.stringify(input, null, 2),
    schema: LetterDraftSchema,
    systemPrompt:
      'You draft professional real-estate administrative letters. Be formal, concise, factual. Cite lease dates when provided. Return JSON.',
  });
  return result.data;
}
