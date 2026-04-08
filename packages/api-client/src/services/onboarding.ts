/**
 * Onboarding API Service
 *
 * Thin wrapper exposing a single `submit` facade plus step/status helpers
 * for the customer onboarding flow.
 */

import { getApiClient, ApiResponse } from '../client';

export interface OnboardingProfile {
  firstName: string;
  lastName: string;
  idNumber: string;
  phone: string;
  email?: string;
}

export interface OnboardingPropertySelection {
  propertyId: string;
  unitId?: string;
}

export interface OnboardingDocumentRef {
  category: string;
  documentId?: string;
  url?: string;
  filename?: string;
}

export interface OnboardingSubmitRequest {
  profile: OnboardingProfile;
  property: OnboardingPropertySelection;
  documents: OnboardingDocumentRef[];
  agreedToTerms: boolean;
  signature?: string;
}

export interface OnboardingSubmitResponse {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedAt: string;
}

export interface OnboardingStatus {
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'PENDING' | 'APPROVED' | 'REJECTED';
  completedSteps: string[];
  lastUpdatedAt?: string;
}

export const onboarding = {
  /**
   * Submit the full onboarding payload.
   *
   * Wraps `POST /onboarding/submit`.
   */
  async submit(
    request: OnboardingSubmitRequest
  ): Promise<ApiResponse<OnboardingSubmitResponse>> {
    return getApiClient().post<OnboardingSubmitResponse>('/onboarding/submit', request);
  },

  /**
   * Get current onboarding status for the authenticated customer.
   */
  async getStatus(): Promise<ApiResponse<OnboardingStatus>> {
    return getApiClient().get<OnboardingStatus>('/onboarding/status');
  },

  /**
   * Persist progress for a named step without finalizing.
   */
  async saveStep(
    step: string,
    data: Record<string, unknown>
  ): Promise<ApiResponse<{ success: boolean }>> {
    return getApiClient().post<{ success: boolean }>(
      `/onboarding/steps/${step}`,
      data
    );
  },
};

export type OnboardingService = typeof onboarding;
