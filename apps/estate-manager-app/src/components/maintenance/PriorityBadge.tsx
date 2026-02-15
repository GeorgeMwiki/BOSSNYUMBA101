'use client';

export type WorkOrderPriority = 'emergency' | 'high' | 'medium' | 'low';

const priorityConfig: Record<
  WorkOrderPriority,
  { label: string; className: string; dotColor: string }
> = {
  emergency: {
    label: 'Emergency',
    className: 'badge-danger',
    dotColor: 'bg-danger-500',
  },
  high: {
    label: 'High',
    className: 'badge-warning',
    dotColor: 'bg-warning-500',
  },
  medium: {
    label: 'Medium',
    className: 'badge-info',
    dotColor: 'bg-primary-500',
  },
  low: {
    label: 'Low',
    className: 'badge-gray',
    dotColor: 'bg-gray-400',
  },
};

interface PriorityBadgeProps {
  priority: WorkOrderPriority;
  showDot?: boolean;
  size?: 'sm' | 'md';
}

export function PriorityBadge({
  priority,
  showDot = false,
  size = 'md',
}: PriorityBadgeProps) {
  const config = priorityConfig[priority];

  return (
    <span
      className={`${config.className} inline-flex items-center gap-1.5 ${
        size === 'sm' ? 'text-[10px] px-1.5 py-0' : ''
      }`}
    >
      {showDot && (
        <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
      )}
      {config.label}
    </span>
  );
}
