/**
 * Applications API Service
 * Lease application management (digitization, routing, approval)
 */

import { getApiClient, ApiResponse } from '../client';
import type { PaginationInfo } from '../types';
import { buildQueryParams } from '../types';

export interface Application {
  id: string;
  tenantId: string;
  applicationNumber: string;
  type: string;
  status: string;
  customerId?: string;
  applicantName: string;
  applicantPhone?: string;
  applicantEmail?: string;
  applicantAddress?: string;
  assetType?: string;
  propertyId?: string;
  unitId?: string;
  parcelId?: string;
  subdivisionId?: string;
  requestedLocation?: string;
  requestedSize?: string;
  proposedRentAmount?: number;
  currency: string;
  proposedLeaseTermMonths?: number;
  purposeOfUse?: string;
  letterReceivedDate: string;
  letterReceivedAt: string;
  receivingStationId?: string;
  digitalLetterUrl?: string;
  digitalizedContent?: string;
  additionalDocumentUrls: string[];
  currentAssigneeId?: string;
  currentOrganizationId?: string;
  forwardedToHqAt?: string;
  receivedAtHqAt?: string;
  assignedToEmuAt?: string;
  requiresCivilEngReview: boolean;
  civilEngNotifiedAt?: string;
  civilEngApprovedAt?: string;
  civilEngApprovedBy?: string;
  civilEngNotes?: string;
  emuReviewedAt?: string;
  emuReviewedBy?: string;
  emuNotes?: string;
  requiresDgApproval: boolean;
  dgApprovedAt?: string;
  dgApprovedBy?: string;
  dgNotes?: string;
  finalDecision?: string;
  finalDecisionAt?: string;
  finalDecisionBy?: string;
  finalDecisionNotes?: string;
  resultingLeaseId?: string;
  responseLetterUrl?: string;
  responseDate?: string;
  internalNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationRoutingEntry {
  id: string;
  tenantId: string;
  applicationId: string;
  fromOrganizationId?: string;
  toOrganizationId?: string;
  fromUserId?: string;
  toUserId?: string;
  action: string;
  notes?: string;
  routedAt: string;
  routedBy?: string;
}

export interface ListApplicationsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  type?: string;
}

export interface CreateApplicationRequest {
  type: string;
  applicantName: string;
  applicantPhone?: string;
  applicantEmail?: string;
  applicantAddress?: string;
  assetType?: string;
  propertyId?: string;
  unitId?: string;
  parcelId?: string;
  requestedLocation?: string;
  requestedSize?: string;
  proposedRentAmount?: number;
  proposedLeaseTermMonths?: number;
  purposeOfUse?: string;
  letterReceivedDate: string;
  letterReceivedAt: string;
  receivingStationId?: string;
  digitalLetterUrl?: string;
}

export const applicationsService = {
  async list(
    params?: ListApplicationsParams
  ): Promise<ApiResponse<Application[]> & { pagination?: PaginationInfo }> {
    const searchParams = buildQueryParams({
      page: params?.page,
      pageSize: params?.pageSize,
      search: params?.search,
      status: params?.status,
      type: params?.type,
    });

    return getApiClient().get<Application[]>('/applications', searchParams) as Promise<
      ApiResponse<Application[]> & { pagination?: PaginationInfo }
    >;
  },

  async get(id: string): Promise<ApiResponse<Application>> {
    return getApiClient().get<Application>(`/applications/${id}`);
  },

  async create(request: CreateApplicationRequest): Promise<ApiResponse<Application>> {
    return getApiClient().post<Application>('/applications', request);
  },

  async update(id: string, request: Partial<CreateApplicationRequest>): Promise<ApiResponse<Application>> {
    return getApiClient().put<Application>(`/applications/${id}`, request);
  },

  async forward(id: string, request: { toOrganizationId: string; toUserId?: string; notes?: string }): Promise<ApiResponse<Application>> {
    return getApiClient().post<Application>(`/applications/${id}/forward`, request);
  },

  async approve(id: string, request: { notes?: string }): Promise<ApiResponse<Application>> {
    return getApiClient().post<Application>(`/applications/${id}/approve`, request);
  },

  async reject(id: string, request: { notes: string }): Promise<ApiResponse<Application>> {
    return getApiClient().post<Application>(`/applications/${id}/reject`, request);
  },

  async getRouting(id: string): Promise<ApiResponse<ApplicationRoutingEntry[]>> {
    return getApiClient().get<ApplicationRoutingEntry[]>(`/applications/${id}/routing`);
  },
};
