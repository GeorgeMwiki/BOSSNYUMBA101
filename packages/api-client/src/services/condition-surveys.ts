/**
 * Condition Surveys API Service
 * Annual condition survey campaigns
 */

import { getApiClient, ApiResponse } from '../client';
import type { PaginationInfo } from '../types';
import { buildQueryParams } from '../types';

export interface ConditionSurvey {
  id: string;
  tenantId: string;
  surveyCode: string;
  title: string;
  description?: string;
  status: string;
  financialYear: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  leadSurveyorId?: string;
  surveyTeam: Array<{ userId: string; name: string; role: string }>;
  organizationId?: string;
  totalAssets: number;
  completedAssets: number;
  summary?: string;
  findings: Record<string, unknown>;
  recommendations: string[];
  totalEstimatedRepairCost?: number;
  approvedAt?: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SurveyItem {
  id: string;
  tenantId: string;
  surveyId: string;
  assetId: string;
  surveyorId?: string;
  conditionBefore?: string;
  conditionAfter: string;
  structuralIntegrity?: string;
  roofCondition?: string;
  plumbingCondition?: string;
  electricalCondition?: string;
  paintCondition?: string;
  generalNotes?: string;
  defectsFound: Array<{ description: string; severity: string; location: string; photo?: string }>;
  repairsRequired: Array<{ description: string; priority: string; estimatedCost: number }>;
  maintenanceRequired: boolean;
  estimatedRepairCost?: number;
  currency: string;
  priorityLevel?: string;
  photos: Array<{ url: string; caption: string; takenAt?: string; type: string }>;
  surveyedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListSurveysParams {
  page?: number;
  pageSize?: number;
  year?: string;
  status?: string;
}

export interface CreateSurveyRequest {
  title: string;
  description?: string;
  financialYear: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  leadSurveyorId?: string;
  organizationId?: string;
}

export const conditionSurveysService = {
  async list(
    params?: ListSurveysParams
  ): Promise<ApiResponse<ConditionSurvey[]> & { pagination?: PaginationInfo }> {
    const searchParams = buildQueryParams({
      page: params?.page,
      pageSize: params?.pageSize,
      year: params?.year,
      status: params?.status,
    });

    return getApiClient().get<ConditionSurvey[]>('/condition-surveys', searchParams) as Promise<
      ApiResponse<ConditionSurvey[]> & { pagination?: PaginationInfo }
    >;
  },

  async get(id: string): Promise<ApiResponse<ConditionSurvey>> {
    return getApiClient().get<ConditionSurvey>(`/condition-surveys/${id}`);
  },

  async create(request: CreateSurveyRequest): Promise<ApiResponse<ConditionSurvey>> {
    return getApiClient().post<ConditionSurvey>('/condition-surveys', request);
  },

  async update(id: string, request: Partial<CreateSurveyRequest>): Promise<ApiResponse<ConditionSurvey>> {
    return getApiClient().put<ConditionSurvey>(`/condition-surveys/${id}`, request);
  },

  async getItems(
    surveyId: string,
    page = 1,
    pageSize = 50
  ): Promise<ApiResponse<SurveyItem[]> & { pagination?: PaginationInfo }> {
    return getApiClient().get<SurveyItem[]>(`/condition-surveys/${surveyId}/items`, {
      page: String(page),
      pageSize: String(pageSize),
    }) as Promise<ApiResponse<SurveyItem[]> & { pagination?: PaginationInfo }>;
  },

  async addItem(
    surveyId: string,
    request: { assetId: string; conditionAfter: string; generalNotes?: string }
  ): Promise<ApiResponse<SurveyItem>> {
    return getApiClient().post<SurveyItem>(`/condition-surveys/${surveyId}/items`, request);
  },
};
