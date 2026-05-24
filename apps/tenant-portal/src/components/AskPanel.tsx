'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchStartingPoints,
  postAsk,
  postFeedback,
  type AskAnswer,
  type AskChip,
} from '@/lib/ask-client';
import { StartingPointChip } from './StartingPointChip';
import { AnswerStream } from './AnswerStream';

interface Props {
  /**
   * Optional injection points for tests. In production all three default
   * to the real `ask-client` functions.
   */
  readonly _fetchStartingPoints?: typeof fetchStartingPoints;
  readonly _postAsk?: typeof postAsk;
  readonly _postFeedback?: typeof postFeedback;
}

/**
 * The main chat surface — input box, chips above it, answer below.
 *
 * State is co-located on purpose: the panel is a self-contained widget
 * embeddable in any tenant-portal page. Wider state (history, multiple
 * sessions) belongs in a future store; this MVP keeps the surface area
 * small.
 */
export function AskPanel({
  _fetchStartingPoints = fetchStartingPoints,
  _postAsk = postAsk,
  _postFeedback = postFeedback,
}: Props = {}) {
  const sessionId = useMemo(
    () => `sess_${Math.random().toString(36).slice(2, 10)}`,
    [],
  );
  const [chips, setChips] = useState<ReadonlyArray<AskChip>>([]);
  const [chipsError, setChipsError] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<AskAnswer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackSent, setFeedbackSent] = useState<null | 'up' | 'down'>(null);

  // Load chips on mount. We don't gate the input on chips loading — the
  // user can start typing immediately even if the chip list is still in
  // flight.
  useEffect(() => {
    let cancelled = false;
    _fetchStartingPoints(sessionId)
      .then((data) => {
        if (!cancelled) setChips(data.chips);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          setChipsError(msg);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, _fetchStartingPoints]);

  const submit = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (trimmed.length < 2) return;
      setLoading(true);
      setError(null);
      setAnswer(null);
      setFeedbackSent(null);
      try {
        const ans = await _postAsk(trimmed, sessionId);
        setAnswer(ans);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [sessionId, _postAsk],
  );

  const handleChipSelect = useCallback(
    (chip: AskChip) => {
      setQuestion(chip.prompt);
      void submit(chip.prompt);
    },
    [submit],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      void submit(question);
    },
    [question, submit],
  );

  const sendFeedback = useCallback(
    async (rating: 1 | 5) => {
      if (!answer) return;
      try {
        await _postFeedback({ sessionId, answerId: answer.answerId, rating });
        setFeedbackSent(rating === 5 ? 'up' : 'down');
      } catch (err) {
        // Surface inline error but don't crash the panel.
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [_postFeedback, answer, sessionId],
  );

  return (
    <section
      className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4"
      data-testid="ask-panel"
    >
      <header>
        <h1 className="text-xl font-semibold text-ink">Ask anything</h1>
        <p className="text-sm text-ink-muted">
          About your lease, your unit, your neighbourhood — the advisor
          shapes its answer to you.
        </p>
      </header>

      <div className="flex flex-wrap gap-2" data-testid="chip-row">
        {chips.map((c) => (
          <StartingPointChip key={c.id} chip={c} onSelect={handleChipSelect} />
        ))}
        {chips.length === 0 && !chipsError ? (
          <span className="text-xs text-ink-muted">Loading suggestions…</span>
        ) : null}
        {chipsError ? (
          <span className="text-xs text-red-600" data-testid="chips-error">
            {chipsError}
          </span>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2" data-testid="ask-form">
        <input
          aria-label="Ask a question"
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What can I help with?"
          className="flex-1 rounded-chat border border-ink-muted/30 bg-surface px-4 py-3 text-base text-ink shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
          data-testid="ask-input"
        />
        <button
          type="submit"
          disabled={loading || question.trim().length < 2}
          className="rounded-chat bg-brand px-4 py-3 text-sm font-medium text-white shadow-panel transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="ask-submit"
        >
          {loading ? 'Asking…' : 'Ask'}
        </button>
      </form>

      <AnswerStream answer={answer} loading={loading} error={error} />

      {answer ? (
        <div className="flex items-center gap-2" data-testid="feedback-row">
          <button
            type="button"
            onClick={() => void sendFeedback(5)}
            disabled={feedbackSent !== null}
            className="rounded-chip border border-ink-muted/30 bg-surface px-3 py-1 text-sm text-ink-muted hover:border-brand hover:text-brand disabled:opacity-50"
            data-testid="thumbs-up"
            aria-label="Helpful answer"
          >
            👍 Helpful
          </button>
          <button
            type="button"
            onClick={() => void sendFeedback(1)}
            disabled={feedbackSent !== null}
            className="rounded-chip border border-ink-muted/30 bg-surface px-3 py-1 text-sm text-ink-muted hover:border-brand hover:text-brand disabled:opacity-50"
            data-testid="thumbs-down"
            aria-label="Unhelpful answer"
          >
            👎 Not quite
          </button>
          {feedbackSent ? (
            <span className="text-xs text-ink-muted" data-testid="feedback-ack">
              Thanks — feedback recorded.
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
