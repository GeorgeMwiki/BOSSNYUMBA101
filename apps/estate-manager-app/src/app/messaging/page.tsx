'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, MessageCircle, ChevronRight, Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { messagingService } from '@bossnyumba/api-client';
import {
  Alert,
  AlertDescription,
  Button,
  Skeleton,
} from '@bossnyumba/design-system';
import { PageHeader } from '@/components/layout/PageHeader';

const TENANT_LOCALE =
  process.env.NEXT_PUBLIC_TENANT_LOCALE?.trim() || 'en';

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 24 * 60 * 60 * 1000) {
    return date.toLocaleTimeString(TENANT_LOCALE, {
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    return date.toLocaleDateString(TENANT_LOCALE, { weekday: 'short' });
  }
  return date.toLocaleDateString(TENANT_LOCALE, {
    month: 'short',
    day: 'numeric',
  });
}

function describeParticipants(
  participants: ReadonlyArray<{ id: string; name?: string; type: string }>
): string {
  const names = participants
    .map((p) => p.name?.trim())
    .filter((n): n is string => Boolean(n && n.length > 0));
  if (names.length > 0) return names.join(', ');
  return participants.map((p) => p.type).join(', ');
}

export default function MessagingPage() {
  const t = useTranslations('messagingList');
  const [search, setSearch] = useState('');

  const conversationsQuery = useQuery({
    queryKey: ['messaging-conversations-live', { page: 1, pageSize: 50 }],
    queryFn: () => messagingService.listConversations({ page: 1, pageSize: 50 }),
    retry: false,
  });

  const conversations = useMemo(() => {
    return Array.isArray(conversationsQuery.data?.data)
      ? conversationsQuery.data!.data!
      : [];
  }, [conversationsQuery.data]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return conversations;
    return conversations.filter((c) => {
      const subject = (c.subject ?? '').toLowerCase();
      const partNames = describeParticipants(c.participants).toLowerCase();
      const preview = (c.lastMessage?.content ?? '').toLowerCase();
      return (
        subject.includes(term) ||
        partNames.includes(term) ||
        preview.includes(term)
      );
    });
  }, [conversations, search]);

  const unreadCount = useMemo(
    () => conversations.reduce((acc, c) => acc + (c.unreadCount ?? 0), 0),
    [conversations]
  );

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={
          unreadCount > 0
            ? t('unreadCount', { count: unreadCount })
            : t('allCaughtUp')
        }
        action={
          <Link
            href="/messaging/new"
            className="btn-primary text-sm flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            {t('newBtn')}
          </Link>
        }
      />

      <div className="px-4 py-4 space-y-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            className="input pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {conversationsQuery.isLoading && (
          <div aria-busy="true" aria-live="polite" className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {conversationsQuery.error && (
          <Alert variant="danger">
            <AlertDescription>
              {(conversationsQuery.error as Error).message ||
                t('failedToLoad')}
              <Button
                size="sm"
                onClick={() => conversationsQuery.refetch()}
                className="ml-2"
              >
                {t('retry')}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {!conversationsQuery.isLoading && !conversationsQuery.error && (
          <div className="space-y-3">
            {filtered.map((conv) => {
              const isUnread = (conv.unreadCount ?? 0) > 0;
              const lastAt = conv.lastMessage?.createdAt ?? conv.updatedAt;
              return (
                <Link key={conv.id} href={`/messaging/${conv.id}`}>
                  <div
                    className={`card p-4 hover:shadow-md transition-shadow ${
                      isUnread ? 'border-l-4 border-l-primary-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-medium ${
                              isUnread ? 'text-gray-900' : 'text-gray-700'
                            }`}
                          >
                            {conv.subject || t('untitledConversation')}
                          </span>
                          {isUnread && (
                            <span className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0" />
                          )}
                        </div>
                        <div className="text-sm text-gray-500 mt-0.5">
                          {describeParticipants(conv.participants)}
                        </div>
                        {conv.lastMessage?.content && (
                          <div className="text-sm text-gray-600 mt-2 truncate">
                            {conv.lastMessage.content}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end flex-shrink-0">
                        {lastAt && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(lastAt)}
                          </span>
                        )}
                        <ChevronRight className="w-5 h-5 text-gray-400 mt-2" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {!conversationsQuery.isLoading &&
          !conversationsQuery.error &&
          filtered.length === 0 && (
            <div className="text-center py-12">
              <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="font-medium text-gray-900">
                {t('noConversations')}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {search ? t('noMatches') : t('startNew')}
              </p>
              {!search && (
                <Link
                  href="/messaging/new"
                  className="btn-primary mt-4 inline-block"
                >
                  {t('newMessage')}
                </Link>
              )}
            </div>
          )}
      </div>
    </>
  );
}
