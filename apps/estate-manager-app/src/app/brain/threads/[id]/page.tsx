'use client';

/**
 * Brain Thread Detail — replays the visibility-filtered event log for one
 * thread. Read-only view; new turns happen on /brain or /coworker.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  Brain,
  User,
  ArrowRightLeft,
  Wrench,
  ShieldCheck,
  StickyNote,
  CheckCircle2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';
import { Spinner } from '@bossnyumba/design-system';
import { brainFetch } from '@/lib/brain-client';

interface ThreadEvent {
  id: string;
  threadId: string;
  kind:
    | 'user_message'
    | 'persona_message'
    | 'tool_call'
    | 'tool_result'
    | 'handoff_out'
    | 'handoff_in'
    | 'review_requested'
    | 'review_decision'
    | 'system_note';
  actorId: string;
  visibility: { scope: 'private' | 'team' | 'management' | 'public' };
  createdAt: string;
  text?: string;
  personaId?: string;
  toolName?: string;
  ok?: boolean;
  evidenceSummary?: string;
  packet?: { sourcePersonaId: string; targetPersonaId: string; objective: string };
  decision?: 'approved' | 'rejected' | 'modified';
  reviewerId?: string;
  riskLevel?: string;
}

interface Thread {
  id: string;
  title: string;
  primaryPersonaId: string;
  status: string;
  updatedAt: string;
}

export default function ThreadDetailPage() {
  const tMisc = useTranslations('misc');
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const [data, setData] = useState<{ thread: Thread; events: ThreadEvent[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    brainFetch<{ thread: Thread; events: ThreadEvent[] }>(`/api/brain/threads/${id}`)
      .then(setData)
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'failed to load thread')
      );
  }, [id]);

  return (
    <>
      <PageHeader
        title={data?.thread?.title ?? 'Thread'}
        subtitle={data?.thread?.primaryPersonaId ?? ''}
        showBack
      />
      <div className="px-4 py-3 pb-24 max-w-3xl mx-auto flex flex-col gap-2">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}
        {!data && !error && (
          <div className="flex items-center gap-2 text-sm text-gray-500 px-2">
            <Spinner size="sm" /> loading…
          </div>
        )}
        {data?.events?.length === 0 && (
          <div className="text-sm text-gray-500 px-2">{tMisc('noEventsVisible')}</div>
        )}
        {data?.events?.map((e) => (
          <EventRow key={e.id} event={e} />
        ))}
      </div>
    </>
  );
}

function EventRow({ event }: { event: ThreadEvent }) {
  const time = new Date(event.createdAt).toLocaleString();
  switch (event.kind) {
    case 'user_message':
      return (
        <Row icon={<User className="w-4 h-4 text-sky-500" />} actor="You" time={time}>
          <p className="whitespace-pre-wrap">{event.text}</p>
        </Row>
      );
    case 'persona_message':
      return (
        <Row icon={<Brain className="w-4 h-4 text-sky-500" />} actor={event.personaId ?? 'Brain'} time={time}>
          <p className="whitespace-pre-wrap">{event.text}</p>
        </Row>
      );
    case 'tool_call':
      return (
        <Row icon={<Wrench className="w-4 h-4 text-gray-500" />} actor={`tool:${event.toolName}`} time={time}>
          <code className="text-xs">{event.toolName}</code>
        </Row>
      );
    case 'tool_result':
      return (
        <Row icon={<Wrench className={`w-4 h-4 ${event.ok ? 'text-green-500' : 'text-red-500'}`} />} actor={`result:${event.toolName}`} time={time}>
          <p className="text-xs whitespace-pre-wrap">{event.evidenceSummary ?? (event.ok ? 'ok' : 'failed')}</p>
        </Row>
      );
    case 'handoff_out':
      return (
        <Row icon={<ArrowRightLeft className="w-4 h-4 text-amber-600" />} actor={`handoff: ${event.packet?.sourcePersonaId} → ${event.packet?.targetPersonaId}`} time={time}>
          <p className="text-xs italic">{event.packet?.objective}</p>
        </Row>
      );
    case 'handoff_in':
      return (
        <Row icon={<ArrowRightLeft className="w-4 h-4 text-amber-600" />} actor="handoff accepted" time={time}>
          <p className="text-xs">accepted</p>
        </Row>
      );
    case 'review_requested':
      return (
        <Row icon={<ShieldCheck className="w-4 h-4 text-amber-700" />} actor={`review requested risk:${event.riskLevel}`} time={time}>
          <p className="text-xs">awaiting human review</p>
        </Row>
      );
    case 'review_decision':
      return (
        <Row
          icon={<CheckCircle2 className={`w-4 h-4 ${event.decision === 'approved' ? 'text-green-600' : 'text-red-600'}`} />}
          actor={`review ${event.decision} by ${event.reviewerId}`}
          time={time}
        >
          <p className="text-xs">decision recorded</p>
        </Row>
      );
    case 'system_note':
      return (
        <Row icon={<StickyNote className="w-4 h-4 text-gray-500" />} actor="system" time={time}>
          <p className="text-xs text-gray-600">{event.text}</p>
        </Row>
      );
    default:
      return null;
  }
}

function Row({
  icon,
  actor,
  time,
  children,
}: {
  icon: React.ReactNode;
  actor: string;
  time: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 flex gap-3">
      <div className="shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-gray-500 flex items-center gap-2">
          <span>{actor}</span>
          <span className="ml-auto text-gray-400">{time}</span>
        </div>
        <div className="text-sm text-gray-900 mt-1">{children}</div>
      </div>
    </div>
  );
}
