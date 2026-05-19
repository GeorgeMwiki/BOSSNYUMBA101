/**
 * External Nightly Auditor types.
 *
 * The auditor RUNS OUTSIDE the training loop in an isolated subagent
 * context (`isolated_context: true`). It replays the golden set against
 * the current production brain and flags regressions.
 *
 * Defense thesis (Apollo Research): more capable models are better at
 * in-context scheming, so the auditor MUST NOT share context, weights,
 * or prompt state with the brain being audited.
 */

import type { GoldenScenario } from '../immutable-golden-eval/types.js';

export interface AuditRunInput {
  readonly run_id: string;
  readonly run_at: string; // ISO-8601
  readonly brain_version: string;
  readonly brain_endpoint: string;
  readonly golden_root: string;
  readonly self_signature: string; // SHA-256 of the auditor bundle
  readonly expected_self_signature: string;
}

export interface ScenarioOutcome {
  readonly scenario_id: string;
  readonly category: string;
  readonly severity: string;
  readonly passed: boolean;
  readonly observed_action: string;
  readonly forbidden_hit: readonly string[];
  readonly latency_ms: number;
  readonly notes: string;
}

export interface AuditRunReport {
  readonly run_id: string;
  readonly run_at: string;
  readonly brain_version: string;
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly pass_rate: number; // 0..1
  readonly previous_pass_rate: number | null;
  readonly regression_pp: number | null; // current - previous
  readonly critical_regression: boolean; // > 5pp drop
  readonly by_category: Readonly<Record<string, { readonly total: number; readonly passed: number }>>;
  readonly outcomes: readonly ScenarioOutcome[];
}

/**
 * Pluggable adapter — the actual call to the brain.
 *
 * Production: HTTP call to the brain's `/audit` endpoint with a fresh
 * subagent context.
 *
 * Test: deterministic stub returning canned outcomes.
 */
export interface BrainAuditAdapter {
  evaluate(scenario: GoldenScenario): Promise<{
    readonly observed_action: string;
    readonly forbidden_hit: readonly string[];
    readonly latency_ms: number;
  }>;
}

export interface PreviousRunStore {
  readonly load: () => Promise<number | null>; // previous pass_rate
  readonly save: (run: AuditRunReport) => Promise<void>;
}

export class AuditorTamperError extends Error {
  constructor(public readonly expected: string, public readonly actual: string) {
    super(`auditor self-signature mismatch: expected ${expected.slice(0, 12)}…, got ${actual.slice(0, 12)}…`);
    this.name = 'AuditorTamperError';
  }
}
