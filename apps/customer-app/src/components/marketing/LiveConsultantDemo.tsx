'use client';

/**
 * Live consultant demo — streams a real answer from Mr. Mwikila via
 * the public SSE endpoint. Scoped to one question at a time, results
 * land in an embedded response panel rather than the full chat.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useChatStream } from '@bossnyumba/chat-ui';

const PROMPTS: readonly string[] = [
  'What is the best way to vet a commercial tenant in Nairobi?',
  'How should I price a 2-bedroom in Mbezi this year?',
  'My tenant claims the geyser was already broken on move-in. Now what?',
];

export function LiveConsultantDemo() {
  const t = useTranslations('liveConsultant');
  const [sessionId, setSessionId] = useState<string>('');
  const [question, setQuestion] = useState<string>('');
  const [pastQuestion, setPastQuestion] = useState<string>('');
  const streamingRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const existing = window.sessionStorage.getItem('bossnyumba_consultant_demo');
    if (existing) {
      setSessionId(existing);
    } else {
      const sid = `mk_${Math.random().toString(36).slice(2, 10)}`;
      window.sessionStorage.setItem('bossnyumba_consultant_demo', sid);
      setSessionId(sid);
    }
  }, []);

  const { state, sendMessage, reset } = useChatStream('public-guide', {
    endpoint: '/api/v1/public/chat',
    headers: { Accept: 'text/event-stream' },
    extraBody: { sessionId, transcript: [] },
  });

  const ask = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || state.isStreaming) return;
      reset();
      setPastQuestion(q);
      setQuestion('');
      await sendMessage(q);
    },
    [state.isStreaming, sendMessage, reset]
  );

  useEffect(() => {
    if (state.isStreaming && streamingRef.current) {
      streamingRef.current.scrollTop = streamingRef.current.scrollHeight;
    }
  }, [state.assistantText, state.isStreaming]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
        Live demo — ask a real estate question
      </div>
      <h3 className="mb-2 text-lg font-semibold">{t('heading')}</h3>
      <p className="mb-4 text-sm text-slate-700">
        Streams directly from Mr. Mwikila's marketing brain. No signup, no email capture.
      </p>
      <form
        className="mb-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
      >
        <input
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          placeholder={t('questionPlaceholder')}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={state.isStreaming}
        />
        <button
          type="submit"
          disabled={state.isStreaming || !question.trim()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Ask
        </button>
      </form>
      <div className="mb-3 flex flex-wrap gap-2">
        {PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => void ask(p)}
            disabled={state.isStreaming}
            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:border-emerald-500 disabled:opacity-50"
          >
            {p.length > 48 ? p.slice(0, 46) + '…' : p}
          </button>
        ))}
      </div>
      {(pastQuestion || state.assistantText) && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          {pastQuestion && (
            <div className="mb-2 text-xs text-slate-500">{t('youAskedPrefix')}: {pastQuestion}</div>
          )}
          <div
            ref={streamingRef}
            className="max-h-48 overflow-y-auto text-sm leading-relaxed text-slate-800"
          >
            {state.assistantText || (state.isStreaming ? 'Mr. Mwikila is thinking…' : '')}
            {state.isStreaming && state.assistantText && (
              <span className="text-slate-500"> …</span>
            )}
          </div>
          {state.error && (
            <div className="mt-2 text-xs text-red-700">{state.error}</div>
          )}
        </div>
      )}
    </div>
  );
}
