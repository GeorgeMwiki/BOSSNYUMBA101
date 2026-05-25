'use client';

import { useState } from 'react';
import { marketplaceClient } from '@/lib/marketplace/api-client';
import type { MarketplaceListingDetail } from '@/lib/marketplace/types';

/**
 * Application draft assistant — gathers a few prompts, builds a letter,
 * and submits the application.
 *
 * MVP flow:
 *   1. User answers 3 short fields (employment, household, move-in).
 *   2. The component composes a letter draft from those fields.
 *   3. User edits the draft inline.
 *   4. Submit → POST /listings/:id/applications.
 *
 * The "AI" today is a deterministic template — once the chat surface
 * owned by P7 stabilises, we'll swap the template for a call to
 * /v1/ask with a `marketplace_applicant` persona.
 */
export function ApplicationDraftAssistant({
  listing,
}: {
  readonly listing: MarketplaceListingDetail;
}): JSX.Element {
  const [employment, setEmployment] = useState('');
  const [household, setHousehold] = useState('');
  const [moveIn, setMoveIn] = useState('');
  const [letter, setLetter] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<
    | { readonly kind: 'success'; readonly applicationId: string }
    | { readonly kind: 'error'; readonly message: string }
    | null
  >(null);

  function composeLetter(): void {
    setLetter(
      [
        `Dear ${listing.orgName} team,`,
        '',
        `I'd like to apply for ${listing.propertyName} (${listing.unitName}). I am ${
          employment || 'a professional with stable income'
        }, household size is ${household || 'one'}, and I'd like to move in around ${
          moveIn || 'the start of next month'
        }.`,
        '',
        'I am happy to provide references and supporting documents. Thank you for considering my application.',
      ].join('\n'),
    );
  }

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const result = await marketplaceClient.postApplication(listing.listingId, {
        letterBody: letter,
      });
      setFeedback({ kind: 'success', applicationId: result.applicationId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Submission failed.';
      setFeedback({ kind: 'error', message: msg });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-chat border border-ink-muted/10 bg-surface p-4"
    >
      <h3 className="text-base font-semibold text-ink">Apply with AI help</h3>
      <p className="text-xs text-ink-muted">
        Answer three prompts, generate a draft, edit it, and submit.
      </p>
      <label className="flex flex-col gap-1 text-sm text-ink">
        What do you do for work?
        <input
          type="text"
          value={employment}
          onChange={(e) => setEmployment(e.target.value)}
          placeholder="e.g. a software engineer at Safaricom"
          className="rounded-chat border border-ink-muted/20 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink">
        Household size
        <input
          type="text"
          value={household}
          onChange={(e) => setHousehold(e.target.value)}
          placeholder="e.g. 2 adults + 1 child"
          className="rounded-chat border border-ink-muted/20 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink">
        Desired move-in date
        <input
          type="text"
          value={moveIn}
          onChange={(e) => setMoveIn(e.target.value)}
          placeholder="e.g. 1 July 2026"
          className="rounded-chat border border-ink-muted/20 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
      </label>
      <button
        type="button"
        onClick={composeLetter}
        className="self-start rounded-chat border border-brand bg-brand-light px-3 py-1.5 text-sm font-medium text-brand-dark hover:bg-brand hover:text-white"
      >
        Compose letter
      </button>
      <label className="flex flex-col gap-1 text-sm text-ink">
        Letter
        <textarea
          value={letter}
          onChange={(e) => setLetter(e.target.value)}
          rows={8}
          placeholder="Your application letter will appear here once you click Compose."
          className="rounded-chat border border-ink-muted/20 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={submitting || letter.trim().length < 20}
        className="self-start rounded-chat bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark disabled:opacity-50"
      >
        {submitting ? 'Submitting…' : 'Submit application'}
      </button>
      {feedback?.kind === 'success' ? (
        <p className="text-sm text-emerald-700">
          Application submitted. Reference {feedback.applicationId}.
        </p>
      ) : null}
      {feedback?.kind === 'error' ? (
        <p className="text-sm text-red-700">{feedback.message}</p>
      ) : null}
    </form>
  );
}
