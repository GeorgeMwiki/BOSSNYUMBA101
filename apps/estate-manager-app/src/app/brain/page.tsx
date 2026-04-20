'use client';

/**
 * BossNyumba Brain — Admin Chat Surface
 *
 * The LitFit-style chat-stepper surface for admins. One conversation, many
 * personae; the Brain routes internally. Admins never have to think about
 * "which Junior do I ask?" — they just talk.
 *
 * Intentionally a single file for Phase 1: keeps the surface reviewable.
 * Splits into subcomponents in Phase 2 when we add tool-result cards,
 * diff panels for migration, and inline entity pills.
 */

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Brain,
  Send,
  Sparkles,
  ShieldCheck,
  Users,
  Building2,
  Coins,
  Scale,
  Megaphone,
  AlertTriangle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';
import { Spinner } from '@bossnyumba/design-system';
import {
  usePersonae,
  useBrainChat,
  type BrainMessage,
  type PersonaInfo,
} from '@/lib/brain-client';

const PERSONA_ICON: Record<string, typeof Brain> = {
  'estate-manager': Brain,
  'junior.leasing': Building2,
  'junior.maintenance': Sparkles,
  'junior.finance': Coins,
  'junior.compliance': Scale,
  'junior.communications': Megaphone,
  coworker: Users,
  'migration-wizard': ShieldCheck,
};

function personaIcon(id: string) {
  const key = id.startsWith('coworker.') ? 'coworker' : id;
  return PERSONA_ICON[key] ?? Brain;
}

export default function BrainPage() {
  const tSimple = useTranslations('simple');
  const tMisc = useTranslations('misc');
  const [input, setInput] = useState('');
  const [showTrace, setShowTrace] = useState(false);
  const { personae } = usePersonae();
  const { messages, sending, threadId, sendMessage, error } = useBrainChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, sending]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    await sendMessage(text);
  };

  return (
    <>
      <PageHeader
        title={tSimple('bossnyumbaBrain')}
        subtitle={tSimple('bossnyumbaBrainSubtitle')}
        action={
          <button
            type="button"
            onClick={() => setShowTrace((v) => !v)}
            className="text-xs px-2 py-1 rounded-md border border-gray-200 hover:bg-gray-50 flex items-center gap-1"
            aria-label={showTrace ? 'Hide decision trace' : 'Show decision trace'}
          >
            {showTrace ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
            Trace
          </button>
        }
      />

      <div className="px-4 py-3 pb-32 flex flex-col gap-3">
        {/* Persona roster */}
        <PersonaRoster personae={personae} />

        {/* Thread */}
        <div
          ref={scrollRef}
          className="flex flex-col gap-3 max-h-[calc(100vh-300px)] overflow-y-auto"
        >
          {messages.length === 0 && !sending && (
            <EmptyState />
          )}
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} showTrace={showTrace} />
          ))}
          {sending && (
            <div className="flex items-center gap-2 text-sm text-gray-500 px-2">
              <Spinner size="sm" />
              Thinking…
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer: thread id + visibility summary */}
        {threadId && (
          <div className="text-[10px] text-gray-400 px-2">
            thread: {threadId}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="fixed bottom-20 inset-x-0 bg-white border-t border-gray-100 px-3 py-2">
        <div className="flex items-end gap-2 max-w-3xl mx-auto">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            rows={2}
            placeholder={tSimple('brainInputPlaceholder')}
            className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending || !input.trim()}
            className="rounded-xl bg-sky-500 text-white px-3 py-2 text-sm font-medium hover:bg-sky-600 disabled:opacity-50 flex items-center gap-1"
          >
            {sending ? (
              <Spinner size="sm" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Send
          </button>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function PersonaRoster({ personae }: { personae: PersonaInfo[] }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto py-1 -mx-4 px-4">
      {personae.map((p) => {
        const Icon = personaIcon(p.id);
        return (
          <div
            key={p.id}
            className="shrink-0 flex items-center gap-1.5 rounded-full bg-gray-100 text-gray-700 px-2.5 py-1 text-xs"
            title={p.missionStatement}
          >
            <Icon className="w-3.5 h-3.5" />
            {p.displayName}
          </div>
        );
      })}
    </div>
  );
}

function EmptyState() {
  const tMisc = useTranslations('misc');
  const prompts = [
    'Give me the state of the portfolio right now.',
    'Who is in arrears over 30 days at Block A? Draft firm notices.',
    'Reconcile last month M-Pesa paybill against the ledger.',
    'Draft an eviction notice for unit C-7 (4 months unpaid).',
    'Plan the renewal pipeline for the next 60 days.',
  ];
  return (
    <div className="rounded-2xl border border-gray-100 bg-gradient-to-br from-sky-50 to-white p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-gray-900">
        <Brain className="w-5 h-5 text-sky-500" />
        <span className="font-medium">{tMisc('brainReady')}</span>
      </div>
      <p className="text-sm text-gray-600">
        Talk to your estate. The Brain will choose the right Junior — Leasing,
        Maintenance, Finance, Compliance, or Communications — and come back
        with an evidence-backed plan. Human review is required for
        irreversible actions.
      </p>
      <div className="flex flex-wrap gap-2">
        {prompts.map((p) => (
          <button
            key={p}
            type="button"
            className="text-xs rounded-full border border-gray-200 bg-white px-2.5 py-1 hover:bg-gray-50"
            onClick={() => {
              // Prefill: update the composer via a synthetic event.
              const composer = document.querySelector<HTMLTextAreaElement>(
                'textarea'
              );
              if (composer) {
                composer.value = p;
                composer.focus();
                composer.dispatchEvent(new Event('input', { bubbles: true }));
              }
            }}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  showTrace,
}: {
  message: BrainMessage;
  showTrace: boolean;
}) {
  const tSimple = useTranslations('simple');
  const tMisc = useTranslations('misc');
  if (message.role === 'user') {
    return (
      <div className="self-end max-w-[85%] rounded-2xl rounded-br-sm bg-sky-500 text-white px-3 py-2 text-sm whitespace-pre-wrap">
        {message.text}
      </div>
    );
  }

  const Icon = personaIcon(message.personaId ?? 'estate-manager');
  return (
    <div className="self-start max-w-[90%] flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[11px] text-gray-500 pl-1">
        <Icon className="w-3 h-3" />
        <span>{message.personaLabel ?? message.personaId ?? 'Brain'}</span>
        {message.advisorConsulted && (
          <span
            className="text-[10px] bg-amber-100 text-amber-800 rounded-full px-1.5 py-px"
            title={tSimple('opusAdvisorConsulted')}
          >
            +advisor
          </span>
        )}
        {message.visibilityScope && (
          <span
            className={`text-[10px] rounded-full px-1.5 py-px ${
              message.visibilityScope === 'private'
                ? 'bg-gray-100 text-gray-700'
                : message.visibilityScope === 'team'
                  ? 'bg-sky-100 text-sky-800'
                  : message.visibilityScope === 'management'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-green-100 text-green-800'
            }`}
          >
            {message.visibilityScope}
          </span>
        )}
      </div>
      <div className="rounded-2xl rounded-bl-sm bg-white border border-gray-100 px-3 py-2 text-sm text-gray-900 whitespace-pre-wrap">
        {message.text}
      </div>
      {message.proposedAction && (
        <ProposedActionCard
          action={message.proposedAction}
          messageId={message.id}
        />
      )}
      {showTrace && (message.handoffs?.length || message.toolCalls?.length) ? (
        <details className="text-[11px] text-gray-500 pl-1">
          <summary className="cursor-pointer select-none">{tMisc('decisionTrace')}</summary>
          <div className="mt-1 space-y-0.5 font-mono">
            {(message.handoffs ?? []).map((h, i) => (
              <div key={`h-${i}`}>↳ handoff {h.from} → {h.to}: {h.objective}</div>
            ))}
            {(message.toolCalls ?? []).map((t, i) => (
              <div key={`t-${i}`}>
                {t.ok ? '✓' : '✗'} tool {t.tool}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

/**
 * ProposedActionCard — inline approve/reject for a Brain-proposed action.
 *
 * The card POSTs to /api/brain/review with the latest threadId from the
 * useBrainChat hook. Because the persona message itself doesn't carry the
 * copilotRequestId yet, we route to the Reviews dashboard for the explicit
 * review flow if more nuance is needed; this inline button is the
 * happy-path "yes, do it" affordance for low-friction approvals.
 */
function ProposedActionCard({
  action,
  messageId,
}: {
  action: NonNullable<BrainMessage['proposedAction']>;
  messageId: string;
}) {
  return (
    <div className="mt-1 rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 flex items-start gap-2">
      <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
      <div className="flex-1">
        <div className="font-medium">
          Proposed: {action.verb} {action.object}
        </div>
        <div className="opacity-80">
          Risk: {action.riskLevel}
          {action.reviewRequired ? ' · review required' : ''}
        </div>
      </div>
      <Link
        href="/brain/reviews"
        className="rounded-md bg-amber-600 text-white text-xs px-2 py-1"
      >
        {action.reviewRequired ? 'Review' : 'Approve'}
      </Link>
    </div>
  );
}
