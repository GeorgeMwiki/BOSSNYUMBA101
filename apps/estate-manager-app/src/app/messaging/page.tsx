'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, MessageCircle, ChevronRight, Clock, Loader2, AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { messagingApi, type Conversation } from '@/lib/api';

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 24 * 60 * 60 * 1000) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function MessagingPage() {
  const [search, setSearch] = useState('');

  const conversationsQuery = useQuery({
    queryKey: ['messaging-conversations'],
    queryFn: () => messagingApi.listConversations({ pageSize: 100 }),
    retry: false,
  });

  const response = conversationsQuery.data;
  const conversations: Conversation[] = response?.data ?? [];
  const unreadCount = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  const errorMessage =
    conversationsQuery.error instanceof Error
      ? conversationsQuery.error.message
      : response && !response.success
      ? response.error?.message
      : undefined;

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const subject = c.subject?.toLowerCase() ?? '';
      if (subject.includes(q)) return true;
      return c.participants.some((p) => (p.name ?? '').toLowerCase().includes(q));
    });
  }, [conversations, search]);

  return (
    <>
      <PageHeader
        title="Messages"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
        action={
          <Link href="/messaging/new" className="btn-primary text-sm flex items-center gap-1">
            <Plus className="w-4 h-4" />
            New
          </Link>
        }
      />

      <div className="px-4 py-4 space-y-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            className="input pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {conversationsQuery.isLoading && (
          <div className="card p-4 flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading conversations...
          </div>
        )}

        {errorMessage && (
          <div className="card p-4 flex items-start gap-2 border-danger-200 bg-danger-50 text-danger-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Unable to load messages</div>
              <div>{errorMessage}</div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {filteredConversations.map((conv) => {
            const participantNames = conv.participants.map((p) => p.name || p.id).join(', ');
            const lastMessage = conv.lastMessage?.content ?? '(no messages)';
            const lastAt = conv.lastMessage?.createdAt ?? conv.updatedAt;
            const isUnread = (conv.unreadCount || 0) > 0;
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
                          {conv.subject || 'Conversation'}
                        </span>
                        {isUnread && (
                          <span className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0" />
                        )}
                      </div>
                      <div className="text-sm text-gray-500 mt-0.5">{participantNames}</div>
                      <div className="text-sm text-gray-600 mt-2 truncate">{lastMessage}</div>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0">
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(lastAt)}
                      </span>
                      <ChevronRight className="w-5 h-5 text-gray-400 mt-2" />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {!conversationsQuery.isLoading && !errorMessage && filteredConversations.length === 0 && (
          <div className="text-center py-12">
            <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-medium text-gray-900">No conversations</h3>
            <p className="text-sm text-gray-500 mt-1">
              {search ? 'No conversations match your search' : 'Start a new conversation'}
            </p>
            {!search && (
              <Link href="/messaging/new" className="btn-primary mt-4 inline-block">
                New Message
              </Link>
            )}
          </div>
        )}
      </div>
    </>
  );
}
