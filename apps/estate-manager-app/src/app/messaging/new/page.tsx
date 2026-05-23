'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  customersService,
  messagingService,
} from '@bossnyumba/api-client';
import {
  Alert,
  AlertDescription,
  Skeleton,
} from '@bossnyumba/design-system';
import { PageHeader } from '@/components/layout/PageHeader';
import { ROUTES } from '@/lib/routes';

interface RecipientOption {
  readonly id: string;
  readonly name: string;
  readonly hint?: string;
}

export default function NewConversationPage() {
  const t = useTranslations('newMessage');
  const tList = useTranslations('messagingList');
  const router = useRouter();
  const queryClient = useQueryClient();

  const [recipientId, setRecipientId] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');

  const customersQuery = useQuery({
    queryKey: [
      'messaging-new-customers',
      { search: search.trim() || undefined, pageSize: 50 },
    ],
    queryFn: () =>
      customersService.list({
        page: 1,
        pageSize: 50,
        search: search.trim() || undefined,
      }),
    retry: false,
  });

  const recipients: ReadonlyArray<RecipientOption> = useMemo(() => {
    const list = Array.isArray(customersQuery.data?.data)
      ? customersQuery.data!.data!
      : [];
    return list.map((c) => {
      const fullName = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
      const lease = (c as { currentLease?: { unitNumber?: string } })
        .currentLease;
      return {
        id: c.id,
        name: fullName || c.email || c.id,
        hint: lease?.unitNumber
          ? t('unitLabel', { unit: lease.unitNumber })
          : c.email,
      };
    });
  }, [customersQuery.data, t]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const trimmedMessage = message.trim();
      const trimmedSubject = subject.trim();
      const created = await messagingService.createConversation({
        participantId: recipientId,
        subject: trimmedSubject || undefined,
        initialMessage: trimmedMessage || undefined,
      });
      return created;
    },
    onSuccess: (response: { data: { id: string } }) => {
      queryClient.invalidateQueries({
        queryKey: ['messaging-conversations-live'],
      });
      router.push(ROUTES.messaging.detail(response.data.id));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientId || !subject.trim() || !message.trim()) return;
    createMutation.mutate();
  };

  return (
    <>
      <PageHeader title={t('title')} showBack />

      <form
        onSubmit={handleSubmit}
        className="px-4 py-4 space-y-4 max-w-2xl mx-auto"
        noValidate
      >
        <div className="card p-4 space-y-4">
          <div>
            <label className="label">{t('selectRecipient')}</label>
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              className="input mb-3"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {customersQuery.isLoading && (
              <div aria-busy="true" className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            )}
            {customersQuery.error && (
              <Alert variant="danger">
                <AlertDescription>
                  {(customersQuery.error as Error).message ||
                    tList('failedToLoad')}
                </AlertDescription>
              </Alert>
            )}
            {!customersQuery.isLoading &&
              !customersQuery.error &&
              recipients.length === 0 && (
                <div className="text-sm text-gray-500 px-1 py-3">
                  {t('noRecipients')}
                </div>
              )}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {recipients.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRecipientId(r.id)}
                  className={`w-full p-3 rounded-lg text-left border transition-colors flex items-start gap-3 ${
                    recipientId === r.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{r.name}</div>
                    {r.hint && (
                      <div className="text-sm text-gray-500 truncate">
                        {r.hint}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="msg-subject" className="label">
              {t('subject')}
            </label>
            <input
              id="msg-subject"
              type="text"
              className="input"
              placeholder={t('subjectPlaceholder')}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="msg-body" className="label">
              {t('message')}
            </label>
            <textarea
              id="msg-body"
              className="input min-h-[120px]"
              placeholder={t('messagePlaceholder')}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            />
          </div>
        </div>

        {createMutation.error && (
          <Alert variant="danger">
            <AlertDescription>
              {(createMutation.error as Error).message ||
                tList('createFailed')}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-secondary flex-1"
            disabled={createMutation.isPending}
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            disabled={
              !recipientId ||
              !subject.trim() ||
              !message.trim() ||
              createMutation.isPending
            }
          >
            <Send className="w-4 h-4" />
            {createMutation.isPending
              ? tList('creating')
              : t('sendMessage')}
          </button>
        </div>
      </form>
    </>
  );
}
