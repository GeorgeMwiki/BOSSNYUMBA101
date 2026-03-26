import type { WorkOrderCardData } from '@/components/maintenance';

export const KANBAN_COLUMNS = [
  { id: 'submitted', title: 'Submitted' },
  { id: 'triaged', title: 'Triaged' },
  { id: 'assigned', title: 'Assigned' },
  { id: 'in_progress', title: 'In Progress' },
  { id: 'completed', title: 'Completed' },
] as const;

export type KanbanColumnId = (typeof KANBAN_COLUMNS)[number]['id'];

export const initialWorkOrders: WorkOrderCardData[] = [];
