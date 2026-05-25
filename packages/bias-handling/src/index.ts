/**
 * `@bossnyumba/bias-handling` — public surface.
 *
 * Sister to `@bossnyumba/fairness-eval`:
 *  - fairness-eval = individual / counterfactual fairness.
 *  - bias-handling = group fairness + mitigation + LLM bias +
 *    drift + subgroup discovery + anti-discrimination law map.
 *
 * Background + citations: `Docs/BIAS_HANDLING_SOTA_2026-05-25.md`.
 */

export type {
  BiasDriftAlert,
  BiasDriftObservation,
  BiasBrain,
  BiasMetric,
  DisparityScore,
  FairnessConstraint,
  FairnessRow,
  Jurisdiction,
  LLMBiasBenchmark,
  MitigationStrategy,
  MitigationTier,
  ProtectedAttribute,
  ProtectionContext,
  SliceFinderRow,
  SubgroupSlice,
} from './types.js';

// 8 group-fairness metrics
export {
  DEFAULT_THRESHOLDS,
  calibrationWithinGroups,
  countByGroup,
  demographicParity,
  disparateImpact,
  equalOpportunity,
  equalizedOdds,
  falseDiscoveryRate,
  falseDiscoveryRateParity,
  falseOmissionRate,
  falseOmissionRateParity,
  falsePositiveRate,
  positivePredictiveValue,
  predictiveParity,
  selectionRate,
  statisticalParityDifference,
  thresholdFor,
  truePositiveRate,
} from './group-fairness-metrics/index.js';

export type { GroupCounts } from './group-fairness-metrics/index.js';
