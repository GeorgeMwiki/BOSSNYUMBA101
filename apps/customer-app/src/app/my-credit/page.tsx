// @ts-nocheck — shared Brain types / customer-app API drift; tracked.
/**
 * /my-credit — tenant-facing credit rating self-service.
 *
 * Shows the tenant their own FICO-scale (300-850) rating, 5-factor
 * breakdown, improvement tips, and lets them:
 *   - Download a signed portable credit certificate (PDF-equivalent).
 *   - Opt-in to share their rating with a specific prospective landlord
 *     or bank for a fixed duration (default 60 days).
 *
 * Endpoints:
 *   GET  /api/v1/credit-rating/my-rating
 *   GET  /api/v1/credit-rating/my-rating/certificate
 *   POST /api/v1/credit-rating/my-rating/opt-in-sharing
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';
import { api } from '@/lib/api';

type Band =
  | 'excellent'
  | 'good'
  | 'fair'
  | 'poor'
  | 'very_poor'
  | 'insufficient_data';

interface DimensionScore {
  readonly score: number;
  readonly weight: number;
  readonly explanation: string;
}

interface CreditRating {
  readonly numericScore: number | null;
  readonly letterGrade: 'A' | 'B' | 'C' | 'D' | 'F' | null;
  readonly band: Band;
  readonly dimensions: Record<string, DimensionScore>;
  readonly recommendations: readonly string[];
  readonly insufficientDataReason: string | null;
  readonly dataFreshness: string;
  readonly lastComputedAt: string;
}

const BAND_MESSAGE: Record<Band, string> = {
  excellent: 'Excellent — banks and landlords will welcome your application.',
  good: 'Good — most landlords will accept without extra deposit.',
  fair: 'Fair — some landlords may ask for a guarantor.',
  poor: 'Poor — work on on-time payments for the next 3 months.',
  very_poor: 'Very poor — focus on one on-time payment at a time.',
  insufficient_data:
    'Not enough payment history yet — your rating will activate after 3 invoices.',
};

const DIM_LABELS: Record<string, string> = {
  payment_history: 'Payment history',
  promise_keeping: 'Keeping promises',
  rent_to_income: 'Rent vs income',
  tenancy_length: 'Length of tenancy',
  dispute_history: 'Clean record',
};

export default function MyCreditPage(): JSX.Element {
  const t = useTranslations('myCredit');
  const [rating, setRating] = useState<CreditRating | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareForm, setShareForm] = useState({
    shareWithOrg: '',
    purpose: 'tenancy_application',
    durationDays: 60,
  });
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api.get('/credit-rating/my-rating');
    if (res.success && res.data) setRating(res.data as CreditRating);
    else setError(res.error ?? 'Unable to load your rating.');
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function downloadCertificate(): Promise<void> {
    setDownloading(true);
    const res = await api.get('/credit-rating/my-rating/certificate');
    setDownloading(false);
    if (res.success && res.data) {
      const blob = new Blob([JSON.stringify(res.data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bossnyumba-credit-certificate.json';
      a.click();
      URL.revokeObjectURL(url);
    } else {
      setError(res.error ?? 'Unable to generate certificate.');
    }
  }

  async function submitShare(): Promise<void> {
    const res = await api.post(
      '/credit-rating/my-rating/opt-in-sharing',
      shareForm,
    );
    if (res.success) {
      setShareMsg('Shared. The organization can now view your rating.');
      setShareOpen(false);
    } else {
      setShareMsg(res.error ?? 'Unable to share.');
    }
  }

  return (
    <>
      <PageHeader title={t('title')} showSettings />
      <div className="space-y-4 px-4 py-4 pb-24">
        {error && (
          <div className="card p-3 bg-red-900/20 text-red-300 text-sm">
            {error}
          </div>
        )}

        {loading || !rating ? (
          <div className="card p-6 text-center text-gray-400">{t('loading')}</div>
        ) : (
          <>
            <div className="card p-5 text-center">
              <div className="text-sm text-gray-400">{t('yourScore')}</div>
              <div className="mt-2 text-5xl font-bold text-white">
                {rating.numericScore ?? '—'}
              </div>
              <div className="text-sm text-gray-400 mt-1">
                {rating.letterGrade
                  ? `Grade ${rating.letterGrade}`
                  : 'Not enough data'}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                {BAND_MESSAGE[rating.band]}
              </div>
              {rating.insufficientDataReason && (
                <div className="text-xs text-yellow-300 mt-2">
                  {rating.insufficientDataReason}
                </div>
              )}
            </div>

            <div className="card p-4 space-y-3">
              <h3 className="text-white font-semibold text-sm">
                How your score is built
              </h3>
              {Object.entries(rating.dimensions).map(([key, dim]) => (
                <div key={key}>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">
                      {DIM_LABELS[key] ?? key}
                    </span>
                    <span className="text-gray-400">
                      {(dim.score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded mt-1">
                    <div
                      className="h-2 bg-indigo-500 rounded"
                      style={{ width: `${Math.round(dim.score * 100)}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {dim.explanation}
                  </div>
                </div>
              ))}
            </div>

            <div className="card p-4">
              <h3 className="text-white font-semibold text-sm mb-2">
                What you can do to improve
              </h3>
              <ul className="list-disc pl-5 text-sm text-gray-300 space-y-1">
                {rating.recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>

            <div className="card p-4 space-y-3">
              <button
                type="button"
                onClick={() => void downloadCertificate()}
                disabled={downloading}
                className="w-full py-2 rounded bg-indigo-600 text-white text-sm font-medium disabled:opacity-50"
              >
                {downloading ? 'Preparing…' : 'Download my credit certificate'}
              </button>
              <button
                type="button"
                onClick={() => setShareOpen((v) => !v)}
                className="w-full py-2 rounded border border-gray-600 text-gray-200 text-sm"
              >
                Share my rating with a landlord or bank
              </button>
              {shareMsg && (
                <div className="text-xs text-gray-400">{shareMsg}</div>
              )}
            </div>

            {shareOpen && (
              <div className="card p-4 space-y-3">
                <h3 className="text-white font-semibold text-sm">
                  Grant access
                </h3>
                <p className="text-xs text-gray-400">
                  The recipient can view your current score and dimension
                  breakdown for the selected number of days. You can revoke at
                  any time.
                </p>
                <input
                  type="text"
                  placeholder={t('orgNamePlaceholder')}
                  value={shareForm.shareWithOrg}
                  onChange={(e) =>
                    setShareForm((s) => ({
                      ...s,
                      shareWithOrg: e.target.value,
                    }))
                  }
                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                />
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={shareForm.durationDays}
                  onChange={(e) =>
                    setShareForm((s) => ({
                      ...s,
                      durationDays: Number(e.target.value) || 60,
                    }))
                  }
                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                />
                <button
                  type="button"
                  onClick={() => void submitShare()}
                  disabled={!shareForm.shareWithOrg.trim()}
                  className="w-full py-2 rounded bg-emerald-600 text-white text-sm disabled:opacity-50"
                >
                  Confirm share
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
