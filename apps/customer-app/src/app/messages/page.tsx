'use client';

import { useQuery, messagingService, type Conversation } from '@bossnyumba/api-client';
import { MessageSquare, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import Link from 'next/link';

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getConversationName(conversation: Conversation): string {
  const other = conversation.participants.find((p) => p.type === 'manager');
  return other?.name || conversation.subject || 'Conversation';
}

function ConversationsSkeleton() {
  return (
    <div className="divide-y divide-white/10">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 p-4 animate-pulse">
          <div className="w-12 h-12 bg-surface-card rounded-full flex-shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between">
              <div className="h-4 w-28 bg-surface-card rounded" />
              <div className="h-3 w-12 bg-surface-card rounded" />
            </div>
            <div className="h-3 w-3/4 bg-surface-card rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyConversations() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
      <div className="p-4 bg-surface-card rounded-full mb-4">
        <MessageSquare className="w-10 h-10 text-gray-400" />
      </div>
      <h2 className="text-lg font-semibold text-white mb-2">No messages yet</h2>
      <p className="text-gray-400 text-sm">Your conversations will appear here.</p>
    </div>
  );
}

function ConversationsError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
      <AlertTriangle className="w-12 h-12 text-warning-400 mb-4" />
      <h2 className="text-lg font-semibold text-white mb-2">Failed to load messages</h2>
      <p className="text-gray-400 text-sm mb-6">Something went wrong. Please try again.</p>
      <button onClick={onRetry} className="btn-primary px-6 py-2">
        Retry
      </button>
    </div>
  );
}

export default function MessagesPage() {
  const { data: conversations, isLoading, isError, refetch } = useQuery<Conversation[]>(
    '/messaging/conversations',
    { staleTime: 30 * 1000 }
  );

  return (
    <div>
      <PageHeader title="Messages" showSettings />
      <div className="pb-24">
        {isLoading ? (
          <ConversationsSkeleton />
        ) : isError ? (
          <ConversationsError onRetry={refetch} />
        ) : !conversations || conversations.length === 0 ? (
          <EmptyConversations />
        ) : (
          <div className="divide-y divide-white/10">
            {conversations.map((conversation) => {
              const name = getConversationName(conversation);
              const lastMsg = conversation.lastMessage;
              const hasUnread = conversation.unreadCount > 0;

              return (
                <Link
                  key={conversation.id}
                  href={`/messages/${conversation.id}`}
                  className="flex items-center gap-3 p-4 hover:bg-white/5 transition-colors"
                >
                  <div className="w-12 h-12 bg-surface-card rounded-full flex-shrink-0 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium truncate ${hasUnread ? 'text-white' : 'text-gray-300'}`}>
                        {name}
                      </span>
                      {lastMsg && (
                        <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                          {formatTimestamp(lastMsg.createdAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className={`text-sm truncate ${hasUnread ? 'text-gray-300' : 'text-gray-500'}`}>
                        {lastMsg?.content || 'No messages yet'}
                      </p>
                      {hasUnread && (
                        <span className="ml-2 flex-shrink-0 bg-primary-500 text-white text-xs font-medium rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                          {conversation.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
