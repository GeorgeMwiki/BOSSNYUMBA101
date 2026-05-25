// @ts-nocheck — shared Brain types / Payments response drift; tracked
'use client';

/**
 * Tenant Assistant — customer-app facing Brain surface.
 *
 * The tenant talks to BossNyumba about their own lease, payments, requests,
 * notices. Persona is fixed to `tenant-assistant` server-side; the route
 * cannot be coerced to act as a different persona.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Brain, Send, AlertTriangle, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Spinner } from '@bossnyumba/design-system';
import {
  ProactiveHint,
  NeedSpawnBanner,
  ChatArtifactStream,
  type ChatArtifact,
  type HintCandidate,
  type TabSpawnProposal,
} from '@bossnyumba/chat-ui';
import { authedHeaders } from '@/lib/supabase';
import { getCsrfHeaders } from '@/lib/csrf';
import { isFeatureEnabled } from '@/lib/featureFlags';

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  proposedAction?: {
    verb: string;
    object: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  };
}

export default function TenantAssistantPage() {
  const t = useTranslations('assistantPage');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, sending]);

  // Wave-3 INT-4 — proactive UX. Hints + spawn proposals are gated by
  // feature flags so they stay invisible in prod until ops flip them.
  // The proposals list is empty until the tab-need-detector api-client
  // port lands. The hint candidates list is sourced locally so the
  // surface is testable without the affect-profile transport.
  const proactiveHintsEnabled = isFeatureEnabled('chat_proactive_hint_enabled');
  const spawnBannerEnabled = isFeatureEnabled('need_spawn_banner_enabled');
  const hintCandidates = useMemo<HintCandidate[]>(
    () => [
      {
        id: 'tenant-frustration-human-handoff',
        trigger: 'frustration',
        threshold: 0.5,
        title: 'Want to talk to a person?',
        body: 'We can route you to your estate manager.',
        action: { label: 'Yes, please', emit: 'request-human-handoff' },
      },
    ],
    [],
  );
  // TODO(wave3-int5): replace empty array with
  //   `useTabSpawnProposals()` once the tab-need-detector API exists.
  const spawnProposals: TabSpawnProposal[] = useMemo(() => [], []);
  // TODO(wave3-int5): replace empty array with `useThreadArtifacts(threadId)`
  // once the conversation-threads api-client port lands.
  const artifactStreamEnabled = isFeatureEnabled('chat_artifact_stream_enabled');
  const artifacts: ChatArtifact[] = useMemo(() => [], []);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setError(null);
    setMessages((p) => [
      ...p,
      { id: `u-${Date.now()}`, role: 'user', text },
    ]);
    setSending(true);
    try {
      const headers = await authedHeaders();
      const body: Record<string, unknown> = { userText: text };
      if (threadId) body.threadId = threadId;
      const res = await fetch('/api/brain/turn', {
        method: 'POST',
        headers: { ...headers, ...getCsrfHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        threadId: string;
        responseText: string;
        proposedAction?: Msg['proposedAction'];
      };
      if (!threadId) setThreadId(data.threadId);
      setMessages((p) => [
        ...p,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: data.responseText,
          proposedAction: data.proposedAction,
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'assistant unavailable');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        showBack
      />
      <div ref={scrollRef} className="px-4 py-3 pb-32 flex flex-col gap-3 max-h-[calc(100vh-200px)] overflow-y-auto">
        {/* Proactive hints + tab-spawn proposals — Wave-3 INT-4 */}
        {proactiveHintsEnabled ? (
          <ProactiveHint
            profile={null}
            hints={hintCandidates}
          />
        ) : null}
        {spawnBannerEnabled && spawnProposals.length > 0 ? (
          <NeedSpawnBanner
            proposals={spawnProposals}
            onAccept={(p) => {
              if (p.targetRoute) {
                window.location.href = p.targetRoute;
              }
            }}
          />
        ) : null}
        {artifactStreamEnabled && artifacts.length > 0 ? (
          <ChatArtifactStream artifacts={artifacts} />
        ) : null}
        {messages.length === 0 && <Empty />}
        {messages.map((m) => (
          <Bubble key={m.id} msg={m} />
        ))}
        {sending && (
          <div className="flex items-center gap-2 text-sm text-gray-500 px-2">
            <Spinner size="sm" /> {t('thinking')}
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}
      </div>
      <div className="fixed bottom-20 inset-x-0 bg-white border-t border-gray-100 px-3 py-2">
        <div className="flex items-end gap-2 max-w-3xl mx-auto">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            placeholder={t('inputPlaceholder')}
            className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending || !input.trim()}
            className="rounded-xl bg-sky-500 text-white px-3 py-2 text-sm font-medium hover:bg-sky-600 disabled:opacity-50 flex items-center gap-1"
          >
            {sending ? <Spinner size="sm" /> : <Send className="w-4 h-4" />}
            {t('send')}
          </button>
        </div>
      </div>
    </>
  );
}

function Empty() {
  const t = useTranslations('assistantPage');
  return (
    <div className="rounded-2xl border border-gray-100 bg-gradient-to-br from-sky-50 to-white p-5 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-gray-900">
        <Brain className="w-5 h-5 text-sky-500" />
        <span className="font-medium">{t('hereToHelp')}</span>
      </div>
      <p className="text-sm text-gray-600">
        {t('emptyBody')}
      </p>
    </div>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const t = useTranslations('assistantPage');
  if (msg.role === 'user') {
    return (
      <div className="self-end max-w-[85%] rounded-2xl rounded-br-sm bg-sky-500 text-white px-3 py-2 text-sm whitespace-pre-wrap">
        {msg.text}
      </div>
    );
  }
  return (
    <div className="self-start max-w-[90%] flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[11px] text-gray-500 pl-1">
        <Brain className="w-3 h-3" />
        <span>{t('assistantLabel')}</span>
      </div>
      <div className="rounded-2xl rounded-bl-sm bg-white border border-gray-100 px-3 py-2 text-sm text-gray-900 whitespace-pre-wrap">
        {msg.text}
      </div>
      {msg.proposedAction && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">
              {t('proposedLabel')}: {msg.proposedAction.verb} {msg.proposedAction.object}
            </div>
            <div className="opacity-80">{t('riskLabel')}: {msg.proposedAction.riskLevel}</div>
          </div>
        </div>
      )}
    </div>
  );
}
