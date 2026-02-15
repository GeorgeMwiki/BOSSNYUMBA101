'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  Phone,
  Calendar,
  MessageSquare,
  Image as ImageIcon,
  ChevronRight,
  Star,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  Wrench,
  ArrowLeft,
  Play,
  Loader2,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { ServiceRating } from '@/components/maintenance/ServiceRating';

type RequestStatus = 'submitted' | 'acknowledged' | 'in_progress' | 'completed' | 'disputed';

interface StatusStep {
  id: RequestStatus;
  label: string;
  description: string;
  timestamp?: string;
}

interface MaintenanceRequest {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: RequestStatus;
  createdAt: string;
  acknowledgedAt?: string;
  inProgressAt?: string;
  completedAt?: string;
  estimatedCompletion?: string;
  slaDeadline: string;
  location: string;
  photos: string[];
  voiceNoteUrl?: string;
  assignedTo?: {
    name: string;
    phone: string;
    company: string;
  };
  updates: {
    timestamp: string;
    message: string;
    type: 'status' | 'note' | 'photo';
  }[];
  completionProof?: {
    photos: string[];
    notes: string;
    completedBy: string;
  };
  rating?: {
    score: number;
    comment: string;
  };
}

// Mock data
const MOCK_REQUEST: MaintenanceRequest = {
  id: 'req-1',
  title: 'Kitchen sink is leaking',
  description: 'There is a slow drip from the pipe under the kitchen sink. Getting worse over the past few days.',
  category: 'Plumbing',
  priority: 'Medium',
  status: 'completed',
  createdAt: '2024-02-10T09:30:00Z',
  acknowledgedAt: '2024-02-10T10:15:00Z',
  inProgressAt: '2024-02-11T14:00:00Z',
  completedAt: '2024-02-11T16:30:00Z',
  slaDeadline: '2024-02-13T09:30:00Z',
  estimatedCompletion: '2024-02-12T18:00:00Z',
  location: 'Kitchen, under the sink',
  photos: ['/placeholder-1.jpg', '/placeholder-2.jpg'],
  assignedTo: {
    name: 'John Mwangi',
    phone: '+254 712 345 678',
    company: 'Quick Fix Plumbing',
  },
  updates: [
    {
      timestamp: '2024-02-10T09:30:00Z',
      message: 'Request submitted',
      type: 'status',
    },
    {
      timestamp: '2024-02-10T10:15:00Z',
      message: 'Request acknowledged by management. Plumber will be scheduled.',
      type: 'status',
    },
    {
      timestamp: '2024-02-11T09:00:00Z',
      message: 'Plumber scheduled to visit between 2:00 PM - 4:00 PM today.',
      type: 'note',
    },
    {
      timestamp: '2024-02-11T14:00:00Z',
      message: 'Technician arrived and started work.',
      type: 'status',
    },
    {
      timestamp: '2024-02-11T16:30:00Z',
      message: 'Work completed. Replaced faulty pipe fitting and tested for leaks.',
      type: 'status',
    },
  ],
  completionProof: {
    photos: ['/completion-1.jpg', '/completion-2.jpg'],
    notes: 'Replaced the P-trap and tightened all connections. No more leaks detected.',
    completedBy: 'John Mwangi',
  },
};

const STATUS_STEPS: StatusStep[] = [
  { id: 'submitted', label: 'Submitted', description: 'Your request has been received' },
  { id: 'acknowledged', label: 'Acknowledged', description: 'Management is reviewing your request' },
  { id: 'in_progress', label: 'In Progress', description: 'A technician is working on the issue' },
  { id: 'completed', label: 'Completed', description: 'The work has been finished' },
];

const statusOrder: RequestStatus[] = ['submitted', 'acknowledged', 'in_progress', 'completed'];

const priorityColors: Record<string, string> = {
  Emergency: 'badge-danger',
  High: 'badge-warning',
  Medium: 'badge-info',
  Low: 'badge-gray',
};

export default function MaintenanceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [request, setRequest] = useState<MaintenanceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [confirmingCompletion, setConfirmingCompletion] = useState(false);

  useEffect(() => {
    // Simulate API fetch
    const timer = setTimeout(() => {
      setRequest(MOCK_REQUEST);
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

  if (!request) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h2 className="font-semibold text-gray-900">Request Not Found</h2>
          <p className="text-sm text-gray-500 mt-1">This maintenance request doesn&apos;t exist.</p>
          <Link href="/maintenance" className="btn-primary mt-4">
            Back to Requests
          </Link>
        </div>
      </main>
    );
  }

  const currentStatusIndex = statusOrder.indexOf(request.status);
  const isCompleted = request.status === 'completed';
  const needsConfirmation = isCompleted && !request.rating;

  const handleConfirmCompletion = async () => {
    setConfirmingCompletion(true);
    // Simulate API call
    await new Promise((r) => setTimeout(r, 1000));
    setConfirmingCompletion(false);
    setShowRatingModal(true);
  };

  const handleRatingSubmit = async (score: number, comment: string) => {
    // Simulate API call
    await new Promise((r) => setTimeout(r, 500));
    setRequest((prev) =>
      prev ? { ...prev, rating: { score, comment } } : prev
    );
    setShowRatingModal(false);
  };

  const handleDispute = async (reason: string) => {
    // Simulate API call
    await new Promise((r) => setTimeout(r, 500));
    setRequest((prev) =>
      prev ? { ...prev, status: 'disputed' } : prev
    );
    setShowDisputeModal(false);
  };

  return (
    <>
      <PageHeader title="Request Details" showBack />

      <div className="px-4 py-4 space-y-6 pb-32">
        {/* Request Header */}
        <div className="card p-4">
          <div className="flex items-start justify-between mb-3">
            <span className={priorityColors[request.priority]}>
              {request.priority} Priority
            </span>
            <span className="text-xs text-gray-400">#{request.id}</span>
          </div>
          <h1 className="text-xl font-semibold mb-2">{request.title}</h1>
          <p className="text-gray-600 text-sm">{request.description}</p>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Wrench className="w-3 h-3" />
              {request.category}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(request.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Status Timeline */}
        <section className="card p-4">
          <h2 className="font-medium mb-4">Status</h2>
          <div className="space-y-4">
            {STATUS_STEPS.map((step, index) => {
              const isPast = index <= currentStatusIndex;
              const isCurrent = statusOrder[index] === request.status;
              const timestamp = 
                step.id === 'submitted' ? request.createdAt :
                step.id === 'acknowledged' ? request.acknowledgedAt :
                step.id === 'in_progress' ? request.inProgressAt :
                step.id === 'completed' ? request.completedAt : undefined;

              return (
                <div key={step.id} className="flex gap-3">
                  {/* Timeline connector */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isPast
                          ? 'bg-success-500 text-white'
                          : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      {isPast ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <Clock className="w-4 h-4" />
                      )}
                    </div>
                    {index < STATUS_STEPS.length - 1 && (
                      <div
                        className={`w-0.5 h-8 ${
                          index < currentStatusIndex ? 'bg-success-500' : 'bg-gray-200'
                        }`}
                      />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${isPast ? '' : 'text-gray-400'}`}>
                        {step.label}
                      </span>
                      {isCurrent && (
                        <span className="badge-primary text-xs">Current</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{step.description}</p>
                    {timestamp && (
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(timestamp).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SLA Info */}
        {!isCompleted && (
          <div className="card p-4 bg-primary-50 border-primary-100">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-primary-600" />
              <div>
                <div className="font-medium text-primary-900">Expected Resolution</div>
                <div className="text-sm text-primary-700">
                  {request.estimatedCompletion
                    ? new Date(request.estimatedCompletion).toLocaleString()
                    : `By ${new Date(request.slaDeadline).toLocaleString()}`}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Assigned Technician */}
        {request.assignedTo && (
          <section className="card p-4">
            <h2 className="font-medium mb-3">Assigned Technician</h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-gray-500" />
                </div>
                <div>
                  <div className="font-medium">{request.assignedTo.name}</div>
                  <div className="text-sm text-gray-500">{request.assignedTo.company}</div>
                </div>
              </div>
              <a
                href={`tel:${request.assignedTo.phone}`}
                className="btn-secondary"
              >
                <Phone className="w-4 h-4" />
              </a>
            </div>
          </section>
        )}

        {/* Photos */}
        {request.photos.length > 0 && (
          <section className="card p-4">
            <h2 className="font-medium mb-3">Your Photos</h2>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {request.photos.map((photo, idx) => (
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

        {/* Completion Proof */}
        {request.completionProof && (
          <section className="card p-4">
            <h2 className="font-medium mb-3 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-success-500" />
              Completion Report
            </h2>
            <p className="text-sm text-gray-600 mb-3">{request.completionProof.notes}</p>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {request.completionProof.photos.map((photo, idx) => (
                <div
                  key={idx}
                  className="w-24 h-24 bg-gray-200 rounded-lg flex-shrink-0 flex items-center justify-center"
                >
                  <ImageIcon className="w-8 h-8 text-gray-400" />
                </div>
              ))}
            </div>
            <div className="text-xs text-gray-400 mt-2">
              Completed by {request.completionProof.completedBy}
            </div>
          </section>
        )}

        {/* Updates Timeline */}
        <section className="card p-4">
          <h2 className="font-medium mb-3">Activity</h2>
          <div className="space-y-4">
            {request.updates.map((update, idx) => (
              <div key={idx} className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-gray-300 mt-2" />
                <div className="flex-1">
                  <p className="text-sm">{update.message}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(update.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Rating (if completed and rated) */}
        {request.rating && (
          <section className="card p-4 bg-success-50 border-success-200">
            <h2 className="font-medium mb-2 text-success-900">Your Rating</h2>
            <div className="flex items-center gap-1 mb-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-5 h-5 ${
                    star <= request.rating!.score
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-gray-300'
                  }`}
                />
              ))}
            </div>
            <p className="text-sm text-success-700">{request.rating.comment}</p>
          </section>
        )}

        {/* Chat Link */}
        <Link
          href={`/chat?requestId=${request.id}`}
          className="card p-4 flex items-center gap-3"
        >
          <MessageSquare className="w-5 h-5 text-primary-600" />
          <div className="flex-1">
            <div className="font-medium">Questions about this request?</div>
            <div className="text-sm text-gray-500">Message management</div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </Link>
      </div>

      {/* Confirmation Actions (for completed requests) */}
      {needsConfirmation && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
          <div className="mb-3 p-3 bg-warning-50 rounded-lg text-sm text-warning-700">
            <AlertTriangle className="w-4 h-4 inline mr-1" />
            Please confirm if the work was completed satisfactorily.
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowDisputeModal(true)}
              className="btn-secondary flex-1 py-3 flex items-center justify-center gap-2"
            >
              <ThumbsDown className="w-5 h-5" />
              Report Issue
            </button>
            <button
              onClick={handleConfirmCompletion}
              disabled={confirmingCompletion}
              className="btn-primary flex-1 py-3 flex items-center justify-center gap-2"
            >
              {confirmingCompletion ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ThumbsUp className="w-5 h-5" />
              )}
              Confirm Complete
            </button>
          </div>
        </div>
      )}

      {/* Rating Modal */}
      {showRatingModal && (
        <ServiceRating
          onSubmit={handleRatingSubmit}
          onClose={() => setShowRatingModal(false)}
          technicianName={request.assignedTo?.name}
        />
      )}

      {/* Dispute Modal */}
      {showDisputeModal && (
        <DisputeModal
          onSubmit={handleDispute}
          onClose={() => setShowDisputeModal(false)}
        />
      )}
    </>
  );
}

function DisputeModal({
  onSubmit,
  onClose,
}: {
  onSubmit: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const disputeCategories = [
    'Issue not fixed',
    'Work incomplete',
    'New problem created',
    'Damage to property',
    'Other',
  ];

  const handleSubmit = async () => {
    if (!category) return;
    setSubmitting(true);
    await onSubmit(`${category}: ${reason}`);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
      <div className="bg-white w-full max-w-lg rounded-t-2xl p-4 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Report Issue</h3>
          <button onClick={onClose} className="p-2 text-gray-400">
            ×
          </button>
        </div>

        <p className="text-sm text-gray-500">
          Please let us know what&apos;s wrong with the completed work.
        </p>

        <div className="space-y-2">
          <label className="label">What&apos;s the issue?</label>
          <div className="flex flex-wrap gap-2">
            {disputeCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-2 rounded-full text-sm border transition-colors ${
                  category === cat
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Additional details</label>
          <textarea
            className="input min-h-[100px]"
            placeholder="Please describe the issue in detail..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1 py-3">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!category || submitting}
            className="btn-danger flex-1 py-3"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit Dispute'}
          </button>
        </div>
      </div>
    </div>
  );
}
