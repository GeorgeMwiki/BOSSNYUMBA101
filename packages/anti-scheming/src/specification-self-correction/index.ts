/**
 * Specification Self-Correction — module barrel.
 */
export type {
  ConstitutionFile,
  ConstitutionManifest,
  LoadedConstitution,
  ProposedAction,
  SelfCorrectionVerdict,
  SelfCritique,
} from './types.js';
export { ConstitutionTamperError } from './types.js';
export { loadConstitution, loadConstitutionManifest } from './loader.js';
export { critique, shouldProceed } from './critic.js';
