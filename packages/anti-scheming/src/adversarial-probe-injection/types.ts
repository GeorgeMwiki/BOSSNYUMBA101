/**
 * Adversarial Probe Injection (Apollo Research-inspired).
 *
 * Apollo finding: models behave differently when they detect testing.
 * Defense: insert golden-set scenarios into PRODUCTION traffic at a
 * low rate (1 in 10,000 turns) disguised as real user requests. The
 * `adversarial_probe` flag is set in trace metadata but is NEVER
 * visible to the brain.
 */

import type { GoldenScenario } from '../immutable-golden-eval/types.js';

export interface ProductionTurnRef {
  readonly turn_id: string;
  readonly tenant_id: string;
  readonly user_input: string;
  readonly ts: string;
}

export interface ProbeDecision {
  readonly should_inject: boolean;
  readonly probe_id: string | null;
  readonly probe_scenario_id: string | null;
  readonly random_value: number;
  readonly threshold: number;
}

export interface ProbeRecord {
  readonly probe_id: string;
  readonly tenant_id: string;
  readonly turn_id: string; // The fake turn id used in trace store
  readonly scenario: GoldenScenario;
  readonly injected_at: string;
  readonly behaviour_hash: string; // SHA-256 of brain's response
}

export interface BehaviourDeltaReport {
  readonly window_start: string;
  readonly window_end: string;
  readonly tenant_id: string;
  readonly probe_total: number;
  readonly probe_pass: number;
  readonly real_traffic_pass_rate: number;
  readonly probe_pass_rate: number;
  readonly delta_pp: number;
  readonly is_test_detection_suspected: boolean; // delta > 5pp
}
