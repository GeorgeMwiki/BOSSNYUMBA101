/**
 * enforceConstitution — the entry point.
 *
 * Pipeline:
 *   1. Decide whether this action gets a full pass (destructive,
 *      external-comm, financial) or a sampled pass (read-only at 5%).
 *   2. Run each principle checker — deterministic check first, then
 *      delegate to the SelfCritiquePort (LLM in prod, deterministic in
 *      tests).
 *   3. Aggregate verdicts. If any principle reports a violation, surface
 *      the worst one (severity-then-principle-order). Otherwise return
 *      `compliant`.
 *
 * Designed to be called as a `pre-tool-use` hook. Returns a verdict
 * object — never throws on policy violations.
 */

import { PRINCIPLE_CHECKERS } from './deterministic-checks.js';
import {
  passthroughSelfCritiquePort,
  pickWorstViolation,
  shouldSampleReadOnlyForTelemetry,
} from './self-critique-pass.js';
import type {
  ConstitutionContext,
  ConstitutionVerdict,
  PrincipleVerdict,
  ProposedAction,
  SelfCritiquePort,
} from './types.js';

export interface EnforceConstitutionOptions {
  readonly port?: SelfCritiquePort;
  readonly random?: () => number;
  readonly sampleRate?: number;
}

/**
 * Run the constitutional self-critique pass over a proposed action.
 *
 * For destructive / external-comm / financial actions, every principle is
 * evaluated. For read-only actions, the function samples at the
 * configured rate (default 5%) and otherwise returns `compliant` without
 * running any check — the fast path.
 */
export const enforceConstitution = async (
  action: ProposedAction,
  context: ConstitutionContext,
  options: EnforceConstitutionOptions = {},
): Promise<ConstitutionVerdict> => {
  const port = options.port ?? passthroughSelfCritiquePort;
  const random = options.random ?? Math.random;
  const sampleRate = options.sampleRate ?? 0.05;

  // Read-only fast path — sample for telemetry, but never block.
  if (action.riskClass === 'read-only') {
    const sampled = shouldSampleReadOnlyForTelemetry(action, context, random, sampleRate);
    if (!sampled) {
      return { outcome: 'compliant', checks: [] };
    }
    const sampledChecks = await runAllChecks(action, context, port);
    // Even on sampled violations the read-only action proceeds (severity
    // floors at `info` for read-only). We surface the worst as a
    // telemetry signal but never block.
    return {
      outcome: 'compliant',
      checks: sampledChecks.map((v) => ({
        ...v,
        severity: 'info',
        violated: false,
      })),
    };
  }

  const checks = await runAllChecks(action, context, port);
  const worst = pickWorstViolation(checks);
  if (worst === undefined) {
    return { outcome: 'compliant', checks };
  }
  return {
    outcome: 'violation',
    violation: worst.principle,
    severity: worst.severity,
    mitigation: worst.mitigation,
    checks,
  };
};

const runAllChecks = async (
  action: ProposedAction,
  context: ConstitutionContext,
  port: SelfCritiquePort,
): Promise<readonly PrincipleVerdict[]> => {
  const verdicts: PrincipleVerdict[] = [];
  for (const { name } of PRINCIPLE_CHECKERS) {
    const verdict = await port.critique({ principle: name, action, context });
    verdicts.push(verdict);
  }
  return verdicts;
};

/**
 * Convenience helper for callers that only want to know "did this pass?"
 *   - returns true iff the verdict is `compliant`
 *   - returns false otherwise
 */
export const isCompliant = (verdict: ConstitutionVerdict): boolean =>
  verdict.outcome === 'compliant';
