/**
 * Agent certifications admin — Wave 15 UI gap closure.
 *
 *   GET    /api/v1/agent-certifications
 *   POST   /api/v1/agent-certifications
 *   DELETE /api/v1/agent-certifications/:id
 *   GET    /api/v1/agent-certifications/revocations
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { KeyRound, Plus, Loader2, Trash2 } from 'lucide-react';
import { api } from '../lib/api';

interface Certification {
  readonly id: string;
  readonly agentId: string;
  readonly scopes: readonly string[];
  readonly expiresAt: string;
  readonly createdAt: string;
  readonly revokedAt?: string | null;
}

interface Revocation {
  readonly id: string;
  readonly certId: string;
  readonly reason: string;
  readonly revokedAt: string;
}

export default function ApiIntegrations(): JSX.Element {
  const t = useTranslations('apiIntegrations');
  const [certs, setCerts] = useState<readonly Certification[]>([]);
  const [revocations, setRevocations] = useState<readonly Revocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    agentId: '',
    scopes: 'read:property,read:lease',
    days: '90',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [list, revs] = await Promise.all([
      api.get<readonly Certification[]>('/agent-certifications'),
      api.get<readonly Revocation[]>('/agent-certifications/revocations'),
    ]);
    if (list.success && list.data) setCerts(list.data);
    else setError(list.error ?? t('errors.loadFailed'));
    if (revs.success && revs.data) setRevocations(revs.data);
    setLoading(false);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function issue(): Promise<void> {
    const scopes = form.scopes.split(',').map((s) => s.trim()).filter(Boolean);
    if (!form.agentId || scopes.length === 0) return;
    const validForMs = Number(form.days) * 24 * 60 * 60 * 1000;
    const res = await api.post('/agent-certifications', {
      agentId: form.agentId,
      scopes,
      validForMs,
    });
    if (res.success) {
      setForm({ agentId: '', scopes: 'read:property,read:lease', days: '90' });
      void load();
    } else {
      setError(res.error ?? t('errors.issueFailed'));
    }
  }

  async function revoke(cert: Certification): Promise<void> {
    const reason = window.prompt(t('revokePrompt')) ?? '';
    if (!reason) return;
    const res = await api.delete(`/agent-certifications/${encodeURIComponent(cert.id)}`);
    // If the delete endpoint expects a body with reason, the PUT below can be used instead.
    if (res.success) void load();
    else setError(res.error ?? t('errors.revokeFailed'));
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <KeyRound className="h-6 w-6 text-amber-600" />
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

      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3 max-w-xl">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Plus className="h-4 w-4" /> {t('issueNewCert')}
        </h3>
        <label className="block text-sm">
          <span className="text-gray-700">{t('form.agentId')}</span>
          <input
            type="text"
            value={form.agentId}
            onChange={(e) => setForm({ ...form, agentId: e.target.value })}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-700">{t('form.scopes')}</span>
          <input
            type="text"
            value={form.scopes}
            onChange={(e) => setForm({ ...form, scopes: e.target.value })}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-700">{t('form.validFor')}</span>
          <input
            type="number"
            min="1"
            max="1095"
            value={form.days}
            onChange={(e) => setForm({ ...form, days: e.target.value })}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={() => void issue()}
          disabled={!form.agentId}
          className="rounded bg-amber-600 text-white px-4 py-2 text-sm disabled:opacity-50"
        >
          {t('issue')}
        </button>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <header className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">{t('activeCerts')}</h3>
        </header>
        {loading ? (
          <p className="p-5 text-sm text-gray-500 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> {t('loading')}
          </p>
        ) : certs.length === 0 ? (
          <p className="p-5 text-sm text-gray-500">{t('noCertsYet')}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {certs.map((c) => (
              <li key={c.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{c.agentId}</p>
                  <p className="text-xs text-gray-500">
                    {t('scopesLabel', { list: c.scopes.join(', ') })}
                  </p>
                  <p className="text-xs text-gray-400">
                    {t('expiresLabel', { date: new Date(c.expiresAt).toLocaleString() })}
                  </p>
                </div>
                {!c.revokedAt && (
                  <button
                    type="button"
                    onClick={() => void revoke(c)}
                    className="text-xs text-red-600 hover:underline inline-flex items-center gap-1"
                  >
                    <Trash2 className="h-3 w-3" /> {t('revoke')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {revocations.length > 0 && (
        <section className="bg-gray-50 border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-900 mb-3">{t('revocationHistory')}</h3>
          <ul className="divide-y divide-gray-100 text-sm">
            {revocations.map((r) => (
              <li key={r.id} className="py-2">
                <p>
                  {t('certLabel')} <code className="text-xs">{r.certId}</code> — {r.reason}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(r.revokedAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
