/**
 * HBU analyzer — composes the four gates per Appraisal Institute
 * methodology. Each gate is a hard filter except `maximally
 * productive`, which ranks survivors.
 */

import type { CandidateUse, GateResult, HBUResult, Parcel } from '../types.js';
import { financiallyFeasible, type FinancialRules } from './financially-feasible.js';
import { legallyPermissible, type LegalityRules } from './legally-permissible.js';
import { maximallyProductive, type ProductivityInputs } from './maximally-productive.js';
import { physicallyPossible, type PhysicalRules } from './physically-possible.js';

export interface HBUInputs {
  readonly parcel: Parcel;
  readonly uses: ReadonlyArray<CandidateUse>;
  readonly legality: LegalityRules;
  readonly physical: PhysicalRules;
  readonly financial: FinancialRules;
}

export function analyzeHBU(input: HBUInputs): HBUResult {
  const gateLog: GateResult[] = [];
  const productivity: ProductivityInputs[] = [];

  for (const use of input.uses) {
    const legal = legallyPermissible(input.parcel, use, input.legality);
    gateLog.push(legal);
    if (legal.outcome === 'fail') continue;

    const physical = physicallyPossible(input.parcel, use, input.physical);
    gateLog.push(physical);
    if (physical.outcome === 'fail') continue;

    const fin = financiallyFeasible(use, input.financial);
    gateLog.push(fin.result);
    if (fin.result.outcome === 'fail') continue;

    const stabilisedNoi =
      use.nlaSqm *
      use.stabilisedRentPerSqm *
      12 *
      (1 - use.operatingExpenseRatio);

    productivity.push({
      use,
      medianIrr: fin.medianIrr,
      medianNpv: fin.medianNpv,
      stabilisedNoi,
      siteAreaSqm: input.parcel.siteAreaSqm,
    });
  }

  const ranked = maximallyProductive(productivity);
  const winner = ranked[0]?.use;

  return {
    parcelId: input.parcel.id,
    ranked,
    gateLog,
    ...(winner ? { winner } : {}),
  };
}
