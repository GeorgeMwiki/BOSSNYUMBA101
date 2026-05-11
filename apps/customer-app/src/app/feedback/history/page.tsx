'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { MessageSquare, ChevronRight, Loader2 } from 'lucide-react';
import { feedbackService } from '@bossnyumba/api-client';
import { PageHeader } from '@/components/layout/PageHeader';

/**
 * Local Feedback shape — inlined to sidestep tsup's barrel
 * namespace/type drift (TS2709). Mirrors the structurally-relevant
 * subset of the api-client's `services/feedback.ts` `Feedback`
 * interface.
 */
type FeedbackType = 'COMPLAINT' | 'SUGGESTION' | 'PRAISE' | 'GENERAL';
type FeedbackStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
interface Feedback {
  readonly id: string;
  readonly type: FeedbackType;
  readonly status: FeedbackStatus;
  readonly subject?: string;
  readonly message?: string;
  readonly description?: string;
  readonly createdAt: string;
}

const TYPE_LABEL_KEY: Record<Feedback['type'], string> = {
  COMPLAINT: 'typeComplaint',
  SUGGESTION: 'typeSuggestion',
  PRAISE: 'typeCompliment',
  GENERAL: 'typeOther',
};

const STATUS_LABEL_KEY: Record<Feedback['status'], string> = {
  OPEN: 'statusOpen',
  IN_PROGRESS: 'statusInProgress',
  RESOLVED: 'statusResolved',
  CLOSED: 'statusClosed',
};

export default function FeedbackHistoryPage() {
  const t = useTranslations('feedbackHistory');
  const tTypes = useTranslations('feedbackPage');
  const [items, setItems] = useState<readonly Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;
    async function load(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const response = await feedbackService.getMyFeedback({ pageSize: 50 });
        if (!active) return;
        setItems(response.data ?? []);
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
  }, [reloadToken, t]);

  return (
    <>
      <PageHeader title={t('title')} showBack />

      <div className="px-4 py-4 space-y-4">
        <Link
          href="/feedback"
          className="card p-4 flex items-center justify-between bg-primary-50 border-primary-100 hover:bg-primary-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-500 rounded-lg">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-medium">{t('submitNew')}</div>
              <div className="text-sm text-gray-600">
                {t('submitNewSubtitle')}
              </div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-primary-600" />
        </Link>

        <section>
          <h3 className="text-sm font-medium text-gray-500 mb-3">
            {t('pastSubmissions')}
          </h3>

          {loading && (
            <div className="card p-4 flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('loading')}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="card p-4 border-danger-200 bg-danger-50 text-sm text-danger-700 flex items-center justify-between gap-3"
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setReloadToken((value) => value + 1)}
                className="rounded border border-danger-300 px-3 py-1 text-xs hover:bg-danger-100"
              >
                {t('retry')}
              </button>
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="font-medium text-gray-900">{t('emptyTitle')}</h3>
              <p className="text-sm text-gray-500 mt-1">
                {t('emptyBody')}
              </p>
              <Link href="/feedback" className="btn-primary mt-4 inline-flex">
                {t('emptyCta')}
              </Link>
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {item.subject || tTypes(TYPE_LABEL_KEY[item.type])}
                        </span>
                        <span className="badge-gray">
                          {tTypes(TYPE_LABEL_KEY[item.type])}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                        {item.description}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                        <span className="badge-gray">
                          {t(STATUS_LABEL_KEY[item.status])}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
