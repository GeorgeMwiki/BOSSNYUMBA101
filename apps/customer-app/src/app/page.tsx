'use client';

/**
 * Public landing page — bossnyumba.com.
 *
 * Mr. Mwikila's marketing chat is the primary call-to-action. The chat is
 * UNAUTHENTICATED and streams SSE from /api/v1/public/chat in the gateway.
 * No production tenant data is reachable from here.
 *
 * Three featured CTAs (owner / tenant / manager) set a context hint that
 * seeds the conversation toward the right sub-persona, and the response is
 * rendered through the shared AdaptiveRenderer + Blackboard so generative
 * UI blocks (affordability calculator, pricing hints, etc.) appear inline.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AdaptiveRenderer,
  Blackboard,
  generateBlocks,
  useChatStream,
  type AdaptiveMessageMetadata,
} from '@bossnyumba/chat-ui';

interface ChatTurn {
  readonly id: string;
  readonly role: 'visitor' | 'assistant';
  readonly content: string;
  readonly metadata?: AdaptiveMessageMetadata;
  readonly isStreaming?: boolean;
}

const SESSION_KEY = 'bossnyumba_public_session';
const CTA_ROLE_KEY = 'bossnyumba_public_role_hint';

type RoleHint = 'owner' | 'tenant' | 'manager';

const INITIAL_GREETING =
  'Hi, I am Mr. Mwikila. Are you an owner, a tenant, or a property manager? That tells me which BOSSNYUMBA capability to show you first.';

export default function HomePage() {
  // Ephemeral session id — persisted in sessionStorage so demo data stays
  // isolated across refreshes but never leaks to another tab.
  const [sessionId, setSessionId] = useState<string>('');
  const [turns, setTurns] = useState<ChatTurn[]>([
    { id: 'g-0', role: 'assistant', content: INITIAL_GREETING },
  ]);
  const [input, setInput] = useState('');
  const [roleHint, setRoleHint] = useState<RoleHint | null>(null);
  const [activeAssistantId, setActiveAssistantId] = useState<string | null>(null);
  const [suggestedRoute, setSuggestedRoute] = useState<string | null>(null);

  // Hydrate session id / role hint from sessionStorage once, client-side only.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let sid = window.sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = `mk_${Math.random().toString(36).slice(2, 10)}`;
      window.sessionStorage.setItem(SESSION_KEY, sid);
    }
    setSessionId(sid);
    const hint = window.sessionStorage.getItem(CTA_ROLE_KEY) as RoleHint | null;
    if (hint) setRoleHint(hint);
  }, []);

  const transcriptRef = useRef(turns);
  transcriptRef.current = turns;

  const { state, sendMessage: sendStream } = useChatStream('public-guide', {
    endpoint: '/api/v1/public/chat',
    headers: { Accept: 'text/event-stream' },
    extraBody: {
      sessionId,
      // The public chat endpoint reads `transcript` — not `personaId` — so
      // we shape the body via `extraBody` for parity with the gateway
      // ChatTurnSchema. The personaId in useChatStream body is harmless
      // extra noise that the public router ignores.
      transcript: turns.map((t) => ({
        role: t.role,
        content: t.content,
      })),
    },
    onEvent: (evt) => {
      if (evt.type === 'handoff') {
        // The public router maps `suggestedRoute` onto the handoff `to`
        // field so the landing page can render the next-step CTA chip.
        setSuggestedRoute(evt.to);
      }
      if (evt.type === 'turn_end' && activeAssistantId) {
        const text = state.assistantText;
        const blocks = generateBlocks({ responseText: text, toolCalls: [] });
        setTurns((prev) =>
          prev.map((t) =>
            t.id === activeAssistantId
              ? { ...t, content: text, metadata: { uiBlocks: blocks }, isStreaming: false }
              : t,
          ),
        );
      }
    },
  });

  // Mirror streaming deltas into the live assistant bubble.
  useEffect(() => {
    if (!state.isStreaming || !activeAssistantId) return;
    setTurns((prev) =>
      prev.map((t) =>
        t.id === activeAssistantId ? { ...t, content: state.assistantText, isStreaming: true } : t,
      ),
    );
  }, [state.assistantText, state.isStreaming, activeAssistantId]);

  const send = useCallback(
    async (message: string, override?: { readonly role?: RoleHint }) => {
      const text = message.trim();
      if (!text || state.isStreaming) return;
      const visitorId = `v-${Date.now()}`;
      const assistantId = `a-${Date.now()}`;
      const contextPrefix = override?.role
        ? `I am a ${override.role}. `
        : roleHint
          ? `I am a ${roleHint}. `
          : '';
      const payloadText = `${contextPrefix}${text}`;
      setTurns((prev) => [
        ...prev,
        { id: visitorId, role: 'visitor', content: text },
        { id: assistantId, role: 'assistant', content: '', isStreaming: true },
      ]);
      setActiveAssistantId(assistantId);
      setInput('');
      await sendStream(payloadText);
    },
    [state.isStreaming, sendStream, roleHint],
  );

  const pickRole = useCallback(
    (role: RoleHint) => {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(CTA_ROLE_KEY, role);
      }
      setRoleHint(role);
      void send(`I am a ${role}. Where should I start?`, { role });
    },
    [send],
  );

  const lastAssistant = useMemo(
    () => [...turns].reverse().find((t) => t.role === 'assistant' && t.metadata?.uiBlocks?.length),
    [turns],
  );

  const ctaTarget = useMemo(() => {
    switch (suggestedRoute) {
      case 'owner_advisor':
      case 'owner-advisor':
        return { label: 'Open Owner Advisor', href: '/auth/signup?persona=owner' };
      case 'tenant_assistant':
      case 'tenant-assistant':
        return { label: 'Open Tenant Assistant', href: '/auth/signup?persona=tenant' };
      case 'manager_chat':
      case 'manager-chat':
        return { label: 'Open Manager Chat', href: '/auth/signup?persona=manager' };
      default:
        return null;
    }
  }, [suggestedRoute]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10">
      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <header className="mb-8 text-center lg:text-left">
            <h1 className="text-4xl font-bold text-slate-900">BOSSNYUMBA</h1>
            <p className="mt-2 text-lg text-slate-600">
              Estate management, reimagined. Meet Mr. Mwikila — your AI partner for every role in the estate.
            </p>
          </header>

          <div className="mb-4 flex flex-wrap gap-2">
            <button
              className={`rounded-full border px-3 py-1 text-sm ${
                roleHint === 'owner'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-emerald-500'
              }`}
              onClick={() => pickRole('owner')}
            >
              I am a property owner
            </button>
            <button
              className={`rounded-full border px-3 py-1 text-sm ${
                roleHint === 'tenant'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-emerald-500'
              }`}
              onClick={() => pickRole('tenant')}
            >
              I am a tenant
            </button>
            <button
              className={`rounded-full border px-3 py-1 text-sm ${
                roleHint === 'manager'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-emerald-500'
              }`}
              onClick={() => pickRole('manager')}
            >
              I am a property manager
            </button>
          </div>

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

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {turns.map((t) => (
                <div
                  key={t.id}
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
                    {t.isStreaming && <span className="text-slate-500"> …</span>}
                    {t.metadata && (
                      <div className="mt-2">
                        <AdaptiveRenderer
                          metadata={t.metadata}
                          language="en"
                          onSendMessage={(msg) => void send(msg)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {state.isStreaming && (
                <div className="text-xs text-slate-500">Mr. Mwikila is typing…</div>
              )}
              {state.error && <div className="text-xs text-red-700">Error: {state.error}</div>}
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
                disabled={state.isStreaming}
              />
              <button
                type="submit"
                disabled={state.isStreaming || !input.trim()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Send
              </button>
            </form>

            {ctaTarget && (
              <a
                href={ctaTarget.href}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white"
              >
                {ctaTarget.label} →
              </a>
            )}
          </div>

          <footer className="mt-6 text-center text-xs text-slate-500 lg:text-left">
            Session id: {sessionId ? <span className="font-mono">{sessionId}</span> : '—'}. Data is
            not stored until you join the waitlist or create an account.
          </footer>
        </div>

        <aside className="hidden lg:block">
          <Blackboard language="en" conceptTitle="BOSSNYUMBA at a glance">
            {lastAssistant?.metadata?.uiBlocks && lastAssistant.metadata.uiBlocks.length > 0 && (
              <AdaptiveRenderer metadata={lastAssistant.metadata} language="en" />
            )}
            {!lastAssistant && (
              <div className="text-sm text-slate-500">
                Ask Mr. Mwikila to walk you through rent affordability, an owner report, or a
                maintenance triage — the visualisation appears here.
              </div>
            )}
          </Blackboard>
        </aside>
      </section>
    </main>
  );
}
