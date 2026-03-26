/**
 * Staff / Team Members API Service
 * Organization staff and team member management
 */

import { getApiClient, ApiResponse } from '../client';
import type { PaginationInfo } from '../types';
import { buildQueryParams } from '../types';

export type StaffRole =
  | 'MANAGER'
  | 'MAINTENANCE'
  | 'TECHNICIAN'
  | 'ADMIN'
  | 'ACCOUNTANT'
  | 'OTHER';

export interface StaffMember {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  phone?: string;
  role: StaffRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ListStaffParams {
  page?: number;
  pageSize?: number;
  role?: StaffRole;
  search?: string;
  isActive?: boolean;
}

export const staffService = {
  /**
   * List staff members with optional filters
   */
  async list(
    params?: ListStaffParams
  ): Promise<ApiResponse<StaffMember[]> & { pagination?: PaginationInfo }> {
    const searchParams = buildQueryParams({
      page: params?.page,
      pageSize: params?.pageSize,
      role: params?.role,
      search: params?.search,
      isActive: params?.isActive,
    });
    return getApiClient().get<StaffMember[]>('/staff', searchParams) as Promise<
      ApiResponse<StaffMember[]> & { pagination?: PaginationInfo }
    >;
  },

  /**
   * Get staff member by ID
   */
  async get(id: string): Promise<ApiResponse<StaffMember>> {
    return getApiClient().get<StaffMember>(`/staff/${id}`);
  },
};
