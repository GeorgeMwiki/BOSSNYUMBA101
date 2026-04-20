/**
 * Lease renewal offer viewer — Wave 15 UI gap closure.
 *
 * Reads `/api/v1/renewals/active` for the caller's tenancy. Renders the
 * offer (new term, new rent, deposit top-up, conditions) and exposes
 * accept / decline / counter-offer actions.
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { FileSignature, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

interface RenewalOffer {
  readonly id: string;
  readonly unitId: string;
  readonly newTermMonths: number;
  readonly newMonthlyRent: number;
  readonly currency: string;
  readonly depositTopUp: number;
  readonly startDate: string;
  readonly endDate: string;
  readonly conditions: readonly string[];
  readonly status: 'pending' | 'accepted' | 'declined' | 'countered';
  readonly expiresAt: string;
}

function apiBase(): string {
  const url = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL;
  if (url?.trim()) {
    const base = url.trim().replace(/\/$/, '');
    return base.endsWith('/api/v1') ? base : `${base}/api/v1`;
  }
  return 'http://localhost:4001/api/v1';
}

function token(): string {
  return typeof window !== 'undefined'
    ? localStorage.getItem('customer_token') ?? ''
    : '';
}

export default function LeaseRenewalPage() {
  const t = useTranslations('leaseRenewal');
  const [offer, setOffer] = useState<RenewalOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [counterRent, setCounterRent] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase()}/renewals/active`, {
        headers: token() ? { Authorization: `Bearer ${token()}` } : {},
      });
      const body = (await res.json()) as {
        success?: boolean;
        data?: RenewalOffer | null;
        error?: { message?: string };
      };
      if (!res.ok || !body.success) {
        setError(body.error?.message ?? 'Failed to load renewal offer');
      } else {
        setOffer(body.data ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: 'accept' | 'decline' | 'counter'): Promise<void> {
    if (!offer) return;
    setWorking(true);
    try {
      const payload =
        action === 'counter'
          ? { counterMonthlyRent: Number(counterRent) || offer.newMonthlyRent }
          : {};
      const res = await fetch(
        `${apiBase()}/renewals/${encodeURIComponent(offer.id)}/${action}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
          },
          body: JSON.stringify(payload),
        },
      );
      const body = (await res.json()) as {
        success?: boolean;
        error?: { message?: string };
      };
      if (!res.ok || !body.success) {
        setError(body.error?.message ?? `${action} failed`);
      } else {
        void load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `${action} failed`);
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <PageHeader title={t('title')} showBack />
      <div className="px-4 py-4 pb-24 space-y-4">
        {loading && (
          <p className="text-sm text-gray-400 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> {t('loadingOffer')}
          </p>
        )}
        {error && (
          <div className="rounded-lg bg-red-900/30 border border-red-500/40 text-red-200 p-3 text-sm">
            {error}
          </div>
        )}
        {!loading && !offer && !error && (
          <div className="rounded-lg bg-gray-800 border border-gray-700 p-5 text-sm text-gray-400 flex items-center gap-2">
            <FileSignature className="h-4 w-4" />
            {t('noActiveOffer')}
          </div>
        )}
        {offer && (
          <>
            <section className="rounded-lg bg-gray-800 border border-gray-700 p-5 space-y-3">
              <h2 className="text-lg font-semibold text-white">
                {t('offerHeader')}
              </h2>
              <dl className="grid grid-cols-2 gap-3 text-sm text-gray-300">
                <div>
                  <dt className="text-gray-500">{t('newRent')}</dt>
                  <dd>
                    {offer.currency} {offer.newMonthlyRent.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">{t('term')}</dt>
                  <dd>{t('monthsCount', { count: offer.newTermMonths })}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">{t('start')}</dt>
                  <dd>{new Date(offer.startDate).toLocaleDateString()}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">{t('end')}</dt>
                  <dd>{new Date(offer.endDate).toLocaleDateString()}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">{t('depositTopUp')}</dt>
                  <dd>
                    {offer.currency} {offer.depositTopUp.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">{t('offerExpires')}</dt>
                  <dd>{new Date(offer.expiresAt).toLocaleDateString()}</dd>
                </div>
              </dl>
              {offer.conditions.length > 0 && (
                <div>
                  <p className="text-gray-500 text-sm mb-1">{t('conditions')}</p>
                  <ul className="list-disc ml-5 text-sm text-gray-300 space-y-1">
                    {offer.conditions.map((c, idx) => (
                      <li key={idx}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {offer.status === 'pending' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void act('accept')}
                    disabled={working}
                    className="rounded-lg bg-emerald-600 text-white py-3 font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" /> {t('accept')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void act('decline')}
                    disabled={working}
                    className="rounded-lg bg-red-600 text-white py-3 font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" /> {t('decline')}
                  </button>
                </div>

                <div className="rounded-lg bg-gray-800 border border-gray-700 p-4 space-y-2">
                  <p className="text-sm text-gray-300">
                    {t('counterOfferPrompt')}
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      value={counterRent}
                      onChange={(e) => setCounterRent(e.target.value)}
                      placeholder={String(offer.newMonthlyRent)}
                      className="flex-1 rounded bg-gray-900 border border-gray-700 px-3 py-2 text-white"
                    />
                    <button
                      type="button"
                      onClick={() => void act('counter')}
                      disabled={working || !counterRent}
                      className="rounded bg-amber-600 text-white px-4 py-2 text-sm disabled:opacity-50"
                    >
                      {t('counter')}
                    </button>
                  </div>
                </div>
              </>
            )}

            {offer.status !== 'pending' && (
              <p className="text-sm text-gray-400">
                {t('currentStatus')}: <strong>{offer.status}</strong>
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}
