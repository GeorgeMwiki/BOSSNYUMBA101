'use client';

import { cn } from '@bossnyumba/design-system';

export type StatusType =
  | 'active'
  | 'pending'
  | 'expired'
  | 'terminated'
  | 'draft'
  | 'paid'
  | 'overdue'
  | 'processing'
  | 'cancelled'
  | 'renewed';

const statusConfig: Record<
  StatusType,
  { label: string; className: string }
> = {
  active: {
    label: 'Active',
    className:
      'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  pending: {
    label: 'Pending',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  expired: {
    label: 'Expired',
    className: 'bg-gray-100 text-gray-600 border-gray-200',
  },
  terminated: {
    label: 'Terminated',
    className: 'bg-red-50 text-red-700 border-red-200',
  },
  draft: {
    label: 'Draft',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  },
  paid: {
    label: 'Paid',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  overdue: {
    label: 'Overdue',
    className: 'bg-red-50 text-red-700 border-red-200',
  },
  processing: {
    label: 'Processing',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-gray-100 text-gray-600 border-gray-200',
  },
  renewed: {
    label: 'Renewed',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
};

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? {
    label: status,
    className: 'bg-gray-100 text-gray-600 border-gray-200',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        config.className,
        className
      )}
    >
      {label ?? config.label}
    </span>
  );
}
