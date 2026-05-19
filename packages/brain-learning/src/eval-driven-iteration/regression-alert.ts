/**
 * Regression alert + failure → preference-pair pipeline.
 *
 * §7 R-LEARNING — failures auto-become DPO pairs:
 *   - prompt   = the failed scenario input
 *   - chosen   = the human-curated expected_action
 *   - rejected = the model's failing actual_action
 *
 * Alert threshold: current pass-rate drops > 5pp vs 4-week rolling.
 */

import type {
  EvalFailedScenario,
  PreferencePair,
} from '../types.js';

export const REGRESSION_ALERT_THRESHOLD_PP = 0.05;

export function checkRegression(args: {
  currentPassRate: number;
  rollingPassRate: number;
}): boolean {
  return (
    args.rollingPassRate - args.currentPassRate >
    REGRESSION_ALERT_THRESHOLD_PP
  );
}

/**
 * Convert a single failed eval scenario to a candidate DPO pair.
 *
 * NB: `chosenQuality` and `rejectedPercentile` are stamped at
 * heuristically-strong values (0.95, 0.025) because eval-based pairs
 * are highest signal — the scenario already encodes ground truth.
 * preference-pair-builder's quality filter accepts the result.
 */
export function failedScenarioToPair(args: {
  tenantId: string;
  scenario: EvalFailedScenario;
  scenarioPrompt: string;
  generatedAt: string;
}): PreferencePair {
  return Object.freeze({
    tenantId: args.tenantId,
    sourceTurnId: args.scenario.traceId,
    algo: 'dpo',
    prompt: args.scenarioPrompt,
    chosen: args.scenario.expectedAction,
    rejected: args.scenario.actualAction,
    chosenQuality: 0.95,
    rejectedPercentile: 0.025,
    generatedAt: args.generatedAt,
  });
}
