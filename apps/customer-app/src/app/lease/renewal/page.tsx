'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Calendar, Check, FileText, Home, Loader2, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { api } from '@/lib/api';
import { useMutation } from '@bossnyumba/api-client';

interface RenewalOption {
  months: number;
  label: string;
  description: string;
}

const RENEWAL_OPTIONS: RenewalOption[] = [
  { months: 12, label: '12 Months', description: 'Standard 1-year renewal' },
  { months: 24, label: '24 Months', description: 'Extended 2-year renewal' },
];

export default function LeaseRenewalPage() {
  const router = useRouter();
  const [lease, setLease] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTerm, setSelectedTerm] = useState<number | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const renewalMutation = useMutation<
    unknown,
    { termMonths: number; agreedToTerms: boolean }
  >(
    (client, variables) => client.post('/leases/current/renew', variables),
    {
      onSuccess: () => {
        router.push('/lease');
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : 'Failed to submit renewal request');
      },
    }
  );

  useEffect(() => {
    loadLease();
  }, []);

  async function loadLease() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.lease.getCurrent();
      setLease(data as Record<string, unknown>);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lease details');
    } finally {
      setLoading(false);
    }
  }

  const handleRenewal = () => {
    if (selectedTerm === null || !agreedToTerms) return;
    renewalMutation.mutate({ termMonths: selectedTerm, agreedToTerms });
  };

  return (
    <>
      <PageHeader title="Lease Renewal" showBack />

      <div className="space-y-4 px-4 py-4 pb-24">
        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4 animate-pulse">
            <div className="card p-4 space-y-3">
              <div className="h-4 bg-surface-card rounded w-32" />
              <div className="h-6 bg-surface-card rounded w-48" />
              <div className="h-3 bg-surface-card rounded w-40" />
            </div>
            <div className="card p-4 space-y-3">
              <div className="h-4 bg-surface-card rounded w-24" />
              <div className="h-3 bg-surface-card rounded w-36" />
              <div className="h-3 bg-surface-card rounded w-28" />
            </div>
            {[1, 2].map((i) => (
              <div key={i} className="card p-4 space-y-2">
                <div className="h-5 bg-surface-card rounded w-24" />
                <div className="h-3 bg-surface-card rounded w-40" />
                <div className="h-6 bg-surface-card rounded w-32" />
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {!loading && error && !lease && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">Failed to load lease</h3>
            <p className="text-sm text-gray-400 max-w-sm mb-6">{error}</p>
            <button
              onClick={loadLease}
              className="btn-primary text-sm flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        )}

        {/* Empty state - no lease */}
        {!loading && !error && !lease && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-gray-500" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">No active lease</h3>
            <p className="text-sm text-gray-400 max-w-sm mb-6">
              You don&apos;t have an active lease to renew. Contact property management for assistance.
            </p>
            <button
              onClick={() => router.push('/lease')}
              className="btn-primary text-sm flex items-center gap-2"
            >
              <Home className="w-4 h-4" />
              Back to Lease
            </button>
          </div>
        )}

        {/* Lease details and renewal options */}
        {!loading && lease && (
          <>
            {/* Current lease details */}
            <div className="card p-4 space-y-3">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Current Lease
              </h2>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Property</span>
                  <span className="text-white">{(lease.propertyName as string) || (lease.unitNumber as string) || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Start Date</span>
                  <span className="text-white">
                    {lease.startDate
                      ? new Date(lease.startDate as string).toLocaleDateString('en-TZ', { dateStyle: 'medium' })
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">End Date</span>
                  <span className="text-white">
                    {lease.endDate
                      ? new Date(lease.endDate as string).toLocaleDateString('en-TZ', { dateStyle: 'medium' })
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Monthly Rent</span>
                  <span className="text-white">
                    {lease.monthlyRent
                      ? `TZS ${Number(lease.monthlyRent).toLocaleString()}`
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Status</span>
                  <span className="text-green-400 capitalize">{(lease.status as string) || 'Active'}</span>
                </div>
              </div>
            </div>

            {/* Renewal options */}
            <h2 className="font-semibold text-white px-1">Choose renewal term</h2>
            <div className="space-y-3">
              {RENEWAL_OPTIONS.map((option) => {
                const isSelected = selectedTerm === option.months;
                return (
                  <button
                    key={option.months}
                    onClick={() => setSelectedTerm(option.months)}
                    className={`w-full card p-4 text-left transition-all ${
                      isSelected
                        ? 'ring-2 ring-primary-500 bg-primary-500/5'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <h3 className="font-semibold text-white">{option.label}</h3>
                        </div>
                        <p className="text-sm text-gray-400 mt-1">{option.description}</p>
                      </div>
                      <div className="ml-3 flex-shrink-0">
                        {isSelected ? (
                          <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 border-2 border-white/20 rounded-full" />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Terms agreement */}
            <label className="card p-4 flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-1 rounded border-white/20 bg-white/5 text-primary-500 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-400">
                I agree to the lease renewal terms and conditions. I understand the renewed lease will begin after the current lease expires.
              </span>
            </label>

            {/* Error from mutation */}
            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Submit button */}
            <button
              onClick={handleRenewal}
              disabled={selectedTerm === null || !agreedToTerms || renewalMutation.isLoading}
              className="w-full btn-primary py-4 text-base font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {renewalMutation.isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting request...
                </>
              ) : (
                'Request Renewal'
              )}
            </button>
          </>
        )}
      </div>
    </>
  );
}
