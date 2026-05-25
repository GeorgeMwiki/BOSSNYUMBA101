/**
 * PSA clause flagger — flags absence / weakness of 30+ canonical
 * PSA clauses (a superset of LOI). EA add-ons cover spousal,
 * family-trust, customary-tenure, and ancestral releases.
 *
 * Per ABA Real Property Section Model PSA 2024 + Eversheds
 * Sutherland Africa EA Deal Mechanics 2024.
 */

import type { Jurisdiction, PSAClauseFlag, PSAClauseKey } from '../types.js';

interface ClauseSpec {
  readonly key: PSAClauseKey;
  readonly applicableJurisdictions: ReadonlyArray<Jurisdiction> | 'all';
  readonly defaultRecommendation: string;
  readonly defaultRiskWhenAbsent: PSAClauseFlag['riskLevel'];
}

const CLAUSE_SPECS: ReadonlyArray<ClauseSpec> = [
  { key: 'titleObjectionMechanic', applicableJurisdictions: 'all', defaultRecommendation: 'Add Notice / Cure / Buyer-Termination mechanic per ABA Model PSA', defaultRiskWhenAbsent: 'critical' },
  { key: 'permittedExceptions', applicableJurisdictions: 'all', defaultRecommendation: 'Enumerate permitted exceptions explicitly', defaultRiskWhenAbsent: 'high' },
  { key: 'surveyObjection', applicableJurisdictions: 'all', defaultRecommendation: 'Mirror title-objection mechanic for survey defects', defaultRiskWhenAbsent: 'high' },
  { key: 'opStatementAudit', applicableJurisdictions: 'all', defaultRecommendation: 'Reserve audit right against T-12 + T-3 + budget', defaultRiskWhenAbsent: 'critical' },
  { key: 'serviceContractSchedule', applicableJurisdictions: 'all', defaultRecommendation: 'Schedule all service contracts; require <=30-day terminability', defaultRiskWhenAbsent: 'medium' },
  { key: 'personalPropSchedule', applicableJurisdictions: 'all', defaultRecommendation: 'Schedule FF&E with bill of sale', defaultRiskWhenAbsent: 'medium' },
  { key: 'intangibleAssignment', applicableJurisdictions: 'all', defaultRecommendation: 'Assign websites, social handles, tenant database, leads', defaultRiskWhenAbsent: 'medium' },
  { key: 'tenantDepositTransfer', applicableJurisdictions: 'all', defaultRecommendation: 'Transfer deposits via closing credit, not in-place ledger', defaultRiskWhenAbsent: 'high' },
  { key: 'prepaidRentTransfer', applicableJurisdictions: 'all', defaultRecommendation: 'Credit prepaid rent at close', defaultRiskWhenAbsent: 'medium' },
  { key: 'taxProration', applicableJurisdictions: 'all', defaultRecommendation: 'Prorate at midnight on closing day, true-up post-close', defaultRiskWhenAbsent: 'medium' },
  { key: 'utilityTransfer', applicableJurisdictions: 'all', defaultRecommendation: 'Seller pays final bill; buyer establishes new accounts pre-close', defaultRiskWhenAbsent: 'low' },
  { key: 'insuranceTransfer', applicableJurisdictions: 'all', defaultRecommendation: 'Buyer must bind insurance pre-close; seller maintains until close', defaultRiskWhenAbsent: 'medium' },
  { key: 'lenderSideLetters', applicableJurisdictions: 'all', defaultRecommendation: 'Required for any loan-assumption deal', defaultRiskWhenAbsent: 'high' },
  { key: 'loanAssumptionFee', applicableJurisdictions: 'all', defaultRecommendation: 'Allocate lender fee + transfer fee in PSA', defaultRiskWhenAbsent: 'medium' },
  { key: 'defeasanceAllocation', applicableJurisdictions: 'all', defaultRecommendation: 'If payoff, allocate defeasance cost (seller usually)', defaultRiskWhenAbsent: 'high' },
  { key: 'casualtyTrigger', applicableJurisdictions: 'all', defaultRecommendation: 'Use 5% / $250k threshold; buyer-terminate above', defaultRiskWhenAbsent: 'critical' },
  { key: 'condemnationTrigger', applicableJurisdictions: 'all', defaultRecommendation: 'Any partial = buyer-terminate per ULI 2024 guidance', defaultRiskWhenAbsent: 'critical' },
  { key: 'hazardInsurance', applicableJurisdictions: 'all', defaultRecommendation: 'Seller maintains until close', defaultRiskWhenAbsent: 'medium' },
  { key: 'rwiProcurement', applicableJurisdictions: 'all', defaultRecommendation: 'RWI optional but recommended for >$25M trades', defaultRiskWhenAbsent: 'low' },
  { key: 'indemnityBasket', applicableJurisdictions: 'all', defaultRecommendation: 'Basket 0.25-0.50% of price; cap 1-3%', defaultRiskWhenAbsent: 'high' },
  { key: 'holdbackEscrow', applicableJurisdictions: 'all', defaultRecommendation: 'Post-closing repair holdback in escrow', defaultRiskWhenAbsent: 'medium' },
  { key: 'brokersLienWaiver', applicableJurisdictions: 'all', defaultRecommendation: 'Broker lien waiver delivered at close', defaultRiskWhenAbsent: 'medium' },
  { key: 'constructionWarranty', applicableJurisdictions: 'all', defaultRecommendation: 'Assign all unexpired construction warranties', defaultRiskWhenAbsent: 'medium' },
  { key: 'roofHvacWarranty', applicableJurisdictions: 'all', defaultRecommendation: 'Assign roof / HVAC warranties; verify transferability', defaultRiskWhenAbsent: 'medium' },
  { key: 'soilsDisclosure', applicableJurisdictions: 'all', defaultRecommendation: 'Disclose any soils report; deliver in DD package', defaultRiskWhenAbsent: 'medium' },
  { key: 'moldDisclosure', applicableJurisdictions: 'all', defaultRecommendation: 'Disclose any mold history per IICRC S520', defaultRiskWhenAbsent: 'medium' },
  { key: 'lbpDisclosure', applicableJurisdictions: ['US'], defaultRecommendation: 'LBP disclosure required for pre-1978 builds (US EPA)', defaultRiskWhenAbsent: 'critical' },
  { key: 'asbestosDisclosure', applicableJurisdictions: 'all', defaultRecommendation: 'ACM disclosure for pre-1980 (US) or pre-1990 (EA) builds', defaultRiskWhenAbsent: 'high' },
  { key: 'radonDisclosure', applicableJurisdictions: ['US'], defaultRecommendation: 'Radon disclosure where state law requires', defaultRiskWhenAbsent: 'medium' },
  { key: 'melloRoosDisclosure', applicableJurisdictions: ['US'], defaultRecommendation: 'Mello-Roos / special-tax disclosure (CA-specific)', defaultRiskWhenAbsent: 'medium' },
  { key: 'spousalConsentKE', applicableJurisdictions: ['KE'], defaultRecommendation: 'Verify spousal consent per Matrimonial Property Act 2013', defaultRiskWhenAbsent: 'critical' },
  { key: 'familyTrustTZ', applicableJurisdictions: ['TZ'], defaultRecommendation: 'Family-trust disclosure per TZ Family Law 1971', defaultRiskWhenAbsent: 'high' },
  { key: 'customaryReleaseUG', applicableJurisdictions: ['UG'], defaultRecommendation: 'Customary tenure release per UG Land Act 1998', defaultRiskWhenAbsent: 'high' },
  { key: 'ancestralRelease', applicableJurisdictions: ['KE', 'TZ', 'UG'], defaultRecommendation: 'Notarised village-elder ancestral-claim release', defaultRiskWhenAbsent: 'high' },
];

export interface PSAFlaggerInputs {
  /** Map of clause key -> {present, buyerFavorable}. */
  readonly clauses: ReadonlyArray<{
    readonly key: PSAClauseKey;
    readonly present: boolean;
    readonly buyerFavorable: boolean;
  }>;
  readonly jurisdiction: Jurisdiction;
}

export function flagPSAClauses(inputs: PSAFlaggerInputs): ReadonlyArray<PSAClauseFlag> {
  const map = new Map(inputs.clauses.map((c) => [c.key, c]));
  const out: PSAClauseFlag[] = [];

  for (const spec of CLAUSE_SPECS) {
    const applicable =
      spec.applicableJurisdictions === 'all' ||
      spec.applicableJurisdictions.includes(inputs.jurisdiction);
    if (!applicable) continue;

    const entry = map.get(spec.key);
    const present = entry?.present ?? false;
    const buyerFavorable = entry?.buyerFavorable ?? false;

    let riskLevel: PSAClauseFlag['riskLevel'];
    if (!present) {
      riskLevel = spec.defaultRiskWhenAbsent;
    } else if (!buyerFavorable) {
      // present but seller-favorable → escalate one band
      riskLevel = escalate(spec.defaultRiskWhenAbsent);
    } else {
      riskLevel = 'low';
    }

    out.push({
      key: spec.key,
      present,
      buyerFavorable,
      riskLevel,
      recommendation: spec.defaultRecommendation,
    });
  }
  return out;
}

function escalate(r: PSAClauseFlag['riskLevel']): PSAClauseFlag['riskLevel'] {
  switch (r) {
    case 'low':
      return 'medium';
    case 'medium':
      return 'high';
    case 'high':
      return 'critical';
    case 'critical':
      return 'critical';
  }
}

export const PSA_CLAUSE_SPECS = CLAUSE_SPECS;
