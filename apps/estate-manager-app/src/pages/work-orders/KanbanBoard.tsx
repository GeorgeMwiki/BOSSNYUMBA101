'use client';

import { useDroppable, useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import type { WorkOrderCardData } from '@/components/maintenance';
import type { KanbanColumnId } from './workOrdersData';

interface KanbanColumnProps {
  id: KanbanColumnId;
  title: string;
  orders: WorkOrderCardData[];
}

export function KanbanColumn({ id, title, orders }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`kanban-column min-h-[200px] ${
        isOver ? 'ring-2 ring-primary-500 ring-offset-2 rounded-xl' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-sm">{title}</h3>
        <span className="badge-gray">{orders.length}</span>
      </div>
      <div className="space-y-2">
        {orders.map((wo) => (
          <KanbanCard key={wo.id} workOrder={wo} />
        ))}
      </div>
    </div>
  );
}

interface KanbanCardProps {
  workOrder: WorkOrderCardData;
}

function KanbanCard({ workOrder }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: workOrder.id });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  const priorityConfig: Record<string, string> = {
    emergency: 'badge-danger',
    high: 'badge-warning',
    medium: 'badge-info',
    low: 'badge-gray',
  };

  return (
    <Link href={`/work-orders/${workOrder.id}`}>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`kanban-card ${isDragging ? 'opacity-50' : ''}`}
      >
        <div className="text-xs text-gray-400 mb-1">{workOrder.workOrderNumber}</div>
        <div className="font-medium text-sm mb-2">{workOrder.title}</div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Unit {workOrder.unit}</span>
          <span className={priorityConfig[workOrder.priority]}>
            {workOrder.priority.charAt(0).toUpperCase() + workOrder.priority.slice(1)}
          </span>
        </div>
      </div>
    </Link>
  );
}
