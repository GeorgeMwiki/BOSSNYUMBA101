'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Send, AlertCircle } from 'lucide-react';
import { chat, type Message } from '@bossnyumba/api-client';
import { ChatBubble } from '@/components/chat/ChatBubble';
import { useAuth } from '../contexts/AuthContext';

interface ChatPageProps {
  threadId?: string;
}

function formatTime(iso?: string): string | undefined {
  if (!iso) return undefined;
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return undefined;
  }
}

/**
 * ChatPage — thread-centric messaging surface backed by the live
 * messaging API via `@bossnyumba/api-client` `chat` service.
 *
 * Fetches the last 50 messages on mount, auto-scrolls to the bottom
 * whenever the list changes, and sends new messages via the send form.
 */
export default function ChatPage({ threadId: threadIdProp }: ChatPageProps = {}) {
  const auth = useAuth() as unknown as {
    user: { id: string } | null;
    token: string | null;
  };
  const currentUserId = auth.user?.id;

  const threadId = useMemo(() => {
    if (threadIdProp) return threadIdProp;
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    return params.get('threadId') ?? '';
  }, [threadIdProp]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadHistory = useCallback(async () => {
    if (!threadId) {
      setError('No chat thread selected.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await chat.listMessages({ threadId, limit: 50 });
      // API returns most-recent-first; display oldest-first
      const ordered = [...(response.data ?? [])].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      setMessages(ordered);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load chat history'
      );
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages]);

  const handleSend = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const body = draft.trim();
      if (!body) {
        setError('Message cannot be empty');
        return;
      }
      if (!threadId) {
        setError('No chat thread selected.');
        return;
      }
      setSending(true);
      setError(null);
      try {
        const response = await chat.sendMessage({ threadId, body });
        if (response.data) {
          setMessages((prev) => [...prev, response.data]);
        }
        setDraft('');
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to send message'
        );
      } finally {
        setSending(false);
      }
    },
    [draft, threadId]
  );

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3">
        <h1 className="text-lg font-semibold">Messages</h1>
        {threadId && (
          <p className="text-xs text-gray-500">Thread {threadId}</p>
        )}
      </header>

      <div
        ref={scrollRef}
        data-testid="chat-scroll"
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        {loading && (
          <div
            role="status"
            aria-live="polite"
            className="text-center text-sm text-gray-500 py-8"
          >
            Loading messages...
          </div>
        )}

        {!loading && error && (
          <div
            role="alert"
            className="card p-4 flex items-start gap-3 bg-danger-50 border-danger-100"
          >
            <AlertCircle className="w-5 h-5 text-danger-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-danger-900 mb-1">
                Something went wrong
              </h3>
              <p className="text-sm text-danger-800">{error}</p>
              <button
                onClick={() => void loadHistory()}
                className="text-sm text-danger-700 underline mt-2"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {!loading && !error && messages.length === 0 && (
          <div className="text-center text-sm text-gray-500 py-8">
            No messages yet. Say hello!
          </div>
        )}

        {!loading &&
          messages.map((msg) => (
            <ChatBubble
              key={msg.id}
              message={msg.content}
              isSent={msg.senderId === currentUserId}
              time={formatTime(msg.createdAt)}
            />
          ))}
      </div>

      <form
        onSubmit={handleSend}
        className="sticky bottom-0 bg-white border-t border-gray-200 p-3 flex gap-2 safe-area-bottom"
        aria-label="Send message"
      >
        <label htmlFor="chat-message-input" className="sr-only">
          Message
        </label>
        <input
          id="chat-message-input"
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message..."
          disabled={sending || loading}
          className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="btn-primary rounded-full px-4 py-2 flex items-center justify-center disabled:opacity-50"
          aria-label="Send"
        >
          {sending ? (
            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </form>
    </div>
  );
}
