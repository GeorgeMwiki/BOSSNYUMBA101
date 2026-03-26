/**
 * Financial Profiles API Service
 * Customer financial capability and credit assessment
 */

import { getApiClient, ApiResponse } from '../client';

export interface FinancialProfile {
  id: string;
  tenantId: string;
  customerId: string;
  employmentStatus?: string;
  businessName?: string;
  businessRegistrationNumber?: string;
  tinNumber?: string;
  annualRevenue?: number;
  currency: string;
  financialStatementUrls: Array<{ url: string; year: string; type: string }>;
  bankStatementUrls: string[];
  bankName?: string;
  bankAccountRef?: string;
  hasActiveLitigation: boolean;
  litigationDetails: Array<{ caseNumber: string; court: string; status: string; description: string; amount?: number }>;
  previousDefaultHistory: boolean;
  defaultDetails: string[];
  creditRiskRating: string;
  paymentTendency: string;
  creditAssessmentNotes?: string;
  creditAssessedAt?: string;
  creditAssessedBy?: string;
  guarantorName?: string;
  guarantorIdNumber?: string;
  guarantorPhone?: string;
  guarantorAddress?: string;
  guarantorRelationship?: string;
  riskAssessmentNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFinancialProfileRequest {
  customerId: string;
  employmentStatus?: string;
  businessName?: string;
  businessRegistrationNumber?: string;
  tinNumber?: string;
  annualRevenue?: number;
  currency?: string;
  bankName?: string;
  bankAccountRef?: string;
  hasActiveLitigation?: boolean;
  previousDefaultHistory?: boolean;
  guarantorName?: string;
  guarantorIdNumber?: string;
  guarantorPhone?: string;
  guarantorAddress?: string;
  guarantorRelationship?: string;
}

export const financialProfilesService = {
  async getByCustomer(customerId: string): Promise<ApiResponse<FinancialProfile>> {
    return getApiClient().get<FinancialProfile>(`/financial-profiles/customer/${customerId}`);
  },

  async get(id: string): Promise<ApiResponse<FinancialProfile>> {
    return getApiClient().get<FinancialProfile>(`/financial-profiles/${id}`);
  },

  async create(request: CreateFinancialProfileRequest): Promise<ApiResponse<FinancialProfile>> {
    return getApiClient().post<FinancialProfile>('/financial-profiles', request);
  },

  async update(id: string, request: Partial<CreateFinancialProfileRequest>): Promise<ApiResponse<FinancialProfile>> {
    return getApiClient().put<FinancialProfile>(`/financial-profiles/${id}`, request);
  },

  async assessCredit(id: string, request: { creditRiskRating: string; paymentTendency: string; notes?: string }): Promise<ApiResponse<FinancialProfile>> {
    return getApiClient().post<FinancialProfile>(`/financial-profiles/${id}/assess`, request);
  },
};
