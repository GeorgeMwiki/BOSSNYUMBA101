'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, messagingService, type Message, type Conversation } from '@bossnyumba/api-client';
import { AlertTriangle, Send } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateDivider(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function MessagesSkeleton() {
  return (
    <div className="flex-1 p-4 space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
          <div className="animate-pulse">
            <div
              className={`h-10 rounded-2xl bg-surface-card ${i % 2 === 0 ? 'w-48' : 'w-56'}`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ChatError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center">
      <AlertTriangle className="w-12 h-12 text-warning-400 mb-4" />
      <h2 className="text-lg font-semibold text-white mb-2">Failed to load conversation</h2>
      <p className="text-gray-400 text-sm mb-6">Something went wrong. Please try again.</p>
      <button onClick={onRetry} className="btn-primary px-6 py-2">
        Retry
      </button>
    </div>
  );
}

export default function MessageThreadPage() {
  const params = useParams();
  const id = params.id as string;
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversation } = useQuery<Conversation>(
    `/messaging/conversations/${id}`,
    { enabled: !!id }
  );

  const { data: messages, isLoading, isError, refetch } = useQuery<Message[]>(
    `/messaging/conversations/${id}/messages`,
    { enabled: !!id, staleTime: 10 * 1000, refetchInterval: 15 * 1000 }
  );

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (messages?.length) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  const handleSend = async () => {
    if (!message.trim() || sending) return;

    setSending(true);
    try {
      await messagingService.sendMessage(id, { content: message.trim() });
      setMessage('');
      refetch();
    } catch {
      // allow retry
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const conversationName = conversation?.participants.find((p) => p.type === 'manager')?.name
    || conversation?.subject
    || 'Conversation';

  // Group messages by date
  const groupedMessages: { date: string; messages: Message[] }[] = [];
  if (messages) {
    let currentDate = '';
    for (const msg of messages) {
      const msgDate = new Date(msg.createdAt).toDateString();
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groupedMessages.push({ date: msg.createdAt, messages: [msg] });
      } else {
        groupedMessages[groupedMessages.length - 1].messages.push(msg);
      }
    }
  }

  return (
    <div className="flex flex-col h-screen">
      <PageHeader title={conversationName} showBack />

      {isLoading ? (
        <MessagesSkeleton />
      ) : isError ? (
        <ChatError onRetry={refetch} />
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 pb-2">
          {groupedMessages.map((group, gi) => (
            <div key={gi}>
              <div className="flex justify-center my-3">
                <span className="text-xs text-gray-500 bg-surface-card px-3 py-1 rounded-full">
                  {formatDateDivider(group.date)}
                </span>
              </div>
              {group.messages.map((msg) => {
                const isSent = msg.senderType === 'customer';
                return (
                  <div key={msg.id} className={`flex mb-2 ${isSent ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[75%] px-4 py-2.5 rounded-2xl ${
                        isSent
                          ? 'bg-primary-600 text-white rounded-br-md'
                          : 'bg-surface-card text-gray-200 rounded-bl-md'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                      <div className={`flex items-center justify-end gap-1 mt-1 ${isSent ? 'text-primary-200' : 'text-gray-500'}`}>
                        <span className="text-[10px]">{formatTime(msg.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Message input */}
      <div className="border-t border-white/10 bg-[#121212] p-3 pb-safe">
        <div className="flex items-end gap-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 bg-surface-card text-white placeholder-gray-500 rounded-2xl px-4 py-3 text-sm resize-none max-h-32 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || sending}
            className="p-3 bg-primary-600 text-white rounded-full disabled:opacity-40 hover:bg-primary-500 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Send message"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
