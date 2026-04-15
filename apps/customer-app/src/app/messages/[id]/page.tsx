'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, Send } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { api, type ConversationRecord, type MessageRecord } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

export default function MessageThreadPage() {
  const params = useParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const id = params?.id as string;
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const conversationQuery = useQuery<ConversationRecord>({
    queryKey: ['conversation', id],
    queryFn: () => api.messaging.getConversation(id),
    enabled: !!id,
  });

  const messagesQuery = useQuery<MessageRecord[]>({
    queryKey: ['conversation', id, 'messages'],
    queryFn: () => api.messaging.listMessages(id),
    enabled: !!id,
    refetchInterval: 10000,
  });

  const [draft, setDraft] = useState('');
  const sendMutation = useMutation({
    mutationFn: (content: string) => api.messaging.sendMessage(id, content),
    onSuccess: () => {
      setDraft('');
      queryClient.invalidateQueries({ queryKey: ['conversation', id, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : 'Failed to send message',
        'Message failed'
      ),
  });

  const markReadMutation = useMutation({
    mutationFn: () => api.messaging.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  useEffect(() => {
    if (id && conversationQuery.data?.unreadCount) {
      markReadMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, conversationQuery.data?.unreadCount]);

  useEffect(() => {
    if (messagesQuery.data?.length) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messagesQuery.data?.length]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    sendMutation.mutate(trimmed);
  };

  const subject =
    conversationQuery.data?.subject ??
    conversationQuery.data?.participants?.find((p) => p.type !== 'customer')?.name ??
    'Conversation';

  return (
    <>
      <PageHeader title={subject} showBack />
      <div className="flex h-[calc(100vh-56px)] flex-col">
        <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
          {messagesQuery.isLoading && (
            <div className="flex items-center justify-center gap-2 py-12 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading messages...
            </div>
          )}

          {messagesQuery.error && (
            <div className="card border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <span>{(messagesQuery.error as Error).message}</span>
              </div>
            </div>
          )}

          {(messagesQuery.data ?? []).map((m) => {
            const self = m.senderType === 'customer';
            return (
              <div
                key={m.id}
                className={`flex ${self ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    self
                      ? 'rounded-br-sm bg-primary-500/30 text-primary-50'
                      : 'rounded-bl-sm bg-white/5 text-gray-100'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  <div className="mt-1 text-[10px] uppercase tracking-wide text-gray-400">
                    {new Date(m.createdAt).toLocaleString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={handleSend}
          className="flex gap-2 border-t border-white/10 bg-[#121212] p-3"
        >
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a message..."
            className="input flex-1"
            disabled={sendMutation.isPending}
          />
          <button
            type="submit"
            disabled={!draft.trim() || sendMutation.isPending}
            className="btn-primary flex items-center justify-center rounded-lg px-4"
            aria-label="Send message"
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </form>
      </div>
    </>
  );
}
