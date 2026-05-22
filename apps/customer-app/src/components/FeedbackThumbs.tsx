'use client';

/**
 * FeedbackThumbs — per-Jarvis-turn feedback widget.
 *
 * LITFIN parity gap B (`.planning/parity-litfin/02-memory-learning.md`):
 *   BOSSNYUMBA built the entire feedback backend (kernel_feedback table,
 *   POST /feedback route, recordFeedback SDK method, renderFeedbackFragment
 *   in the kernel) but no UI surface mounted it. This component closes
 *   the loop: a 👍/👎 button beneath each assistant turn that fires the
 *   caller-provided `onFeedback` handler. A 👎 click expands a 1-line
 *   reason input so the user can supply a verbatim correction —
 *   `kernel.ts:1161-1218` `renderFeedbackFragment` pulls those into the
 *   next system prompt directly.
 *
 * UX notes:
 *
 *   - Optimistic UI: both buttons disable during submit. On error the
 *     buttons restore so the user can retry, and a one-line toast
 *     announces the failure (auto-clears after 3s).
 *   - Submit happens via the `onFeedback` callback so the caller owns
 *     transport (POST /api/v1/feedback, the SDK's recordFeedback, an
 *     offline outbox, etc.). This component is transport-agnostic.
 *   - The 👎 reason input is opt-in: clicking 👎 immediately fires the
 *     onFeedback('down') call AND reveals the reason input. If the user
 *     types a correction and submits, a SECOND call goes out with the
 *     reason. This matches LITFIN's emoji-tap-then-amplify flow.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

export type FeedbackVerdict = 'up' | 'down';

export interface FeedbackThumbsProps {
  /** The Jarvis turn id this feedback attaches to. */
  readonly turnId: string;
  /** Submit handler. Resolves on success, throws on failure. */
  readonly onFeedback: (verdict: FeedbackVerdict, reason?: string) => Promise<void>;
  /** Disable both buttons regardless of internal state. */
  readonly disabled?: boolean;
}

const REASON_MAX_LEN = 200;
const TOAST_DURATION_MS = 3000;

export function FeedbackThumbs({
  turnId,
  onFeedback,
  disabled = false,
}: FeedbackThumbsProps): JSX.Element {
  const t = useTranslations('feedbackThumbs');
  const [submitting, setSubmitting] = useState(false);
  const [submittedVerdict, setSubmittedVerdict] = useState<FeedbackVerdict | null>(null);
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Auto-clear the error toast.
  useEffect(() => {
    if (!error) return;
    const handle = setTimeout(() => setError(null), TOAST_DURATION_MS);
    return () => clearTimeout(handle);
  }, [error]);

  const submit = useCallback(
    async (verdict: FeedbackVerdict, reasonText?: string): Promise<void> => {
      if (submitting || disabled) return;
      setSubmitting(true);
      setError(null);
      try {
        await onFeedback(verdict, reasonText);
        setSubmittedVerdict(verdict);
        if (verdict === 'down') {
          setShowReason(true);
        } else {
          setShowReason(false);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Feedback failed';
        setError(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [submitting, disabled, onFeedback],
  );

  const submitReason = useCallback(
    async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
      e.preventDefault();
      const trimmed = reason.trim();
      if (!trimmed) return;
      await submit('down', trimmed);
      if (!error) setReason('');
    },
    [reason, submit, error],
  );

  const buttonsDisabled = submitting || disabled;
  const upChosen = submittedVerdict === 'up';
  const downChosen = submittedVerdict === 'down';

  return (
    <div
      className="mt-2 flex flex-col gap-2"
      data-testid={`feedback-thumbs-${turnId}`}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{t('prompt')}</span>
        <button
          type="button"
          aria-label={t('thumbsUp')}
          aria-pressed={upChosen}
          disabled={buttonsDisabled}
          onClick={() => void submit('up')}
          className={
            upChosen
              ? 'rounded border border-primary bg-primary px-2 py-1 text-primary-foreground disabled:opacity-50'
              : 'rounded border border-border bg-surface px-2 py-1 text-foreground hover:bg-surface-sunken disabled:opacity-50'
          }
        >
          {'\u{1F44D}'}
        </button>
        <button
          type="button"
          aria-label={t('thumbsDown')}
          aria-pressed={downChosen}
          disabled={buttonsDisabled}
          onClick={() => void submit('down')}
          className={
            downChosen
              ? 'rounded border border-destructive bg-destructive px-2 py-1 text-destructive-foreground disabled:opacity-50'
              : 'rounded border border-border bg-surface px-2 py-1 text-foreground hover:bg-surface-sunken disabled:opacity-50'
          }
        >
          {'\u{1F44E}'}
        </button>
      </div>

      {showReason ? (
        <form onSubmit={submitReason} className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX_LEN))}
            placeholder="Tell me what was wrong (optional)"
            aria-label="Feedback reason"
            disabled={buttonsDisabled}
            className="min-w-0 flex-1 rounded border border-border bg-surface px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground disabled:opacity-50"
            maxLength={REASON_MAX_LEN}
          />
          <button
            type="submit"
            disabled={buttonsDisabled || reason.trim().length === 0}
            className="rounded border border-border bg-surface px-2 py-1 text-xs text-foreground disabled:opacity-50"
          >
            Send
          </button>
        </form>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="text-xs text-destructive"
          data-testid="feedback-error"
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
