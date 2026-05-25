/**
 * Capital-raise structurer — recommends 506(b) vs 506(c) (US) or
 * EA equivalents (KE-AIF, KE private-placement, TZ private-placement).
 *
 * Authority: SEC Reg D — Rules 506(b), 506(c) (17 CFR §230.506),
 * JOBS Act 2012, 2020 amendments; Capital Markets Authority Act
 * (Kenya), Capital Markets (Alternative Investment Funds)
 * Regulations 2023; CMSA (Tanzania).
 */

import type {
  CapitalRaiseInputs,
  CapitalRaiseResult,
} from '../types.js';

const US_506B_MAX_NONACC = 35;
const KE_PP_MAX_INVESTORS = 20;
const TZ_PP_MAX_INVESTORS = 50;

export function structureCapitalRaise(
  inputs: Readonly<CapitalRaiseInputs>,
): CapitalRaiseResult {
  if (inputs.jurisdiction === 'KE') {
    if (inputs.hasRegulatedFundStructure) {
      return {
        structure: 'ke-aif',
        rationale: 'Kenya regulated alternative-investment fund under CMA AIF Regulations 2023; permits broader marketing within fund-licensee bounds',
        verificationRequired: 'regulator',
        marketingAllowed: 'public',
        maxNonAccredited: 0,
        statutoryCitation: 'Capital Markets (Alternative Investment Funds) Regulations 2023',
      };
    }
    return {
      structure: 'ke-private-placement-20',
      rationale: `Kenya private-placement exemption up to ${KE_PP_MAX_INVESTORS} investors; below threshold of full prospectus`,
      verificationRequired: 'self-cert',
      marketingAllowed: 'private-only',
      maxNonAccredited: KE_PP_MAX_INVESTORS,
      statutoryCitation: 'Capital Markets Authority Act + Public Offers, Listing & Disclosures Regulations 2002',
    };
  }
  if (inputs.jurisdiction === 'TZ') {
    return {
      structure: 'tz-private-placement-50',
      rationale: `Tanzania private-placement exemption up to ${TZ_PP_MAX_INVESTORS} sophisticated investors`,
      verificationRequired: 'self-cert',
      marketingAllowed: 'private-only',
      maxNonAccredited: TZ_PP_MAX_INVESTORS,
      statutoryCitation: 'Capital Markets & Securities Authority Act',
    };
  }
  // US / default
  if (inputs.wantsGeneralSolicitation) {
    if (!inputs.accreditedOnly) {
      throw new Error('structureCapitalRaise: 506(c) requires accreditedOnly=true (no non-accredited permitted)');
    }
    return {
      structure: '506-c',
      rationale: 'General solicitation permitted (web, social, public marketing); accredited-only with reasonable-verification',
      verificationRequired: 'reasonable-steps',
      marketingAllowed: 'public',
      maxNonAccredited: 0,
      statutoryCitation: '17 CFR §230.506(c); JOBS Act 2012',
    };
  }
  if (inputs.nonAccreditedCount > US_506B_MAX_NONACC) {
    throw new Error(`structureCapitalRaise: 506(b) caps non-accredited at ${US_506B_MAX_NONACC} (requested ${inputs.nonAccreditedCount})`);
  }
  return {
    structure: '506-b',
    rationale: `Pre-existing relationships only; up to ${US_506B_MAX_NONACC} non-accredited + unlimited accredited`,
    verificationRequired: 'self-cert',
    marketingAllowed: 'private-only',
    maxNonAccredited: US_506B_MAX_NONACC,
    statutoryCitation: '17 CFR §230.506(b)',
  };
}
