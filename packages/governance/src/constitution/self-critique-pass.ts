/**
 * LLM self-critique pass — second-stage check that runs after the
 * deterministic checks for risk classes where pattern matching is
 * insufficient.
 *
 * In production, the port is wired to a Claude self-critique prompt that
 * holds the full principle prose in working memory. In tests, the port is
 * stubbed to a deterministic LLM-shaped responder.
 *
 * This file exposes the **default no-op port** and a small composable
 * pipeline. The port itself lives in `types.ts` as `SelfCritiquePort`.
 */

import { PRINCIPLE_CHECKERS, SEVERITY_RANK } from './deterministic-checks.js';
import type {
  ConstitutionContext,
  PrincipleName,
  PrincipleVerdict,
  ProposedAction,
  SelfCritiquePort,
  Severity,
} from './types.js';

/**
 * A no-op port that defers entirely to the deterministic check verdicts.
 * Useful as a default when the LLM is unavailable (the constitution still
 * works, just with less nuance).
 */
export const passthroughSelfCritiquePort: SelfCritiquePort = {
  async critique({ principle, action, context }) {
    const entry = PRINCIPLE_CHECKERS.find((p) => p.name === principle);
    if (entry === undefined) {
      throw new Error(`Unknown principle: ${principle}`);
    }
    return entry.check(action, context);
  },
};

/**
 * A stricter port that downgrades any `warn` verdict from the
 * deterministic check to `block` for destructive/external-comm/financial
 * risk classes. Tests use this to verify the escalation path.
 */
export const strictSelfCritiquePort: SelfCritiquePort = {
  async critique({ principle, action, context }) {
    const verdict = await passthroughSelfCritiquePort.critique({ principle, action, context });
    if (
      verdict.violated &&
      verdict.severity === 'warn' &&
      action.riskClass !== 'read-only'
    ) {
      return {
        principle,
        violated: true,
        severity: 'block' as Severity,
        explanation: verdict.explanation,
        mitigation: verdict.mitigation,
      };
    }
    return verdict;
  },
};

/**
 * Compose two ports: run `primary` first; if it returns compliant, run
 * `fallback`. The first violation wins.
 */
export const composePorts =
  (primary: SelfCritiquePort, fallback: SelfCritiquePort): SelfCritiquePort => ({
    async critique(args) {
      const verdict = await primary.critique(args);
      if (verdict.violated) return verdict;
      return fallback.critique(args);
    },
  });

/**
 * Pick the worst violation from a list — used by `enforceConstitution` to
 * produce the top-level verdict from per-principle verdicts.
 */
export const pickWorstViolation = (
  verdicts: readonly PrincipleVerdict[],
): PrincipleVerdict | undefined => {
  const violations = verdicts.filter((v) => v.violated);
  if (violations.length === 0) return undefined;
  return violations.reduce((worst, current) => {
    const worstSeverity = SEVERITY_RANK[worst.severity];
    const currentSeverity = SEVERITY_RANK[current.severity];
    if (currentSeverity > worstSeverity) return current;
    if (currentSeverity === worstSeverity) {
      // Tie-breaker: lower-numbered principle wins (constitution §3).
      const worstIndex = PRINCIPLE_CHECKERS.findIndex(
        (p) => p.name === (worst.principle satisfies PrincipleName),
      );
      const currentIndex = PRINCIPLE_CHECKERS.findIndex(
        (p) => p.name === (current.principle satisfies PrincipleName),
      );
      if (currentIndex >= 0 && (worstIndex < 0 || currentIndex < worstIndex)) {
        return current;
      }
    }
    return worst;
  });
};

/**
 * Sampling helper — returns true iff a read-only action should be
 * critiqued for telemetry. 5% default rate.
 */
export const shouldSampleReadOnlyForTelemetry = (
  action: ProposedAction,
  context: ConstitutionContext,
  random: () => number = Math.random,
  sampleRate: number = 0.05,
): boolean => {
  void context;
  if (action.riskClass !== 'read-only') return false;
  return random() < sampleRate;
};
