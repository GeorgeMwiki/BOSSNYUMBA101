'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FileText, ChevronRight, Home, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';

interface LeaseData {
  property: string;
  unit: string;
  type: string;
  endDate: string;
  daysRemaining: number;
}

function LeaseSkeleton() {
  return (
    <section>
      <h2 className="text-sm font-medium text-gray-400 mb-3">Current Lease</h2>
      <div className="card p-4 animate-pulse">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 bg-surface-card rounded-lg flex-shrink-0" />
            <div className="space-y-2 min-w-0 flex-1">
              <div className="h-4 w-3/4 bg-surface-card rounded" />
              <div className="h-3 w-1/2 bg-surface-card rounded" />
            </div>
          </div>
          <div className="w-5 h-5 bg-surface-card rounded flex-shrink-0" />
        </div>
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="h-4 w-36 bg-surface-card rounded" />
        </div>
      </div>
    </section>
  );
}

export function LeaseSummary() {
  const [lease, setLease] = useState<LeaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function loadLease() {
      try {
        const data = await api.lease.getCurrent() as Record<string, unknown>;
        const endDate = (data.endDate as string) ?? '';
        const daysRemaining = endDate
          ? Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
          : 0;

        setLease({
          property: ((data.property as Record<string, unknown>)?.name as string) ?? 'My Property',
          unit: ((data.unit as Record<string, unknown>)?.unitNumber as string) ?? '',
          type: (data.type as string) ?? '',
          endDate,
          daysRemaining,
        });
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    loadLease();
  }, []);

  if (loading) {
    return <LeaseSkeleton />;
  }

  if (error) {
    return (
      <section>
        <h2 className="text-sm font-medium text-gray-400 mb-3">Current Lease</h2>
        <div className="card p-4 flex items-center gap-3 text-warning-400">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">Unable to load lease information.</p>
        </div>
      </section>
    );
  }

  if (!lease) return null;

  return (
    <section>
      <h2 className="text-sm font-medium text-gray-400 mb-3">Current Lease</h2>
      <Link href="/lease">
        <div className="card p-4 active:scale-[0.99] transition-transform">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-2 bg-primary-500/20 rounded-lg flex-shrink-0">
                <Home className="w-5 h-5 text-primary-400" />
              </div>
              <div className="min-w-0">
                <div className="font-medium text-white truncate">
                  {lease.property} · {lease.unit}
                </div>
                <div className="text-sm text-gray-400 mt-0.5">
                  {lease.type ? `${lease.type} · ` : ''}Ends in {lease.daysRemaining} days
                </div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
          </div>
          <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2 text-sm text-primary-400">
            <FileText className="w-4 h-4" />
            <span>View full lease details</span>
          </div>
        </div>
      </Link>
    </section>
  );
}
