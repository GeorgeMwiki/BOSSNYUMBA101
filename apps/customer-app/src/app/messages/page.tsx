/**
 * Tenant ↔ property manager conversations list.
 *
 * Wave 22: rewired to consume `messagingService.listConversations()`
 * from `@bossnyumba/api-client`. The gateway currently returns raw
 * snake_case rows from the `conversations` table (subject /
 * created_at / updated_at) — the api-client's typed `Conversation`
 * shape (camelCase + nested participants) drifts from that. We
 * tolerate both shapes via a thin adapter so the page works both
 * before and after a future gateway-side normalisation pass.
 *
 * Loading / error / empty / retry states mirror the pattern used by
 * `apps/customer-app/src/app/feedback/history/page.tsx`.
 */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { MessageSquare, Loader2 } from 'lucide-react';
import { messagingService } from '@bossnyumba/api-client';
import { PageHeader } from '@/components/layout/PageHeader';

interface ConversationView {
  readonly id: string;
  readonly subject: string;
  readonly lastMessagePreview: string;
  readonly lastMessageAt: string | null;
  readonly unreadCount: number;
  readonly counterpart: {
    readonly name: string;
    readonly role: string;
  };
}

/**
 * Snake-case raw row shape returned by the api-gateway today
 * (`services/api-gateway/src/routes/messaging.ts` SELECTs the columns
 * directly). Kept narrow — only the fields we actually render.
 */
interface RawConversationRow {
  readonly id: string;
  readonly subject?: string | null;
  readonly created_at?: string | null;
  readonly updated_at?: string | null;
  readonly entity_type?: string | null;
  readonly created_by?: string | null;
}

/** Adapt either the api-client typed shape or the raw gateway row. */
function adaptConversation(input: unknown): ConversationView | null {
  if (!input || typeof input !== 'object') return null;
  const obj = input as Record<string, unknown>;
  const id = typeof obj.id === 'string' ? obj.id : null;
  if (!id) return null;

  const subject =
    (typeof obj.subject === 'string' && obj.subject.trim().length > 0
      ? obj.subject
      : null) ?? '';

  // api-client typed shape carries `lastMessage.content` and `unreadCount`.
  // Raw gateway rows do not — we fall back to empty strings / 0 there.
  const lastMessage =
    obj.lastMessage && typeof obj.lastMessage === 'object'
      ? (obj.lastMessage as Record<string, unknown>)
      : null;
  const lastMessagePreview =
    lastMessage && typeof lastMessage.content === 'string'
      ? lastMessage.content
      : '';

  const lastMessageAt =
    typeof obj.updatedAt === 'string'
      ? obj.updatedAt
      : typeof (obj as RawConversationRow).updated_at === 'string'
        ? (obj as RawConversationRow).updated_at ?? null
        : null;

  const unreadCount =
    typeof obj.unreadCount === 'number' && Number.isFinite(obj.unreadCount)
      ? obj.unreadCount
      : 0;

  // Counterpart hydration: api-client surfaces a `participants` array.
  // Raw rows don't yet — we fall back to a sensible label.
  let counterpartName = '';
  let counterpartRole = '';
  if (Array.isArray(obj.participants)) {
    const other = (obj.participants as Array<Record<string, unknown>>).find(
      (p) => typeof p?.type === 'string' && p.type !== 'customer',
    );
    if (other) {
      counterpartName = typeof other.name === 'string' ? other.name : '';
      counterpartRole = typeof other.type === 'string' ? other.type : '';
    }
  }
  if (!counterpartRole) {
    const entityType = (obj as RawConversationRow).entity_type;
    if (typeof entityType === 'string') counterpartRole = entityType;
  }

  return {
    id,
    subject,
    lastMessagePreview,
    lastMessageAt,
    unreadCount,
    counterpart: { name: counterpartName, role: counterpartRole },
  };
}

export default function MessagesPage() {
  const t = useTranslations('pageHeaders');
  const tList = useTranslations('messagesList');
  const [threads, setThreads] = useState<readonly ConversationView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;
    async function load(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const response = await messagingService.listConversations({ pageSize: 50 });
        if (!active) return;
        const rows = Array.isArray(response.data) ? response.data : [];
        const adapted = rows
          .map((row) => adaptConversation(row))
          .filter((row): row is ConversationView => row !== null);
        setThreads(adapted);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : tList('errorLoad'));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [reloadToken, tList]);

  return (
    <>
      <PageHeader title={t('messages')} />
      <div className="px-4 py-4 pb-24 space-y-3">
        {loading && (
          <p className="text-sm text-gray-400 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> {tList('loading')}
          </p>
        )}
        {error && (
          <div className="rounded-lg bg-red-900/30 border border-red-500/40 text-red-200 p-3 text-sm flex items-center justify-between gap-3">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setReloadToken((v) => v + 1)}
              className="rounded border border-red-400/60 px-3 py-1 text-xs hover:bg-red-500/20"
            >
              {tList('retry')}
            </button>
          </div>
        )}
        {!loading && !error && threads.length === 0 && (
          <div className="rounded-lg bg-gray-800 border border-gray-700 p-5 text-sm text-gray-400 flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            {tList('empty')}
          </div>
        )}
        {threads.map((thread) => (
          <Link
            key={thread.id}
            href={`/messages/${thread.id}`}
            className="block rounded-lg bg-gray-800 border border-gray-700 p-4 hover:border-blue-500"
          >
            <div className="flex items-center justify-between">
              <div className="font-medium text-white">
                {thread.subject || tList('untitled')}
              </div>
              {thread.unreadCount > 0 && (
                <span className="text-xs bg-blue-600 text-white rounded-full px-2 py-0.5">
                  {thread.unreadCount}
                </span>
              )}
            </div>
            {thread.lastMessagePreview && (
              <p className="text-sm text-gray-400 mt-1 truncate">
                {thread.lastMessagePreview}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              {[
                thread.counterpart.name,
                thread.counterpart.role,
                thread.lastMessageAt
                  ? new Date(thread.lastMessageAt).toLocaleString()
                  : null,
              ]
                .filter((part): part is string => Boolean(part))
                .join(' · ')}
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}
