/**
 * UI Block Generator (BOSSNYUMBA estate-management)
 *
 * Zero-LLM post-processing. Given the AI's raw text + tool calls, produce
 * structured UI blocks. Re-keyed from LitFin financial topics to estate
 * management topics: rent affordability, arrears, lease, maintenance,
 * property comparison, and the 5 Ps of tenancy risk.
 */

import { generateBlockId } from './types';
import type {
  UIBlock,
  RentAffordabilityCalculatorBlock,
  FivePsRiskWheelBlock,
  ArrearsProjectionChartBlock,
  LeaseTimelineDiagramBlock,
  MaintenanceCaseFlowDiagramBlock,
  PropertyComparisonTableBlock,
  ConceptCardBlock,
  QuickRepliesBlock,
} from './types';

function safeId(): string {
  try {
    return generateBlockId();
  } catch {
    return `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

const RENT_AFFORDABILITY_PATTERNS = [
  /rent affordability/i,
  /rent[- ]to[- ]income/i,
  /rent ratio/i,
  /can .{0,20}afford/i,
];

const ARREARS_PATTERNS = [
  /arrears/i,
  /unpaid rent/i,
  /rent overdue/i,
  /delinquen(t|cy)/i,
];

const LEASE_TIMELINE_PATTERNS = [
  /lease (timeline|lifecycle|period|term)/i,
  /renewal window/i,
  /lease end/i,
];

const MAINTENANCE_PATTERNS = [
  /maintenance (case|flow|workflow|request|ticket)/i,
  /work order/i,
  /repair request/i,
];

const FIVE_PS_PATTERNS = [
  /five ?p'?s/i,
  /5 ?p'?s/i,
  /tenancy risk/i,
  /payment history.{0,40}property fit/i,
];

const PROPERTY_COMPARISON_PATTERNS = [
  /compare (these )?properties/i,
  /property comparison/i,
  /unit A .{0,20}unit B/i,
  /side by side/i,
];

function matchAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

export interface BlockGeneratorInput {
  readonly responseText: string;
  readonly toolCalls: readonly string[];
  readonly language?: 'en' | 'sw';
  readonly defaultCurrency?: string;
}

export function generateBlocks(input: BlockGeneratorInput): readonly UIBlock[] {
  // TODO(tenant-context): resolve defaultCurrency from
  // `tenant.defaultCurrency` / `getDefaultCurrency(tenant.countryCode)` via
  // @bossnyumba/compliance-plugins instead of the neutral 'USD' fallback.
  const { responseText, toolCalls, defaultCurrency = 'USD' } = input;
  const blocks: UIBlock[] = [];

  if (
    toolCalls.includes('rent-affordability-calculator') ||
    matchAny(responseText, RENT_AFFORDABILITY_PATTERNS)
  ) {
    const block: RentAffordabilityCalculatorBlock = {
      id: safeId(),
      type: 'rent_affordability_calculator',
      position: 'below',
      defaultRent: 25000,
      defaultIncome: 100000,
      currency: defaultCurrency,
    };
    blocks.push(block);
  }

  if (matchAny(responseText, ARREARS_PATTERNS)) {
    const monthsDelinquent = 3;
    const monthlyRent = 25000;
    const lateFeePerMonth = 1000;
    const points = Array.from({ length: monthsDelinquent + 1 }, (_, i) => ({
      month: i,
      cumulative: i * (monthlyRent + lateFeePerMonth),
    }));
    const block: ArrearsProjectionChartBlock = {
      id: safeId(),
      type: 'arrears_projection_chart',
      position: 'below',
      title: 'Arrears projection',
      monthlyRent,
      currency: defaultCurrency,
      monthsDelinquent,
      lateFeePerMonth,
      points,
    };
    blocks.push(block);
  }

  if (matchAny(responseText, LEASE_TIMELINE_PATTERNS)) {
    const block: LeaseTimelineDiagramBlock = {
      id: safeId(),
      type: 'lease_timeline_diagram',
      position: 'below',
      title: 'Lease timeline',
      events: [
        { label: 'Signing', date: 'Month 0', status: 'completed' },
        { label: 'Rent start', date: 'Month 0', status: 'completed' },
        { label: 'Renewal window', date: 'Month 10', status: 'current' },
        { label: 'Lease end', date: 'Month 12', status: 'upcoming' },
      ],
    };
    blocks.push(block);
  }

  if (matchAny(responseText, MAINTENANCE_PATTERNS)) {
    const block: MaintenanceCaseFlowDiagramBlock = {
      id: safeId(),
      type: 'maintenance_case_flow_diagram',
      position: 'below',
      title: 'Maintenance case flow',
      currentStage: 'assigned',
      stages: [
        { id: 'reported', label: 'Reported' },
        { id: 'triaged', label: 'Triaged' },
        { id: 'assigned', label: 'Assigned' },
        { id: 'in_progress', label: 'In progress' },
        { id: 'resolved', label: 'Resolved' },
      ],
    };
    blocks.push(block);
  }

  if (matchAny(responseText, FIVE_PS_PATTERNS)) {
    const block: FivePsRiskWheelBlock = {
      id: safeId(),
      type: 'five_ps_tenancy_risk_wheel',
      position: 'below',
      title: '5 Ps of tenancy risk',
      scores: {
        paymentHistory: 70,
        propertyFit: 85,
        purpose: 60,
        person: 80,
        protection: 55,
      },
      overallRating: 'B',
    };
    blocks.push(block);
  }

  if (matchAny(responseText, PROPERTY_COMPARISON_PATTERNS)) {
    const block: PropertyComparisonTableBlock = {
      id: safeId(),
      type: 'property_comparison_table',
      position: 'below',
      title: 'Property comparison',
      columns: [{ header: 'Unit A' }, { header: 'Unit B', highlight: true }],
      rows: [
        { label: 'Monthly rent', values: ['25,000', '30,000'] },
        { label: 'Bedrooms', values: ['2', '3'] },
        { label: 'Security deposit', values: ['50,000', '60,000'] },
      ],
    };
    blocks.push(block);
  }

  // Always include quick replies if blocks were emitted
  if (blocks.length > 0) {
    const replies: QuickRepliesBlock = {
      id: safeId(),
      type: 'quick_replies',
      position: 'below',
      replies: [
        { label: 'Go deeper', prompt: 'Can you go deeper on this concept?' },
        { label: 'Test me', prompt: 'Quiz me on what we just discussed' },
      ],
    };
    blocks.push(replies);
  }

  return blocks;
}

/**
 * Helper: promote an InsightCard-style payload into a ConceptCard with
 * extracted key points (used by renderer when the AI returns bare text).
 */
export function promoteInsightToConcept(
  title: string,
  message: string,
): ConceptCardBlock {
  const sentences = message
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);
  const keyPoints = sentences.length >= 2 ? sentences.slice(0, 4) : [message.slice(0, 150)];
  return {
    id: safeId(),
    type: 'concept_card',
    position: 'below',
    title,
    description: '',
    keyPoints,
    bloomLevel: 'understand',
  };
}
