'use client';

import { useState } from 'react';

/**
 * Public landing page — bossnyumba.com.
 *
 * Renders Mr. Mwikila's marketing chat as the primary call-to-action.
 * The chat is UNAUTHENTICATED and talks to /api/v1/public/chat in the
 * gateway. No production tenant data is reachable from here.
 */
export default function HomePage() {
  const [sessionId] = useState(() => `mk_${Math.random().toString(36).slice(2, 10)}`);
  const [turns, setTurns] = useState<Array<{ role: 'visitor' | 'assistant'; content: string }>>(
    [
      {
        role: 'assistant',
        content:
          'Hi, I am Mr. Mwikila. Are you an owner, a tenant, a property manager, or a station master? That tells me which BOSSNYUMBA capability to show you first.',
      },
    ]
  );
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [suggestedRoute, setSuggestedRoute] = useState<string | null>(null);

  async function send(message: string) {
    if (!message.trim() || sending) return;
    setSending(true);
    const nextTurns = [...turns, { role: 'visitor' as const, content: message }];
    setTurns(nextTurns);
    setInput('');
    try {
      const res = await fetch('/api/v1/public/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message,
          transcript: nextTurns,
        }),
      });
      const json = await res.json();
      if (json?.success && json.data?.reply) {
        setTurns((t) => [...t, { role: 'assistant', content: json.data.reply }]);
        setSuggestedRoute(json.data.suggestedRoute ?? null);
      } else {
        setTurns((t) => [
          ...t,
          { role: 'assistant', content: 'I lost my train of thought. Try again?' },
        ]);
      }
    } catch {
      setTurns((t) => [
        ...t,
        { role: 'assistant', content: 'I could not reach the server. Check your connection.' },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10">
      <section className="mx-auto max-w-3xl">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-slate-900">BOSSNYUMBA</h1>
          <p className="mt-2 text-lg text-slate-600">
            Estate management, reimagined. Meet Mr. Mwikila, your AI partner for every estate role.
          </p>
        </header>

        <div className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-200">
          <div className="mb-4 flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-emerald-500 text-white grid place-items-center font-bold">
              M
            </div>
            <div>
              <p className="font-semibold text-slate-900">Mr. Mwikila</p>
              <p className="text-xs text-slate-500">Marketing chat — no signup required</p>
            </div>
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {turns.map((t, idx) => (
              <div
                key={idx}
                className={`flex ${t.role === 'visitor' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-xl px-4 py-2 text-sm ${
                    t.role === 'visitor'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-900'
                  }`}
                >
                  {t.content}
                </div>
              </div>
            ))}
          </div>

          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <input
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              placeholder="Tell Mr. Mwikila about your estate..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Send
            </button>
          </form>

          {suggestedRoute && suggestedRoute !== 'keep_chatting' && (
            <p className="mt-3 text-xs text-emerald-700">
              Suggested next step:{' '}
              <span className="font-semibold">{suggestedRoute.replace(/_/g, ' ')}</span>
            </p>
          )}
        </div>

        <footer className="mt-6 text-center text-xs text-slate-500">
          No data is stored until you explicitly join the waitlist or create an account.
        </footer>
      </section>
    </main>
  );
}
