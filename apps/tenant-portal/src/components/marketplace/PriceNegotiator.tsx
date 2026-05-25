'use client';

import { useState } from 'react';
import { marketplaceClient } from '@/lib/marketplace/api-client';
import type { MarketplaceListingDetail } from '@/lib/marketplace/types';

/**
 * Price negotiator — sends a counter-offer message to the listing
 * owner. The AI fills in a rationale draft based on the listing range
 * and the user's proposed price, then the user can edit/send.
 *
 * The "AI draft" is a deterministic seed string today (we don't call
 * the brain yet) — once the chat surface owned by P7 stabilises a
 * named interface (`/v1/ask?persona=marketplace_buyer`), this
 * component will swap the seed for that call.
 */
export function PriceNegotiator({
  listing,
}: {
  readonly listing: MarketplaceListingDetail;
}): JSX.Element {
  const [proposedPrice, setProposedPrice] = useState<number>(
    Math.round((listing.priceMin + listing.priceMax) / 2),
  );
  const [message, setMessage] = useState<string>(seedDraft(listing, proposedPrice));
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<
    | { readonly kind: 'success'; readonly inquiryId: string }
    | { readonly kind: 'error'; readonly message: string }
    | null
  >(null);

  function regenerateDraft(): void {
    setMessage(seedDraft(listing, proposedPrice));
  }

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const result = await marketplaceClient.postInquiry(listing.listingId, {
        message,
        proposedPrice,
      });
      setFeedback({ kind: 'success', inquiryId: result.inquiryId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Submission failed.';
      setFeedback({ kind: 'error', message: msg });
    } finally {
      setSubmitting(false);
    }
  }

  const withinRange =
    proposedPrice >= listing.priceMin && proposedPrice <= listing.priceMax;

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-chat border border-ink-muted/10 bg-surface p-4"
    >
      <div>
        <h3 className="text-base font-semibold text-ink">Make an offer</h3>
        <p className="text-xs text-ink-muted">
          {listing.negotiable
            ? 'This unit is open to negotiation within the listed range.'
            : 'The owner has marked this listing as firm-price.'}
        </p>
      </div>
      <label className="flex flex-col gap-1 text-sm text-ink">
        Your proposed price ({listing.currency})
        <input
          type="number"
          min={1}
          inputMode="numeric"
          value={proposedPrice}
          onChange={(e) => setProposedPrice(Number(e.target.value) || 0)}
          className="rounded-chat border border-ink-muted/20 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
        {!withinRange ? (
          <span className="text-xs text-amber-700">
            Outside the listed range ({listing.priceMin.toLocaleString()} –{' '}
            {listing.priceMax.toLocaleString()}) — the owner may push back.
          </span>
        ) : null}
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink">
        <div className="flex items-center justify-between">
          <span>Message</span>
          <button
            type="button"
            onClick={regenerateDraft}
            className="text-xs text-brand hover:text-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            Regenerate AI draft
          </button>
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          className="rounded-chat border border-ink-muted/20 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={submitting || message.trim().length < 1}
        className="self-start rounded-chat bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark disabled:opacity-50"
      >
        {submitting ? 'Sending…' : 'Send offer'}
      </button>
      {feedback?.kind === 'success' ? (
        <p className="text-sm text-emerald-700">
          Offer sent. Reference {feedback.inquiryId}.
        </p>
      ) : null}
      {feedback?.kind === 'error' ? (
        <p className="text-sm text-red-700">{feedback.message}</p>
      ) : null}
    </form>
  );
}

function seedDraft(listing: MarketplaceListingDetail, price: number): string {
  return [
    `Hi ${listing.orgName} team,`,
    '',
    `I'm interested in ${listing.propertyName} (${listing.unitName}). Based on the listed range of ${listing.priceMin.toLocaleString()} – ${listing.priceMax.toLocaleString()} ${listing.currency}, I'd like to propose ${price.toLocaleString()} ${listing.currency}.`,
    '',
    'Looking forward to hearing from you.',
  ].join('\n');
}
