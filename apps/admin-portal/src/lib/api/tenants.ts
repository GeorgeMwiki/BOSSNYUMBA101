import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

function unwrap<T>(res: { success: boolean; data?: T; error?: string }, feature: string): T {
  if (res.success && res.data !== undefined) return res.data;
  throw new Error(res.error || `${feature} is unavailable.`);
}

export interface TenantOnboardingPayload {
  organization: {
    name: string;
    industry: string;
    address: string;
    city: string;
    country: string;
    phone: string;
    website?: string;
    registrationNumber?: string;
  };
  policy: {
    lateFeeType: 'percentage' | 'fixed';
    lateFeeValue: number;
    gracePeriodDays: number;
    autoReminders: boolean;
    reminderDaysBeforeDue: number;
    autoLateFee: boolean;
    maxPaymentRetries: number;
    leaseAutoRenewal: boolean;
    securityDepositMonths: number;
    noticeperiodDays: number;
  };
  subscription: {
    plan: 'starter' | 'professional' | 'enterprise';
    billingCycle: 'monthly' | 'annual';
    startTrial: boolean;
  };
  admin: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    role: string;
    sendInvite: boolean;
  };
}

export interface TenantOnboardingResult {
  tenantId: string;
  adminUserId: string;
  subscriptionId: string;
  inviteSent: boolean;
}

export function useOnboardTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TenantOnboardingPayload) =>
      unwrap(await api.post<TenantOnboardingResult>('/tenants/onboard', payload), 'Tenant onboarding'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenants'] }),
  });
}

export interface OnboardingStepValidation {
  valid: boolean;
  errors?: Record<string, string>;
}

export function useValidateOnboardingStep() {
  return useMutation({
    mutationFn: async (payload: { step: string; data: unknown }) =>
      unwrap(
        await api.post<OnboardingStepValidation>('/tenants/onboard/validate', payload),
        'Onboarding validation'
      ),
  });
}
