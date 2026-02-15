'use client';

import Link from 'next/link';
import { Clock, CheckCircle, Wrench, AlertCircle } from 'lucide-react';

export type RequestStatus = 'submitted' | 'in_progress' | 'scheduled' | 'completed';

export type RequestPriority = 'emergency' | 'high' | 'normal' | 'low';

export interface MaintenanceRequest {
  id: string;
  workOrderNumber: string;
  title: string;
  category: string;
  status: RequestStatus;
  priority: RequestPriority;
  createdAt: string;
  scheduledDate?: string;
}

const statusConfig: Record<
  RequestStatus,
  { label: string; icon: React.ElementType; color: string }
> = {
  submitted: { label: 'Submitted', icon: Clock, color: 'badge-info' },
  in_progress: { label: 'In Progress', icon: Wrench, color: 'badge-warning' },
  scheduled: { label: 'Scheduled', icon: Clock, color: 'badge-info' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'badge-success' },
};

const priorityColors: Record<RequestPriority, string> = {
  emergency: 'border-l-red-500',
  high: 'border-l-amber-500',
  normal: 'border-l-primary-500',
  low: 'border-l-gray-400',
};

interface RequestCardProps {
  request: MaintenanceRequest;
  href?: string;
}

export function RequestCard({ request, href }: RequestCardProps) {
  const status = statusConfig[request.status];
  const StatusIcon = status.icon;
  const linkHref = href ?? `/requests/${request.id}`;

  return (
    <Link href={linkHref}>
      <div
        className={`card p-4 border-l-4 ${priorityColors[request.priority]} transition-shadow hover:shadow-md`}
      >
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="text-xs text-gray-400 mb-1">{request.workOrderNumber}</div>
            <div className="font-medium">{request.title}</div>
          </div>
          <span className={status.color}>
            <StatusIcon className="w-3 h-3 mr-1 inline" />
            {status.label}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>{request.category}</span>
          {request.scheduledDate && (
            <span>Scheduled: {new Date(request.scheduledDate).toLocaleDateString()}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
