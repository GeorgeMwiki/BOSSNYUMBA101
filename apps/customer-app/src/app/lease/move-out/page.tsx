'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronDown,
  ClipboardCheck,
  FileText,
  Home,
  Loader2,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { api } from '@/lib/api';
import { useMutation } from '@bossnyumba/api-client';

const MOVE_OUT_REASONS = [
  'Relocating for work',
  'Found a better place',
  'Financial reasons',
  'End of lease term',
  'Personal reasons',
  'Moving out of the city',
  'Other',
];

const MOVE_OUT_CHECKLIST = [
  { id: 'notice', label: 'Provide at least 30 days notice' },
  { id: 'rent', label: 'Clear all outstanding rent and bills' },
  { id: 'repair', label: 'Repair any damages beyond normal wear' },
  { id: 'clean', label: 'Clean the unit thoroughly' },
  { id: 'keys', label: 'Return all keys and access cards' },
  { id: 'inspection', label: 'Schedule a move-out inspection' },
  { id: 'utilities', label: 'Transfer or cancel utilities' },
  { id: 'address', label: 'Provide forwarding address for deposit return' },
];

export default function MoveOutNoticePage() {
  const router = useRouter();
  const [lease, setLease] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [moveOutDate, setMoveOutDate] = useState('');
  const [reason, setReason] = useState('');
  const [forwardingAddress, setForwardingAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  const submitMutation = useMutation<
    unknown,
    { moveOutDate: string; reason: string; forwardingAddress?: string; notes?: string }
  >(
    (client, variables) => client.post('/leases/current/move-out', variables),
    {
      onSuccess: () => {
        router.push('/lease');
      },
      onError: (err) => {
        setSubmitError(err instanceof Error ? err.message : 'Failed to submit move-out notice');
      },
    }
  );

  useEffect(() => {
    loadLease();
  }, []);

  async function loadLease() {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await api.lease.getCurrent();
      setLease(data as Record<string, unknown>);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load lease details');
    } finally {
      setLoading(false);
    }
  }

  const toggleCheckItem = (id: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Minimum date is 30 days from now
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 30);
  const minDateStr = minDate.toISOString().split('T')[0];

  const canSubmit = moveOutDate && reason && !submitMutation.isLoading;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setSubmitError(null);
    submitMutation.mutate({
      moveOutDate,
      reason,
      forwardingAddress: forwardingAddress || undefined,
      notes: notes || undefined,
    });
  };

  return (
    <>
      <PageHeader title="Move-Out Notice" showBack />

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
              <div className="h-10 bg-surface-card rounded w-full" />
              <div className="h-4 bg-surface-card rounded w-24" />
              <div className="h-10 bg-surface-card rounded w-full" />
            </div>
            <div className="card p-4 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-5 w-5 bg-surface-card rounded" />
                  <div className="h-3 bg-surface-card rounded flex-1" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error state */}
        {!loading && loadError && !lease && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">Failed to load lease</h3>
            <p className="text-sm text-gray-400 max-w-sm mb-6">{loadError}</p>
            <button
              onClick={loadLease}
              className="btn-primary text-sm flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !loadError && !lease && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-gray-500" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">No active lease</h3>
            <p className="text-sm text-gray-400 max-w-sm mb-6">
              You don&apos;t have an active lease. Contact property management for assistance.
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

        {/* Move-out form */}
        {!loading && lease && (
          <>
            {/* Current lease info */}
            <div className="card p-4 space-y-2">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Current Lease
              </h2>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Property</span>
                <span className="text-white">{(lease.propertyName as string) || (lease.unitNumber as string) || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Lease ends</span>
                <span className="text-white">
                  {lease.endDate
                    ? new Date(lease.endDate as string).toLocaleDateString('en-TZ', { dateStyle: 'medium' })
                    : 'N/A'}
                </span>
              </div>
            </div>

            {/* Move-out form fields */}
            <div className="card p-4 space-y-4">
              <h2 className="font-semibold text-white">Move-Out Details</h2>

              {/* Date selector */}
              <label className="block">
                <span className="text-sm font-medium text-gray-400 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Preferred move-out date
                </span>
                <input
                  type="date"
                  value={moveOutDate}
                  onChange={(e) => setMoveOutDate(e.target.value)}
                  min={minDateStr}
                  className="mt-2 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent [color-scheme:dark]"
                />
                <p className="mt-1 text-xs text-gray-500">Minimum 30 days notice required</p>
              </label>

              {/* Reason dropdown */}
              <label className="block">
                <span className="text-sm font-medium text-gray-400">Reason for moving out</span>
                <div className="relative mt-2">
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full appearance-none bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent pr-10"
                  >
                    <option value="" className="bg-[#1a1a1a]">Select a reason</option>
                    {MOVE_OUT_REASONS.map((r) => (
                      <option key={r} value={r} className="bg-[#1a1a1a]">{r}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </label>

              {/* Forwarding address */}
              <label className="block">
                <span className="text-sm font-medium text-gray-400 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  Forwarding address (optional)
                </span>
                <textarea
                  value={forwardingAddress}
                  onChange={(e) => setForwardingAddress(e.target.value)}
                  placeholder="Enter your new address for deposit return"
                  rows={2}
                  className="mt-2 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
              </label>

              {/* Additional notes */}
              <label className="block">
                <span className="text-sm font-medium text-gray-400">Additional notes (optional)</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional information..."
                  rows={2}
                  className="mt-2 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
              </label>
            </div>

            {/* Move-out checklist */}
            <div className="card p-4 space-y-3">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4" />
                Move-Out Checklist
              </h2>
              <p className="text-xs text-gray-400">
                Please review and complete the following before your move-out date.
              </p>
              <div className="space-y-2">
                {MOVE_OUT_CHECKLIST.map((item) => {
                  const isChecked = checkedItems.has(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleCheckItem(item.id)}
                      className="w-full flex items-center gap-3 rounded-xl border border-white/10 p-3 text-left hover:bg-white/5 transition-colors"
                    >
                      <div
                        className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border ${
                          isChecked
                            ? 'bg-green-500 border-green-500'
                            : 'border-white/20 bg-white/5'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span
                        className={`text-sm ${
                          isChecked ? 'text-gray-400 line-through' : 'text-white'
                        }`}
                      >
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Submit error */}
            {submitError && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                {submitError}
              </div>
            )}

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full btn-primary py-4 text-base font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitMutation.isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting notice...
                </>
              ) : (
                'Submit Move-Out Notice'
              )}
            </button>

            <p className="text-center text-xs text-gray-400">
              By submitting, you acknowledge that you are providing formal notice to vacate your unit.
            </p>
          </>
        )}
      </div>
    </>
  );
}
