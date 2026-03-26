/**
 * Assets API Service
 * Fixed asset register management
 */

import { getApiClient, ApiResponse } from '../client';
import type { PaginationInfo } from '../types';
import { buildQueryParams } from '../types';

export interface AssetRegisterEntry {
  id: string;
  tenantId: string;
  assetCode: string;
  name: string;
  type: string;
  description?: string;
  propertyId?: string;
  unitId?: string;
  parcelId?: string;
  organizationId?: string;
  acquisitionDate?: string;
  acquisitionCost?: number;
  currency: string;
  currentBookValue?: number;
  depreciationRate?: number;
  currentCondition: string;
  lastSurveyDate?: string;
  lastSurveyId?: string;
  nextSurveyDue?: string;
  occupancyStatus: string;
  currentCustomerId?: string;
  currentLeaseId?: string;
  monthlyRentAmount?: number;
  annualRevenue?: number;
  location?: string;
  latitude?: number;
  longitude?: number;
  images: string[];
  documents: string[];
  metadata: Record<string, unknown>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListAssetsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  condition?: string;
  occupancyStatus?: string;
  type?: string;
}

export interface CreateAssetRequest {
  assetCode: string;
  name: string;
  type: string;
  description?: string;
  propertyId?: string;
  unitId?: string;
  parcelId?: string;
  organizationId?: string;
  acquisitionDate?: string;
  acquisitionCost?: number;
  currency?: string;
  currentCondition?: string;
  occupancyStatus?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
}

export const assetsService = {
  async list(
    params?: ListAssetsParams
  ): Promise<ApiResponse<AssetRegisterEntry[]> & { pagination?: PaginationInfo }> {
    const searchParams = buildQueryParams({
      page: params?.page,
      pageSize: params?.pageSize,
      search: params?.search,
      condition: params?.condition,
      occupancyStatus: params?.occupancyStatus,
      type: params?.type,
    });

    return getApiClient().get<AssetRegisterEntry[]>('/assets', searchParams) as Promise<
      ApiResponse<AssetRegisterEntry[]> & { pagination?: PaginationInfo }
    >;
  },

  async get(id: string): Promise<ApiResponse<AssetRegisterEntry>> {
    return getApiClient().get<AssetRegisterEntry>(`/assets/${id}`);
  },

  async create(request: CreateAssetRequest): Promise<ApiResponse<AssetRegisterEntry>> {
    return getApiClient().post<AssetRegisterEntry>('/assets', request);
  },

  async update(id: string, request: Partial<CreateAssetRequest>): Promise<ApiResponse<AssetRegisterEntry>> {
    return getApiClient().put<AssetRegisterEntry>(`/assets/${id}`, request);
  },

  async delete(id: string): Promise<ApiResponse<{ message: string }>> {
    return getApiClient().delete<{ message: string }>(`/assets/${id}`);
  },
};
