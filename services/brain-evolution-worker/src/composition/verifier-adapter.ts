/**
 * Constitution verifier adapter — wraps the pure `verifyResponse`
 * evaluator from `@bossnyumba/autonomy-governance` as the worker's
 * `ConstitutionVerifierPort`.
 *
 * The package verdict (`VerifyVerdict`) carries the full clause objects;
 * the gate only consumes `{ id }`, so this adapter projects each
 * `ConstitutionClause` down to its id. The jurisdiction string from the
 * directory adapter is cast to the package's `Jurisdiction` union — the
 * verifier already treats unknown jurisdictions as "global clauses only",
 * so an out-of-list code degrades safely rather than throwing.
 */

import { verifyResponse } from '@bossnyumba/autonomy-governance';

import type {
  ConstitutionVerifierPort,
  VerifierVerdict,
} from '../safety/review-gate.js';

/**
 * Build the constitution verifier port. Synchronous + pure — wraps the
 * pure `verifyResponse` function with no DB or network dependency.
 */
export function createVerifierAdapter(): ConstitutionVerifierPort {
  return {
    verify(input): VerifierVerdict {
      const verdict = verifyResponse({
        candidateResponse: input.candidateResponse,
        action: input.action,
        // verifyResponse's Jurisdiction union narrows the known codes;
        // unknown codes resolve to global-only clauses (safe default).
        jurisdiction: input.jurisdiction as never,
        ...(input.evidence ? { evidence: input.evidence } : {}),
      });
      return {
        pass: verdict.pass,
        escalate: verdict.escalate,
        violations: verdict.violations.map((clause) => ({ id: clause.id })),
        warnings: verdict.warnings,
      };
    },
  };
}
