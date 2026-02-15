'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  User,
  FileText,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  Loader2,
  Camera,
  Download,
  ArrowLeftRight,
  Zap,
  Droplets,
  Gauge,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { inspectionsService } from '@bossnyumba/api-client';

type InspectionStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
type InspectionType = 'MOVE_IN' | 'MOVE_OUT' | 'ROUTINE' | 'ANNUAL';
type Condition = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';

const typeLabels: Record<string, string> = {
  MOVE_IN: 'Move-In', move_in: 'Move-In',
  MOVE_OUT: 'Move-Out', move_out: 'Move-Out',
  ROUTINE: 'Routine', routine: 'Routine',
  ANNUAL: 'Annual', annual: 'Annual',
};

const statusConfig: Record<string, { label: string; color: string }> = {
  SCHEDULED: { label: 'Scheduled', color: 'badge-info' },
  scheduled: { label: 'Scheduled', color: 'badge-info' },
  IN_PROGRESS: { label: 'In Progress', color: 'badge-warning' },
  in_progress: { label: 'In Progress', color: 'badge-warning' },
  COMPLETED: { label: 'Completed', color: 'badge-success' },
  completed: { label: 'Completed', color: 'badge-success' },
  CANCELLED: { label: 'Cancelled', color: 'badge-danger' },
  missed: { label: 'Missed', color: 'badge-danger' },
};

const conditionColors: Record<string, string> = {
  EXCELLENT: 'badge-success', excellent: 'badge-success',
  GOOD: 'badge-primary', good: 'badge-primary',
  FAIR: 'badge-warning', fair: 'badge-warning',
  POOR: 'badge-danger', poor: 'badge-danger',
};

const conditionTextColors: Record<string, string> = {
  EXCELLENT: 'text-success-600', excellent: 'text-success-600',
  GOOD: 'text-primary-600', good: 'text-primary-600',
  FAIR: 'text-warning-600', fair: 'text-warning-600',
  POOR: 'text-danger-600', poor: 'text-danger-600',
};

const meterIcons: Record<string, React.ElementType> = {
  electricity: Zap, water: Droplets, gas: Gauge,
  ELECTRICITY: Zap, WATER: Droplets, GAS: Gauge,
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export default function InspectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [showComparison, setShowComparison] = useState(false);

  // Fetch inspection from API
  const { data: inspectionData, isLoading } = useQuery({
    queryKey: ['inspection', id],
    queryFn: () => inspectionsService.get(id as never),
    enabled: !!id,
    retry: false,
  });

  const ins = inspectionData?.data as Record<string, unknown> | undefined;
  const unit = ins?.unit as Record<string, unknown> | undefined;
  const property = ins?.property as Record<string, unknown> | undefined;
  const customer = ins?.customer as Record<string, unknown> | undefined;
  const items = Array.isArray(ins?.items) ? ins.items as Record<string, unknown>[] : [];
  const meterReadings = Array.isArray(ins?.meterReadings) ? ins.meterReadings as Record<string, unknown>[] : [];

  const inspection = useMemo(() => {
    if (!ins) return null;
    return {
      id: String(ins.id),
      inspectionNumber: String(ins.inspectionNumber ?? ins.id ?? ''),
      type: String(ins.type ?? 'ROUTINE'),
      unit: String(unit?.unitNumber ?? ins.unitId ?? ''),
      property: String(property?.name ?? ins.propertyId ?? ''),
      status: String(ins.status ?? 'SCHEDULED'),
      scheduledDate: String(ins.scheduledDate ?? ''),
      scheduledTime: String(ins.scheduledTimeSlot ?? ''),
      customerName: customer
        ? `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim() || String(customer.name ?? 'Tenant')
        : 'Tenant',
      overallCondition: ins.overallCondition ? String(ins.overallCondition) : null,
      summary: ins.summary ? String(ins.summary) : null,
      recommendations: ins.recommendations ? String(ins.recommendations) : null,
      followUpRequired: Boolean(ins.followUpRequired),
      completedAt: ins.completedAt ? String(ins.completedAt) : null,
      customerPresent: Boolean(ins.customerPresent),
      inspectorSignatureUrl: ins.inspectorSignatureUrl ? String(ins.inspectorSignatureUrl) : null,
      customerSignatureUrl: ins.customerSignatureUrl ? String(ins.customerSignatureUrl) : null,
      unitId: String(ins.unitId ?? ''),
    };
  }, [ins, unit, property, customer]);

  // For move-out inspections, try to fetch the corresponding move-in inspection for comparison
  const isMoveOut = inspection?.type?.toLowerCase().includes('move_out') || inspection?.type === 'MOVE_OUT';
  const { data: moveInData } = useQuery({
    queryKey: ['inspections', 'moveIn', inspection?.unitId],
    queryFn: () => inspectionsService.list(
      { unitId: inspection!.unitId, type: ['MOVE_IN'] as never },
      1,
      1
    ),
    enabled: !!inspection?.unitId && isMoveOut && showComparison,
    retry: false,
  });

  const moveInInspection = useMemo(() => {
    const data = moveInData?.data;
    if (!data || !Array.isArray(data) || data.length === 0) return null;
    const mi = data[0] as Record<string, unknown>;
    return {
      items: Array.isArray(mi.items) ? mi.items as Record<string, unknown>[] : [],
      overallCondition: mi.overallCondition ? String(mi.overallCondition) : null,
      completedAt: mi.completedAt ? String(mi.completedAt) : null,
      meterReadings: Array.isArray(mi.meterReadings) ? mi.meterReadings as Record<string, unknown>[] : [],
    };
  }, [moveInData]);

  // Generate report
  const handleGenerateReport = () => {
    inspectionsService.generateReport(id as never);
  };

  if (isLoading) {
    return (
      <>
        <PageHeader title="Inspection" showBack />
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      </>
    );
  }

  if (!inspection) {
    return (
      <>
        <PageHeader title="Inspection" showBack />
        <div className="px-4 py-8 text-center">
          <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">Inspection not found</p>
          <button onClick={() => router.back()} className="btn-secondary">
            Go Back
          </button>
        </div>
      </>
    );
  }

  const status = statusConfig[inspection.status] ?? statusConfig.SCHEDULED;
  const isScheduled = ['SCHEDULED', 'scheduled'].includes(inspection.status);
  const isCompleted = ['COMPLETED', 'completed'].includes(inspection.status);

  return (
    <>
      <PageHeader
        title={inspection.inspectionNumber}
        subtitle={`${typeLabels[inspection.type] ?? inspection.type} • Unit ${inspection.unit}`}
        showBack
        action={
          <div className="flex gap-2">
            {isMoveOut && isCompleted && (
              <button
                onClick={() => setShowComparison(!showComparison)}
                className={`btn text-sm ${showComparison ? 'btn-primary' : 'btn-secondary'}`}
              >
                <ArrowLeftRight className="w-4 h-4" />
              </button>
            )}
            {isScheduled && (
              <Link href={`/inspections/${id}/conduct`} className="btn-primary text-sm flex items-center gap-1">
                <CheckCircle className="w-4 h-4" /> Start
              </Link>
            )}
            {isCompleted && (
              <button onClick={handleGenerateReport} className="btn-secondary text-sm flex items-center gap-1">
                <Download className="w-4 h-4" /> Report
              </button>
            )}
          </div>
        }
      />

      <div className="px-4 py-4 space-y-6 max-w-4xl mx-auto">
        {/* Status & Overview */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <span className={status.color}>{status.label}</span>
            {inspection.overallCondition && (
              <span className={conditionColors[inspection.overallCondition]}>
                {capitalize(inspection.overallCondition)}
              </span>
            )}
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span>
                {inspection.scheduledDate
                  ? new Date(inspection.scheduledDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                  : '—'}
              </span>
            </div>
            {inspection.scheduledTime && (
              <div className="flex items-center gap-3 text-sm">
                <Clock className="w-4 h-4 text-gray-400" />
                <span>{inspection.scheduledTime}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span>{inspection.property} &bull; Unit {inspection.unit}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <User className="w-4 h-4 text-gray-400" />
              <span>{inspection.customerName}</span>
            </div>
          </div>
        </div>

        {/* Summary (for completed inspections) */}
        {inspection.summary && (
          <div className="card p-4">
            <h2 className="font-semibold mb-2">Summary</h2>
            <p className="text-sm text-gray-600">{inspection.summary}</p>
            {inspection.recommendations && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-1">Recommendations</h3>
                <p className="text-sm text-gray-500">{inspection.recommendations}</p>
              </div>
            )}
            {inspection.followUpRequired && (
              <div className="mt-3 p-3 bg-warning-50 rounded-lg flex items-center gap-2 text-warning-700 text-sm">
                <AlertTriangle className="w-4 h-4" />
                Follow-up required
              </div>
            )}
          </div>
        )}

        {/* ── Side-by-Side Comparison (Move-Out) ─────────────────────── */}
        {showComparison && isMoveOut && (
          <div className="card p-4">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-primary-500" />
              Move-In vs Move-Out Comparison
            </h2>

            {!moveInInspection ? (
              <div className="text-center py-6 text-gray-500 text-sm">
                <p>No move-in inspection found for this unit.</p>
                <p className="text-xs text-gray-400 mt-1">Comparison requires a completed move-in inspection.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Overall Condition Comparison */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-primary-50 rounded-lg text-center">
                    <div className="text-xs text-gray-500 mb-1">Move-In</div>
                    <div className={`text-lg font-bold ${conditionTextColors[moveInInspection.overallCondition ?? ''] ?? 'text-gray-600'}`}>
                      {moveInInspection.overallCondition ? capitalize(moveInInspection.overallCondition) : '—'}
                    </div>
                    {moveInInspection.completedAt && (
                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(moveInInspection.completedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div className="p-3 bg-warning-50 rounded-lg text-center">
                    <div className="text-xs text-gray-500 mb-1">Move-Out</div>
                    <div className={`text-lg font-bold ${conditionTextColors[inspection.overallCondition ?? ''] ?? 'text-gray-600'}`}>
                      {inspection.overallCondition ? capitalize(inspection.overallCondition) : '—'}
                    </div>
                    {inspection.completedAt && (
                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(inspection.completedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Item-by-Item Comparison */}
                {items.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">Room-by-Room</h3>
                    <div className="space-y-2">
                      {items.map((item, idx) => {
                        const area = String(item.area ?? item.category ?? '');
                        const itemName = String(item.item ?? item.label ?? '');
                        const moveOutCond = String(item.condition ?? '');
                        const moveInItem = moveInInspection.items.find(
                          (mi) => String(mi.area ?? mi.category ?? '') === area && String(mi.item ?? mi.label ?? '') === itemName
                        );
                        const moveInCond = moveInItem ? String(moveInItem.condition ?? '') : '';
                        const condOrder = ['POOR', 'FAIR', 'GOOD', 'EXCELLENT', 'poor', 'fair', 'good', 'excellent'];
                        const degraded = moveInCond && moveOutCond
                          ? condOrder.indexOf(moveOutCond.toUpperCase()) < condOrder.indexOf(moveInCond.toUpperCase())
                          : false;

                        return (
                          <div key={idx} className={`p-3 rounded-lg flex items-center justify-between text-sm ${degraded ? 'bg-danger-50' : 'bg-gray-50'}`}>
                            <div>
                              <div className="font-medium">{area}</div>
                              <div className="text-xs text-gray-400">{itemName}</div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-center">
                                <div className="text-xs text-gray-400">In</div>
                                <span className={`text-xs font-medium ${conditionTextColors[moveInCond] ?? 'text-gray-500'}`}>
                                  {moveInCond ? capitalize(moveInCond) : '—'}
                                </span>
                              </div>
                              <ChevronRight className="w-3 h-3 text-gray-300" />
                              <div className="text-center">
                                <div className="text-xs text-gray-400">Out</div>
                                <span className={`text-xs font-medium ${conditionTextColors[moveOutCond] ?? 'text-gray-500'}`}>
                                  {moveOutCond ? capitalize(moveOutCond) : '—'}
                                </span>
                              </div>
                              {degraded && <AlertTriangle className="w-3 h-3 text-danger-500 ml-1" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Meter Reading Comparison */}
                {(meterReadings.length > 0 || moveInInspection.meterReadings.length > 0) && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">Meter Readings</h3>
                    <div className="space-y-2">
                      {meterReadings.map((meter, idx) => {
                        const type = String(meter.type ?? '');
                        const MIcon = meterIcons[type] ?? Gauge;
                        const moveInMeter = moveInInspection.meterReadings.find(
                          (mi) => String(mi.type ?? '') === type
                        );
                        return (
                          <div key={idx} className="p-3 bg-gray-50 rounded-lg flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <MIcon className="w-4 h-4 text-primary-500" />
                              <span className="font-medium">{capitalize(type)}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-center">
                                <div className="text-xs text-gray-400">Move-In</div>
                                <span className="text-xs font-medium">
                                  {moveInMeter?.reading ? String(moveInMeter.reading) : '—'}
                                </span>
                              </div>
                              <ChevronRight className="w-3 h-3 text-gray-300" />
                              <div className="text-center">
                                <div className="text-xs text-gray-400">Move-Out</div>
                                <span className="text-xs font-medium">{meter.reading ? String(meter.reading) : '—'}</span>
                              </div>
                              {moveInMeter?.reading && meter.reading && (
                                <div className="text-xs text-primary-600 font-medium ml-1">
                                  Δ {(Number(meter.reading) - Number(moveInMeter.reading)).toLocaleString()}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Inspection Checklist Items */}
        {items.length > 0 && (
          <div className="card p-4">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Inspection Checklist
            </h2>
            <div className="space-y-2">
              {items.map((item, idx) => {
                const condition = String(item.condition ?? '');
                const area = String(item.area ?? item.category ?? '');
                const itemName = String(item.item ?? item.label ?? '');
                const notes = item.notes ? String(item.notes) : null;
                const photos = Array.isArray(item.photoUrls) ? item.photoUrls as string[] : [];
                const requiresAction = Boolean(item.requiresAction);

                return (
                  <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-sm">{area}{itemName ? ` — ${itemName}` : ''}</div>
                        {notes && <div className="text-xs text-gray-500 mt-1">{notes}</div>}
                        {requiresAction && (
                          <div className="flex items-center gap-1 text-xs text-warning-600 mt-1">
                            <AlertTriangle className="w-3 h-3" /> Action required
                          </div>
                        )}
                      </div>
                      {condition && (
                        <span className={conditionColors[condition] ?? 'badge-gray'}>
                          {capitalize(condition)}
                        </span>
                      )}
                    </div>
                    {photos.length > 0 && (
                      <div className="flex gap-2 mt-2 overflow-x-auto">
                        {photos.map((photo, pi) => (
                          <div key={pi} className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-200 flex items-center justify-center">
                            <Camera className="w-5 h-5 text-gray-400" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Meter Readings */}
        {meterReadings.length > 0 && !showComparison && (
          <div className="card p-4">
            <h2 className="font-semibold mb-3">Meter Readings</h2>
            <div className="space-y-2">
              {meterReadings.map((meter, idx) => {
                const type = String(meter.type ?? '');
                const MIcon = meterIcons[type] ?? Gauge;
                return (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <MIcon className="w-4 h-4 text-primary-500" />
                      <span className="text-sm font-medium">{capitalize(type)}</span>
                    </div>
                    <span className="text-sm font-semibold">
                      {meter.reading ? String(meter.reading) : '—'} {meter.unit ? String(meter.unit) : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Signatures */}
        {(inspection.inspectorSignatureUrl || inspection.customerSignatureUrl) && (
          <div className="card p-4">
            <h2 className="font-semibold mb-3">Signatures</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-1">Inspector</div>
                {inspection.inspectorSignatureUrl ? (
                  <div className="h-16 bg-gray-50 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-success-500" />
                  </div>
                ) : (
                  <div className="h-16 bg-gray-50 rounded-lg flex items-center justify-center text-xs text-gray-400">Not signed</div>
                )}
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-1">Customer</div>
                {inspection.customerSignatureUrl ? (
                  <div className="h-16 bg-gray-50 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-success-500" />
                  </div>
                ) : (
                  <div className="h-16 bg-gray-50 rounded-lg flex items-center justify-center text-xs text-gray-400">
                    {inspection.customerPresent ? 'Not signed' : 'Not present'}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        {isScheduled && (
          <div className="flex gap-3">
            <Link href={`/inspections/${id}/conduct`} className="btn-primary flex-1 flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4" /> Start Inspection
            </Link>
            <button className="btn-secondary">Reschedule</button>
          </div>
        )}
      </div>
    </>
  );
}
