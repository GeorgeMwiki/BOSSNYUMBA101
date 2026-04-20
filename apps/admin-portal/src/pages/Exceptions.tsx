/**
 * Exceptions inbox page — Wave-13.
 *
 * Priority-grouped list with acknowledge + resolve actions. The head of
 * estates works through P1 → P2 → P3 and every resolution writes back
 * through the autonomy audit trail.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription, Button } from '@bossnyumba/design-system';
import { api } from '../lib/api';

type Priority = 'P1' | 'P2' | 'P3';

interface Exception {
  readonly id: string;
  readonly domain: string;
  readonly priority: Priority;
  readonly title: string;
  readonly description: string;
  readonly recommendedAction: string | null;
  readonly createdAt: string;
  readonly status: 'open' | 'resolved' | 'dismissed';
}

export default function ExceptionsPage(): JSX.Element {
  const t = useTranslations('exceptions');
  const [items, setItems] = useState<readonly Exception[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    const res = await api.get<readonly Exception[]>('/exceptions');
    if (res.success && res.data) setItems(res.data);
    else setError(res.error ?? t('errorLoad'));
    setLoading(false);
  }, [t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const groups: Record<Priority, Exception[]> = {
    P1: [],
    P2: [],
    P3: [],
  };
  for (const e of items) groups[e.priority].push(e);

  async function acknowledge(id: string): Promise<void> {
    await api.post(`/exceptions/${id}/acknowledge`, {});
    void reload();
  }

  async function resolve(id: string, resolution: string): Promise<void> {
    await api.post(`/exceptions/${id}/resolve`, { resolution });
    void reload();
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <AlertTriangle className="h-6 w-6 text-amber-500" />
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{t('title')}</h2>
          <p className="text-sm text-gray-500">{t('subtitle')}</p>
        </div>
      </header>

      {loading && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 text-sm text-gray-500">
          {t('loading')}
        </div>
      )}

      {!loading && error && (
        <Alert variant="danger">
          <AlertDescription>
            {error}
            <Button size="sm" onClick={() => void reload()} className="ml-2">
              {t('retry')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 text-sm text-gray-500 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          {t('empty')}
        </div>
      )}

      {(['P1', 'P2', 'P3'] as const).map((pri) =>
        groups[pri].length > 0 ? (
          <PriorityGroup
            key={pri}
            priority={pri}
            items={groups[pri]}
            onAcknowledge={acknowledge}
            onResolve={resolve}
          />
        ) : null,
      )}
    </div>
  );
}

function PriorityGroup({
  priority,
  items,
  onAcknowledge,
  onResolve,
}: {
  priority: Priority;
  items: readonly Exception[];
  onAcknowledge: (id: string) => Promise<void>;
  onResolve: (id: string, resolution: string) => Promise<void>;
}): JSX.Element {
  const t = useTranslations('exceptions');
  const colour =
    priority === 'P1'
      ? 'text-red-700 bg-red-50 border-red-200'
      : priority === 'P2'
        ? 'text-amber-700 bg-amber-50 border-amber-200'
        : 'text-gray-700 bg-gray-50 border-gray-200';
  return (
    <section
      className={`rounded-xl border p-5 ${colour}`}
      data-testid={`group-${priority}`}
    >
      <h3 className="font-semibold mb-3">{t(`priority.${priority}`)}</h3>
      <ul className="space-y-3">
        {items.map((e) => (
          <li
            key={e.id}
            className="bg-white rounded-lg border border-gray-200 p-4 text-sm text-gray-700 space-y-2"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-gray-900">{e.title}</p>
                <p className="text-xs text-gray-500">
                  {e.domain} \u00b7 {new Date(e.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onAcknowledge(e.id)}
                  className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50"
                >
                  {t('acknowledge')}
                </button>
                <button
                  type="button"
                  onClick={() => onResolve(e.id, 'approved')}
                  className="rounded bg-violet-600 text-white px-3 py-1 text-xs hover:bg-violet-700"
                >
                  {t('resolve')}
                </button>
              </div>
            </div>
            <p>{e.description}</p>
            {e.recommendedAction && (
              <p className="text-xs text-violet-700">
                {t('recommended', { action: e.recommendedAction })}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
