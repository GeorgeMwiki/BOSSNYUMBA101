/**
 * Maintenance API Service
 *
 * Customer-app oriented wrapper for the maintenance / work-orders
 * backend. Exposes a simple `createTicket` / `listTickets` / `closeTicket`
 * surface so that the resident-facing MaintenancePage can talk to the
 * backend without dealing with the richer manager-side work-order shape.
 */

import { getApiClient, ApiResponse } from '../client';
import type {
  WorkOrder,
  WorkOrderId,
  WorkOrderPriority,
  WorkOrderCategory,
} from '@bossnyumba/domain-models';

export interface CreateMaintenanceTicketInput {
  tenantId: string;
  title: string;
  description: string;
  category: WorkOrderCategory | string;
  priority: WorkOrderPriority | string;
  photos?: Array<{ url: string; filename: string; type?: string }>;
  propertyId?: string;
  unitId?: string;
  location?: string;
}

export interface ListMaintenanceTicketsInput {
  tenantId: string;
  status?: 'open' | 'closed' | 'all';
  limit?: number;
  page?: number;
}

export interface CloseMaintenanceTicketInput {
  ticketId: WorkOrderId | string;
  resolutionNotes?: string;
}

export const maintenanceService = {
  /**
   * Create a new maintenance ticket (backed by work-orders).
   */
  async createTicket(
    input: CreateMaintenanceTicketInput
  ): Promise<ApiResponse<WorkOrder>> {
    const body = {
      tenantId: input.tenantId,
      title: input.title,
      description: input.description,
      category: input.category,
      priority: input.priority,
      propertyId: input.propertyId,
      unitId: input.unitId,
      location: input.location,
      attachments: (input.photos ?? []).map((p) => ({
        type: p.type ?? 'photo',
        url: p.url,
        filename: p.filename,
      })),
    };
    return getApiClient().post<WorkOrder>('/api/maintenance/tickets', body);
  },

  /**
   * List maintenance tickets for the given tenant.
   * `status: 'open'` returns tickets that are not yet completed/cancelled.
   */
  async listTickets(
    input: ListMaintenanceTicketsInput
  ): Promise<ApiResponse<WorkOrder[]>> {
    const params: Record<string, string> = {
      tenantId: input.tenantId,
      limit: String(input.limit ?? 20),
      page: String(input.page ?? 1),
    };
    if (input.status && input.status !== 'all') {
      params.status = input.status;
    }
    return getApiClient().get<WorkOrder[]>('/api/maintenance/tickets', {
      params,
    });
  },

  /**
   * Close an open ticket.
   */
  async closeTicket(
    input: CloseMaintenanceTicketInput
  ): Promise<ApiResponse<WorkOrder>> {
    return getApiClient().post<WorkOrder>(
      `/api/maintenance/tickets/${input.ticketId}/close`,
      { resolutionNotes: input.resolutionNotes }
    );
  },
};

/**
 * Namespaced alias used by customer-app surfaces that expect
 * `maintenance.createTicket(...)` / `maintenance.listTickets(...)`.
 */
export const maintenance = {
  createTicket: maintenanceService.createTicket,
  listTickets: maintenanceService.listTickets,
  closeTicket: maintenanceService.closeTicket,
};
