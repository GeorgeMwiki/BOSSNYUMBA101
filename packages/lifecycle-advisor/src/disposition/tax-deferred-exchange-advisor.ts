/**
 * Tax-deferred exchange advisor — recommends the structure best fit
 * to seller's situation across US §1031 (forward / reverse /
 * improvement), TZ Land Act §47 like-kind land swap, and KE SPV
 * rollover under Income Tax Act §15(2)(s).
 *
 * Authority: IRC §1031(a)(3), Rev. Proc. 2000-37 (parking
 * arrangements), FEA *Federation of Exchange Accommodators 2024
 * Best Practices*; TZ Land Act §47; KE Income Tax Act §15(2)(s).
 */

import type {
  TaxDeferredExchangeInputs,
  TaxDeferredExchangeResult,
} from '../types.js';

const US_PARKING_RATIO_MIN = 0.30;
const US_PARKING_DAYS_MAX = 180;
const US_ID_DAYS_MAX = 45;
const US_EAT_FEE_PCT_MAX = 0.02;

export function adviseTaxDeferredExchange(
  inputs: Readonly<TaxDeferredExchangeInputs>,
): TaxDeferredExchangeResult {
  const j = inputs.jurisdiction;
  const blockers: string[] = [];

  if (j === 'US') {
    // Default to reverse 1031 if parking happened; otherwise forward
    const isReverse = inputs.daysSinceParking !== undefined;
    if (isReverse) {
      if (inputs.daysSinceParking! > US_PARKING_DAYS_MAX) {
        blockers.push(`days-since-parking ${inputs.daysSinceParking} > ${US_PARKING_DAYS_MAX} (statutory)`);
      }
      if (inputs.daysToReplacementID !== undefined && inputs.daysToReplacementID > US_ID_DAYS_MAX) {
        blockers.push(`days-to-replacement-ID ${inputs.daysToReplacementID} > ${US_ID_DAYS_MAX} (statutory)`);
      }
      if (inputs.replacementPurchase <= 0) {
        blockers.push('replacement-purchase must be > 0');
      } else {
        const ratio = inputs.equityInRelinquished / inputs.replacementPurchase;
        if (ratio < US_PARKING_RATIO_MIN) {
          blockers.push(
            `equity/replacement ratio ${(ratio * 100).toFixed(1)}% < ${(US_PARKING_RATIO_MIN * 100).toFixed(0)}% (parking-fee headroom)`,
          );
        }
      }
      return {
        structure: 'reverse-1031',
        feasible: blockers.length === 0,
        blockers,
        maxEATFeePct: US_EAT_FEE_PCT_MAX,
        statutoryDeadlines: [
          `replacement ID ≤ ${US_ID_DAYS_MAX} days from parking`,
          `relinquished close ≤ ${US_PARKING_DAYS_MAX} days from parking`,
        ],
      };
    }
    return {
      structure: 'forward-1031',
      feasible: blockers.length === 0,
      blockers,
      maxEATFeePct: US_EAT_FEE_PCT_MAX,
      statutoryDeadlines: [
        `replacement ID ≤ ${US_ID_DAYS_MAX} days from sale`,
        `replacement close ≤ ${US_PARKING_DAYS_MAX} days from sale`,
      ],
    };
  }

  if (j === 'TZ') {
    if (inputs.developedProperty) {
      blockers.push('TZ Land Act §47 like-kind swap available on undeveloped land only');
      return {
        structure: 'not-applicable',
        feasible: false,
        blockers,
        statutoryDeadlines: [],
      };
    }
    return {
      structure: 'tz-land-act-47',
      feasible: true,
      blockers,
      statutoryDeadlines: ['no statutory clock; document like-kind via valuation parity'],
    };
  }

  if (j === 'KE') {
    return {
      structure: 'ke-spv-rollover',
      feasible: true,
      blockers,
      statutoryDeadlines: [
        'Income Tax Act §15(2)(s) rollover: re-investment within 12 months of disposal',
      ],
    };
  }

  // Other jurisdictions: not applicable in this advisor's scope
  return {
    structure: 'not-applicable',
    feasible: false,
    blockers: [`jurisdiction ${j} not yet modelled — consult local tax counsel`],
    statutoryDeadlines: [],
  };
}
