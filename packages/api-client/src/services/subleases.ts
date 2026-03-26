/**
 * Sublease Monitoring API Service
 * Detect and manage unauthorized sub-leasing
 */

import { getApiClient, ApiResponse } from '../client';
import type { PaginationInfo } from '../types';
import { buildQueryParams } from '../types';

export interface SubleaseAlert {
  id: string;
  tenantId: string;
  alertCode: string;
  leaseId: string;
  propertyId: string;
  unitId?: string;
  parcelId?: string;
  customerId: string;
  status: string;
  source: string;
  reportedBy?: string;
  reportedAt: string;
  description: string;
  evidenceUrls: string[];
  suspectedSubtenantName?: string;
  suspectedSubtenantPhone?: string;
  suspectedSubtenantDetails?: string;
  investigatedBy?: string;
  investigatedAt?: string;
  investigationNotes?: string;
  confirmedAt?: string;
  confirmedBy?: string;
  resolution?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  caseId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListSubleaseAlertsParams {
  page?: number;
  pageSize?: number;
  status?: string;
  source?: string;
}

export interface CreateSubleaseAlertRequest {
  leaseId: string;
  propertyId: string;
  unitId?: string;
  parcelId?: string;
  customerId: string;
  source: string;
  description: string;
  evidenceUrls?: string[];
  suspectedSubtenantName?: string;
  suspectedSubtenantPhone?: string;
  suspectedSubtenantDetails?: string;
}

export const subleaseAlertsService = {
  async list(
    params?: ListSubleaseAlertsParams
  ): Promise<ApiResponse<SubleaseAlert[]> & { pagination?: PaginationInfo }> {
    const searchParams = buildQueryParams({
      page: params?.page,
      pageSize: params?.pageSize,
      status: params?.status,
      source: params?.source,
    });

    return getApiClient().get<SubleaseAlert[]>('/sublease-alerts', searchParams) as Promise<
      ApiResponse<SubleaseAlert[]> & { pagination?: PaginationInfo }
    >;
  },

  async get(id: string): Promise<ApiResponse<SubleaseAlert>> {
    return getApiClient().get<SubleaseAlert>(`/sublease-alerts/${id}`);
  },

  async create(request: CreateSubleaseAlertRequest): Promise<ApiResponse<SubleaseAlert>> {
    return getApiClient().post<SubleaseAlert>('/sublease-alerts', request);
  },

  async investigate(id: string, request: { notes: string }): Promise<ApiResponse<SubleaseAlert>> {
    return getApiClient().post<SubleaseAlert>(`/sublease-alerts/${id}/investigate`, request);
  },

  async confirm(id: string, request: { notes?: string }): Promise<ApiResponse<SubleaseAlert>> {
    return getApiClient().post<SubleaseAlert>(`/sublease-alerts/${id}/confirm`, request);
  },

  async dismiss(id: string, request: { notes: string }): Promise<ApiResponse<SubleaseAlert>> {
    return getApiClient().post<SubleaseAlert>(`/sublease-alerts/${id}/dismiss`, request);
  },

  async resolve(id: string, request: { resolution: string }): Promise<ApiResponse<SubleaseAlert>> {
    return getApiClient().post<SubleaseAlert>(`/sublease-alerts/${id}/resolve`, request);
  },
};
