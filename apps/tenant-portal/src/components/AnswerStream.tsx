'use client';

import type { AskAnswer } from '@/lib/ask-client';
import { CitationFootnote } from './CitationFootnote';

interface Props {
  readonly answer: AskAnswer | null;
  readonly loading: boolean;
  readonly error: string | null;
}

/**
 * Renders the brain's answer plus citations + follow-up prompts.
 *
 * The /v1/ask route is JSON today (the AdviseResponse is computed in
 * one synchronous orchestrator call). When the backend later upgrades
 * to SSE / chunked streaming, this component will switch to consuming
 * a `ReadableStream` — the parent will swap `answer` with a streaming
 * accumulator. For now it just renders the final payload.
 */
export function AnswerStream({ answer, loading, error }: Props) {
  if (loading) {
    return (
      <div className="rounded-chat bg-surface p-4 text-ink-muted shadow-panel">
        <p className="animate-pulse">Thinking…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-chat border border-red-300 bg-red-50 p-4 text-red-800">
        {error}
      </div>
    );
  }
  if (!answer) return null;

  return (
    <article className="rounded-chat bg-surface p-4 shadow-panel" data-testid="answer-card">
      <p className="whitespace-pre-wrap text-ink" data-testid="answer-text">
        {answer.answer}
      </p>

      {answer.citations.length > 0 ? (
        <div className="mt-3" data-testid="answer-citations">
          {answer.citations.map((c, i) => (
            <CitationFootnote key={c.id} citation={c} index={i} />
          ))}
        </div>
      ) : null}

      {answer.suggestedFollowUps.length > 0 ? (
        <div className="mt-4" data-testid="answer-followups">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Suggested next questions
          </p>
          <ul className="mt-2 space-y-1 text-sm text-ink-muted">
            {answer.suggestedFollowUps.map((f) => (
              <li key={f}>— {f}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
