/**
 * Tenant ↔ property-manager conversation detail.
 *
 * Wave 23: rewired off `LiveDataRequiredScreen` to consume the real
 * gateway endpoints via `@bossnyumba/api-client`:
 *   - `messagingService.getConversation(id)` — thread header / subject
 *   - `messagingService.listMessages(id)`    — message history
 *   - `messagingService.sendMessage(id, …)`  — outbound compose
 *
 * Shape tolerance (mirrors the list page at `../page.tsx`): the gateway
 * currently SELECTs raw snake_case rows (`sender_type`, `created_at`,
 * `is_internal`) which drift from the api-client's camelCase `Message`
 * type. A thin adapter accepts either shape so the page works before
 * and after a future gateway normalisation pass.
 *
 * Send-path degradation: `POST /conversations/:id/messages` is still
 * `501 NOT_IMPLEMENTED` on the gateway today. We keep the composer
 * visible but, on a not-implemented / failed send, surface a localized
 * notice instead of crashing — the read path (the actual "tenant can't
 * open threads" blocker) is fully live.
 *
 * Internal-note guard: tenant-facing surfaces must never render
 * manager-only notes. We drop any message flagged `is_internal` before
 * display, regardless of what the gateway returns.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, Send } from 'lucide-react';
import { messagingService } from '@bossnyumba/api-client';
import { PageHeader } from '@/components/layout/PageHeader';

interface MessageView {
  readonly id: string;
  readonly content: string;
  readonly senderType: 'customer' | 'manager' | 'system';
  readonly createdAt: string | null;
  readonly mine: boolean;
}

/** Raw snake_case message row as SELECTed by the api-gateway today. */
interface RawMessageRow {
  readonly id?: string;
  readonly content?: string | null;
  readonly sender_type?: string | null;
  readonly is_internal?: boolean | null;
  readonly created_at?: string | null;
}

function normalizeSenderType(
  value: unknown,
): 'customer' | 'manager' | 'system' {
  if (value === 'customer' || value === 'manager' || value === 'system') {
    return value;
  }
  // Gateway rows may carry richer roles (e.g. 'agent', 'landlord'); collapse
  // anything that isn't the tenant into the non-customer "manager" bucket so
  // alignment / labelling stays binary on this surface.
  return 'manager';
}

/** Adapt either the api-client typed `Message` or the raw gateway row. */
function adaptMessage(input: unknown): MessageView | null {
  if (!input || typeof input !== 'object') return null;
  const obj = input as Record<string, unknown>;

  const id = typeof obj.id === 'string' ? obj.id : null;
  if (!id) return null;

  // Internal manager notes must never reach a tenant surface.
  const isInternal =
    obj.isInternal === true ||
    (obj as unknown as RawMessageRow).is_internal === true;
  if (isInternal) return null;

  const content =
    typeof obj.content === 'string' ? obj.content : '';
  if (content.trim().length === 0) return null;

  const senderType = normalizeSenderType(
    obj.senderType ?? (obj as unknown as RawMessageRow).sender_type,
  );

  const createdAt =
    typeof obj.createdAt === 'string'
      ? obj.createdAt
      : typeof (obj as unknown as RawMessageRow).created_at === 'string'
        ? ((obj as unknown as RawMessageRow).created_at ?? null)
        : null;

  return {
    id,
    content,
    senderType,
    createdAt,
    mine: senderType === 'customer',
  };
}

/** Pull a human subject from either api-client or raw gateway conversation. */
function adaptSubject(input: unknown): string {
  if (!input || typeof input !== 'object') return '';
  const obj = input as Record<string, unknown>;
  return typeof obj.subject === 'string' ? obj.subject : '';
}

export default function MessageThreadPage() {
  const params = useParams();
  const conversationId =
    typeof params.id === 'string'
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : '';

  const tHeaders = useTranslations('pageHeaders');
  const t = useTranslations('messageThread');

  const [subject, setSubject] = useState<string>('');
  const [messages, setMessages] = useState<readonly MessageView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendNotice, setSendNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!conversationId) {
      setError(t('notFound'));
      setLoading(false);
      return;
    }
    let active = true;
    async function load(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const [conversation, messageList] = await Promise.all([
          messagingService.getConversation(conversationId),
          messagingService.listMessages(conversationId, { pageSize: 100 }),
        ]);
        if (!active) return;
        setSubject(adaptSubject(conversation.data));
        const rows = Array.isArray(messageList.data) ? messageList.data : [];
        const adapted = rows
          .map((row) => adaptMessage(row))
          .filter((row): row is MessageView => row !== null)
          // Gateway returns newest-first; render oldest-first (chat order).
          .reverse();
        setMessages(adapted);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : t('errorLoad'));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [conversationId, reloadToken, t]);

  const handleSend = useCallback(async () => {
    const content = draft.trim();
    if (!content || !conversationId || sending) return;
    setSending(true);
    setSendNotice(null);
    try {
      const response = await messagingService.sendMessage(conversationId, {
        content,
      });
      const sent = adaptMessage(response.data);
      if (sent) {
        setMessages((prev) => [...prev, sent]);
      } else {
        // Send succeeded but the gateway didn't echo a usable row — refetch.
        setReloadToken((v) => v + 1);
      }
      setDraft('');
    } catch (err) {
      // The gateway send path is 501 today; surface a soft notice rather
      // than blocking the (working) read experience.
      const message = err instanceof Error ? err.message : '';
      const notImplemented = /501|not.?implemented|not yet wired/i.test(
        message,
      );
      setSendNotice(notImplemented ? t('sendUnavailable') : t('sendFailed'));
    } finally {
      setSending(false);
    }
  }, [conversationId, draft, sending, t]);

  return (
    <>
      <PageHeader title={subject || tHeaders('conversation')} showBack />
      <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
        <div className="flex-1 px-4 py-4 pb-40 space-y-3">
          {loading && (
            <p className="text-sm text-gray-400 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> {t('loading')}
            </p>
          )}

          {error && (
            <div className="rounded-lg bg-red-900/30 border border-red-500/40 text-red-200 p-3 text-sm flex items-center justify-between gap-3">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setReloadToken((v) => v + 1)}
                className="rounded border border-red-400/60 px-3 py-1 text-xs hover:bg-red-500/20"
              >
                {t('retry')}
              </button>
            </div>
          )}

          {!loading && !error && messages.length === 0 && (
            <p className="text-sm text-gray-400">{t('empty')}</p>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.mine ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  message.mine
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 border border-gray-700 text-gray-100'
                }`}
              >
                {!message.mine && (
                  <p className="text-xs text-gray-400 mb-1">
                    {message.senderType === 'system'
                      ? t('system')
                      : t('manager')}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words">
                  {message.content}
                </p>
                {message.createdAt && (
                  <p
                    className={`text-[10px] mt-1 ${
                      message.mine ? 'text-blue-200' : 'text-gray-500'
                    }`}
                  >
                    {new Date(message.createdAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {!loading && !error && (
          <div className="fixed bottom-16 left-0 right-0 border-t border-gray-700 bg-gray-900 px-4 py-3">
            {sendNotice && (
              <p className="text-xs text-amber-300 mb-2">{sendNotice}</p>
            )}
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                rows={1}
                placeholder={t('composerPlaceholder')}
                aria-label={t('composerPlaceholder')}
                className="flex-1 resize-none rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={sending || draft.trim().length === 0}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span>{sending ? t('sending') : t('send')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
