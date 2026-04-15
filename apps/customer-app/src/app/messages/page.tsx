'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronRight, Loader2, MessageCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { api, type ConversationRecord } from '@/lib/api';

function formatTime(date: string) {
  const d = new Date(date);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString();
}

export default function MessagesPage() {
  const query = useQuery<ConversationRecord[]>({
    queryKey: ['conversations'],
    queryFn: () => api.messaging.listConversations(),
    refetchInterval: 30000,
  });

  return (
    <>
      <PageHeader title="Messages" />
      <div className="space-y-2 px-4 py-4 pb-24">
        {query.isLoading && (
          <div className="flex items-center justify-center gap-2 py-12 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading conversations...
          </div>
        )}

        {query.error && (
          <div className="card border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <div>
                <p className="font-medium">Could not load messages</p>
                <p>{(query.error as Error).message}</p>
                <button
                  type="button"
                  onClick={() => query.refetch()}
                  className="mt-2 text-sm underline"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        )}

        {!query.isLoading && !query.error && (query.data?.length ?? 0) === 0 && (
          <div className="card flex flex-col items-center gap-2 p-10 text-center text-gray-400">
            <MessageCircle className="h-8 w-8 text-gray-500" />
            <p className="font-medium text-gray-200">No conversations yet</p>
            <p className="text-sm">
              Messages from your property manager will appear here.
            </p>
          </div>
        )}

        {(query.data ?? []).map((c) => {
          const other = c.participants?.find((p) => p.type !== 'customer');
          const name = c.subject ?? other?.name ?? 'Property Manager';
          return (
            <Link
              key={c.id}
              href={`/messages/${c.id}`}
              className="card flex items-center gap-3 p-4"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-500/15 text-primary-200">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate font-medium text-white">{name}</div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    {c.unreadCount > 0 && (
                      <span className="rounded-full bg-primary-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                        {c.unreadCount}
                      </span>
                    )}
                    <span>{formatTime(c.updatedAt)}</span>
                  </div>
                </div>
                <div className="truncate text-sm text-gray-400">
                  {c.lastMessage?.content ?? 'No messages yet'}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-500" />
            </Link>
          );
        })}
      </div>
    </>
  );
}
