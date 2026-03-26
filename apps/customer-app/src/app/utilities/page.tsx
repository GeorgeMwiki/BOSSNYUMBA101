'use client';

import Link from 'next/link';
import { useQuery } from '@bossnyumba/api-client';
import { Zap, Droplets, Plus, ChevronRight, AlertTriangle, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

interface Utility {
  id: string;
  type: string;
  lastReading: number;
  unit: string;
  dueDate: string;
  amount: number;
  status: 'pending' | 'paid';
}

interface UtilityBill {
  id: string;
  month: string;
  total: number;
  paid: boolean;
}

function getUtilityIcon(type: string) {
  switch (type.toLowerCase()) {
    case 'water':
      return Droplets;
    case 'electricity':
      return Zap;
    default:
      return Zap;
  }
}

function UtilitiesSkeleton() {
  return (
    <div className="px-4 py-4 pb-24 space-y-6 animate-pulse">
      {/* CTA skeleton */}
      <div className="card p-4 flex items-center gap-3">
        <div className="w-10 h-10 bg-surface-card rounded-lg" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-surface-card rounded w-40" />
          <div className="h-3 bg-surface-card rounded w-52" />
        </div>
      </div>

      {/* Current Readings skeleton */}
      <section className="space-y-3">
        <div className="h-4 bg-surface-card rounded w-32" />
        {[1, 2].map((i) => (
          <div key={i} className="card p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-surface-card rounded-lg" />
              <div className="space-y-2">
                <div className="h-4 bg-surface-card rounded w-24" />
                <div className="h-3 bg-surface-card rounded w-20" />
              </div>
            </div>
            <div className="flex justify-between pt-2 border-t border-white/5">
              <div className="h-3 bg-surface-card rounded w-28" />
              <div className="h-3 bg-surface-card rounded w-20" />
            </div>
          </div>
        ))}
      </section>

      {/* Recent Bills skeleton */}
      <section className="space-y-3">
        <div className="h-4 bg-surface-card rounded w-28" />
        <div className="card divide-y divide-white/5">
          {[1, 2].map((i) => (
            <div key={i} className="p-4 flex justify-between items-center">
              <div className="space-y-2">
                <div className="h-4 bg-surface-card rounded w-28" />
                <div className="h-3 bg-surface-card rounded w-20" />
              </div>
              <div className="h-6 bg-surface-card rounded-full w-14" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function UtilitiesError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
      <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-4">
        <AlertTriangle className="w-8 h-8 text-red-400" />
      </div>
      <h2 className="text-lg font-semibold text-white mb-2">Failed to load utilities</h2>
      <p className="text-gray-400 text-sm mb-6">Something went wrong. Please try again.</p>
      <button onClick={onRetry} className="btn-primary px-6 py-2 flex items-center gap-2">
        <RefreshCw className="w-4 h-4" />
        Retry
      </button>
    </div>
  );
}

function EmptyUtilities() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
      <div className="p-4 bg-surface-card rounded-full mb-4">
        <Zap className="w-10 h-10 text-gray-400" />
      </div>
      <h2 className="text-lg font-semibold text-white mb-2">No utilities found</h2>
      <p className="text-gray-400 text-sm">Your utility readings will appear here once available.</p>
    </div>
  );
}

export default function UtilitiesPage() {
  const {
    data: utilities,
    isLoading: utilitiesLoading,
    isError: utilitiesError,
    refetch: refetchUtilities,
  } = useQuery<Utility[]>('/utilities', { staleTime: 30_000 });

  const {
    data: recentBills,
    isLoading: billsLoading,
    isError: billsError,
    refetch: refetchBills,
  } = useQuery<UtilityBill[]>('/utilities/bills', { staleTime: 30_000 });

  const isLoading = utilitiesLoading || billsLoading;
  const isError = utilitiesError || billsError;

  const handleRetry = () => {
    refetchUtilities();
    refetchBills();
  };

  if (isLoading) {
    return (
      <>
        <PageHeader
          title="Utilities"
          action={
            <Link href="/utilities/submit-reading" className="btn-primary text-sm">
              <Plus className="w-4 h-4 mr-1" />
              Submit Reading
            </Link>
          }
        />
        <UtilitiesSkeleton />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader title="Utilities" />
        <UtilitiesError onRetry={handleRetry} />
      </>
    );
  }

  const utilityList = utilities ?? [];
  const billList = recentBills ?? [];
  const isEmpty = utilityList.length === 0 && billList.length === 0;

  return (
    <>
      <PageHeader
        title="Utilities"
        action={
          <Link href="/utilities/submit-reading" className="btn-primary text-sm">
            <Plus className="w-4 h-4 mr-1" />
            Submit Reading
          </Link>
        }
      />

      <div className="px-4 py-4 pb-24 space-y-6">
        {/* Submit Reading CTA */}
        <Link
          href="/utilities/submit-reading"
          className="card p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-500 rounded-lg">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-medium text-white">Submit meter reading</div>
              <div className="text-sm text-gray-400">
                Enter your current readings
              </div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </Link>

        {isEmpty ? (
          <EmptyUtilities />
        ) : (
          <>
            {/* Current Readings */}
            {utilityList.length > 0 && (
              <section>
                <h3 className="text-sm font-medium text-gray-400 mb-3">
                  Current Readings
                </h3>
                <div className="space-y-3">
                  {utilityList.map((util) => {
                    const Icon = getUtilityIcon(util.type);
                    return (
                      <div key={util.id} className="card p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-surface-card rounded-lg">
                              <Icon className="w-5 h-5 text-gray-400" />
                            </div>
                            <div>
                              <div className="font-medium text-white">{util.type}</div>
                              <div className="text-xs text-gray-400">
                                Last: {util.lastReading} {util.unit}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-between text-sm pt-2 border-t border-white/5">
                          <span className="text-gray-400">Due {util.dueDate}</span>
                          <span className="font-medium text-white">
                            TZS {util.amount.toLocaleString()}
                          </span>
                        </div>
                        {util.status === 'pending' && (
                          <span className="badge-warning mt-2 inline-block">Pending</span>
                        )}
                        {util.status === 'paid' && (
                          <span className="badge-success mt-2 inline-block">Paid</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Recent Bills */}
            {billList.length > 0 && (
              <section>
                <h3 className="text-sm font-medium text-gray-400 mb-3">
                  Recent Bills
                </h3>
                <div className="card divide-y divide-white/5">
                  {billList.map((bill) => (
                    <div
                      key={bill.id}
                      className="flex items-center justify-between p-4"
                    >
                      <div>
                        <div className="font-medium text-sm text-white">{bill.month}</div>
                        <div className="text-xs text-gray-400">
                          TZS {bill.total.toLocaleString()}
                        </div>
                      </div>
                      <span
                        className={
                          bill.paid ? 'badge-success' : 'badge-warning'
                        }
                      >
                        {bill.paid ? 'Paid' : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
