/**
 * Continuous grading — the real-estate analogue of LITFIN's
 * five-C-continuous (Character, Capacity, Capital, Collateral,
 * Conditions). For BossNyumba the dimensions are five property/
 * occupancy axes, each scored continuously on [0,1]:
 *
 *   - condition  — physical state (inspections, work-order density)
 *   - cashflow   — rent collection consistency, arrears trend
 *   - covenant   — lease terms, renewal probability, dispute history
 *   - context    — neighbourhood / market drift signals
 *   - compliance — KYC, statute adherence, GDPR / data rights health
 *
 * The grade is a 5-vector with derived overall = weighted mean. The
 * kernel mixes a low-resolution version of this grade into the
 * system prompt for tier ≥ unit so the assistant grounds its
 * reasoning in the asset's current state.
 */

export interface PropertyGrade {
  readonly condition: number;
  readonly cashflow: number;
  readonly covenant: number;
  readonly context: number;
  readonly compliance: number;
  readonly overall: number;
  readonly band: GradeBand;
}

export type GradeBand = 'A' | 'B' | 'C' | 'D' | 'F';

export interface GradeInputs {
  readonly inspectionsPassRate: number;     // [0,1]
  readonly workOrderBacklogIndex: number;   // [0,1] — 0 = no backlog
  readonly rentCollectionRate12mo: number;  // [0,1]
  readonly arrearsCaseCountRel: number;     // [0,1] vs comparable cohort
  readonly renewalRate: number;             // [0,1]
  readonly disputeRate: number;             // [0,1] — lower better
  readonly marketDriftSignal: number;       // [-1,1] — local market move
  readonly kycCompletionRate: number;       // [0,1]
  readonly gdprRequestSlaHit: number;       // [0,1]
}

const WEIGHTS: ReadonlyArray<{ key: keyof Omit<PropertyGrade, 'overall' | 'band'>; w: number }> = [
  { key: 'condition',  w: 0.20 },
  { key: 'cashflow',   w: 0.30 },
  { key: 'covenant',   w: 0.20 },
  { key: 'context',    w: 0.15 },
  { key: 'compliance', w: 0.15 },
];

export function gradeProperty(inputs: GradeInputs): PropertyGrade {
  const condition = mean(inputs.inspectionsPassRate, 1 - inputs.workOrderBacklogIndex);
  const cashflow = mean(inputs.rentCollectionRate12mo, 1 - inputs.arrearsCaseCountRel);
  const covenant = mean(inputs.renewalRate, 1 - inputs.disputeRate);
  // Map drift in [-1,1] to a "calmness" score in [0,1].
  const context = 1 - Math.min(1, Math.abs(inputs.marketDriftSignal));
  const compliance = mean(inputs.kycCompletionRate, inputs.gdprRequestSlaHit);

  const partial = { condition, cashflow, covenant, context, compliance };
  const overall = WEIGHTS.reduce((acc, { key, w }) => acc + clamp01(partial[key]) * w, 0);
  const band = bandFor(overall);

  return {
    condition: clamp01(condition),
    cashflow: clamp01(cashflow),
    covenant: clamp01(covenant),
    context: clamp01(context),
    compliance: clamp01(compliance),
    overall: clamp01(overall),
    band,
  };
}

function mean(...xs: ReadonlyArray<number>): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function bandFor(overall: number): GradeBand {
  if (overall >= 0.85) return 'A';
  if (overall >= 0.70) return 'B';
  if (overall >= 0.55) return 'C';
  if (overall >= 0.40) return 'D';
  return 'F';
}

export function renderGradeBriefing(g: PropertyGrade): string {
  return [
    `Asset grade: ${g.band} (overall ${(g.overall * 100).toFixed(0)}%).`,
    `Sub-scores — condition ${(g.condition * 100).toFixed(0)}%,`,
    `cashflow ${(g.cashflow * 100).toFixed(0)}%,`,
    `covenant ${(g.covenant * 100).toFixed(0)}%,`,
    `context ${(g.context * 100).toFixed(0)}%,`,
    `compliance ${(g.compliance * 100).toFixed(0)}%.`,
  ].join(' ');
}
