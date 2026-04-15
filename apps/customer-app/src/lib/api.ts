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
import type { PaymentBalance, PaymentRecord } from './payment-types';

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
          localStorage.removeItem('customer_active_org');
          window.location.href = '/auth/login';
        }
      },
    });
  }

  const client = getApiClient();
  // Re-sync the Bearer token + X-Active-Org header on every use so that the
  // singleton reflects the latest AuthContext state (login, org switch, logout).
  if (typeof window !== 'undefined') {
    const latestToken = localStorage.getItem('customer_token');
    const activeOrg = localStorage.getItem('customer_active_org');
    if (latestToken) {
      client.setAccessToken(latestToken);
    } else {
      client.clearTokens();
    }
    // buildHeaders() merges `config.headers` into every request, so stamping it
    // here is enough to flow X-Active-Org through the whole surface.
    const cfg = (client as unknown as { config: { headers?: Record<string, string> } }).config;
    cfg.headers = { ...(cfg.headers ?? {}) };
    if (activeOrg) {
      cfg.headers['X-Active-Org'] = activeOrg;
    } else {
      delete cfg.headers['X-Active-Org'];
    }
  }

  return client;
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
    async getBalance(): Promise<PaymentBalance> {
      return requireLiveData<PaymentBalance>(() => ensureClient().get('/payments/balance'));
    },

    async getHistory(page = 1, limit = 20): Promise<PaymentRecord[]> {
      return requireLiveData<PaymentRecord[]>(() =>
        ensureClient().get('/payments/history', {
          params: { page, limit },
        })
      );
    },

    async getPending(): Promise<PaymentRecord[]> {
      return requireLiveData<PaymentRecord[]>(() => ensureClient().get('/payments/pending'));
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
