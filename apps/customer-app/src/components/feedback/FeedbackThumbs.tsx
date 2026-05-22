'use client';

/**
 * FeedbackThumbs (generic-context wrapper).
 *
 * The original `@/components/FeedbackThumbs` is specialised to a
 * Jarvis turn (`turnId` + caller-owned POST). This generic version
 * accepts a context discriminator (`brain` / `support` / `document`)
 * and a `contextId`, and POSTs directly to
 * `/api/v1/feedback` with the shape
 *   { contextId, type, value }
 *
 * Use this when the caller doesn't already have a per-turn POST
 * pipeline (e.g. on the support page, doc preview screen). For
 * Jarvis turns keep the original component so it can route through
 * `kernel_feedback` rather than the generic feedback table.
 */

import { useEffect, useState } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/api';
import { getCsrfHeaders } from '@/lib/csrf';

export type FeedbackContextType =
  | 'brain'
  | 'support'
  | 'document'
  | 'maintenance';

export interface FeedbackThumbsProps {
  readonly contextId: string;
  readonly contextType: FeedbackContextType;
  readonly label?: string;
}

const TOAST_MS = 3000;

function authHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = window.localStorage.getItem('customer_token') ?? '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function FeedbackThumbs({
  contextId,
  contextType,
  label,
}: FeedbackThumbsProps): JSX.Element {
  const [submitting, setSubmitting] = useState(false);
  const [chosen, setChosen] = useState<'up' | 'down' | null>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(
    null,
  );

  useEffect(() => {
    if (!toast) return;
    const h = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(h);
  }, [toast]);

  async function submit(value: 'up' | 'down'): Promise<void> {
    if (submitting || chosen === value) return;
    setSubmitting(true);
    const previous = chosen;
    setChosen(value);
    try {
      const res = await fetch(`${getApiBaseUrl()}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
          ...getCsrfHeaders(),
        },
        body: JSON.stringify({
          contextId,
          type: contextType,
          value,
        }),
      });
      if (!res.ok) {
        throw new Error(`Feedback failed (${res.status})`);
      }
      setToast({ kind: 'ok', msg: 'Thanks for the feedback.' });
    } catch (err) {
      setChosen(previous);
      const message = err instanceof Error ? err.message : 'Feedback failed';
      setToast({ kind: 'err', msg: message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="flex items-center gap-2"
      data-testid={`feedback-thumbs-${contextType}-${contextId}`}
    >
      {label ? (
        <span className="text-xs text-gray-400">{label}</span>
      ) : null}
      <button
        type="button"
        onClick={() => void submit('up')}
        disabled={submitting}
        aria-label="Thumbs up"
        aria-pressed={chosen === 'up'}
        data-testid={`thumbs-up-${contextType}-${contextId}`}
        className={
          chosen === 'up'
            ? 'rounded-md border border-blue-500 bg-blue-500/10 p-1.5 text-blue-300 disabled:opacity-60'
            : 'rounded-md border border-white/10 bg-[#1a1a1a] p-1.5 text-gray-300 hover:bg-white/5 disabled:opacity-50'
        }
      >
        <ThumbsUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => void submit('down')}
        disabled={submitting}
        aria-label="Thumbs down"
        aria-pressed={chosen === 'down'}
        data-testid={`thumbs-down-${contextType}-${contextId}`}
        className={
          chosen === 'down'
            ? 'rounded-md border border-red-500 bg-red-500/10 p-1.5 text-red-300 disabled:opacity-60'
            : 'rounded-md border border-white/10 bg-[#1a1a1a] p-1.5 text-gray-300 hover:bg-white/5 disabled:opacity-50'
        }
      >
        <ThumbsDown className="h-4 w-4" />
      </button>
      {toast ? (
        <span
          role={toast.kind === 'err' ? 'alert' : 'status'}
          className={
            toast.kind === 'err'
              ? 'text-xs text-red-300'
              : 'text-xs text-emerald-300'
          }
        >
          {toast.msg}
        </span>
      ) : null}
    </div>
  );
}
