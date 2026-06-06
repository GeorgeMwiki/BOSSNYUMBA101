'use client';

/**
 * MaintenanceRequestDetail — operator work-order detail + lifecycle.
 *
 * Drives the REAL maintenance lifecycle endpoints (no dead work-order
 * sub-routes, no mocks):
 *   - GET  /maintenance/requests/:id          load the request
 *   - POST /maintenance/requests/:id/dispatch dispatch to a vendor/tech
 *   - POST /maintenance/requests/:id/complete submit completion proof
 *
 * The dispatch + complete events are recorded against a work-order
 * linkage id; we reuse the request's `workOrderId` when present, else the
 * request id itself (the gateway dispatch-event store keys on that id).
 *
 * The vendor picker is populated from live `vendorsService` data. There is
 * no gateway endpoint that lists *assignable internal technicians* (the
 * field-staff routes only expose the caller's own tasks), so internal
 * assignment is handled by the operator selecting a registered vendor;
 * when no vendors exist the picker shows an honest empty state.
 */

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MapPin,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Plus,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { vendorsService } from '@bossnyumba/api-client';
import { Spinner, toast } from '@bossnyumba/design-system';
import { PageHeader } from '@/components/layout/PageHeader';
import { PriorityBadge } from '@/components/maintenance';
import { AttachmentUpload, type AttachmentPreview } from '@/components/maintenance';
import type { WorkOrderPriority } from '@/components/maintenance/PriorityBadge';
import {
  getMaintenanceRequest,
  dispatchMaintenanceRequest,
  completeMaintenanceRequest,
  type MaintenanceRequest,
  type CompletionPart,
} from '@/lib/maintenance-api';

const STATUS_BADGE: Record<string, string> = {
  submitted: 'badge-info',
  triaged: 'badge-info',
  classified: 'badge-info',
  dispatched: 'badge-warning',
  in_progress: 'badge-warning',
  awaiting_parts: 'badge-warning',
  completed: 'badge-success',
  verified: 'badge-success',
  rejected: 'badge-gray',
  cancelled: 'badge-gray',
};

function normalizePriority(p: string | null): WorkOrderPriority {
  const lower = (p ?? 'medium').toLowerCase();
  if (lower === 'urgent' || lower === 'emergency') return 'emergency';
  if (lower === 'high') return 'high';
  if (lower === 'low') return 'low';
  return 'medium';
}

interface VendorOption {
  readonly id: string;
  readonly companyName?: string;
  readonly name?: string;
}

/** Stable work-order linkage id for dispatch/complete events. */
function linkageId(req: MaintenanceRequest): string {
  return req.workOrderId && req.workOrderId.length > 0 ? req.workOrderId : req.id;
}

export function MaintenanceRequestDetail() {
  const t = useTranslations('workOrderDetailLive');
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const requestId = (params?.id ?? '') as string;

  const [showDispatch, setShowDispatch] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [vendorId, setVendorId] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');
  const [afterPhotos, setAfterPhotos] = useState<ReadonlyArray<AttachmentPreview>>([]);
  const [parts, setParts] = useState<ReadonlyArray<CompletionPart>>([]);
  const [newPart, setNewPart] = useState({ name: '', quantity: 1 });

  const requestQuery = useQuery({
    queryKey: ['maintenance-request', requestId],
    queryFn: () => getMaintenanceRequest(requestId),
    enabled: requestId.length > 0,
    retry: false,
  });
  const request = requestQuery.data;

  const vendorsQuery = useQuery({
    queryKey: ['vendors', 'available'],
    queryFn: () => vendorsService.list({ available: true }),
    enabled: showDispatch,
    retry: false,
  });
  const vendors = useMemo<ReadonlyArray<VendorOption>>(
    () => (vendorsQuery.data?.data ?? []) as ReadonlyArray<VendorOption>,
    [vendorsQuery.data],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['maintenance-request', requestId] });
    queryClient.invalidateQueries({ queryKey: ['maintenance-requests'] });
  };

  const dispatchMutation = useMutation({
    mutationFn: () => {
      if (!request) throw new Error(t('notFound'));
      return dispatchMaintenanceRequest(requestId, {
        workOrderId: linkageId(request),
        vendorId: vendorId.length > 0 ? vendorId : undefined,
      });
    },
    onSuccess: () => {
      toast.success(t('dispatchedToast'));
      setShowDispatch(false);
      invalidate();
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : t('dispatchFailed')),
  });

  const completeMutation = useMutation({
    mutationFn: () => {
      if (!request) throw new Error(t('notFound'));
      return completeMaintenanceRequest(requestId, {
        workOrderId: linkageId(request),
        afterPhotos: afterPhotos
          .filter((p) => p.url.length > 0)
          .map((p) => ({ url: p.url })),
        partsUsed: parts,
        notes: completionNotes.length > 0 ? completionNotes : undefined,
      });
    },
    onSuccess: () => {
      toast.success(t('completedToast'));
      setShowComplete(false);
      invalidate();
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : t('completeFailed')),
  });

  const addPart = () => {
    const name = newPart.name.trim();
    if (!name) return;
    setParts((prev) => [...prev, { name, quantity: newPart.quantity }]);
    setNewPart({ name: '', quantity: 1 });
  };
  const removePart = (idx: number) =>
    setParts((prev) => prev.filter((_, i) => i !== idx));

  if (requestQuery.isLoading) {
    return (
      <>
        <PageHeader title={t('title')} showBack />
        <div className="flex justify-center py-12">
          <Spinner size="lg" className="text-signal-500" />
        </div>
      </>
    );
  }

  if (!request) {
    return (
      <>
        <PageHeader title={t('title')} showBack />
        <div className="px-4 py-8 text-center">
          <AlertTriangle className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
          <p className="text-neutral-500 mb-4">{t('notFound')}</p>
          <button onClick={() => router.back()} className="btn-secondary">
            {t('goBack')}
          </button>
        </div>
      </>
    );
  }

  const isClosed = ['completed', 'verified', 'cancelled', 'rejected'].includes(
    request.status,
  );
  const isDispatched = ['dispatched', 'in_progress', 'awaiting_parts'].includes(
    request.status,
  );

  return (
    <>
      <PageHeader title={request.requestNumber} showBack />

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4 pb-24">
        <div className="card p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">{request.title}</h2>
              {request.description && (
                <p className="text-sm text-neutral-500 mt-1">
                  {request.description}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <span
                className={`${STATUS_BADGE[request.status] ?? 'badge-info'} capitalize`}
              >
                {request.status.replace(/_/g, ' ')}
              </span>
              <PriorityBadge priority={normalizePriority(request.priority)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {request.category && (
              <div>
                <div className="text-neutral-500">{t('category')}</div>
                <div className="font-medium capitalize">
                  {request.category.replace(/_/g, ' ')}
                </div>
              </div>
            )}
            {request.location && (
              <div className="flex items-start gap-1.5">
                <MapPin className="w-4 h-4 mt-0.5 text-neutral-500" aria-hidden="true" />
                <div>
                  <div className="text-neutral-500">{t('location')}</div>
                  <div className="font-medium">{request.location}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Lifecycle actions */}
        {!isClosed && (
          <div className="flex flex-wrap gap-3">
            {!isDispatched && (
              <button
                type="button"
                onClick={() => setShowDispatch((v) => !v)}
                className="btn-secondary flex items-center gap-1"
              >
                <Truck className="w-4 h-4" aria-hidden="true" />
                {t('dispatch')}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowComplete((v) => !v)}
              className="btn-primary flex items-center gap-1"
            >
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              {t('complete')}
            </button>
          </div>
        )}

        {/* Dispatch panel */}
        {showDispatch && !isClosed && (
          <div className="card p-4 space-y-3">
            <h3 className="font-medium">{t('dispatchTitle')}</h3>
            <div>
              <label htmlFor="vendorId" className="label">
                {t('vendor')}
              </label>
              <select
                id="vendorId"
                className="input"
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                disabled={vendorsQuery.isLoading}
              >
                <option value="">{t('vendorNone')}</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.companyName || v.name || v.id}
                  </option>
                ))}
              </select>
              {!vendorsQuery.isLoading && vendors.length === 0 && (
                <p className="mt-1 text-xs text-neutral-500">{t('noVendors')}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dispatchMutation.mutate()}
              disabled={dispatchMutation.isPending}
              className="btn-primary w-full"
            >
              {dispatchMutation.isPending ? t('dispatching') : t('confirmDispatch')}
            </button>
          </div>
        )}

        {/* Completion panel */}
        {showComplete && !isClosed && (
          <div className="card p-4 space-y-4">
            <h3 className="font-medium">{t('completeTitle')}</h3>
            <div>
              <label className="label">{t('afterPhotos')}</label>
              <AttachmentUpload value={[...afterPhotos]} onChange={setAfterPhotos} />
            </div>
            <div>
              <label className="label">{t('partsUsed')}</label>
              <div className="space-y-2">
                {parts.map((part, idx) => (
                  <div
                    key={`${part.name}-${idx}`}
                    className="flex items-center justify-between rounded-lg bg-surface-raised p-2 text-sm"
                  >
                    <span>
                      {part.name}
                      <span className="text-neutral-500 ml-2">x{part.quantity}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removePart(idx)}
                      aria-label={t('removePart')}
                      className="text-danger-600 p-1"
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2 mt-2">
                <input
                  type="text"
                  aria-label={t('partName')}
                  className="input col-span-2"
                  placeholder={t('partName')}
                  value={newPart.name}
                  onChange={(e) => setNewPart({ ...newPart, name: e.target.value })}
                />
                <input
                  type="number"
                  aria-label={t('partQty')}
                  className="input"
                  min="1"
                  value={newPart.quantity}
                  onChange={(e) =>
                    setNewPart({
                      ...newPart,
                      quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                    })
                  }
                />
                <button
                  type="button"
                  onClick={addPart}
                  disabled={!newPart.name.trim()}
                  className="btn-secondary text-sm disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="completionNotes" className="label">
                {t('notes')}
              </label>
              <textarea
                id="completionNotes"
                className="input min-h-[80px]"
                placeholder={t('notesPlaceholder')}
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
              className="btn-primary w-full"
            >
              {completeMutation.isPending ? t('completing') : t('confirmComplete')}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
