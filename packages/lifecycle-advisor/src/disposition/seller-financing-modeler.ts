/**
 * Seller-financing modeler — recommends LTV / term / amort / rate /
 * guarantee structure for seller-take-back financing on a sale.
 *
 * Authority: MBA *Seller-Financing Guide 2024*; IRC §453 installment-
 * sale rules for tax-deferral applicability.
 */

import type {
  SellerFinancingInputs,
  SellerFinancingTerms,
} from '../types.js';

export function modelSellerFinancing(
  inputs: Readonly<SellerFinancingInputs>,
): SellerFinancingTerms {
  if (inputs.purchasePrice <= 0) {
    throw new Error('modelSellerFinancing: purchasePrice must be > 0');
  }
  // LTV scales down with worse credit
  const recommendedLTV =
    inputs.buyerCreditTier === 'IG' ? 0.70 :
    inputs.buyerCreditTier === 'sub-IG' ? 0.65 :
    0.60;
  // Term: shorter with worse credit
  const termYears =
    inputs.buyerCreditTier === 'IG' ? 7 :
    inputs.buyerCreditTier === 'sub-IG' ? 6 :
    5;
  // Amort: 25-30 yrs standard
  const amortYears = inputs.buyerCreditTier === 'IG' ? 30 : 25;
  // Rate spread vs bank rate
  const rateSpreadBps =
    inputs.buyerCreditTier === 'IG' ? 100 :
    inputs.buyerCreditTier === 'sub-IG' ? 150 :
    200;
  const recommendedRate = inputs.bankRatePct + rateSpreadBps / 10_000;
  // Personal guarantee always for non-IG; cross-collat for unrated
  const personalGuarantee = inputs.buyerCreditTier !== 'IG';
  const crossCollateralisation = inputs.buyerCreditTier === 'unrated';
  // Installment-sale §453 applicable when seller wants tax deferral
  const installmentSaleApplicable = inputs.desiredTaxDeferral;
  return {
    recommendedLTV,
    termYears,
    amortYears,
    rateSpreadBps,
    recommendedRate,
    personalGuarantee,
    crossCollateralisation,
    installmentSaleApplicable,
  };
}
