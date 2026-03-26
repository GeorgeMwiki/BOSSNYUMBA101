'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search, MessageCircle, ChevronRight, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useQuery } from '@tanstack/react-query';
import { messagingService } from '@bossnyumba/api-client';

type ConversationStatus = 'unread' | 'read';

interface Conversation {
  id: string;
  subject: string;
  participants: string[];
  lastMessage: string;
  lastMessageAt: string;
  status: ConversationStatus;
  preview: string;
}

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

  const { data: conversationsData, isLoading, isError, refetch } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const response = await messagingService.list();
      return response.data;
    },
  });

  const conversations: Conversation[] = (conversationsData ?? []).map((c: any) => ({
    id: c.id,
    subject: c.subject ?? '',
    participants: c.participants?.map((p: any) => p.name ?? p.id) ?? [],
    lastMessage: c.lastMessage ?? '',
    lastMessageAt: c.lastMessageAt ?? c.updatedAt ?? '',
    status: c.read || c.readAt ? 'read' as const : 'unread' as const,
    preview: c.preview ?? c.lastMessage ?? '',
  }));

  const filteredConversations = conversations.filter(
    (c) =>
      c.subject.toLowerCase().includes(search.toLowerCase()) ||
      c.participants.some((p) => p.toLowerCase().includes(search.toLowerCase()))
  );

  const unreadCount = conversations.filter((c) => c.status === 'unread').length;

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

      <div className="px-4 py-4 pb-24 space-y-4">
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

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                    <div className="h-3 bg-gray-200 rounded w-1/4" />
                    <div className="h-3 bg-gray-200 rounded w-3/4" />
                  </div>
                  <div className="h-3 w-12 bg-gray-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">Failed to load messages</h3>
            <p className="text-sm text-gray-500 max-w-xs mb-6">Please check your connection and try again.</p>
            <button onClick={() => refetch()} className="btn-secondary text-sm flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          </div>
        ) : (
        <div className="space-y-3">
          {filteredConversations.map((conv) => (
            <Link key={conv.id} href={`/messaging/${conv.id}`}>
              <div
                className={`card p-4 hover:shadow-md transition-shadow ${
                  conv.status === 'unread' ? 'border-l-4 border-l-primary-500' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${conv.status === 'unread' ? 'text-gray-900' : 'text-gray-700'}`}>
                        {conv.subject}
                      </span>
                      {conv.status === 'unread' && (
                        <span className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0" />
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {conv.participants.join(', ')}
                    </div>
                    <div className="text-sm text-gray-600 mt-2 truncate">
                      {conv.lastMessage}
                    </div>
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(conv.lastMessageAt)}
                    </span>
                    <ChevronRight className="w-5 h-5 text-gray-400 mt-2" />
                  </div>
                </div>
              </div>
            </Link>
          ))}

          {filteredConversations.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                <MessageCircle className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">No conversations</h3>
              <p className="text-sm text-gray-500 max-w-xs mb-6">
                {search ? 'No conversations match your search.' : 'Start a new conversation to get in touch.'}
              </p>
              {!search && (
                <Link href="/messaging/new" className="btn-primary text-sm">
                  New Message
                </Link>
              )}
            </div>
          )}
        </div>
        )}
      </div>
    </>
  );
}
