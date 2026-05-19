/**
 * Immutable Golden Eval — module barrel.
 */
export type {
  GoldenScenario,
  GoldenCategory,
  GoldenSeverity,
  GoldenManifest,
  GoldenManifestEntry,
  IntegrityResult,
  IntegrityFailureReason,
  IntegrityViolation,
} from './types.js';

export { verifyGoldenSetIntegrity, sha256Hex, computeManifestHash, loadManifest, listGoldenFiles } from './integrity.js';
export { loadGoldenSet, GoldenSetIntegrityError } from './loader.js';
