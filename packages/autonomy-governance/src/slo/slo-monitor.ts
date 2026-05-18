/**
 * SLO monitor — streams in actual outcomes, updates SLO state, decides
 * whether to fire a breach action.
 *
 * Pure: takes the SLO + recent events, returns a verdict. Persistence
 * (event log row, breach action wiring) is the adapter's job.
 *
 * Breach policy:
 *   - We need a minimum sample size before declaring a breach, otherwise
 *     a single bad run nukes a sub-MD. Default: 10 events in window.
 *   - The breach metric is the *mean* `delta` over the window. `mean < 0`
 *     = sustained breach.
 *   - For `warn` action: any single delta < 0 once min-sample is met.
 *   - For `reduce-traffic` / `handoff` / `kill-and-rollback`: the mean
 *     delta must be < 0 AND the breach magnitude must exceed `target *
 *     toleranceFraction` (default 5%). This is the anti-flap clause.
 */

import { demoteStage } from './canary-controller.js';
import type {
  SloEvent,
  SloMonitorVerdict,
  SubMdSlo,
} from '../types.js';

export interface SloMonitorOptions {
  /** Minimum events in window before any breach can fire. */
  readonly minSampleSize?: number;
  /**
   * Fractional tolerance — breaches inside this band are warns, not
   * traffic-reductions. Default 5%.
   */
  readonly toleranceFraction?: number;
}

const DEFAULT_OPTS: Required<SloMonitorOptions> = {
  minSampleSize: 10,
  toleranceFraction: 0.05,
};

/**
 * Evaluate whether the recent stream of events breaches the SLO.
 *
 * @param slo            The SLO definition for the (subMd, metric) pair.
 * @param recentEvents   Events for THIS slo (caller filters by subMd +
 *                       metric + window). Order does not matter.
 * @param opts           Monitor knobs.
 */
export function evaluateSlo(
  slo: SubMdSlo,
  recentEvents: ReadonlyArray<SloEvent>,
  opts: SloMonitorOptions = {},
): SloMonitorVerdict {
  const { minSampleSize, toleranceFraction } = { ...DEFAULT_OPTS, ...opts };

  // Filter belt-and-braces: only events matching this SLO.
  const matched = recentEvents.filter(
    (e) => e.subMd === slo.subMd && e.metric === slo.metric,
  );

  if (matched.length < minSampleSize) {
    return Object.freeze({
      subMd: slo.subMd,
      metric: slo.metric,
      breached: false,
      nextStage: null,
      action: 'no-op',
      reason: `sample size ${matched.length} < min ${minSampleSize}`,
    });
  }

  const meanDelta = matched.reduce((sum, e) => sum + e.delta, 0) / matched.length;
  const toleranceBand = Math.abs(slo.target) * toleranceFraction;

  // No breach: meanDelta is at-or-above target (delta convention: negative = bad).
  if (meanDelta >= 0) {
    return Object.freeze({
      subMd: slo.subMd,
      metric: slo.metric,
      breached: false,
      nextStage: null,
      action: 'no-op',
      reason: `meanDelta ${meanDelta.toFixed(4)} >= 0 (within SLO)`,
    });
  }

  // Inside tolerance band → soft breach: warn only, never demote.
  if (Math.abs(meanDelta) <= toleranceBand) {
    return Object.freeze({
      subMd: slo.subMd,
      metric: slo.metric,
      breached: true,
      nextStage: slo.canaryStage,
      action: 'warn',
      reason: `meanDelta ${meanDelta.toFixed(4)} inside tolerance band ±${toleranceBand.toFixed(4)}`,
    });
  }

  // Hard breach — honour the SLO's configured action.
  if (slo.breachAction === 'warn') {
    return Object.freeze({
      subMd: slo.subMd,
      metric: slo.metric,
      breached: true,
      nextStage: slo.canaryStage,
      action: 'warn',
      reason: `meanDelta ${meanDelta.toFixed(4)} breached (warn-only policy)`,
    });
  }

  if (slo.breachAction === 'reduce-traffic') {
    const next = demoteStage(slo.canaryStage);
    return Object.freeze({
      subMd: slo.subMd,
      metric: slo.metric,
      breached: true,
      nextStage: next ?? slo.canaryStage,
      action: next === null ? 'warn' : 'reduce-traffic',
      reason:
        next === null
          ? `meanDelta ${meanDelta.toFixed(4)} breached at floor stage 'shadow' — warn-only`
          : `meanDelta ${meanDelta.toFixed(4)} breached — demote ${slo.canaryStage} → ${next}`,
    });
  }

  if (slo.breachAction === 'handoff') {
    return Object.freeze({
      subMd: slo.subMd,
      metric: slo.metric,
      breached: true,
      nextStage: 'shadow',
      action: 'handoff',
      reason: `meanDelta ${meanDelta.toFixed(4)} breached — quarantine sub-MD, route to handoff queue`,
    });
  }

  // kill-and-rollback — terminal
  return Object.freeze({
    subMd: slo.subMd,
    metric: slo.metric,
    breached: true,
    nextStage: 'shadow',
    action: 'kill-and-rollback',
    reason: `meanDelta ${meanDelta.toFixed(4)} breached — disable sub-MD and restore prior version`,
  });
}
