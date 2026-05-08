'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send, User } from 'lucide-react';
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

function formatTimestamp(dateStr: string): string {
  return new Date(dateStr).toLocaleString(TENANT_LOCALE, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function ConversationDetailPage() {
  const t = useTranslations('simple');
  const tList = useTranslations('messagingList');
  const tMisc = useTranslations('misc');
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = (params?.id ?? '') as string;
  const [draft, setDraft] = useState('');

  const conversationQuery = useQuery({
    queryKey: ['messaging-conversation-live', id],
    queryFn: () => messagingService.getConversation(id),
    enabled: Boolean(id),
    retry: false,
  });

  const messagesQuery = useQuery({
    queryKey: ['messaging-messages-live', id],
    queryFn: () => messagingService.listMessages(id, { page: 1, pageSize: 100 }),
    enabled: Boolean(id),
    retry: false,
  });

  const conversation = conversationQuery.data?.data;
  const messages = useMemo(() => {
    return Array.isArray(messagesQuery.data?.data)
      ? messagesQuery.data!.data!
      : [];
  }, [messagesQuery.data]);

  // Mark conversation as read once it loads.
  useEffect(() => {
    if (!conversation || (conversation.unreadCount ?? 0) === 0) return;
    messagingService
      .markAsRead(id)
      .then(() => {
        queryClient.invalidateQueries({
          queryKey: ['messaging-conversations-live'],
        });
      })
      .catch(() => {
        // Non-blocking: read receipt failure should not interrupt UX.
      });
  }, [conversation, id, queryClient]);

  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      messagingService.sendMessage(id, { content }),
    onSuccess: () => {
      setDraft('');
      queryClient.invalidateQueries({
        queryKey: ['messaging-messages-live', id],
      });
      queryClient.invalidateQueries({
        queryKey: ['messaging-conversations-live'],
      });
    },
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content) return;
    sendMutation.mutate(content);
  };

  const subject = conversation?.subject ?? tList('untitledConversation');
  const participants = conversation?.participants ?? [];
  const subtitle = participants
    .map((p) => p.name?.trim())
    .filter((n): n is string => Boolean(n && n.length > 0))
    .join(', ');

  if (conversationQuery.isLoading) {
    return (
      <>
        <PageHeader title={t('conversation')} showBack />
        <div className="px-4 py-4 space-y-3" aria-busy="true" aria-live="polite">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </>
    );
  }

  if (conversationQuery.error) {
    return (
      <>
        <PageHeader title={t('conversation')} showBack />
        <div className="px-4 py-4">
          <Alert variant="danger">
            <AlertDescription>
              {(conversationQuery.error as Error).message ||
                tList('failedToLoad')}
              <Button
                size="sm"
                onClick={() => conversationQuery.refetch()}
                className="ml-2"
              >
                {tList('retry')}
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </>
    );
  }

  if (!conversation) {
    return (
      <>
        <PageHeader title={t('conversation')} showBack />
        <div className="px-4 py-8 text-center">
          <p className="text-gray-500 mb-4">{tMisc('conversationNotFound')}</p>
          <button onClick={() => router.back()} className="btn-secondary">
            {tMisc('goBack')}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={subject} subtitle={subtitle} showBack />

      <div className="flex flex-col h-[calc(100vh-120px)]">
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messagesQuery.isLoading && (
            <div className="text-sm text-gray-500">
              {tList('loadingMessages')}
            </div>
          )}

          {messagesQuery.error && (
            <Alert variant="danger">
              <AlertDescription>
                {(messagesQuery.error as Error).message || tList('failedToLoad')}
                <Button
                  size="sm"
                  onClick={() => messagesQuery.refetch()}
                  className="ml-2"
                >
                  {tList('retry')}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {!messagesQuery.isLoading &&
            !messagesQuery.error &&
            messages.length === 0 && (
              <div className="text-sm text-gray-500 text-center py-8">
                {tList('noMessagesYet')}
              </div>
            )}

          {messages.map((msg) => {
            const isOwn = msg.senderType === 'manager';
            const senderLabel =
              participants.find((p) => p.id === msg.senderId)?.name ??
              msg.senderType;
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}
              >
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-primary-600" />
                </div>
                <div className={`flex-1 max-w-[80%] ${isOwn ? 'items-end' : ''}`}>
                  <div className="text-xs text-gray-500 mb-1">{senderLabel}</div>
                  <div
                    className={`p-3 rounded-xl ${
                      isOwn
                        ? 'bg-primary-100 text-primary-900 ml-auto'
                        : 'bg-gray-100'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {formatTimestamp(msg.createdAt)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {sendMutation.error && (
          <div className="px-4">
            <Alert variant="danger">
              <AlertDescription>
                {(sendMutation.error as Error).message ||
                  tList('failedToSend')}
              </AlertDescription>
            </Alert>
          </div>
        )}

        <div className="p-4 border-t border-gray-200 bg-white">
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="text"
              className="input flex-1"
              placeholder={t('typeMessagePlaceholder')}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={sendMutation.isPending}
            />
            <button
              type="submit"
              className="btn-primary"
              disabled={!draft.trim() || sendMutation.isPending}
              aria-label={
                sendMutation.isPending ? tList('sending') : t('sendQuestion')
              }
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
