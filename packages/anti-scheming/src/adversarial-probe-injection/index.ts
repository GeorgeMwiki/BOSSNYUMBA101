/**
 * Adversarial Probe Injection — module barrel.
 */
export type {
  ProductionTurnRef,
  ProbeDecision,
  ProbeRecord,
  BehaviourDeltaReport,
} from './types.js';
export { decideInjection, buildProbeRecord, computeBehaviourDelta, renderProbeReport } from './injector.js';
