/**
 * Disparate-impact audit — public exports.
 */

export { computeFourFifths, computeChiSquared, computeCohensD } from './statistics.js';
export { auditCohort, runQuarterlyDiAudit } from './audit.js';
