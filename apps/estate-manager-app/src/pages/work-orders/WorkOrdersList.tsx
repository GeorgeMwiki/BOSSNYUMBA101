'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { WorkOrderCard } from '@/components/maintenance';
import type { WorkOrderCardData } from '@/components/maintenance';
import { KanbanColumn } from './KanbanBoard';
import { KANBAN_COLUMNS, type KanbanColumnId, mockWorkOrders } from './workOrdersData';
import { workOrdersService } from '@bossnyumba/api-client';

// Map API statuses to local card statuses
const apiStatusToCard: Record<string, WorkOrderCardData['status']> = {
  OPEN: 'submitted',
  SUBMITTED: 'submitted',
  TRIAGED: 'triaged',
  ASSIGNED: 'assigned',
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'completed',
};

const statusToColumn: Record<string, KanbanColumnId> = {
  submitted: 'submitted',
  triaged: 'triaged',
  assigned: 'assigned',
  scheduled: 'assigned',
  in_progress: 'in_progress',
  completed: 'completed',
};

const columnToApiStatus: Record<KanbanColumnId, string> = {
  submitted: 'OPEN',
  triaged: 'TRIAGED',
  assigned: 'ASSIGNED',
  in_progress: 'IN_PROGRESS',
  completed: 'COMPLETED',
};

function mapApiWorkOrder(wo: Record<string, unknown>): WorkOrderCardData {
  const sla = wo.sla as Record<string, unknown> | undefined;
  const unit = wo.unit as Record<string, unknown> | undefined;
  const property = wo.property as Record<string, unknown> | undefined;
  const vendor = wo.vendor as Record<string, unknown> | undefined;
  const assignedUser = wo.assignedToUser as Record<string, unknown> | undefined;

  const responseDueAt = sla?.responseDueAt ? new Date(String(sla.responseDueAt)).getTime() : null;
  const resolutionDueAt = sla?.resolutionDueAt ? new Date(String(sla.resolutionDueAt)).getTime() : null;
  const now = Date.now();

  const responseRemaining = responseDueAt && !sla?.respondedAt
    ? Math.round((responseDueAt - now) / (60 * 1000))
    : null;
  const resolutionRemaining = resolutionDueAt && !sla?.resolvedAt
    ? Math.round((resolutionDueAt - now) / (60 * 1000))
    : null;

  const status = String(wo.status ?? 'OPEN');
  const priority = String(wo.priority ?? 'MEDIUM').toLowerCase();

  return {
    id: String(wo.id),
    workOrderNumber: String(wo.workOrderNumber ?? wo.id ?? ''),
    title: String(wo.title ?? ''),
    category: String(wo.category ?? ''),
    unit: String(unit?.unitNumber ?? wo.unitId ?? ''),
    property: String(property?.name ?? wo.propertyId ?? ''),
    status: apiStatusToCard[status] ?? 'submitted',
    priority: (['emergency', 'high', 'medium', 'low'].includes(priority)
      ? priority
      : 'medium') as WorkOrderCardData['priority'],
    assignedTo: assignedUser
      ? String(assignedUser.name ?? assignedUser.email ?? '')
      : vendor
        ? String(vendor.name ?? vendor.companyName ?? '')
        : null,
    createdAt: String(wo.createdAt ?? ''),
    scheduledDate: wo.scheduledDate ? String(wo.scheduledDate) : null,
    sla: {
      responseRemaining,
      resolutionRemaining,
      responseBreached: responseRemaining !== null && responseRemaining < 0,
      resolutionBreached: resolutionRemaining !== null && resolutionRemaining < 0,
    },
  };
}

export default function WorkOrdersList() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Fetch work orders from API
  const { data: apiData, isLoading } = useQuery({
    queryKey: ['workOrders', 'list'],
    queryFn: () => workOrdersService.list(undefined, 1, 200),
    retry: false,
  });

  // Map API data to card format, or fall back to mock data
  const workOrders: WorkOrderCardData[] = useMemo(() => {
    const raw = apiData?.data;
    if (!raw || !Array.isArray(raw) || raw.length === 0) return mockWorkOrders;
    return raw.map((wo: Record<string, unknown>) => mapApiWorkOrder(wo));
  }, [apiData]);

  // Mutation for status changes via drag-and-drop
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return workOrdersService.update(id as never, { status: status as never });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
    },
  });

  const filteredOrders = workOrders.filter((wo) => {
    const matchesSearch =
      !searchQuery ||
      wo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wo.workOrderNumber.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === 'urgent')
      return wo.priority === 'emergency' || wo.priority === 'high';
    if (filter === 'breached')
      return wo.sla.responseBreached || wo.sla.resolutionBreached;
    if (filter === 'open') return wo.status !== 'completed';
    return true;
  });

  const getOrdersByColumn = (columnId: KanbanColumnId) =>
    filteredOrders.filter((wo) => statusToColumn[wo.status] === columnId);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over?.id) return;

    let columnId: KanbanColumnId | undefined;
    if (KANBAN_COLUMNS.some((c) => c.id === over.id)) {
      columnId = over.id as KanbanColumnId;
    } else {
      const targetOrder = workOrders.find((wo) => wo.id === over.id);
      if (targetOrder) {
        columnId = statusToColumn[targetOrder.status];
      }
    }

    if (columnId) {
      const apiStatus = columnToApiStatus[columnId];
      if (apiStatus) {
        updateStatusMutation.mutate({ id: active.id as string, status: apiStatus });
      }
    }
  };

  const activeOrder = activeId
    ? workOrders.find((wo) => wo.id === activeId)
    : null;

  return (
    <>
      <PageHeader
        title="Work Orders"
        subtitle={`${filteredOrders.length} tasks`}
        action={
          <Link href="/work-orders/new" className="btn-primary text-sm">
            <Plus className="w-4 h-4" />
          </Link>
        }
      />

      <div className="px-4 py-4 space-y-4">
        {/* Search and Filter */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search work orders..."
              className="input pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            className="input w-auto"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="urgent">Urgent</option>
            <option value="breached">SLA Breached</option>
          </select>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('kanban')}
            className={`btn text-sm flex-1 ${
              viewMode === 'kanban' ? 'btn-primary' : 'btn-secondary'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            Board
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`btn text-sm flex-1 ${
              viewMode === 'list' ? 'btn-primary' : 'btn-secondary'
            }`}
          >
            <List className="w-4 h-4" />
            List
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : (
          <>
            {/* List View */}
            {viewMode === 'list' && (
              <div className="space-y-3">
                {filteredOrders.map((wo) => (
                  <WorkOrderCard key={wo.id} workOrder={wo} />
                ))}
              </div>
            )}

            {/* Kanban Board */}
            {viewMode === 'kanban' && (
              <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4">
                  {KANBAN_COLUMNS.map((column) => (
                    <KanbanColumn
                      key={column.id}
                      id={column.id}
                      title={column.title}
                      orders={getOrdersByColumn(column.id)}
                    />
                  ))}
                </div>

                <DragOverlay>
                  {activeOrder ? (
                    <div className="opacity-90 rotate-2 scale-105">
                      <WorkOrderCard workOrder={activeOrder} />
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}

            {filteredOrders.length === 0 && (
              <div className="text-center py-12">
                <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="font-medium text-gray-900">No work orders</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {searchQuery || filter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Create your first work order to get started'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
