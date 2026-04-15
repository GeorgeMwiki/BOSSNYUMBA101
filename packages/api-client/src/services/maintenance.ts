/**
 * Maintenance Tickets API Service
 *
 * Customer-facing maintenance intake. A "ticket" is a customer-side view of a
 * work order. Under the hood this calls `/maintenance/tickets` on the gateway
 * which bridges to the work-order domain service.
 */

import { getApiClient, type ApiResponse } from '../client';

export type MaintenanceTicketStatus =
  | 'submitted'
  | 'triaged'
  | 'pending_approval'
  | 'approved'
  | 'assigned'
  | 'scheduled'
  | 'in_progress'
  | 'pending_verification'
  | 'completed'
  | 'cancelled';

export type MaintenanceTicketPriority = 'emergency' | 'high' | 'medium' | 'low';

export type MaintenanceTicketCategory =
  | 'plumbing'
  | 'electrical'
  | 'appliance'
  | 'hvac'
  | 'structural'
  | 'pest_control'
  | 'security'
  | 'cleaning'
  | 'landscaping'
  | 'other';

export interface MaintenanceTicketAttachment {
  type: 'image' | 'video' | 'audio' | 'document';
  url: string;
  filename: string;
}

export interface MaintenanceTicket {
  id: string;
  tenantId: string;
  ticketNumber: string;
  workOrderNumber?: string;
  propertyId?: string;
  unitId?: string;
  customerId?: string;
  vendorId?: string;
  title: string;
  description?: string;
  location?: string;
  category: MaintenanceTicketCategory | string;
  priority: MaintenanceTicketPriority | string;
  status: MaintenanceTicketStatus | string;
  attachments?: MaintenanceTicketAttachment[];
  scheduledDate?: string;
  completedAt?: string;
  completionNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListTicketsFilter {
  tenantId?: string;
  status?: MaintenanceTicketStatus | MaintenanceTicketStatus[];
  customerId?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateTicketRequest {
  propertyId?: string;
  unitId?: string;
  customerId?: string;
  category: MaintenanceTicketCategory | string;
  priority: MaintenanceTicketPriority | string;
  title: string;
  description: string;
  location?: string;
  attachments?: MaintenanceTicketAttachment[];
  permissionToEnter?: boolean;
  entryInstructions?: string;
}

export interface RateTicketRequest {
  rating: number; // 1..5
  feedback?: string;
  tags?: string[];
  wouldRecommend?: boolean;
  categoryRatings?: Record<string, number>;
}

export const maintenanceService = {
  /**
   * List maintenance tickets for the authenticated customer (or filtered set).
   * Calls GET /api/v1/maintenance/tickets
   */
  async list(filter: ListTicketsFilter = {}): Promise<ApiResponse<MaintenanceTicket[]>> {
    const params: Record<string, string> = {};
    if (filter.tenantId) params.tenantId = filter.tenantId;
    if (filter.customerId) params.customerId = filter.customerId;
    if (filter.page) params.page = String(filter.page);
    if (filter.pageSize) params.pageSize = String(filter.pageSize);
    if (filter.status) {
      params.status = Array.isArray(filter.status) ? filter.status.join(',') : filter.status;
    }
    return getApiClient().get<MaintenanceTicket[]>('/maintenance/tickets', { params });
  },

  /** Get a single ticket by id. */
  async get(id: string): Promise<ApiResponse<MaintenanceTicket>> {
    return getApiClient().get<MaintenanceTicket>(`/maintenance/tickets/${id}`);
  },

  /** Create a new maintenance ticket (customer intake). */
  async create(request: CreateTicketRequest): Promise<ApiResponse<MaintenanceTicket>> {
    return getApiClient().post<MaintenanceTicket>('/maintenance/tickets', request);
  },

  /** Cancel a ticket the customer no longer needs. */
  async cancel(id: string, reason?: string): Promise<ApiResponse<MaintenanceTicket>> {
    return getApiClient().post<MaintenanceTicket>(`/maintenance/tickets/${id}/cancel`, { reason });
  },

  /** Customer rating for a completed ticket. */
  async rate(id: string, rating: RateTicketRequest): Promise<ApiResponse<MaintenanceTicket>> {
    return getApiClient().post<MaintenanceTicket>(`/maintenance/tickets/${id}/rating`, rating);
  },
};
