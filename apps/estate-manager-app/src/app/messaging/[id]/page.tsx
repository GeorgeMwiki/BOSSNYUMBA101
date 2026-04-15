'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, User, Loader2, AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { messagingApi, type Message } from '@/lib/api';

export default function ConversationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const currentUserId =
    typeof window !== 'undefined' ? localStorage.getItem('user_id') ?? '' : '';

  const conversationQuery = useQuery({
    queryKey: ['conversation', id],
    queryFn: () => messagingApi.getConversation(id),
    retry: false,
    enabled: Boolean(id),
  });

  const messagesQuery = useQuery({
    queryKey: ['conversation-messages', id],
    queryFn: () => messagingApi.listMessages(id, { pageSize: 100 }),
    retry: false,
    enabled: Boolean(id),
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (id) {
      messagingApi.markRead(id).catch(() => undefined);
    }
  }, [id, messagesQuery.data]);

  const sendMutation = useMutation({
    mutationFn: (content: string) => messagingApi.send(id, content),
    onSuccess: () => {
      setNewMessage('');
      void queryClient.invalidateQueries({ queryKey: ['conversation-messages', id] });
      void queryClient.invalidateQueries({ queryKey: ['messaging-conversations'] });
    },
  });

  const conversation = conversationQuery.data?.data;
  const messages: Message[] = messagesQuery.data?.data ?? [];

  const convErrorMessage =
    conversationQuery.error instanceof Error
      ? conversationQuery.error.message
      : conversationQuery.data && !conversationQuery.data.success
      ? conversationQuery.data.error?.message
      : undefined;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (conversationQuery.isLoading) {
    return (
      <>
        <PageHeader title="Conversation" showBack />
        <div className="px-4 py-8 flex items-center justify-center gap-2 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading conversation...
        </div>
      </>
    );
  }

  if (convErrorMessage || !conversation) {
    return (
      <>
        <PageHeader title="Conversation" showBack />
        <div className="px-4 py-8 text-center">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">{convErrorMessage ?? 'Conversation not found'}</p>
          <button onClick={() => router.back()} className="btn-secondary">
            Go Back
          </button>
        </div>
      </>
    );
  }

  const participantNames = conversation.participants.map((p) => p.name || p.id).join(', ');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const content = newMessage.trim();
    if (!content) return;
    sendMutation.mutate(content);
  };

  return (
    <>
      <PageHeader
        title={conversation.subject || 'Conversation'}
        subtitle={participantNames}
        showBack
      />

      <div className="flex flex-col h-[calc(100vh-120px)]">
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messagesQuery.isLoading && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading messages...
            </div>
          )}
          {messages.map((msg) => {
            const isOwn =
              msg.senderType === 'manager' ||
              (currentUserId && msg.senderId === currentUserId);
            const participant = conversation.participants.find((p) => p.id === msg.senderId);
            const senderName = participant?.name ?? msg.senderType;
            return (
              <div key={msg.id} className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-primary-600" />
                </div>
                <div className={`flex-1 max-w-[80%] ${isOwn ? 'items-end' : ''}`}>
                  <div className="text-xs text-gray-500 mb-1">{senderName}</div>
                  <div
                    className={`p-3 rounded-xl ${
                      isOwn ? 'bg-primary-100 text-primary-900 ml-auto' : 'bg-gray-100'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(msg.createdAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        <div className="p-4 border-t border-gray-200 bg-white">
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="text"
              className="input flex-1"
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={sendMutation.isPending}
            />
            <button
              type="submit"
              className="btn-primary flex items-center justify-center"
              disabled={sendMutation.isPending || !newMessage.trim()}
            >
              {sendMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </form>
          {sendMutation.error && (
            <p className="text-xs text-danger-600 mt-2">
              {(sendMutation.error as Error).message}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
