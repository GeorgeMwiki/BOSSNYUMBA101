'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  MapPin,
  User,
  Phone,
  Calendar,
  MessageCircle,
  FileText,
  Check,
  Timer,
  AlertTriangle,
  CheckCircle,
  Camera,
  Wrench,
  X,
  Clock,
  DollarSign,
  Package,
  UserCheck,
  Edit,
  Play,
  Pause,
  Square,
  Plus,
  Send,
  Loader2,
  Building2,
  Star,
  Shield,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { PriorityBadge, SLATimer, Timeline, type TimelineEvent } from '@/components/maintenance';
import { workOrdersService, vendorsService } from '@bossnyumba/api-client';

interface Material {
  id: string;
  name: string;
  quantity: number;
  cost: number;
}

const statusConfig: Record<string, string> = {
  OPEN: 'badge-info',
  SUBMITTED: 'badge-info',
  submitted: 'badge-info',
  TRIAGED: 'badge-info',
  triaged: 'badge-info',
  ASSIGNED: 'badge-warning',
  assigned: 'badge-warning',
  SCHEDULED: 'badge-warning',
  scheduled: 'badge-warning',
  IN_PROGRESS: 'badge-warning',
  in_progress: 'badge-warning',
  PENDING_CONFIRMATION: 'badge-warning',
  pending_confirmation: 'badge-warning',
  COMPLETED: 'badge-success',
  completed: 'badge-success',
  CANCELLED: 'badge-gray',
};

function normalizeStatus(s: string) {
  return s.toLowerCase().replace(/_/g, ' ');
}

function normalizePriority(s: string): 'emergency' | 'high' | 'medium' | 'low' {
  const lower = s.toLowerCase();
  if (['emergency', 'high', 'medium', 'low'].includes(lower)) return lower as 'emergency' | 'high' | 'medium' | 'low';
  return 'medium';
}

export default function WorkOrderDetail() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const workOrderId = params?.id as string;

  // Completion modal state
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [beforePhotos, setBeforePhotos] = useState<string[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<string[]>([]);
  const [workNotes, setWorkNotes] = useState('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [newMaterial, setNewMaterial] = useState({ name: '', quantity: 1, cost: 0 });
  const [laborHours, setLaborHours] = useState(0);
  const [laborMinutes, setLaborMinutes] = useState(0);
  
  // Time tracking
  const [isTracking, setIsTracking] = useState(false);
  const [trackingStartTime, setTrackingStartTime] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  
  // Sign-off state
  const [showSignOffModal, setShowSignOffModal] = useState(false);
  const [signOffStep, setSignOffStep] = useState<'technician' | 'tenant' | 'manager'>('technician');
  const [signatureDrawn, setSignatureDrawn] = useState(false);

  // Vendor assignment state
  const [showVendorModal, setShowVendorModal] = useState(false);

  // Fetch work order from API
  const { data: woData, isLoading } = useQuery({
    queryKey: ['workOrder', workOrderId],
    queryFn: () => workOrdersService.get(workOrderId as never),
    enabled: !!workOrderId,
    retry: false,
  });

  // Fetch available vendors for assignment
  const { data: vendorsData } = useQuery({
    queryKey: ['vendors', 'available'],
    queryFn: () => vendorsService.list({ available: true }),
    enabled: showVendorModal,
    retry: false,
  });

  // Parse work order data
  const wo = woData?.data as Record<string, unknown> | undefined;
  const sla = wo?.sla as Record<string, unknown> | undefined;
  const unit = wo?.unit as Record<string, unknown> | undefined;
  const property = wo?.property as Record<string, unknown> | undefined;
  const customer = wo?.customer as Record<string, unknown> | undefined;
  const assignedVendor = wo?.vendor as Record<string, unknown> | undefined;

  const workOrder = useMemo(() => {
    if (!wo) return null;
    const responseDueAt = sla?.responseDueAt ? new Date(String(sla.responseDueAt)).getTime() : null;
    const resolutionDueAt = sla?.resolutionDueAt ? new Date(String(sla.resolutionDueAt)).getTime() : null;
    const now = Date.now();

    return {
      id: String(wo.id),
      workOrderNumber: String(wo.workOrderNumber ?? wo.id ?? ''),
      title: String(wo.title ?? ''),
      description: String(wo.description ?? ''),
      category: String(wo.category ?? ''),
      priority: normalizePriority(String(wo.priority ?? 'MEDIUM')),
      status: String(wo.status ?? 'OPEN'),
      unit: String(unit?.unitNumber ?? wo.unitId ?? ''),
      property: String(property?.name ?? wo.propertyId ?? ''),
      location: String(wo.location ?? ''),
      customer: {
        name: customer ? String(customer.firstName ?? '') + ' ' + String(customer.lastName ?? '') : 'Tenant',
        phone: String(customer?.phone ?? ''),
      },
      createdAt: String(wo.createdAt ?? ''),
      scheduledDate: wo.scheduledDate ? String(wo.scheduledDate) : null,
      scheduledTimeSlot: wo.scheduledTimeSlot ? String(wo.scheduledTimeSlot) : null,
      permissionToEnter: Boolean(wo.permissionToEnter),
      entryInstructions: wo.entryInstructions ? String(wo.entryInstructions) : null,
      photos: Array.isArray(wo.attachments) ? (wo.attachments as { url: string }[]).map((a) => a.url) : [],
      sla: {
        respondedAt: sla?.respondedAt ? String(sla.respondedAt) : null,
        resolvedAt: sla?.resolvedAt ? String(sla.resolvedAt) : null,
        responseDueAt: sla?.responseDueAt ? String(sla.responseDueAt) : '',
        resolutionDueAt: sla?.resolutionDueAt ? String(sla.resolutionDueAt) : '',
        responseBreached: responseDueAt ? (!sla?.respondedAt && responseDueAt < now) : false,
        resolutionBreached: resolutionDueAt ? (!sla?.resolvedAt && resolutionDueAt < now) : false,
      },
      assignedTo: assignedVendor
        ? String(assignedVendor.companyName ?? assignedVendor.name ?? '')
        : wo.assignedToUserId ? 'Assigned' : null,
      signOff: wo.signOff as { technicianSigned: boolean; technicianSignedAt?: string; tenantSigned: boolean; tenantSignedAt?: string; estateManagerApproved: boolean; estateManagerApprovedAt?: string } | undefined,
    };
  }, [wo, sla, unit, property, customer, assignedVendor]);

  // Build timeline from API data
  const timeline: TimelineEvent[] = useMemo(() => {
    if (!wo) return [];
    const events: TimelineEvent[] = [];
    if (wo.createdAt) events.push({ id: '1', timestamp: String(wo.createdAt), action: 'Work order submitted', user: workOrder?.customer.name ?? '' });
    if (sla?.respondedAt) events.push({ id: '2', timestamp: String(sla.respondedAt), action: 'Triaged and assigned', user: 'System' });
    if (wo.scheduledDate) events.push({ id: '3', timestamp: String(wo.scheduledDate), action: `Scheduled for ${new Date(String(wo.scheduledDate)).toLocaleDateString()}`, user: workOrder?.assignedTo ?? '' });
    if (wo.startedAt) events.push({ id: '4', timestamp: String(wo.startedAt), action: 'Work started', user: workOrder?.assignedTo ?? '' });
    if (wo.completedAt) events.push({ id: '5', timestamp: String(wo.completedAt), action: 'Work completed', user: workOrder?.assignedTo ?? '' });
    return events;
  }, [wo, sla, workOrder]);

  // Mutations
  const completeMutation = useMutation({
    mutationFn: () =>
      workOrdersService.complete(workOrderId as never, {
        completionNotes: workNotes,
        actualCost: materials.length > 0
          ? { amount: materials.reduce((s, m) => s + m.cost * m.quantity, 0), currency: 'KES' }
          : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workOrder', workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
      setShowCompletionModal(false);
      setShowSignOffModal(true);
    },
  });

  const assignVendorMutation = useMutation({
    mutationFn: (vendorId: string) =>
      workOrdersService.assign(workOrderId as never, { vendorId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workOrder', workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
      setShowVendorModal(false);
    },
  });

  const startWorkMutation = useMutation({
    mutationFn: () => workOrdersService.startWork(workOrderId as never),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workOrder', workOrderId] });
    },
  });

  const availableVendors = vendorsData?.data ?? [];

  // Time tracking handlers
  const startTimeTracking = () => {
    setIsTracking(true);
    setTrackingStartTime(new Date());
    if (!['IN_PROGRESS', 'in_progress'].includes(workOrder?.status ?? '')) {
      startWorkMutation.mutate();
    }
  };

  const stopTimeTracking = () => {
    if (trackingStartTime) {
      const elapsed = Math.floor((Date.now() - trackingStartTime.getTime()) / 1000);
      setElapsedSeconds((prev) => prev + elapsed);
      const totalMinutes = Math.floor((elapsedSeconds + elapsed) / 60);
      setLaborHours(Math.floor(totalMinutes / 60));
      setLaborMinutes(totalMinutes % 60);
    }
    setIsTracking(false);
    setTrackingStartTime(null);
  };

  const addMaterial = () => {
    if (newMaterial.name.trim()) {
      setMaterials([...materials, { ...newMaterial, id: Date.now().toString() }]);
      setNewMaterial({ name: '', quantity: 1, cost: 0 });
    }
  };

  const removeMaterial = (id: string) => {
    setMaterials(materials.filter((m) => m.id !== id));
  };

  const addPhoto = (type: 'before' | 'after') => {
    const photoUrl = `/photo-${Date.now()}.jpg`;
    if (type === 'before') setBeforePhotos([...beforePhotos, photoUrl]);
    else setAfterPhotos([...afterPhotos, photoUrl]);
  };

  const removePhoto = (type: 'before' | 'after', index: number) => {
    if (type === 'before') setBeforePhotos(beforePhotos.filter((_, i) => i !== index));
    else setAfterPhotos(afterPhotos.filter((_, i) => i !== index));
  };

  const handleSubmitCompletion = async () => {
    completeMutation.mutate();
  };

  const handleSignOff = async () => {
    if (signOffStep === 'technician') {
      setSignOffStep('tenant');
      setSignatureDrawn(false);
    } else if (signOffStep === 'tenant') {
      setSignOffStep('manager');
      setSignatureDrawn(false);
    } else {
      setShowSignOffModal(false);
    }
  };

  const totalMaterialsCost = materials.reduce((sum, m) => sum + m.cost * m.quantity, 0);
  const canComplete = afterPhotos.length > 0 && workNotes.trim().length > 0;

  // Loading and error states
  if (isLoading) {
    return (
      <>
        <PageHeader title="Work Order" showBack />
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      </>
    );
  }

  if (!workOrder) {
    return (
      <>
        <PageHeader title="Work Order" showBack />
        <div className="px-4 py-8 text-center">
          <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">Work order not found</p>
          <button onClick={() => router.back()} className="btn-secondary">Go Back</button>
        </div>
      </>
    );
  }

  const responseMinutesRemaining = workOrder.sla.respondedAt
    ? null
    : workOrder.sla.responseDueAt
      ? Math.round((new Date(workOrder.sla.responseDueAt).getTime() - Date.now()) / (60 * 1000))
      : null;
  const resolutionMinutesRemaining = ['COMPLETED', 'completed'].includes(workOrder.status)
    ? null
    : workOrder.sla.resolutionDueAt
      ? Math.round((new Date(workOrder.sla.resolutionDueAt).getTime() - Date.now()) / (60 * 1000))
      : null;
  const isActive = ['IN_PROGRESS', 'in_progress', 'ASSIGNED', 'assigned', 'SCHEDULED', 'scheduled'].includes(workOrder.status);

  return (
    <>
      <PageHeader
        title={workOrder.workOrderNumber}
        showBack
        action={
          <button onClick={() => setShowVendorModal(true)} className="btn-secondary text-sm flex items-center gap-1">
            <Building2 className="w-4 h-4" />
            Vendor
          </button>
        }
      />

      <div className="px-4 py-4 space-y-6 pb-32">
        {/* Status and Priority */}
        <div className="card p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold">{workOrder.title}</h2>
              <p className="text-sm text-gray-600 mt-1">{workOrder.description}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={statusConfig[workOrder.status] || 'badge-gray'}>
                {normalizeStatus(workOrder.status)}
              </span>
              <PriorityBadge priority={workOrder.priority} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-gray-500">
              <MapPin className="w-4 h-4" />
              <span>Unit {workOrder.unit}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-500">
              <FileText className="w-4 h-4" />
              <span>{workOrder.category}</span>
            </div>
          </div>

          {workOrder.assignedTo && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 text-sm text-gray-500">
              <Wrench className="w-4 h-4" />
              <span>Assigned to: <strong>{workOrder.assignedTo}</strong></span>
            </div>
          )}
        </div>

        {/* Time Tracking */}
        {isActive && (
          <div className="card p-4">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary-600" />
              Time Tracking
            </h3>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-primary-600">
                  {String(laborHours).padStart(2, '0')}:{String(laborMinutes).padStart(2, '0')}
                </div>
                <div className="text-sm text-gray-500">Hours worked</div>
              </div>
              <div className="flex gap-2">
                {!isTracking ? (
                  <button onClick={startTimeTracking} className="btn-primary flex items-center gap-2">
                    <Play className="w-4 h-4" /> Start
                  </button>
                ) : (
                  <>
                    <button onClick={stopTimeTracking} className="btn-secondary flex items-center gap-2">
                      <Pause className="w-4 h-4" /> Pause
                    </button>
                    <button onClick={stopTimeTracking} className="btn-danger flex items-center gap-2">
                      <Square className="w-4 h-4" /> Stop
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SLA Status with Countdown */}
        <div className="card p-4">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <Timer className="w-5 h-5 text-primary-600" />
            SLA Status
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Response Time</span>
              {workOrder.sla.respondedAt ? (
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-success-500" />
                  <span className="text-sm font-medium text-success-600">Met</span>
                </div>
              ) : (
                <SLATimer minutesRemaining={responseMinutesRemaining} type="response" breached={workOrder.sla.responseBreached} />
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Resolution Time</span>
              {['COMPLETED', 'completed'].includes(workOrder.status) ? (
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-success-500" />
                  <span className="text-sm font-medium text-success-600">Completed</span>
                </div>
              ) : (
                <SLATimer minutesRemaining={resolutionMinutesRemaining} type="resolution" breached={workOrder.sla.resolutionBreached} />
              )}
            </div>
            {(workOrder.sla.responseBreached || workOrder.sla.resolutionBreached) && (
              <div className="bg-danger-50 p-3 rounded-lg flex items-center gap-2 text-danger-700">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-medium">SLA breached</span>
              </div>
            )}
          </div>
        </div>

        {/* Schedule Info */}
        {workOrder.scheduledDate && (
          <div className="card p-4 bg-primary-50 border-primary-200">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <Calendar className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h3 className="font-medium text-primary-900">Scheduled Visit</h3>
                <p className="text-sm text-primary-700">
                  {new Date(workOrder.scheduledDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
                {workOrder.scheduledTimeSlot && <p className="text-sm text-primary-600">{workOrder.scheduledTimeSlot}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Customer Info */}
        <div className="card p-4">
          <h3 className="font-medium mb-3">Customer Contact</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-gray-500" />
              </div>
              <div>
                <div className="font-medium">{workOrder.customer.name}</div>
                <div className="text-sm text-gray-500">{workOrder.customer.phone}</div>
              </div>
            </div>
            <div className="flex gap-2">
              {workOrder.customer.phone && (
                <a href={`tel:${workOrder.customer.phone}`} className="btn-secondary p-2">
                  <Phone className="w-4 h-4" />
                </a>
              )}
              <button className="btn-secondary p-2">
                <MessageCircle className="w-4 h-4" />
              </button>
            </div>
          </div>
          {workOrder.permissionToEnter && (
            <div className="mt-4 p-3 bg-success-50 rounded-lg">
              <div className="flex items-center gap-2 text-success-700 text-sm font-medium">
                <Check className="w-4 h-4" /> Permission to Enter
              </div>
              {workOrder.entryInstructions && <p className="text-sm text-success-600 mt-1">{workOrder.entryInstructions}</p>}
            </div>
          )}
        </div>

        {/* Location Details */}
        <div className="card p-4">
          <h3 className="font-medium mb-3">Location</h3>
          <div className="text-sm">
            <div className="font-medium">{workOrder.property}</div>
            <div className="text-gray-500">Unit {workOrder.unit}</div>
            {workOrder.location && <div className="text-gray-500">{workOrder.location}</div>}
          </div>
        </div>

        {/* Photos from Customer */}
        {workOrder.photos.length > 0 && (
          <div className="card p-4">
            <h3 className="font-medium mb-3">Photos from Customer</h3>
            <div className="flex gap-2 overflow-x-auto">
              {workOrder.photos.map((_, index) => (
                <div key={index} className="w-24 h-24 bg-gray-200 rounded-lg flex-shrink-0 flex items-center justify-center">
                  <Camera className="w-8 h-8 text-gray-400" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sign-off Status */}
        {workOrder.signOff && isActive && (
          <div className="card p-4">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-primary-600" />
              Sign-off Status
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm">Technician Sign-off</span>
                {workOrder.signOff.technicianSigned ? (
                  <span className="badge-success flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Signed</span>
                ) : (
                  <span className="badge-warning">Pending</span>
                )}
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm">Tenant Confirmation</span>
                {workOrder.signOff.tenantSigned ? (
                  <span className="badge-success flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Confirmed</span>
                ) : (
                  <span className="badge-warning">Pending</span>
                )}
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm">Manager Approval</span>
                {workOrder.signOff.estateManagerApproved ? (
                  <span className="badge-success flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Approved</span>
                ) : (
                  <span className="badge-warning">Pending</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Timeline */}
        {timeline.length > 0 && (
          <div className="card p-4">
            <h3 className="font-medium mb-4">Activity Timeline</h3>
            <Timeline events={timeline} />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Link href={`/work-orders/${workOrder.id}/triage`} className="btn-secondary flex-1">
            <Edit className="w-4 h-4 mr-2" /> Edit
          </Link>
          <Link href="/work-orders" className="btn-secondary flex-1">
            Back to List
          </Link>
        </div>
      </div>

      {/* Fixed Bottom Action */}
      {isActive && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
          <button onClick={() => setShowCompletionModal(true)} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
            <Wrench className="w-5 h-5" /> Mark as Complete
          </button>
        </div>
      )}

      {/* ── Vendor Assignment Modal ─────────────────────────────────── */}
      {showVendorModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowVendorModal(false)} />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg mx-4 p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary-500" />
              Assign Vendor
            </h3>
            <p className="text-sm text-gray-500">
              Select a vendor for <strong>{workOrder.category}</strong> work on this order.
            </p>

            {availableVendors.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No vendors available</p>
                <Link href="/vendors/new" className="btn-primary text-sm mt-3 inline-block">Add Vendor</Link>
              </div>
            ) : (
              <div className="space-y-2">
                {availableVendors.map((v: { id: string; companyName?: string; name: string; categories: string[]; rating?: number; responseTimeHours?: number }) => (
                  <div key={v.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div>
                      <div className="font-medium text-sm">{v.companyName || v.name}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-2">
                        {v.categories.join(', ')}
                        {v.rating && (
                          <span className="flex items-center gap-0.5">
                            <Star className="w-3 h-3 text-warning-500 fill-warning-500" />
                            {v.rating.toFixed(1)}
                          </span>
                        )}
                        {v.responseTimeHours && (
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-3 h-3" />
                            {v.responseTimeHours}h
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      className="btn-primary text-xs"
                      onClick={() => assignVendorMutation.mutate(v.id)}
                      disabled={assignVendorMutation.isPending}
                    >
                      {assignVendorMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Assign'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button className="btn-secondary w-full" onClick={() => setShowVendorModal(false)}>Close</button>
          </div>
        </div>
      )}

      {/* ── Completion Modal ────────────────────────────────────────── */}
      {showCompletionModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Complete Work Order</h3>
                <button onClick={() => setShowCompletionModal(false)} className="p-2 text-gray-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-6">
              <div>
                <label className="label">Before Photos</label>
                <div className="flex gap-2 flex-wrap">
                  {beforePhotos.map((_, index) => (
                    <div key={index} className="relative">
                      <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center"><Camera className="w-6 h-6 text-gray-400" /></div>
                      <button onClick={() => removePhoto('before', index)} className="absolute -top-1 -right-1 w-5 h-5 bg-danger-500 rounded-full flex items-center justify-center text-white"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                  <button onClick={() => addPhoto('before')} className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-primary-500 hover:text-primary-500"><Plus className="w-6 h-6" /></button>
                </div>
              </div>
              <div>
                <label className="label">After Photos <span className="text-danger-500">*</span></label>
                <div className="flex gap-2 flex-wrap">
                  {afterPhotos.map((_, index) => (
                    <div key={index} className="relative">
                      <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center"><Camera className="w-6 h-6 text-gray-400" /></div>
                      <button onClick={() => removePhoto('after', index)} className="absolute -top-1 -right-1 w-5 h-5 bg-danger-500 rounded-full flex items-center justify-center text-white"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                  <button onClick={() => addPhoto('after')} className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-primary-500 hover:text-primary-500"><Plus className="w-6 h-6" /></button>
                </div>
                {afterPhotos.length === 0 && <p className="text-xs text-danger-500 mt-1">At least one after photo is required</p>}
              </div>
              <div>
                <label className="label">Work Completed Notes <span className="text-danger-500">*</span></label>
                <textarea className="input min-h-[100px]" placeholder="Describe the work completed..." value={workNotes} onChange={(e) => setWorkNotes(e.target.value)} />
              </div>
              <div>
                <label className="label flex items-center gap-2"><Package className="w-4 h-4" /> Materials Used</label>
                <div className="space-y-2">
                  {materials.map((material) => (
                    <div key={material.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div><span className="font-medium">{material.name}</span><span className="text-sm text-gray-500 ml-2">x{material.quantity}</span></div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">KES {(material.cost * material.quantity).toLocaleString()}</span>
                        <button onClick={() => removeMaterial(material.id)} className="text-danger-500 p-1"><X className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  <input type="text" className="input col-span-2" placeholder="Material name" value={newMaterial.name} onChange={(e) => setNewMaterial({ ...newMaterial, name: e.target.value })} />
                  <input type="number" className="input" placeholder="Qty" min="1" value={newMaterial.quantity} onChange={(e) => setNewMaterial({ ...newMaterial, quantity: parseInt(e.target.value) || 1 })} />
                  <input type="number" className="input" placeholder="Cost" min="0" value={newMaterial.cost || ''} onChange={(e) => setNewMaterial({ ...newMaterial, cost: parseFloat(e.target.value) || 0 })} />
                </div>
                <button onClick={addMaterial} disabled={!newMaterial.name.trim()} className="btn-secondary w-full mt-2 text-sm disabled:opacity-50"><Plus className="w-4 h-4 mr-1" /> Add Material</button>
                {materials.length > 0 && (
                  <div className="mt-3 p-3 bg-primary-50 rounded-lg flex items-center justify-between">
                    <span className="text-sm text-primary-700">Total Materials Cost</span>
                    <span className="font-semibold text-primary-900">KES {totalMaterialsCost.toLocaleString()}</span>
                  </div>
                )}
              </div>
              <div>
                <label className="label flex items-center gap-2"><Clock className="w-4 h-4" /> Labor Time</label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input type="number" className="input" placeholder="Hours" min="0" value={laborHours || ''} onChange={(e) => setLaborHours(parseInt(e.target.value) || 0)} />
                    <span className="text-xs text-gray-500 mt-1">Hours</span>
                  </div>
                  <div className="flex-1">
                    <input type="number" className="input" placeholder="Minutes" min="0" max="59" value={laborMinutes || ''} onChange={(e) => setLaborMinutes(parseInt(e.target.value) || 0)} />
                    <span className="text-xs text-gray-500 mt-1">Minutes</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-200 sticky bottom-0 bg-white">
              <div className="flex gap-3">
                <button onClick={() => setShowCompletionModal(false)} className="btn-secondary flex-1 py-3">Cancel</button>
                <button onClick={handleSubmitCompletion} disabled={!canComplete || completeMutation.isPending} className="btn-primary flex-1 py-3 disabled:opacity-50">
                  {completeMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <><Send className="w-4 h-4 mr-2" /> Submit for Sign-off</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Sign-off Modal ──────────────────────────────────────────── */}
      {showSignOffModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {signOffStep === 'technician' && 'Technician Sign-off'}
                {signOffStep === 'tenant' && 'Tenant Confirmation'}
                {signOffStep === 'manager' && 'Manager Approval'}
              </h3>
              <button onClick={() => setShowSignOffModal(false)} className="p-2 text-gray-400"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex justify-center gap-2">
              <div className={`w-3 h-3 rounded-full ${signOffStep === 'technician' ? 'bg-primary-500' : 'bg-success-500'}`} />
              <div className={`w-3 h-3 rounded-full ${signOffStep === 'tenant' ? 'bg-primary-500' : signOffStep === 'manager' ? 'bg-success-500' : 'bg-gray-300'}`} />
              <div className={`w-3 h-3 rounded-full ${signOffStep === 'manager' ? 'bg-primary-500' : 'bg-gray-300'}`} />
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              {signOffStep === 'technician' && <p className="text-sm text-gray-600">By signing, I confirm that the work has been completed as described and the photos accurately represent the work done.</p>}
              {signOffStep === 'tenant' && <p className="text-sm text-gray-600">Please ask the tenant to confirm they are satisfied with the work.</p>}
              {signOffStep === 'manager' && <p className="text-sm text-gray-600">Review the completion evidence and approve the work order closure.</p>}
            </div>
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 h-32 flex items-center justify-center">
              {signatureDrawn ? (
                <div className="text-center">
                  <CheckCircle className="w-12 h-12 text-success-500 mx-auto mb-2" />
                  <span className="text-sm text-success-600">Signature captured</span>
                </div>
              ) : (
                <button onClick={() => setSignatureDrawn(true)} className="text-sm text-gray-500">Tap to sign</button>
              )}
            </div>
            <div className="flex gap-3">
              {signOffStep !== 'technician' && (
                <button onClick={() => { if (signOffStep === 'tenant') setSignOffStep('technician'); if (signOffStep === 'manager') setSignOffStep('tenant'); setSignatureDrawn(false); }} className="btn-secondary flex-1 py-3">Back</button>
              )}
              <button onClick={handleSignOff} disabled={!signatureDrawn} className="btn-primary flex-1 py-3 disabled:opacity-50">
                {signOffStep === 'manager' ? 'Complete Work Order' : 'Next'}
              </button>
            </div>
            {signOffStep === 'tenant' && <button className="btn-secondary w-full text-sm">Send confirmation link to tenant</button>}
          </div>
        </div>
      )}
    </>
  );
}
