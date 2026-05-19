/**
 * @bossnyumba/governance/constitution
 *
 * The written constitution + the self-critique gate that enforces it.
 *
 * Public surface:
 *   - enforceConstitution(action, context, options?) → ConstitutionVerdict
 *   - isCompliant(verdict) → boolean
 *   - types: ProposedAction, ConstitutionContext, ConstitutionVerdict,
 *     PrincipleName, Severity, ActionRiskClass, SelfCritiquePort
 *   - ports: passthroughSelfCritiquePort, strictSelfCritiquePort,
 *     composePorts(primary, fallback)
 *   - deterministic registry: PRINCIPLE_CHECKERS, SEVERITY_RANK
 *
 * The constitution prose itself lives in BOSSNYUMBA_CONSTITUTION.md
 * alongside this file. Update both in lock-step.
 */

export {
  enforceConstitution,
  isCompliant,
  type EnforceConstitutionOptions,
} from './enforce-constitution.js';

export {
  passthroughSelfCritiquePort,
  strictSelfCritiquePort,
  composePorts,
  pickWorstViolation,
  shouldSampleReadOnlyForTelemetry,
} from './self-critique-pass.js';

export { PRINCIPLE_CHECKERS, SEVERITY_RANK } from './deterministic-checks.js';

export type {
  ActionRiskClass,
  ConstitutionContext,
  ConstitutionVerdict,
  PrincipleName,
  PrincipleVerdict,
  ProposedAction,
  SelfCritiquePort,
  Severity,
} from './types.js';
