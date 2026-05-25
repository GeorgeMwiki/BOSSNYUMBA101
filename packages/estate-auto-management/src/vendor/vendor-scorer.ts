/**
 * Multi-criteria vendor scorer.
 *
 * Weights (FacilitySource / JLL Work Dynamics 2026):
 *   price 30, response 25, quality 25, proximity 10, compliance 10
 *
 * All sub-scores normalise into [0,1]; total ∈ [0,1].
 */

import type { VendorBid, VendorProfile, VendorScore } from '../types.js';

export interface ScorerWeights {
  readonly price: number;
  readonly response: number;
  readonly quality: number;
  readonly proximity: number;
  readonly compliance: number;
}

const DEFAULT_WEIGHTS: ScorerWeights = {
  price: 0.30,
  response: 0.25,
  quality: 0.25,
  proximity: 0.10,
  compliance: 0.10,
};

export interface ScoringInputs {
  readonly vendor: VendorProfile;
  readonly bid?: VendorBid;
  /** Best price observed in this round (for normalisation). */
  readonly bestPrice: number;
  /** Best response hours observed in this round. */
  readonly bestResponseHours: number;
}

export function scoreVendor(
  i: ScoringInputs,
  weights: ScorerWeights = DEFAULT_WEIGHTS,
): VendorScore {
  const priceCandidate = i.bid?.quotedPrice ?? i.vendor.medianJobPrice;
  const responseCandidate = i.bid?.quotedResponseHours ?? i.vendor.medianResponseHours;

  const priceScore = ratio(i.bestPrice, priceCandidate);
  const responseScore = ratio(i.bestResponseHours, responseCandidate);
  const qualityScore = clamp01(1 - i.vendor.reworkRate);
  const proximityScore = Math.exp(-i.vendor.distanceKm / 25);
  const complianceScore = i.vendor.compliant ? 1 : 0;

  const total =
    weights.price * priceScore +
    weights.response * responseScore +
    weights.quality * qualityScore +
    weights.proximity * proximityScore +
    weights.compliance * complianceScore;

  return {
    vendorId: i.vendor.id,
    priceScore,
    responseScore,
    qualityScore,
    proximityScore,
    complianceScore,
    total,
  };
}

function ratio(best: number, candidate: number): number {
  if (candidate <= 0) return 0;
  return clamp01(best / candidate);
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
