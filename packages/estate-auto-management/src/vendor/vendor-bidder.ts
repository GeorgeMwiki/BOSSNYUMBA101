/**
 * Vendor bidder — pure builder of synthetic bid records derived
 * from each vendor's historical profile. Real bids would be
 * collected by an outside adapter; this function is the policy
 * fallback when only profile data is available.
 */

import type { VendorBid, VendorProfile } from '../types.js';

export interface SyntheticBidOptions {
  /** Apply a price bias (e.g. -0.05 = bids 5% under median). */
  readonly priceBias?: number;
  /** Apply a response-time bias (e.g. -0.10 = 10% faster). */
  readonly responseBias?: number;
  /** Validity window in days (default 14). */
  readonly validUntilDays?: number;
}

export function syntheticBids(
  vendors: ReadonlyArray<VendorProfile>,
  o: SyntheticBidOptions = {},
): VendorBid[] {
  const priceBias = o.priceBias ?? 0;
  const responseBias = o.responseBias ?? 0;
  const validity = o.validUntilDays ?? 14;

  return vendors
    .filter((v) => v.available && v.compliant)
    .map((v) => ({
      vendorId: v.id,
      quotedPrice: Math.max(0, v.medianJobPrice * (1 + priceBias)),
      quotedResponseHours: Math.max(0.5, v.medianResponseHours * (1 + responseBias)),
      validUntilDays: validity,
    }));
}

/** Aggregator: best (lowest) price + best (lowest) response in a bid set. */
export function bidExtremes(
  bids: ReadonlyArray<VendorBid>,
): { readonly bestPrice: number; readonly bestResponseHours: number } {
  if (bids.length === 0) return { bestPrice: 0, bestResponseHours: 0 };
  const bestPrice = Math.min(...bids.map((b) => b.quotedPrice));
  const bestResponseHours = Math.min(...bids.map((b) => b.quotedResponseHours));
  return { bestPrice, bestResponseHours };
}
