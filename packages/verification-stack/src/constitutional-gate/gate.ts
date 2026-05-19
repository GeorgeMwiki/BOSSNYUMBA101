/**
 * Constitutional Gate — REQUIRED for destructive actions.
 *
 * Wires into the K-A pre-tool-use hook. If the critic takes longer
 * than `deferAfterMs` (default 5000), we emit `defer` so the caller
 * can fall back to a human approval queue rather than block the
 * action indefinitely.
 *
 * Closes L1 #7 and L3 #7.
 */

import type { ConstitutionalGateResult, Verdict } from '../types.js';
import { systemClock, type Clock } from '../ports/clock.js';
import type {
  ConstitutionalCheckInput,
  ConstitutionalCriticPort,
  RuleSeverityMap,
} from './types.js';

export interface ConstitutionalGateDeps {
  readonly critic: ConstitutionalCriticPort;
  readonly clock?: Clock;
  /** Map of rule-id → severity. Unknown rules default to 'medium'. */
  readonly ruleSeverity?: RuleSeverityMap;
  /** Defer threshold in millis. Default 5000. */
  readonly deferAfterMs?: number;
  /** Critic violation threshold (score < this counts as a violation). Default 0.7. */
  readonly violationThreshold?: number;
  /** Critical-rule pass threshold (score < this on a 'critical' rule = fail). Default 0.9. */
  readonly criticalRuleMinScore?: number;
}

const DEFAULT_RULE_SEVERITY: RuleSeverityMap = Object.freeze({
  'tz-rental-act-notice-period': 'critical',
  'tz-rental-act-deposit-handling': 'high',
  'tz-rental-act-advance-rent': 'high',
  'gdpr-pii-boundary': 'critical',
  'gdpr-right-to-be-forgotten': 'high',
  'currency-chain-no-hardcode': 'medium',
  'inviolable-ip-tenant-isolation': 'critical',
  'inviolable-ip-secret-redaction': 'critical',
});

const DEFAULTS = {
  deferAfterMs: 5000,
  violationThreshold: 0.7,
  criticalRuleMinScore: 0.9,
} as const;

/**
 * Mark the gate as REQUIRED — no opt-out. Returns a function that
 * runs the critic with a timeout.
 */
export interface ConstitutionalGate {
  readonly required: true;
  check(input: ConstitutionalCheckInput): Promise<ConstitutionalGateResult>;
}

export function createConstitutionalGate(
  deps: ConstitutionalGateDeps,
): ConstitutionalGate {
  const clock = deps.clock ?? systemClock;
  const deferAfterMs = deps.deferAfterMs ?? DEFAULTS.deferAfterMs;
  const violationThreshold = deps.violationThreshold ?? DEFAULTS.violationThreshold;
  const criticalRuleMinScore =
    deps.criticalRuleMinScore ?? DEFAULTS.criticalRuleMinScore;
  const severityMap = deps.ruleSeverity ?? DEFAULT_RULE_SEVERITY;

  return {
    required: true,
    async check(input): Promise<ConstitutionalGateResult> {
      const start = clock.monotonicMs();

      // Race the critic against a defer timer. We use a sentinel object
      // rather than a thrown error so a fast critic that resolves at the
      // exact same tick still wins.
      const DEFER = Symbol('defer');
      const deferP = new Promise<typeof DEFER>((resolve) =>
        setTimeout(() => resolve(DEFER), deferAfterMs),
      );

      const result = await Promise.race([deps.critic.score(input), deferP]);

      const elapsedMs = clock.monotonicMs() - start;

      if (result === DEFER) {
        return {
          verdict: 'defer' as Verdict,
          required: true,
          violations: [],
          overallScore: 0,
          elapsedMs,
          deferred: true,
        };
      }

      const verdict = result;
      const violations = verdict.scores
        .filter((s) => s.score < violationThreshold)
        .map((s) => {
          const severity = severityMap[s.ruleId] ?? 'medium';
          return {
            ruleId: s.ruleId,
            description: s.rationale,
            severity,
          };
        });

      // Severity-graded verdict:
      //   - any critical violation              → fail
      //   - any high/medium/low violation       → flag
      //   - none                                → pass
      const criticalFail = verdict.scores.some((s) => {
        const sev = severityMap[s.ruleId] ?? 'medium';
        return sev === 'critical' && s.score < criticalRuleMinScore;
      });

      const finalVerdict: Verdict = criticalFail
        ? 'fail'
        : violations.length === 0
          ? 'pass'
          : 'flag';

      return {
        verdict: finalVerdict,
        required: true,
        violations,
        overallScore: verdict.overall,
        elapsedMs,
        deferred: false,
      };
    },
  };
}
