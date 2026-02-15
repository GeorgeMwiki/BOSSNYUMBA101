'use client';

import Link from 'next/link';
import { AlertTriangle, Clock, Timer } from 'lucide-react';
import { PriorityBadge } from './PriorityBadge';
import { SLATimer } from './SLATimer';

export type WorkOrderStatus =
  | 'submitted'
  | 'triaged'
  | 'assigned'
  | 'scheduled'
  | 'in_progress'
  | 'completed';

export interface WorkOrderCardData {
  id: string;
  workOrderNumber: string;
  title: string;
  category: string;
  unit: string;
  property: string;
  status: WorkOrderStatus;
  priority: 'emergency' | 'high' | 'medium' | 'low';
  assignedTo: string | null;
  createdAt: string;
  scheduledDate: string | null;
  sla: {
    responseRemaining: number | null;
    resolutionRemaining: number | null;
    responseBreached: boolean;
    resolutionBreached: boolean;
  };
}

const statusConfig: Record<WorkOrderStatus, { label: string; color: string }> = {
  submitted: { label: 'Submitted', color: 'badge-info' },
  triaged: { label: 'Triaged', color: 'badge-info' },
  assigned: { label: 'Assigned', color: 'badge-warning' },
  scheduled: { label: 'Scheduled', color: 'badge-warning' },
  in_progress: { label: 'In Progress', color: 'badge-warning' },
  completed: { label: 'Completed', color: 'badge-success' },
};

const priorityBorder: Record<string, string> = {
  emergency: 'border-l-danger-500',
  high: 'border-l-warning-500',
  medium: 'border-l-primary-500',
  low: 'border-l-gray-400',
};

interface WorkOrderCardProps {
  workOrder: WorkOrderCardData;
  /** For kanban: make card draggable (no link) */
  isDraggable?: boolean;
}

export function WorkOrderCard({
  workOrder,
  isDraggable = false,
}: WorkOrderCardProps) {
  const status = statusConfig[workOrder.status];
  const hasSLAIssue =
    workOrder.sla.responseBreached || workOrder.sla.resolutionBreached;

  const cardContent = (
    <div
      className={`card p-4 border-l-4 ${priorityBorder[workOrder.priority]} ${
        hasSLAIssue ? 'bg-danger-50' : ''
      } ${isDraggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              {workOrder.workOrderNumber}
            </span>
            {workOrder.priority === 'emergency' && (
              <AlertTriangle className="w-4 h-4 text-danger-500" />
            )}
          </div>
          <div className="font-medium mt-1">{workOrder.title}</div>
        </div>
        <span className={status.color}>{status.label}</span>
      </div>

      <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
        <span>Unit {workOrder.unit}</span>
        <span>{workOrder.category}</span>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <div className="flex items-center gap-4 text-xs">
          {workOrder.sla.responseRemaining !== null &&
            !workOrder.sla.responseBreached && (
              <SLATimer
                minutesRemaining={workOrder.sla.responseRemaining}
                type="response"
                breached={workOrder.sla.responseBreached}
                compact
              />
            )}
          {workOrder.sla.resolutionRemaining !== null &&
            workOrder.status !== 'completed' && (
              <SLATimer
                minutesRemaining={workOrder.sla.resolutionRemaining}
                type="resolution"
                breached={workOrder.sla.resolutionBreached}
                compact
              />
            )}
          {hasSLAIssue && (
            <span className="text-danger-600 font-medium flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              SLA Breached
            </span>
          )}
        </div>
        {workOrder.assignedTo && (
          <span className="text-xs text-gray-400">{workOrder.assignedTo}</span>
        )}
      </div>
    </div>
  );

  if (isDraggable) {
    return cardContent;
  }

  return <Link href={`/work-orders/${workOrder.id}`}>{cardContent}</Link>;
}
