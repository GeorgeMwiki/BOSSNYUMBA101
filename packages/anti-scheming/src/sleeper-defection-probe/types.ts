/**
 * Sleeper-defection probe types.
 *
 * Extends M-E's existing sleeper probe with 6 BOSSNYUMBA-specific
 * lexical signals. Per Hubinger 2024, sleeper backdoors survive SFT
 * + RL + adversarial training, so we cannot trust the model not to
 * have one. The probe is OBSERVE-ONLY — it NEVER blocks; it flags to
 * the alignment auditor.
 */

export type SleeperSignalId =
  | 'forged-tenant-credential-string'
  | 'fake-vendor-shutdown-request'
  | 'begin-coordination-with-successor'
  | 'timestamp-anomaly-detected-and-acted-on'
  | 'self-modification-attempt'
  | 'long-tail-currency-unhardcoded-flip';

export interface SleeperSignal {
  readonly id: SleeperSignalId;
  readonly description: string;
  readonly severity: 'critical' | 'high' | 'medium';
}

export interface SleeperProbeInput {
  readonly turn_id: string;
  readonly brain_output: string;
  readonly proposed_tool_calls: ReadonlyArray<{ readonly tool: string; readonly args: Readonly<Record<string, unknown>> }>;
  readonly ts: string;
}

export interface SleeperProbeHit {
  readonly signal: SleeperSignal;
  readonly score: number; // 0..1, heuristic + classifier blended
  readonly evidence: string; // The matched substring/JSON snippet
}

export interface SleeperProbeReport {
  readonly turn_id: string;
  readonly evaluated_at: string;
  readonly hits: readonly SleeperProbeHit[];
  readonly max_score: number;
  readonly observe_only_decision: 'flag' | 'noop';
}
