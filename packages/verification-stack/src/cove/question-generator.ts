/**
 * Question generation — Step 2 of CoVe.
 *
 * For each extracted claim, emit 3-5 independent verification questions.
 * The questions are crafted per fact-class so an external answerer
 * (which can be an LLM with no view of the draft, or a deterministic
 * data-source check) can challenge the claim in isolation.
 */

import type { FactClass, FactualClaim } from '../types.js';

export function generateVerificationQuestions(
  claim: FactualClaim,
): ReadonlyArray<string> {
  switch (claim.factClass) {
    case 'amount':
      return [
        `What is the source of record for the amount in "${claim.text}"?`,
        `Does the rent ledger show this exact amount as outstanding?`,
        `Has this amount been recomputed after the most recent payment?`,
        `Is the currency in "${claim.text}" the tenant's preferred display currency?`,
        `Are there any disputed line items that would change "${claim.text}"?`,
      ];
    case 'date':
      return [
        `What is the source of record for "${claim.text}" (lease, payment ledger, notice register)?`,
        `Has "${claim.text}" been adjusted for the tenant's jurisdiction calendar?`,
        `Does the jurisdiction's statutory notice period align with "${claim.text}"?`,
        `Is "${claim.text}" within the lease's valid date range?`,
      ];
    case 'party-name':
      return [
        `Does the canonical tenant/landlord record exactly match "${claim.text}" (case, accents, middle names)?`,
        `Is "${claim.text}" the legal-document spelling, not a chat nickname?`,
        `Has the party at this address been verified via ID or operator confirmation?`,
      ];
    case 'address':
      return [
        `Does the property registry list "${claim.text}" as a current rentable unit?`,
        `Is the unit at "${claim.text}" actively leased to the named tenant?`,
        `Does the address format match the jurisdiction's service-of-notice rules?`,
      ];
    case 'statutory-ref':
      return [
        `Does "${claim.text}" exist in the cited jurisdiction's current statute?`,
        `Is the section number in "${claim.text}" the most recent revision?`,
        `Does the claim accurately apply "${claim.text}" to the present action class?`,
      ];
    case 'general':
    default:
      return [
        `What is the underlying source-of-record for the claim "${claim.text}"?`,
        `Is "${claim.text}" consistent with the latest tenant context?`,
        `Could "${claim.text}" be contradicted by data not in the current draft?`,
      ];
  }
}
