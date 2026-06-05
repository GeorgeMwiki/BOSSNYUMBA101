/**
 * Shared training-surface primitives — locale type, time + score helpers, and
 * the scenario-kind / role-mode label keys.
 *
 * Kept tiny and dependency-free so both the scenario-simulation surface
 * (gap 9) and the mastery-checkpoint surface (gap 10) reuse one source of
 * truth. Labels are translation KEYS resolved by next-intl at the edge — the
 * "single-language per active locale" rule means the active locale supplies
 * every string; nothing is concatenated across locales here.
 */

export type TrainingLanguage = 'en' | 'sw';

/** Narrow the next-intl locale to the two the training surfaces support. */
export function toTrainingLanguage(locale: string): TrainingLanguage {
  return locale === 'sw' ? 'sw' : 'en';
}

/** mm:ss elapsed-time render for the decision-capture timer. */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Map a run's objective coverage + elapsed time to a score in [0, 1].
 *
 * Coverage is the dominant signal (80%): how many of the briefing's grounded
 * objectives the operator surfaced. A small timing bonus (20%) rewards a run
 * completed within the scenario's estimated minutes. Deterministic — the same
 * inputs always yield the same score.
 */
export function computeRunScore(
  objectivesCovered: number,
  objectivesTotal: number,
  elapsedMs: number,
  estimatedMinutes: number,
): number {
  if (objectivesTotal <= 0) return 0;
  const coverage = Math.min(1, objectivesCovered / objectivesTotal);
  const budgetMs = Math.max(1, estimatedMinutes * 60 * 1000);
  const timeRatio = Math.min(1, elapsedMs / budgetMs);
  const timingBonus = 1 - timeRatio; // faster than budget -> closer to 1
  const score = coverage * 0.8 + timingBonus * 0.2;
  return Math.max(0, Math.min(1, Number(score.toFixed(4))));
}

/** Scenario kinds the backend generates (mirrors SCENARIO_KIND_VALUES). */
export const SCENARIO_KINDS = [
  'arrears_negotiation',
  'lease_compliance_interview',
  'maintenance_incident_triage',
  'move_out_inspection',
  'tenant_dispute',
] as const;
export type ScenarioKind = (typeof SCENARIO_KINDS)[number];

export const SCENARIO_DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;
export type ScenarioDifficulty = (typeof SCENARIO_DIFFICULTIES)[number];

export const ROLE_MODES = [
  'leasing',
  'maintenance',
  'compliance',
  'finance',
  'communications',
] as const;
export type RoleModeValue = (typeof ROLE_MODES)[number];

/** Translation-key suffix for a scenario kind, e.g. `kind_arrears_negotiation`. */
export function kindLabelKey(kind: string): string {
  return `kind_${kind}`;
}

/** Translation-key suffix for a role-mode, e.g. `role_finance`. */
export function roleModeLabelKey(mode: string): string {
  return `role_${mode}`;
}

/** Difficulty -> a design-system Badge variant + a soft tone for chips. */
export function difficultyTone(difficulty: string): {
  readonly badge: 'success-soft' | 'warning-soft' | 'error-soft';
} {
  if (difficulty === 'advanced') return { badge: 'error-soft' };
  if (difficulty === 'intermediate') return { badge: 'warning-soft' };
  return { badge: 'success-soft' };
}
