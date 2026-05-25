/**
 * Vendor selector — composes scorer + bids, picks the best
 * vendor that's available, falls back down the ranked list.
 */

import type { VendorBid, VendorProfile, VendorScore, VendorSelection } from '../types.js';
import { bidExtremes } from './vendor-bidder.js';
import { scoreVendor, type ScorerWeights } from './vendor-scorer.js';

export interface SelectionInputs {
  readonly vendors: ReadonlyArray<VendorProfile>;
  readonly bids?: ReadonlyArray<VendorBid>;
  readonly weights?: ScorerWeights;
}

export function selectVendor(input: SelectionInputs): VendorSelection {
  const eligible = input.vendors.filter((v) => v.compliant);
  if (eligible.length === 0) {
    return {
      selected: undefined,
      ranked: [],
      reason: 'no compliant vendor in pool',
    };
  }

  const bids = input.bids ?? [];
  const { bestPrice, bestResponseHours } = bidExtremes(bids);

  const scored: VendorScore[] = eligible
    .map((v) => {
      const bid = bids.find((b) => b.vendorId === v.id);
      return scoreVendor(
        {
          vendor: v,
          ...(bid ? { bid } : {}),
          bestPrice: bestPrice > 0 ? bestPrice : v.medianJobPrice,
          bestResponseHours:
            bestResponseHours > 0 ? bestResponseHours : v.medianResponseHours,
        },
        input.weights,
      );
    })
    .sort((a, b) => b.total - a.total);

  // Pick first scored vendor whose profile is still `available`.
  const profileById = new Map(eligible.map((v) => [v.id, v]));
  const selected = scored.find((s) => profileById.get(s.vendorId)?.available);

  return {
    selected,
    ranked: scored,
    reason: selected
      ? `selected ${selected.vendorId} (score ${selected.total.toFixed(3)})`
      : 'no available vendor among compliant pool',
  };
}
