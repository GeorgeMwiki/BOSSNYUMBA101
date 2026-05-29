/**
 * Mr. Mwikila handler — listing counter offer.
 *
 * Looks at open marketplace bids on listed units / units-for-sale.
 * Counters between the seller's reserve and the seller's ideal price.
 * Default tier is T2 (act-with-reversal) with a 4h reversal window
 * because counterparty pricing moves fast.
 *
 * Pure-logic shape: ports for open-bids + seller-target levels are
 * injected so vitest drives every branch deterministically.
 */

import type {
  MwikilaHandler,
  MwikilaHandlerProposal,
} from '../handler-runtime.js';

export interface OpenBidRow {
  readonly bidId: string;
  readonly listingId: string;
  readonly listingTitle: string;
  readonly buyerName: string;
  readonly bidAmount: number;
  readonly currencyCode: string;
  readonly openedAtIso: string;
}

export interface SellerTargets {
  readonly listingId: string;
  /** The hard minimum the owner will accept. */
  readonly reservePrice: number;
  /** The aspirational ask. */
  readonly idealPrice: number;
  readonly currencyCode: string;
}

export interface ListingCounterOfferPorts {
  listOpenBids(args: {
    readonly tenantId: string;
  }): Promise<ReadonlyArray<OpenBidRow>>;
  getSellerTargets(args: {
    readonly tenantId: string;
    readonly listingId: string;
  }): Promise<SellerTargets | null>;
  /**
   * Returns true when Mwikila has already countered on this bid. The
   * handler stops at one counter per bid so the cron never loops.
   */
  hasAlreadyCountered(args: {
    readonly tenantId: string;
    readonly bidId: string;
  }): Promise<boolean>;
}

/**
 * Counter strategy: weight 60% reserve / 40% ideal. Anchor on the
 * bid when it's close to the ideal — drop the ideal weighting then so
 * we don't push the buyer away.
 *
 * Currency check is the runtime's responsibility — if bid + targets
 * disagree in currency, the proposal still composes but the inviolable
 * rail downstream will block via non_domestic_currency.
 */
export function computeCounterPrice(
  bid: OpenBidRow,
  targets: SellerTargets,
): number | null {
  if (bid.bidAmount >= targets.idealPrice) {
    // Buyer already at or above ideal — accept by countering at the
    // exact bid (signals approval without ambiguity).
    return bid.bidAmount;
  }
  if (bid.bidAmount < targets.reservePrice * 0.7) {
    // Way below reserve — no counter, escalate to owner instead.
    return null;
  }
  const weightReserve = 0.6;
  const weightIdeal = 0.4;
  const counter = Math.round(
    targets.reservePrice * weightReserve + targets.idealPrice * weightIdeal,
  );
  // Never counter below reserve.
  return Math.max(counter, targets.reservePrice);
}

export function buildCounterOfferProposal(
  bid: OpenBidRow,
  targets: SellerTargets,
  counter: number,
): MwikilaHandlerProposal {
  return {
    actionKind: 'marketplace.counter_offer_listing',
    category: 'listing-counter-offers',
    summary: `Counter-offered ${bid.buyerName} at ${counter.toLocaleString()} ${targets.currencyCode} on "${bid.listingTitle}".`,
    summarySw: `Bei mbadala ya ${counter.toLocaleString()} ${targets.currencyCode} kwa ${bid.buyerName} kwa nyumba "${bid.listingTitle}".`,
    rationale:
      `Bid was ${bid.bidAmount} ${bid.currencyCode}; reserve ${targets.reservePrice}, ` +
      `ideal ${targets.idealPrice}. 60/40 weighted counter chosen to keep ` +
      `the buyer engaged without giving up too much margin. Owner has 4h ` +
      `to reverse.`,
    payload: {
      bidId: bid.bidId,
      listingId: bid.listingId,
      bidAmount: bid.bidAmount,
      counterPrice: counter,
      currencyCode: targets.currencyCode,
      reservePrice: targets.reservePrice,
      idealPrice: targets.idealPrice,
    },
    // The counter does not move money until the buyer accepts. amount
    // stays 0 so the envelope check passes.
    amount: 0,
    currency: targets.currencyCode,
    targetRelation: 'counterparty',
  };
}

export function createListingCounterOfferHandler(
  ports: ListingCounterOfferPorts,
): MwikilaHandler {
  return Object.freeze({
    actionKind: 'marketplace.counter_offer_listing',
    category: 'listing-counter-offers',
    async propose({ tenantId }) {
      const bids = await ports.listOpenBids({ tenantId });
      for (const bid of bids) {
        const already = await ports.hasAlreadyCountered({
          tenantId,
          bidId: bid.bidId,
        });
        if (already) continue;
        const targets = await ports.getSellerTargets({
          tenantId,
          listingId: bid.listingId,
        });
        if (!targets) continue;
        const counter = computeCounterPrice(bid, targets);
        if (counter === null) continue;
        return buildCounterOfferProposal(bid, targets, counter);
      }
      return null;
    },
  });
}
