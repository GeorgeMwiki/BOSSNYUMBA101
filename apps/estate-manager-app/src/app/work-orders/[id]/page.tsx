'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Clock,
  CheckCircle,
  AlertTriangle,
  User,
  Phone,
  Calendar,
  MessageSquare,
  Image as ImageIcon,
  ChevronRight,
  Star,
  MapPin,
  Wrench,
  Building2,
  FileText,
  Send,
  Loader2,
  MoreVertical,
  Edit,
  X,
  Camera,
  UserCheck,
  AlertCircle,
  ThumbsUp,
  Ban,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { VendorRecommendation } from '@/components/work-orders/VendorRecommendation';
import { DualSignOff } from '@/components/work-orders/DualSignOff';
import { SLATimer } from '@/components/maintenance/SLATimer';

type WorkOrderStatus = 'PENDING' | 'APPROVED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

interface WorkOrder {
  id: string;
  workOrderNumber: string;
  title: string;
  description: string;
  category: string;
  priority: 'EMERGENCY' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: WorkOrderStatus;
  createdAt: string;
  approvedAt?: string;
  assignedAt?: string;
  startedAt?: string;
  completedAt?: string;
  slaDeadline: string;
  slaResponseDeadline: string;
  location: string;
  unit: {
    id: string;
    unitNumber: string;
    property: string;
  };
  customer: {
    id: string;
    name: string;
    phone: string;
    email: string;
  };
  assignedVendor?: {
    id: string;
    name: string;
    phone: string;
    company: string;
    rating: number;
    completedJobs: number;
  };
  photos: string[];
  voiceNoteUrl?: string;
  updates: {
    timestamp: string;
    message: string;
    author: string;
    type: 'status' | 'note' | 'photo';
  }[];
  completionProof?: {
    beforePhotos: string[];
    afterPhotos: string[];
    notes: string;
    materialsUsed: string[];
    laborHours: number;
    completedBy: string;
    tenantSignature?: string;
    technicianSignature?: string;
  };
  estimatedCost?: number;
  actualCost?: number;
  aiTriageNotes?: string;
}

// Mock data
const MOCK_WORK_ORDER: WorkOrder = {
  id: 'wo-1',
  workOrderNumber: 'WO-2024-0045',
  title: 'Water heater not working',
  description: 'The water heater in the master bathroom is not heating water. Tenant reports the pilot light keeps going out.',
  category: 'Plumbing',
  priority: 'HIGH',
  status: 'IN_PROGRESS',
  createdAt: '2024-02-10T09:30:00Z',
  approvedAt: '2024-02-10T10:15:00Z',
  assignedAt: '2024-02-10T11:00:00Z',
  startedAt: '2024-02-11T14:00:00Z',
  slaDeadline: '2024-02-11T09:30:00Z',
  slaResponseDeadline: '2024-02-10T11:30:00Z',
  location: 'Master Bathroom',
  unit: {
    id: 'unit-1',
    unitNumber: 'A-204',
    property: 'Sunset Apartments',
  },
  customer: {
    id: 'cust-1',
    name: 'John Kamau',
    phone: '+254 712 345 678',
    email: 'john.kamau@email.com',
  },
  assignedVendor: {
    id: 'vendor-1',
    name: 'Peter Ochieng',
    phone: '+254 723 456 789',
    company: 'Quick Fix Plumbing',
    rating: 4.8,
    completedJobs: 156,
  },
  photos: ['/photo-1.jpg', '/photo-2.jpg'],
  updates: [
    { timestamp: '2024-02-10T09:30:00Z', message: 'Work order created from tenant request', author: 'System', type: 'status' },
    { timestamp: '2024-02-10T10:15:00Z', message: 'Approved by Estate Manager', author: 'Jane Mwangi', type: 'status' },
    { timestamp: '2024-02-10T11:00:00Z', message: 'Assigned to Quick Fix Plumbing', author: 'Jane Mwangi', type: 'status' },
    { timestamp: '2024-02-11T14:00:00Z', message: 'Technician arrived on site', author: 'Peter Ochieng', type: 'status' },
    { timestamp: '2024-02-11T14:30:00Z', message: 'Diagnosed issue: faulty thermocouple. Replacement part needed.', author: 'Peter Ochieng', type: 'note' },
  ],
  estimatedCost: 8500,
  aiTriageNotes: 'Based on the description, this appears to be a thermocouple or gas valve issue. Recommended vendor category: Plumbing - Gas Appliances. Priority appropriate for the issue type.',
};

const priorityColors: Record<string, { badge: string; text: string }> = {
  EMERGENCY: { badge: 'badge-danger', text: 'text-danger-600' },
  HIGH: { badge: 'badge-warning', text: 'text-warning-600' },
  MEDIUM: { badge: 'badge-info', text: 'text-primary-600' },
  LOW: { badge: 'badge-gray', text: 'text-gray-600' },
};

const statusConfig: Record<WorkOrderStatus, { label: string; badge: string; icon: React.ElementType }> = {
  PENDING: { label: 'Pending Approval', badge: 'badge-warning', icon: Clock },
  APPROVED: { label: 'Approved', badge: 'badge-info', icon: CheckCircle },
  ASSIGNED: { label: 'Assigned', badge: 'badge-primary', icon: User },
  IN_PROGRESS: { label: 'In Progress', badge: 'badge-primary', icon: Wrench },
  COMPLETED: { label: 'Completed', badge: 'badge-success', icon: CheckCircle },
  CANCELLED: { label: 'Cancelled', badge: 'badge-gray', icon: X },
};

export default function WorkOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showSignOffModal, setShowSignOffModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [newNote, setNewNote] = useState('');

  useEffect(() => {
    // Simulate API fetch
    const timer = setTimeout(() => {
      setWorkOrder(MOCK_WORK_ORDER);
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [params.id]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </main>
    );
  }

  if (!workOrder) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h2 className="font-semibold text-gray-900">Work Order Not Found</h2>
          <Link href="/work-orders" className="btn-primary mt-4">
            Back to Work Orders
          </Link>
        </div>
      </main>
    );
  }

  const status = statusConfig[workOrder.status];
  const StatusIcon = status.icon;
  const priority = priorityColors[workOrder.priority];

  const handleApprove = async () => {
    setActionLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    setWorkOrder((prev) => prev ? { ...prev, status: 'APPROVED', approvedAt: new Date().toISOString() } : prev);
    setShowApprovalModal(false);
    setActionLoading(false);
    setShowVendorModal(true);
  };

  const handleReject = async (reason: string) => {
    setActionLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    // In production, would update status and add rejection note
    setShowApprovalModal(false);
    setActionLoading(false);
  };

  const handleVendorAssign = async (vendorId: string, overrideReason?: string) => {
    setActionLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    setWorkOrder((prev) => prev ? { ...prev, status: 'ASSIGNED', assignedAt: new Date().toISOString() } : prev);
    setShowVendorModal(false);
    setActionLoading(false);
  };

  const handleSignOffComplete = async (tenantSignature: string, technicianSignature: string) => {
    setActionLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    setWorkOrder((prev) => prev ? {
      ...prev,
      status: 'COMPLETED',
      completedAt: new Date().toISOString(),
      completionProof: {
        ...prev.completionProof,
        beforePhotos: [],
        afterPhotos: [],
        notes: '',
        materialsUsed: [],
        laborHours: 2,
        completedBy: workOrder.assignedVendor?.name || '',
        tenantSignature,
        technicianSignature,
      },
    } : prev);
    setShowSignOffModal(false);
    setActionLoading(false);
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setActionLoading(true);
    await new Promise((r) => setTimeout(r, 500));
    setWorkOrder((prev) => prev ? {
      ...prev,
      updates: [
        ...prev.updates,
        {
          timestamp: new Date().toISOString(),
          message: newNote,
          author: 'Jane Mwangi',
          type: 'note',
        },
      ],
    } : prev);
    setNewNote('');
    setActionLoading(false);
  };

  return (
    <>
      <PageHeader
        title={workOrder.workOrderNumber}
        subtitle={workOrder.title}
        showBack
        action={
          <div className="relative">
            <button
              onClick={() => setShowActionsMenu(!showActionsMenu)}
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            {showActionsMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowActionsMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl shadow-lg border py-2 min-w-[180px]">
                  <Link href={`/work-orders/${workOrder.id}/triage`} className="px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-gray-50">
                    <Edit className="w-4 h-4" /> Edit Details
                  </Link>
                  <Link href={`/messaging/new?workOrderId=${workOrder.id}`} className="px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-gray-50">
                    <MessageSquare className="w-4 h-4" /> Message Tenant
                  </Link>
                  {workOrder.status !== 'CANCELLED' && workOrder.status !== 'COMPLETED' && (
                    <button className="w-full px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-gray-50 text-danger-600">
                      <Ban className="w-4 h-4" /> Cancel Order
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        }
      />

      <div className="px-4 py-4 space-y-6 pb-32 max-w-4xl mx-auto">
        {/* Status & Priority */}
        <div className="flex items-center gap-3">
          <span className={status.badge}>
            <StatusIcon className="w-3 h-3 mr-1 inline" />
            {status.label}
          </span>
          <span className={priority.badge}>{workOrder.priority} Priority</span>
        </div>

        {/* SLA Timer */}
        {workOrder.status !== 'COMPLETED' && workOrder.status !== 'CANCELLED' && (
          <SLATimer
            deadline={workOrder.slaDeadline}
            type="resolution"
            priority={workOrder.priority}
          />
        )}

        {/* Property & Tenant Info */}
        <div className="card p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Building2 className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <div className="text-xs text-gray-500">Unit</div>
                <div className="font-medium">{workOrder.unit.unitNumber}</div>
                <div className="text-sm text-gray-500">{workOrder.unit.property}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <User className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <div className="text-xs text-gray-500">Tenant</div>
                <div className="font-medium">{workOrder.customer.name}</div>
                <a href={`tel:${workOrder.customer.phone}`} className="text-sm text-primary-600">
                  {workOrder.customer.phone}
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Issue Details */}
        <section className="card p-4">
          <h2 className="font-medium mb-3">Issue Details</h2>
          <p className="text-gray-600 mb-3">{workOrder.description}</p>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Wrench className="w-4 h-4" />
              {workOrder.category}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {workOrder.location}
            </span>
          </div>
        </section>

        {/* AI Triage Notes */}
        {workOrder.aiTriageNotes && (
          <section className="card p-4 bg-primary-50 border-primary-100">
            <h2 className="font-medium mb-2 text-primary-900 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              AI Triage Analysis
            </h2>
            <p className="text-sm text-primary-700">{workOrder.aiTriageNotes}</p>
          </section>
        )}

        {/* Evidence Photos */}
        {workOrder.photos.length > 0 && (
          <section className="card p-4">
            <h2 className="font-medium mb-3">Evidence Photos</h2>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {workOrder.photos.map((photo, idx) => (
                <div
                  key={idx}
                  className="w-24 h-24 bg-gray-200 rounded-lg flex-shrink-0 flex items-center justify-center"
                >
                  <ImageIcon className="w-8 h-8 text-gray-400" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Assigned Vendor */}
        {workOrder.assignedVendor && (
          <section className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium">Assigned Vendor</h2>
              {workOrder.status === 'ASSIGNED' && (
                <button
                  onClick={() => setShowVendorModal(true)}
                  className="text-sm text-primary-600"
                >
                  Change
                </button>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-primary-700 font-semibold">
                    {workOrder.assignedVendor.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div>
                  <div className="font-medium">{workOrder.assignedVendor.name}</div>
                  <div className="text-sm text-gray-500">{workOrder.assignedVendor.company}</div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="flex items-center gap-0.5">
                      <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                      {workOrder.assignedVendor.rating}
                    </span>
                    <span>{workOrder.assignedVendor.completedJobs} jobs</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <a href={`tel:${workOrder.assignedVendor.phone}`} className="btn-secondary">
                  <Phone className="w-4 h-4" />
                </a>
                <Link href={`/messaging/new?vendorId=${workOrder.assignedVendor.id}`} className="btn-secondary">
                  <MessageSquare className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* Cost Estimate */}
        {workOrder.estimatedCost && (
          <section className="card p-4">
            <h2 className="font-medium mb-3">Cost Estimate</h2>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Estimated</span>
              <span className="text-lg font-semibold">KES {workOrder.estimatedCost.toLocaleString()}</span>
            </div>
            {workOrder.actualCost && (
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                <span className="text-gray-500">Actual</span>
                <span className="text-lg font-semibold text-success-600">
                  KES {workOrder.actualCost.toLocaleString()}
                </span>
              </div>
            )}
          </section>
        )}

        {/* Activity Timeline */}
        <section className="card p-4">
          <h2 className="font-medium mb-4">Activity</h2>
          <div className="space-y-4">
            {workOrder.updates.map((update, idx) => (
              <div key={idx} className="flex gap-3">
                <div className={`w-2 h-2 rounded-full mt-2 ${
                  update.type === 'status' ? 'bg-primary-500' : 'bg-gray-300'
                }`} />
                <div className="flex-1">
                  <p className="text-sm">{update.message}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                    <span>{update.author}</span>
                    <span>•</span>
                    <span>{new Date(update.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add Note */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex gap-2">
              <input
                type="text"
                className="input flex-1"
                placeholder="Add a note..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
              />
              <button
                onClick={handleAddNote}
                disabled={!newNote.trim() || actionLoading}
                className="btn-primary"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
        <div className="max-w-4xl mx-auto">
          {workOrder.status === 'PENDING' && (
            <div className="flex gap-3">
              <button
                onClick={() => setShowApprovalModal(true)}
                className="btn-danger flex-1 py-3"
              >
                Request More Info
              </button>
              <button
                onClick={() => setShowApprovalModal(true)}
                className="btn-primary flex-1 py-3"
              >
                <ThumbsUp className="w-5 h-5 mr-2" />
                Approve
              </button>
            </div>
          )}

          {workOrder.status === 'APPROVED' && (
            <button
              onClick={() => setShowVendorModal(true)}
              className="btn-primary w-full py-3"
            >
              <User className="w-5 h-5 mr-2" />
              Assign Vendor
            </button>
          )}

          {workOrder.status === 'IN_PROGRESS' && (
            <button
              onClick={() => setShowSignOffModal(true)}
              className="btn-primary w-full py-3"
            >
              <UserCheck className="w-5 h-5 mr-2" />
              Complete with Dual Sign-Off
            </button>
          )}

          {workOrder.status === 'COMPLETED' && (
            <div className="text-center text-success-600">
              <CheckCircle className="w-6 h-6 mx-auto mb-1" />
              <span className="text-sm font-medium">Work Order Completed</span>
            </div>
          )}
        </div>
      </div>

      {/* Vendor Assignment Modal */}
      {showVendorModal && (
        <VendorRecommendation
          category={workOrder.category}
          priority={workOrder.priority}
          onAssign={handleVendorAssign}
          onClose={() => setShowVendorModal(false)}
          currentVendorId={workOrder.assignedVendor?.id}
        />
      )}

      {/* Dual Sign-Off Modal */}
      {showSignOffModal && (
        <DualSignOff
          workOrder={workOrder}
          onComplete={handleSignOffComplete}
          onClose={() => setShowSignOffModal(false)}
        />
      )}

      {/* Approval Modal */}
      {showApprovalModal && (
        <ApprovalModal
          workOrder={workOrder}
          onApprove={handleApprove}
          onReject={handleReject}
          onClose={() => setShowApprovalModal(false)}
          loading={actionLoading}
        />
      )}
    </>
  );
}

function ApprovalModal({
  workOrder,
  onApprove,
  onReject,
  onClose,
  loading,
}: {
  workOrder: WorkOrder;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [mode, setMode] = useState<'approve' | 'reject' | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg mx-4 p-6 space-y-4 max-h-[80vh] overflow-y-auto">
        <h3 className="text-lg font-semibold">Work Order Approval</h3>
        
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="font-medium">{workOrder.title}</div>
          <div className="text-sm text-gray-500 mt-1">
            {workOrder.unit.unitNumber} • {workOrder.category} • {workOrder.priority}
          </div>
        </div>

        {!mode && (
          <div className="flex gap-3">
            <button
              onClick={() => setMode('reject')}
              className="btn-secondary flex-1 py-3"
            >
              Request Info
            </button>
            <button
              onClick={onApprove}
              disabled={loading}
              className="btn-primary flex-1 py-3"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Approve'}
            </button>
          </div>
        )}

        {mode === 'reject' && (
          <div className="space-y-4">
            <div>
              <label className="label">Reason for requesting more information</label>
              <textarea
                className="input min-h-[100px]"
                placeholder="What additional information is needed?"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setMode(null)} className="btn-secondary flex-1">
                Back
              </button>
              <button
                onClick={() => onReject(rejectReason)}
                disabled={!rejectReason.trim() || loading}
                className="btn-danger flex-1"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Request'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
