/**
 * Constitutional gate — public API.
 */

export {
  createConstitutionalGate,
  type ConstitutionalGate,
  type ConstitutionalGateDeps,
} from './gate.js';
export {
  heuristicConstitutionalCritic,
  type HeuristicCriticOptions,
} from './heuristic-critic.js';
export type {
  ConstitutionalCheckInput,
  ConstitutionalCriticPort,
  CriticVerdictLike,
  RuleSeverityMap,
} from './types.js';
