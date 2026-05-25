'use client';

/**
 * ChatComposer — textarea + attachment + send for a thread.
 *
 * Posts to `POST /api/v1/messaging/conversations/:threadId/messages`. The
 * E2E spec watches for URLs containing `/api/v1/messag` and method POST,
 * so this hits that filter cleanly.
 *
 * Behaviour:
 *   - Whitespace-only submit is rejected client-side (the E2E's
 *     validation test allows either client OR server reject; we do
 *     client to avoid wasting a round trip).
 *   - Optimistic insertion: the parent's `onLocalMessage` (if provided)
 *     is called with the locally-rendered shape before the POST so the
 *     user sees the message immediately.
 *   - On failure: the optimistic message is removed via
 *     `onLocalMessageFailed(localId)` (parent-owned), and an error toast
 *     appears under the composer for 4s. The text is restored to the
 *     input so the user can retry without retyping.
 */

import { useCallback, useRef, useState } from 'react';
import { Paperclip, Send, X, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getApiBaseUrl } from '@/lib/api';
import { getCsrfHeaders } from '@/lib/csrf';

export interface LocalMessage {
  readonly id: string;
  readonly content: string;
  readonly attachments: ReadonlyArray<{
    readonly name: string;
    readonly dataUrl: string;
  }>;
  readonly createdAt: string;
}

export interface ChatComposerProps {
  readonly threadId: string;
  readonly onLocalMessage?: (msg: LocalMessage) => void;
  readonly onLocalMessageFailed?: (localId: string) => void;
  readonly onLocalMessageConfirmed?: (
    localId: string,
    serverId: string | null,
  ) => void;
  readonly disabled?: boolean;
}

const MAX_ATTACHMENTS = 3;
const TOAST_MS = 4000;

interface PendingFile {
  readonly id: string;
  readonly name: string;
  readonly dataUrl: string;
}

async function readAsDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

function authHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = window.localStorage.getItem('customer_token') ?? '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function ChatComposer({
  threadId,
  onLocalMessage,
  onLocalMessageFailed,
  onLocalMessageConfirmed,
  disabled = false,
}: ChatComposerProps): JSX.Element {
  const t = useTranslations('chatComposer');
  const tP89 = useTranslations('p89.chatComposer');
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<ReadonlyArray<PendingFile>>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const onPickFiles = useCallback(
    async (files: FileList | null): Promise<void> => {
      if (!files || files.length === 0) return;
      const additions: PendingFile[] = [];
      for (const file of Array.from(files).slice(0, MAX_ATTACHMENTS)) {
        try {
          const dataUrl = await readAsDataUrl(file);
          additions.push({
            id:
              typeof crypto !== 'undefined' && 'randomUUID' in crypto
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            name: file.name,
            dataUrl,
          });
        } catch (err) {
          // Single file failure shouldn't block the rest — skip and
          // surface a one-line error.
          setError(err instanceof Error ? err.message : 'Attachment read failed');
        }
      }
      setPending((prev) => {
        const merged = [...prev, ...additions];
        return merged.slice(0, MAX_ATTACHMENTS);
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [],
  );

  const removePending = useCallback((id: string): void => {
    setPending((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const onSend = useCallback(
    async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
      e.preventDefault();
      if (sending || disabled) return;
      const text = draft.trim();
      if (!text && pending.length === 0) {
        setError('Message cannot be empty.');
        return;
      }

      const localId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `local-${Date.now()}`;
      const attachments = pending.map((p) => ({
        name: p.name,
        dataUrl: p.dataUrl,
      }));
      const localMsg: LocalMessage = {
        id: localId,
        content: text,
        attachments,
        createdAt: new Date().toISOString(),
      };

      setSending(true);
      setError(null);
      onLocalMessage?.(localMsg);

      const savedDraft = draft;
      setDraft('');
      setPending([]);

      try {
        const res = await fetch(
          `${getApiBaseUrl()}/messaging/conversations/${encodeURIComponent(threadId)}/messages`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...authHeader(),
              ...getCsrfHeaders(),
            },
            body: JSON.stringify({
              content: text,
              attachments: attachments.map((a) => ({
                type: 'image',
                url: a.dataUrl,
                filename: a.name,
              })),
            }),
          },
        );
        if (!res.ok) {
          throw new Error(`Send failed (${res.status})`);
        }
        const body = (await res.json().catch(() => ({}))) as {
          data?: { id?: string };
        };
        onLocalMessageConfirmed?.(localId, body.data?.id ?? null);
      } catch (err) {
        onLocalMessageFailed?.(localId);
        setError(err instanceof Error ? err.message : 'Send failed');
        // Restore the draft so the user can retry without re-typing.
        setDraft(savedDraft);
        setPending(pending);
      } finally {
        setSending(false);
      }
    },
    [
      draft,
      pending,
      sending,
      disabled,
      threadId,
      onLocalMessage,
      onLocalMessageFailed,
      onLocalMessageConfirmed,
    ],
  );

  // Auto-dismiss the error toast.
  if (error) {
    setTimeout(() => setError((cur) => (cur === error ? null : cur)), TOAST_MS);
  }

  return (
    <form
      onSubmit={(e) => void onSend(e)}
      data-testid="chat-composer"
      className="space-y-2"
    >
      {pending.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {pending.map((file) => (
            <li
              key={file.id}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#1a1a1a] px-3 py-1 text-xs text-gray-200"
            >
              <span className="max-w-[12rem] truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => removePending(file.id)}
                aria-label={`Remove ${file.name}`}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-md bg-red-900/30 border border-red-500/40 text-red-200 px-3 py-2 text-xs"
        >
          {error}
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          onChange={(e) => void onPickFiles(e.target.files)}
          className="hidden"
          aria-label={t('attachFiles')}
          data-testid="chat-file-input"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending || disabled || pending.length >= MAX_ATTACHMENTS}
          aria-label={t('attachFile')}
          data-testid="chat-attach-button"
          className="rounded-lg border border-white/10 bg-[#1a1a1a] p-2 text-gray-300 disabled:opacity-50"
        >
          <Paperclip className="h-5 w-5" />
        </button>
        <label className="flex-1">
          <span className="sr-only">Message</span>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a message…"
            rows={1}
            disabled={sending || disabled}
            aria-label="Message"
            data-testid="chat-input"
            className="block min-h-[44px] w-full resize-y rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm text-white placeholder:text-gray-500"
          />
        </label>
        <button
          type="submit"
          disabled={sending || disabled || (!draft.trim() && pending.length === 0)}
          aria-label={tP89('sendMessageAria')}
          data-testid="chat-send-button"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 inline-flex items-center gap-2"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          <span>{sending ? 'Sending…' : 'Send'}</span>
        </button>
      </div>
    </form>
  );
}
