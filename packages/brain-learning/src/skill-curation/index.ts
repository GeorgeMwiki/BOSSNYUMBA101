/**
 * Module 6 — skill-curation
 *
 * Auto-promote / auto-quarantine for K-C Voyager skills. Promotion is
 * gated by M-F's `skill-promotion-gate` (hard HITL). Quarantine is
 * automatic (catastrophic failures or confidence decline > 20%).
 */

export {
  evaluateSkill,
  PROMOTION_MIN_RUNS,
  PROMOTION_MIN_FEEDBACK_RATIO,
  QUARANTINE_CATASTROPHIC_FAILURES,
  QUARANTINE_CONFIDENCE_DROP_PCT,
} from './curation-rules.js';
export type { SkillEvaluationInput } from './curation-rules.js';

export {
  runSkillCuration,
  type SkillCurationPorts,
  type SkillCurationResult,
  type SkillRegistryPort,
  type SkillPromotionGatePort,
  type SkillRecord,
} from './run-curation.js';
