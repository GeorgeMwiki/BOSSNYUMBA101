'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, workOrdersService } from '@bossnyumba/api-client';
import {
  AlertTriangle,
  Clock,
  Tag,
  Calendar,
  MapPin,
  Star,
  CheckCircle2,
  CircleDot,
  Timer,
  ArrowUpCircle,
  Paperclip,
  ExternalLink,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

interface WorkOrder {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  location?: string;
  createdAt: string;
  updatedAt: string;
  scheduledDate?: string;
  scheduledTimeSlot?: string;
  completionNotes?: string;
  attachments?: Array<{ type: string; url: string; filename: string }>;
  sla?: {
    responseDeadline?: string;
    resolutionDeadline?: string;
    breached?: boolean;
    pausedAt?: string;
  };
  timeline?: Array<{
    id: string;
    action: string;
    description?: string;
    createdAt: string;
    actor?: string;
  }>;
  rating?: {
    rating: number;
    feedback?: string;
  };
}

function getStatusColor(status: string) {
  switch (status) {
    case 'OPEN':
    case 'NEW':
      return 'bg-blue-500/20 text-blue-400';
    case 'IN_PROGRESS':
    case 'ASSIGNED':
      return 'bg-warning-500/20 text-warning-400';
    case 'COMPLETED':
    case 'RESOLVED':
      return 'bg-green-500/20 text-green-400';
    case 'CANCELLED':
      return 'bg-red-500/20 text-red-400';
    case 'SCHEDULED':
      return 'bg-purple-500/20 text-purple-400';
    default:
      return 'bg-gray-500/20 text-gray-400';
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'URGENT':
    case 'EMERGENCY':
      return 'bg-red-500/20 text-red-400';
    case 'HIGH':
      return 'bg-warning-500/20 text-warning-400';
    case 'MEDIUM':
      return 'bg-blue-500/20 text-blue-400';
    case 'LOW':
      return 'bg-green-500/20 text-green-400';
    default:
      return 'bg-gray-500/20 text-gray-400';
  }
}

function getTimelineIcon(action: string) {
  switch (action) {
    case 'CREATED':
      return <CircleDot className="w-4 h-4" />;
    case 'ASSIGNED':
    case 'SCHEDULED':
      return <Clock className="w-4 h-4" />;
    case 'IN_PROGRESS':
    case 'STARTED':
      return <Timer className="w-4 h-4" />;
    case 'COMPLETED':
    case 'RESOLVED':
      return <CheckCircle2 className="w-4 h-4" />;
    case 'ESCALATED':
      return <ArrowUpCircle className="w-4 h-4" />;
    default:
      return <CircleDot className="w-4 h-4" />;
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function DetailSkeleton() {
  return (
    <div className="px-4 pt-4 pb-24 space-y-6 animate-pulse">
      <div className="space-y-3">
        <div className="h-6 w-3/4 bg-surface-card rounded" />
        <div className="flex gap-2">
          <div className="h-6 w-20 bg-surface-card rounded-full" />
          <div className="h-6 w-16 bg-surface-card rounded-full" />
          <div className="h-6 w-24 bg-surface-card rounded-full" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-4 w-full bg-surface-card rounded" />
        <div className="h-4 w-5/6 bg-surface-card rounded" />
        <div className="h-4 w-2/3 bg-surface-card rounded" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-surface-card rounded-xl" />
        ))}
      </div>
      <div className="space-y-3">
        <div className="h-4 w-20 bg-surface-card rounded" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="w-8 h-8 bg-surface-card rounded-full" />
            <div className="flex-1 space-y-1">
              <div className="h-3 w-24 bg-surface-card rounded" />
              <div className="h-3 w-40 bg-surface-card rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
      <AlertTriangle className="w-12 h-12 text-warning-400 mb-4" />
      <h2 className="text-lg font-semibold text-white mb-2">Failed to load maintenance request</h2>
      <p className="text-gray-400 text-sm mb-6">Something went wrong. Please try again.</p>
      <button onClick={onRetry} className="btn-primary px-6 py-2">
        Retry
      </button>
    </div>
  );
}

function RatingSection({ workOrderId, onRated }: { workOrderId: string; onRated: () => void }) {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0 || submitting) return;
    setSubmitting(true);
    try {
      await workOrdersService.rate(workOrderId, { rating, feedback: feedback || undefined });
      setSubmitted(true);
      onRated();
    } catch {
      // allow retry
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-surface-card rounded-xl p-4 text-center">
        <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
        <p className="text-white text-sm font-medium">Thank you for your feedback!</p>
      </div>
    );
  }

  return (
    <div className="bg-surface-card rounded-xl p-4 space-y-3">
      <h3 className="text-white font-medium">Rate this request</h3>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => setRating(star)}
            className="p-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={`Rate ${star} stars`}
          >
            <Star
              className={`w-7 h-7 ${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`}
            />
          </button>
        ))}
      </div>
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Optional feedback..."
        rows={2}
        className="w-full bg-white/5 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary-500"
      />
      <button
        onClick={handleSubmit}
        disabled={rating === 0 || submitting}
        className="btn-primary w-full py-2.5 text-sm disabled:opacity-50"
      >
        {submitting ? 'Submitting...' : 'Submit Rating'}
      </button>
    </div>
  );
}

export default function MaintenanceDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: workOrder, isLoading, isError, refetch } = useQuery<WorkOrder>(
    `/work-orders/${id}`,
    { enabled: !!id }
  );

  const isCompleted = workOrder?.status === 'COMPLETED' || workOrder?.status === 'RESOLVED';

  return (
    <div>
      <PageHeader title="Maintenance Request" showBack />

      {isLoading ? (
        <DetailSkeleton />
      ) : isError ? (
        <DetailError onRetry={refetch} />
      ) : workOrder ? (
        <div className="px-4 pt-4 pb-24 space-y-6">
          {/* Title and badges */}
          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-white">{workOrder.title}</h2>
            <div className="flex flex-wrap gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(workOrder.status)}`}>
                {workOrder.status.replace(/_/g, ' ')}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(workOrder.priority)}`}>
                {workOrder.priority}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400">
                {workOrder.category?.replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-400">Description</h3>
            <p className="text-sm text-gray-300 leading-relaxed">{workOrder.description}</p>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface-card rounded-xl p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-gray-400">
                <Calendar className="w-4 h-4" />
                <span className="text-xs">Created</span>
              </div>
              <p className="text-sm text-white">{formatDate(workOrder.createdAt)}</p>
            </div>
            {workOrder.location && (
              <div className="bg-surface-card rounded-xl p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-gray-400">
                  <MapPin className="w-4 h-4" />
                  <span className="text-xs">Location</span>
                </div>
                <p className="text-sm text-white">{workOrder.location}</p>
              </div>
            )}
            {workOrder.scheduledDate && (
              <div className="bg-surface-card rounded-xl p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-gray-400">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs">Scheduled</span>
                </div>
                <p className="text-sm text-white">
                  {new Date(workOrder.scheduledDate).toLocaleDateString()}
                  {workOrder.scheduledTimeSlot && ` ${workOrder.scheduledTimeSlot}`}
                </p>
              </div>
            )}
            <div className="bg-surface-card rounded-xl p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-gray-400">
                <Tag className="w-4 h-4" />
                <span className="text-xs">Category</span>
              </div>
              <p className="text-sm text-white">{workOrder.category?.replace(/_/g, ' ')}</p>
            </div>
          </div>

          {/* SLA Info */}
          {workOrder.sla && (
            <div className="bg-surface-card rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-medium text-white">SLA Information</h3>
              {workOrder.sla.responseDeadline && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Response by</span>
                  <span className={workOrder.sla.breached ? 'text-red-400' : 'text-gray-300'}>
                    {formatDate(workOrder.sla.responseDeadline)}
                  </span>
                </div>
              )}
              {workOrder.sla.resolutionDeadline && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Resolution by</span>
                  <span className={workOrder.sla.breached ? 'text-red-400' : 'text-gray-300'}>
                    {formatDate(workOrder.sla.resolutionDeadline)}
                  </span>
                </div>
              )}
              {workOrder.sla.breached && (
                <div className="flex items-center gap-1.5 text-red-400 text-sm mt-1">
                  <AlertTriangle className="w-4 h-4" />
                  <span>SLA breached</span>
                </div>
              )}
            </div>
          )}

          {/* Attachments */}
          {workOrder.attachments && workOrder.attachments.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-400">Attachments</h3>
              <div className="space-y-2">
                {workOrder.attachments.map((attachment, idx) => (
                  <a
                    key={idx}
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-surface-card rounded-xl p-3 hover:bg-white/10 transition-colors"
                  >
                    <div className="p-2 bg-primary-500/20 rounded-lg">
                      <Paperclip className="w-4 h-4 text-primary-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{attachment.filename}</p>
                      <p className="text-xs text-gray-500">{attachment.type}</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          {workOrder.timeline && workOrder.timeline.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-400">Status Timeline</h3>
              <div className="space-y-0">
                {workOrder.timeline.map((entry, idx) => (
                  <div key={entry.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="p-1.5 bg-surface-card rounded-full text-gray-400">
                        {getTimelineIcon(entry.action)}
                      </div>
                      {idx < workOrder.timeline!.length - 1 && (
                        <div className="w-px flex-1 bg-white/10 my-1" />
                      )}
                    </div>
                    <div className="pb-4">
                      <p className="text-sm text-white font-medium">
                        {entry.action.replace(/_/g, ' ')}
                      </p>
                      {entry.description && (
                        <p className="text-sm text-gray-400 mt-0.5">{entry.description}</p>
                      )}
                      {entry.actor && (
                        <p className="text-xs text-gray-500 mt-0.5">by {entry.actor}</p>
                      )}
                      <span className="text-xs text-gray-500 mt-0.5 block">
                        {formatDate(entry.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completion notes */}
          {workOrder.completionNotes && (
            <div className="bg-surface-card rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-medium text-white">Completion Notes</h3>
              <p className="text-sm text-gray-300">{workOrder.completionNotes}</p>
            </div>
          )}

          {/* Existing rating display */}
          {workOrder.rating && (
            <div className="bg-surface-card rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-medium text-white">Your Rating</h3>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-5 h-5 ${
                      star <= workOrder.rating!.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'
                    }`}
                  />
                ))}
              </div>
              {workOrder.rating.feedback && (
                <p className="text-sm text-gray-400 mt-1">{workOrder.rating.feedback}</p>
              )}
            </div>
          )}

          {/* Rating section for completed orders without rating */}
          {isCompleted && !workOrder.rating && (
            <RatingSection workOrderId={workOrder.id} onRated={refetch} />
          )}
        </div>
      ) : null}
    </div>
  );
}
