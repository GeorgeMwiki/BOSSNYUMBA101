'use client';

/**
 * Coworker — private chat surface for a single employee.
 *
 * Same Brain intelligence as the Estate Manager and Juniors, but bound to
 * the signed-in employee. Default visibility is `private` — only the
 * employee and the Brain itself see the messages.
 *
 * Identity resolution: the employee id is derived server-side from the
 * verified Supabase JWT (`app_metadata.employee_id`). The client never
 * sends an employee id. Passing `forcePersonaId: 'coworker'` is enough —
 * the API route appends the verified id and rejects with 403 if absent.
 */

import { useState, useEffect, useRef } from 'react';
import {
  Users,
  Send,
  ShieldCheck,
  EyeOff,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';
import { Spinner } from '@bossnyumba/design-system';
import { useBrainChat, type BrainMessage } from '@/lib/brain-client';

type Scope = 'private' | 'team' | 'management' | 'public';

export default function CoworkerPage() {
  const t = useTranslations('coworker');
  const [input, setInput] = useState('');
  const [defaultScope, setDefaultScope] = useState<Scope>('private');
  const { messages, sending, error, sendMessage } = useBrainChat({
    forcePersonaId: 'coworker',
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, sending]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    await sendMessage(text);
  }

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        showBack
      />

      <div className="px-4 pt-2">
        <VisibilityBanner
          defaultScope={defaultScope}
          onChangeScope={setDefaultScope}
        />
      </div>

      <div
        ref={scrollRef}
        className="px-4 py-3 pb-32 flex flex-col gap-3 max-h-[calc(100vh-240px)] overflow-y-auto"
      >
        {messages.length === 0 && <Empty />}
        {messages.map((m) => (
          <Bubble key={m.id} msg={m} />
        ))}
        {sending && (
          <div className="flex items-center gap-2 text-sm text-gray-500 px-2">
            <Spinner size="sm" />
            {t('thinkingPrivately')}
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
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
            {sending ? (
              <Spinner size="sm" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {t('send')}
          </button>
        </div>
      </div>
    </>
  );
}

function VisibilityBanner({
  defaultScope,
  onChangeScope,
}: {
  defaultScope: Scope;
  onChangeScope: (s: Scope) => void;
}) {
  const t = useTranslations('coworker');
  const tones: Record<Scope, string> = {
    private: 'bg-gray-100 text-gray-800',
    team: 'bg-sky-100 text-sky-800',
    management: 'bg-amber-100 text-amber-900',
    public: 'bg-green-100 text-green-900',
  };
  const scopeLabelKey: Record<Scope, 'scopePrivate' | 'scopeTeam' | 'scopeManagement' | 'scopePublic'> = {
    private: 'scopePrivate',
    team: 'scopeTeam',
    management: 'scopeManagement',
    public: 'scopePublic',
  };
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 text-xs flex flex-wrap items-center gap-2">
      <ShieldCheck className="w-4 h-4 text-green-600" />
      <span className="font-medium text-gray-900">{t('visibilityContract')}</span>
      <span className={`rounded-full px-2 py-0.5 ${tones[defaultScope]}`}>
        {t(scopeLabelKey[defaultScope])}
      </span>
      <span className="text-gray-500">
        — {defaultScope === 'private'
          ? t('onlyYou')
          : defaultScope === 'team'
            ? t('teamAndMgmt')
            : defaultScope === 'management'
              ? t('yourMgrs')
              : t('tenantWide')}{' '}
        {t('seenBy')}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <label className="text-gray-500">{t('default')}</label>
        <select
          value={defaultScope}
          onChange={(e) => onChangeScope(e.target.value as Scope)}
          className="rounded-md border border-gray-200 px-1.5 py-0.5 text-xs"
        >
          <option value="private">{t('optPrivate')}</option>
          <option value="team">{t('optTeam')}</option>
          <option value="management">{t('optManagement')}</option>
        </select>
      </div>
      <span className="basis-full text-gray-400 text-[10px]">
        {t('clampNote')}
      </span>
    </div>
  );
}

function Empty() {
  const t = useTranslations('coworker');
  const examples: Array<'egLeak' | 'egSwahili' | 'egAuthorize' | 'egLateFee'> = [
    'egLeak',
    'egSwahili',
    'egAuthorize',
    'egLateFee',
  ];
  return (
    <div className="rounded-2xl border border-gray-100 bg-gradient-to-br from-sky-50 to-white p-5 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-gray-900">
        <Users className="w-5 h-5 text-sky-500" />
        <span className="font-medium">{t('emptyTitle')}</span>
      </div>
      <p className="text-sm text-gray-600">
        {t('emptyDesc')}
      </p>
      <div className="flex flex-wrap gap-2 mt-1">
        {examples.map((p) => (
          <span
            key={p}
            className="text-xs rounded-full border border-gray-200 bg-white px-2.5 py-1"
          >
            {t(p)}
          </span>
        ))}
      </div>
    </div>
  );
}

function Bubble({ msg }: { msg: BrainMessage }) {
  const t = useTranslations('coworker');
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
        <Users className="w-3 h-3" />
        <span>{t('coworkerLabel')}</span>
        {msg.advisorConsulted && (
          <span className="text-[10px] bg-amber-100 text-amber-800 rounded-full px-1.5 py-px">
            +advisor
          </span>
        )}
        {msg.visibilityScope && <ScopePill scope={msg.visibilityScope} />}
      </div>
      <div className="rounded-2xl rounded-bl-sm bg-white border border-gray-100 px-3 py-2 text-sm text-gray-900 whitespace-pre-wrap">
        {msg.text}
      </div>
    </div>
  );
}

function ScopePill({ scope }: { scope: Scope }) {
  const t = useTranslations('coworker');
  const tones: Record<Scope, string> = {
    private: 'bg-gray-100 text-gray-700',
    team: 'bg-sky-100 text-sky-800',
    management: 'bg-amber-100 text-amber-900',
    public: 'bg-green-100 text-green-900',
  };
  const scopeLabelKey: Record<Scope, 'scopePrivate' | 'scopeTeam' | 'scopeManagement' | 'scopePublic'> = {
    private: 'scopePrivate',
    team: 'scopeTeam',
    management: 'scopeManagement',
    public: 'scopePublic',
  };
  const Icon = scope === 'private' ? EyeOff : Eye;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full text-[10px] px-1.5 py-px ${tones[scope]}`}
    >
      <Icon className="w-3 h-3" />
      {t(scopeLabelKey[scope])}
    </span>
  );
}
