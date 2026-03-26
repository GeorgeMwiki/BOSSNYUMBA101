/**
 * API Service Layer for Customer App
 *
 * Live-only wrapper around @bossnyumba/api-client.
 */

import {
  ApiClientError,
  hasApiClient,
  initializeApiClient,
  getApiClient,
} from '@bossnyumba/api-client';

function getApiBaseUrl(): string {
  const url =
    typeof window !== 'undefined'
      ? process.env.NEXT_PUBLIC_API_URL
      : process.env.API_URL;

  if (url?.trim()) {
    const base = url.trim().replace(/\/$/, '');
    return base.endsWith('/api/v1') ? base : `${base}/api/v1`;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEXT_PUBLIC_API_URL (or API_URL server-side) is required in production');
  }

  return 'http://localhost:4000/api/v1';
}

const API_BASE_URL = getApiBaseUrl();

function ensureClient() {
  if (!hasApiClient()) {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('customer_token') ?? undefined
        : undefined;

    initializeApiClient({
      baseUrl: API_BASE_URL,
      accessToken: token,
      timeout: 15000,
      retries: 1,
      onAuthError: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('customer_token');
          localStorage.removeItem('customer_user');
          window.location.href = '/auth/login';
        }
      },
    });
  }

  return getApiClient();
}

function normalizeError(error: unknown): Error {
  if (error instanceof ApiClientError) {
    const message =
      typeof (error as { message?: unknown }).message === 'string'
        ? (error as { message: string }).message
        : 'Live API request failed';
    return new Error(message);
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error('Live API request failed');
}

async function requireLiveData<T>(request: () => Promise<{ data: T }>): Promise<T> {
  try {
    const response = await request();
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

export const api = {
  payments: {
    async getBalance() {
      return requireLiveData(() => ensureClient().get('/payments/balance'));
    },

    async getHistory(page = 1, limit = 20) {
      return requireLiveData(() =>
        ensureClient().get('/payments/history', {
          params: { page, limit },
        })
      );
    },

    async getPending() {
      return requireLiveData(() => ensureClient().get('/payments/pending'));
    },

    async requestPaymentPlan(data: {
      amount: number;
      months: number;
      reason: string;
      startDate: string;
      notes?: string;
    }) {
      return requireLiveData(() => ensureClient().post('/payments/plans', data));
    },

    async getPaymentPlans() {
      return requireLiveData(() => ensureClient().get('/payments/plans'));
    },

    async getPaymentPlan(id: string) {
      return requireLiveData(() => ensureClient().get(`/payments/plans/${id}`));
    },

    async initiateMpesa(data: { amount: number; phoneNumber: string }) {
      return requireLiveData(() => ensureClient().post('/payments/mpesa/initiate', data));
    },

    async confirmBankTransfer(data: { amount: number; reference: string }) {
      return requireLiveData(() => ensureClient().post('/payments/bank-transfer/confirm', data));
    },
  },

  lease: {
    async getCurrent() {
      return requireLiveData(() => ensureClient().get('/leases/current'));
    },

    async getRenewalOffer() {
      return requireLiveData(() => ensureClient().get('/leases/current/renewal-offer'));
    },

    async acceptRenewal(data: { termMonths: number; agreedToTerms: boolean }) {
      return requireLiveData(() => ensureClient().post('/leases/current/renew', data));
    },

    async submitMoveOutNotice(data: {
      moveOutDate: string;
      reason: string;
      forwardingAddress?: string;
      notes?: string;
      inspectionDate?: string;
    }) {
      return requireLiveData(() => ensureClient().post('/leases/current/move-out', data));
    },

    async getMoveOutStatus() {
      return requireLiveData(() => ensureClient().get('/leases/current/move-out'));
    },
  },

  onboarding: {
    async getStatus() {
      return requireLiveData(() => ensureClient().get('/onboarding/status'));
    },

    async updateStep(step: string, data: Record<string, unknown>) {
      return requireLiveData(() => ensureClient().post(`/onboarding/steps/${step}`, data));
    },

    async uploadDocument(formData: FormData) {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('customer_token')
          : null;

      const response = await fetch(`${API_BASE_URL}/onboarding/documents`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!response.ok) {
        let message = 'Document upload failed';

        try {
          const data = await response.json();
          message = data?.error?.message ?? data?.message ?? message;
        } catch {
          // Keep default error
        }

        throw new Error(message);
      }

      const body = await response.json();
      return body?.data ?? body;
    },

    async submitInspection(data: {
      rooms: unknown[];
      meterReadings: Record<string, number>;
      signature?: string;
    }) {
      return requireLiveData(() => ensureClient().post('/onboarding/inspection', data));
    },

    async completeOnboarding(data: {
      checkInDate?: string;
      signature?: string;
    }) {
      return requireLiveData(() => ensureClient().post('/onboarding/complete', data));
    },
  },

  profile: {
    async get() {
      return requireLiveData(() => ensureClient().get('/customers/me'));
    },

    async update(data: Record<string, unknown>) {
      return requireLiveData(() => ensureClient().put('/customers/me', data));
    },
  },

  inspections: {
    async schedule(data: {
      type: 'move_in' | 'move_out' | 'routine';
      preferredDate: string;
      preferredTimeSlot?: string;
    }) {
      return requireLiveData(() => ensureClient().post('/inspections', data));
    },
  },
};
