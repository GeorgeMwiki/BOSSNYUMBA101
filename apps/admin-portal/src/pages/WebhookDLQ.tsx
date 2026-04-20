/**
 * Outbound webhook dead-letter queue — Wave 15 UI gap closure.
 *
 *   GET  /api/v1/webhooks/dead-letters
 *   GET  /api/v1/webhooks/dead-letters/:id
 *   POST /api/v1/webhooks/dead-letters/:id/replay
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Inbox, Loader2, Repeat } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { api } from '../lib/api';

interface DlqEntry {
  readonly id: string;
  readonly webhookUrl: string;
  readonly eventType: string;
  readonly lastError: string;
  readonly attempts: number;
  readonly createdAt: string;
  readonly replayedAt?: string | null;
  readonly replayedBy?: string | null;
  readonly payloadPreview?: string;
}

export default function WebhookDLQ(): JSX.Element {
  const t = useTranslations('webhookDlq');
  const [entries, setEntries] = useState<readonly DlqEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DlqEntry | null>(null);
  const [replaying, setReplaying] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get<readonly DlqEntry[]>('/webhooks/dead-letters?limit=100');
    if (res.success && res.data) setEntries(res.data);
    else setError(res.error ?? t('errorLoad'));
    setLoading(false);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function replay(entry: DlqEntry): Promise<void> {
    setReplaying(entry.id);
    const res = await api.post(
      `/webhooks/dead-letters/${encodeURIComponent(entry.id)}/replay`,
      {},
    );
    setReplaying(null);
    if (res.success) void load();
    else setError(res.error ?? t('errorReplay'));
  }

  async function inspect(entry: DlqEntry): Promise<void> {
    const res = await api.get<DlqEntry>(
      `/webhooks/dead-letters/${encodeURIComponent(entry.id)}`,
    );
    if (res.success && res.data) setSelected(res.data);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Inbox className="h-6 w-6 text-rose-600" />
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{t('title')}</h2>
          <p className="text-sm text-gray-500">
            {t('subtitle')}
          </p>
        </div>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('loading')}
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-500">
          {t('emptyQueue')}
        </div>
      ) : (
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs text-gray-500">
                <th className="px-3 py-2">{t('colEvent')}</th>
                <th className="px-3 py-2">{t('colUrl')}</th>
                <th className="px-3 py-2">{t('colAttempts')}</th>
                <th className="px-3 py-2">{t('colLastError')}</th>
                <th className="px-3 py-2">{t('colCreated')}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-medium">{e.eventType}</td>
                  <td className="px-3 py-2 text-xs font-mono text-gray-500 truncate max-w-[18ch]">
                    {e.webhookUrl}
                  </td>
                  <td className="px-3 py-2">{e.attempts}</td>
                  <td className="px-3 py-2 text-xs text-red-600 truncate max-w-[24ch]">
                    {e.lastError}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => void inspect(e)}
                      className="text-xs text-gray-600 hover:underline"
                    >
                      {t('inspect')}
                    </button>
                    {!e.replayedAt && (
                      <button
                        type="button"
                        onClick={() => void replay(e)}
                        disabled={replaying === e.id}
                        className="text-xs text-rose-600 hover:underline inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        <Repeat className="h-3 w-3" /> {t('replay')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {selected && (
        <section className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-sm space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">
              {t('deliveryHeader', { id: selected.id })}
            </h3>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-xs text-gray-500"
            >
              {t('close')}
            </button>
          </div>
          <pre className="text-xs bg-white border border-gray-200 rounded p-3 overflow-x-auto">
            {selected.payloadPreview ?? t('payloadUnavailable')}
          </pre>
        </section>
      )}
    </div>
  );
}
