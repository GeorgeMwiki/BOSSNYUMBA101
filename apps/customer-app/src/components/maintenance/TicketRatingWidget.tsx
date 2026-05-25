'use client';

/**
 * TicketRatingWidget — 5-star rating + comment for a closed ticket.
 *
 * POSTs to `/api/v1/maintenance/tickets/:id/feedback`. The widget shows
 * an inline confirmation on success and disables itself; the rating
 * cannot be re-submitted (idempotency lives server-side; the UI mirrors
 * that by transitioning to a read-only state).
 *
 * E2E expectations (see `e2e/page-objects/CustomerAppPage.ts`):
 *   - `ratingStars` resolves to a container with `[data-rating]`
 *     attribute or `[data-testid="rating-stars"]`.
 *   - Each star is a button under that container (`button, [data-star]`).
 *   - Submitting fires a POST that includes the request URL fragment
 *     `/api/v1/maintenance` or `/api/v1/ratings`.
 */

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Send, Star, ThumbsUp } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/api';
import { getCsrfHeaders } from '@/lib/csrf';

const STARS: ReadonlyArray<1 | 2 | 3 | 4 | 5> = [1, 2, 3, 4, 5];

export interface TicketRatingWidgetProps {
  readonly ticketId: string;
  readonly onSubmitted?: (score: number, comment: string) => void;
}

function authHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = window.localStorage.getItem('customer_token') ?? '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function TicketRatingWidget({
  ticketId,
  onSubmitted,
}: TicketRatingWidgetProps): JSX.Element {
  const t = useTranslations('p89.ticketRating');
  const [score, setScore] = useState<number>(0);
  const [hover, setHover] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
      e.preventDefault();
      if (score < 1) {
        setError('Please tap a star to rate.');
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch(
          `${getApiBaseUrl()}/maintenance/tickets/${encodeURIComponent(ticketId)}/feedback`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...authHeader(),
              ...getCsrfHeaders(),
            },
            body: JSON.stringify({ score, comment: comment.trim() || undefined }),
          },
        );
        if (!res.ok) {
          throw new Error(`Rating submission failed (${res.status})`);
        }
        setSubmitted(true);
        onSubmitted?.(score, comment.trim());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Rating submission failed');
      } finally {
        setSubmitting(false);
      }
    },
    [score, comment, ticketId, onSubmitted],
  );

  if (submitted) {
    return (
      <div
        className="rounded-lg border border-emerald-500/40 bg-emerald-900/20 p-4 text-emerald-200 inline-flex items-center gap-3"
        role="status"
        data-testid="rating-thanks"
      >
        <ThumbsUp className="h-5 w-5" />
        <span className="text-sm">Thanks for rating — feedback received.</span>
      </div>
    );
  }

  const effective = hover || score;

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      data-testid="ticket-rating-form"
      className="space-y-3 rounded-lg border border-white/10 bg-[#1a1a1a] p-4"
    >
      <div>
        <p className="text-sm font-medium text-white">{t('prompt')}</p>
        <p className="text-xs text-gray-400">
          Your rating helps us improve dispatch and response times.
        </p>
      </div>

      <div
        className="flex items-center gap-2"
        role="radiogroup"
        aria-label="Rating"
        data-rating
        data-testid="rating-stars"
      >
        {STARS.map((star) => {
          const filled = star <= effective;
          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={score === star}
              aria-label={`${star} star${star > 1 ? 's' : ''}`}
              data-star={star}
              data-testid={`star-${star}`}
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(0)}
              onFocus={() => setHover(star)}
              onBlur={() => setHover(0)}
              onClick={() => setScore(star)}
              className="rounded p-1 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Star
                className={
                  filled
                    ? 'h-7 w-7 fill-amber-400 text-amber-400'
                    : 'h-7 w-7 text-gray-500'
                }
              />
            </button>
          );
        })}
      </div>

      <label className="block text-sm">
        <span className="block text-gray-400 mb-1">
          Comments <span className="text-xs">(optional)</span>
        </span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          aria-label="Comment"
          data-testid="rating-comment"
          placeholder={t('commentPlaceholder')}
          className="block w-full rounded-md border border-white/10 bg-[#121212] px-3 py-2 text-sm text-white"
        />
      </label>

      {error ? (
        <div
          role="alert"
          className="rounded-md bg-red-900/30 border border-red-500/40 text-red-200 px-3 py-2 text-xs"
        >
          {error}
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting || score < 1}
          data-testid="submit-rating"
          aria-label={t('submitAria')}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {submitting ? 'Submitting…' : 'Submit'}
        </button>
      </div>
    </form>
  );
}
