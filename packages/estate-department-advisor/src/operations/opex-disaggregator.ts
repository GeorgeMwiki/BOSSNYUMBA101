/**
 * opex-disaggregator — controllable vs uncontrollable opex split.
 *
 * Veteran-director rule: ONLY act on controllable variances > 10 %.
 * Uncontrollable variances feed forecasts, not decisions.
 *
 * Per BOMA EER methodology — split categories below.
 */

export type OpexCategory =
  | 'cleaning'
  | 'r-and-m'
  | 'staffing'
  | 'marketing'
  | 'admin'
  | 'utilities'
  | 'real-estate-tax'
  | 'insurance'
  | 'ground-rent'
  | 'other';

const CONTROLLABLE: ReadonlySet<OpexCategory> = new Set<OpexCategory>([
  'cleaning',
  'r-and-m',
  'staffing',
  'marketing',
  'admin',
]);

const UNCONTROLLABLE: ReadonlySet<OpexCategory> = new Set<OpexCategory>([
  'utilities',
  'real-estate-tax',
  'insurance',
  'ground-rent',
]);

export interface OpexLine {
  readonly category: OpexCategory;
  readonly actualUsd: number;
  readonly budgetUsd: number;
}

export interface OpexDisaggregation {
  readonly controllableActual: number;
  readonly controllableBudget: number;
  readonly controllableVariancePct: number;
  readonly uncontrollableActual: number;
  readonly uncontrollableBudget: number;
  readonly uncontrollableVariancePct: number;
  readonly actionable: ReadonlyArray<OpexLine & { variancePct: number }>;
  readonly informational: ReadonlyArray<OpexLine & { variancePct: number }>;
  readonly rationale: string;
}

const ACTION_THRESHOLD = 0.10;

export function disaggregateOpex(lines: ReadonlyArray<OpexLine>): OpexDisaggregation {
  const c = lines.filter((l) => CONTROLLABLE.has(l.category));
  const u = lines.filter((l) => UNCONTROLLABLE.has(l.category));

  const cActual = c.reduce((s, l) => s + l.actualUsd, 0);
  const cBudget = c.reduce((s, l) => s + l.budgetUsd, 0);
  const uActual = u.reduce((s, l) => s + l.actualUsd, 0);
  const uBudget = u.reduce((s, l) => s + l.budgetUsd, 0);

  const cVar = cBudget > 0 ? (cActual - cBudget) / cBudget : 0;
  const uVar = uBudget > 0 ? (uActual - uBudget) / uBudget : 0;

  const enriched = lines.map((l) => ({
    ...l,
    variancePct: l.budgetUsd > 0 ? (l.actualUsd - l.budgetUsd) / l.budgetUsd : 0,
  }));
  const actionable = enriched
    .filter((l) => CONTROLLABLE.has(l.category) && Math.abs(l.variancePct) > ACTION_THRESHOLD)
    .sort((a, b) => Math.abs(b.variancePct) - Math.abs(a.variancePct));
  const informational = enriched.filter(
    (l) => !CONTROLLABLE.has(l.category) || Math.abs(l.variancePct) <= ACTION_THRESHOLD,
  );

  return {
    controllableActual: cActual,
    controllableBudget: cBudget,
    controllableVariancePct: cVar,
    uncontrollableActual: uActual,
    uncontrollableBudget: uBudget,
    uncontrollableVariancePct: uVar,
    actionable,
    informational,
    rationale: `BOMA disaggregation: act only on controllable variances > ${(ACTION_THRESHOLD * 100).toFixed(0)}%; uncontrollables feed forecasts.`,
  };
}

export const __test__ = { CONTROLLABLE, UNCONTROLLABLE, ACTION_THRESHOLD };
