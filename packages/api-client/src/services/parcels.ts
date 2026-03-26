/**
 * Parcels API Service
 * Land parcel management
 */

import { getApiClient, ApiResponse } from '../client';
import type { PaginationInfo } from '../types';
import { buildQueryParams } from '../types';

export interface LandParcel {
  id: string;
  tenantId: string;
  parentParcelId?: string;
  parcelCode: string;
  name: string;
  type: string;
  status: string;
  description?: string;
  totalAreaSqm: number;
  leasedAreaSqm: number;
  availableAreaSqm: number;
  districtOrgId?: string;
  stationOrgId?: string;
  nearRailwayReserve: boolean;
  requiresCivilEngNotification: boolean;
  addressLine1?: string;
  city?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  boundaryCoordinates: Array<{ lat: number; lng: number }>;
  mapUrl?: string;
  cadastralReference?: string;
  titleDeedNumber?: string;
  titleDeedDocumentUrl?: string;
  surveyorName?: string;
  surveyDate?: string;
  surveyDocumentUrl?: string;
  images: string[];
  documents: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ParcelPortion {
  id: string;
  tenantId: string;
  parcelId: string;
  portionCode: string;
  portionNumber: number;
  name?: string;
  areaSqm: number;
  status: string;
  leaseId?: string;
  customerId?: string;
  latitude?: number;
  longitude?: number;
  boundaryCoordinates: Array<{ lat: number; lng: number }>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListParcelsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: string;
  status?: string;
  districtOrgId?: string;
}

export interface CreateParcelRequest {
  parcelCode: string;
  name: string;
  type: string;
  description?: string;
  totalAreaSqm: number;
  districtOrgId?: string;
  stationOrgId?: string;
  nearRailwayReserve?: boolean;
  requiresCivilEngNotification?: boolean;
  addressLine1?: string;
  city?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  mapUrl?: string;
  cadastralReference?: string;
  titleDeedNumber?: string;
  surveyorName?: string;
  surveyDate?: string;
}

export const parcelsService = {
  async list(
    params?: ListParcelsParams
  ): Promise<ApiResponse<LandParcel[]> & { pagination?: PaginationInfo }> {
    const searchParams = buildQueryParams({
      page: params?.page,
      pageSize: params?.pageSize,
      search: params?.search,
      type: params?.type,
      status: params?.status,
      districtOrgId: params?.districtOrgId,
    });

    return getApiClient().get<LandParcel[]>('/parcels', searchParams) as Promise<
      ApiResponse<LandParcel[]> & { pagination?: PaginationInfo }
    >;
  },

  async get(id: string): Promise<ApiResponse<LandParcel>> {
    return getApiClient().get<LandParcel>(`/parcels/${id}`);
  },

  async create(request: CreateParcelRequest): Promise<ApiResponse<LandParcel>> {
    return getApiClient().post<LandParcel>('/parcels', request);
  },

  async update(id: string, request: Partial<CreateParcelRequest>): Promise<ApiResponse<LandParcel>> {
    return getApiClient().put<LandParcel>(`/parcels/${id}`, request);
  },

  async delete(id: string): Promise<ApiResponse<{ message: string }>> {
    return getApiClient().delete<{ message: string }>(`/parcels/${id}`);
  },

  async getPortions(
    parcelId: string,
    page = 1,
    pageSize = 50
  ): Promise<ApiResponse<ParcelPortion[]> & { pagination?: PaginationInfo }> {
    return getApiClient().get<ParcelPortion[]>(`/parcels/${parcelId}/portions`, {
      page: String(page),
      pageSize: String(pageSize),
    }) as Promise<ApiResponse<ParcelPortion[]> & { pagination?: PaginationInfo }>;
  },

  async createPortion(
    parcelId: string,
    request: { portionCode: string; portionNumber: number; name?: string; areaSqm: number }
  ): Promise<ApiResponse<ParcelPortion>> {
    return getApiClient().post<ParcelPortion>(`/parcels/${parcelId}/portions`, request);
  },
};
