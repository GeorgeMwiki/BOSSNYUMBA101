/**
 * Constitution module barrel.
 *
 * BOSSNYUMBA Constitution v1 + citation verifier. See
 * `bossnyumba-constitution.ts` for clause text and `citation-verifier.ts`
 * for the deliberative-alignment evaluator.
 */

export {
  BOSSNYUMBA_CONSTITUTION_V1,
  clausesForAction,
  clausesForJurisdiction,
  renderConstitutionAsContext,
  getClause,
  type ClauseSeverity,
  type Jurisdiction,
  type ClauseCitation,
  type ConstitutionClause,
} from './bossnyumba-constitution.js';

export {
  applicableClauses,
  verifyResponse,
  renderAuditTrace,
  getClauseById,
  type VerifyInput,
  type VerifyVerdict,
  type ClauseResult,
} from './citation-verifier.js';
