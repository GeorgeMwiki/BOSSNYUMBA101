/**
 * API Service Layer for Customer App
 *
 * Wraps @bossnyumba/api-client with graceful fallback to mock data
 * when the API gateway is unreachable (development mode).
 *
 * Usage:
 *   import { api } from '@/lib/api';
 *   const balance = await api.payments.getBalance();
 */

import {
  type ApiResponse,
  hasApiClient,
  initializeApiClient,
  getApiClient,
} from '@bossnyumba/api-client';

// ============================================================================
// Client Initialization
// ============================================================================

const API_BASE_URL =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1')
    : (process.env.API_URL ?? 'http://localhost:4000/api/v1');

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

// ============================================================================
// Helper: Try API, fall back to mock
// ============================================================================

async function tryApi<T>(
  apiFn: () => Promise<ApiResponse<T>>,
  fallback: T
): Promise<T> {
  try {
    const client = ensureClient();
    const res = await apiFn();
    return res.data;
  } catch {
    // In development, return mock data when API is unavailable
    if (process.env.NODE_ENV === 'development') {
      console.warn('[api] API unavailable, using mock data');
      return fallback;
    }
    throw new Error('API request failed');
  }
}

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_BALANCE = {
  totalDue: { amount: 45000, currency: 'KES' },
  breakdown: [
    { type: 'rent' as const, amount: { amount: 40000, currency: 'KES' } },
    { type: 'utilities' as const, amount: { amount: 5000, currency: 'KES' } },
  ],
};

const MOCK_LEASE = {
  id: 'lease-001',
  leaseNumber: 'LSE-2023-0124',
  status: 'active' as const,
  type: 'Fixed Term',
  startDate: '2023-06-01',
  endDate: '2024-05-31',
  daysRemaining: 75,
  property: {
    id: 'prop-001',
    name: 'Sunset Apartments',
    address: '123 Kenyatta Avenue, Nairobi',
  },
  unit: {
    id: 'unit-001',
    number: 'A-204',
    type: '2 Bedroom',
    floor: '2nd Floor',
  },
  rent: { amount: 40000, frequency: 'Monthly', dueDay: 1 },
  deposit: { amount: 80000, paid: true },
  terms: [
    'Fixed-term lease, 12 months',
    'Rent due on the 1st of each month',
    '30-day notice required for early termination',
    'Pets allowed with prior approval',
  ],
  propertyManager: {
    name: 'Jane Mwangi',
    phone: '+254 700 123 456',
    email: 'jane@sunsetapartments.co.ke',
  },
};

const MOCK_RENEWAL_OFFER = {
  id: 'renewal-001',
  currentLease: {
    startDate: '2023-03-01',
    endDate: '2024-02-29',
    monthlyRent: 45000,
    unit: 'Unit A12, Sunrise Apartments',
  },
  newTerms: {
    startDate: '2024-03-01',
    endDate: '2025-02-28',
    monthlyRent: 47500,
    increasePercentage: 5.5,
    securityDeposit: 47500,
    depositAdjustment: 2500,
  },
  options: [
    { months: 6, rentDiscount: 0, label: '6 months' },
    { months: 12, rentDiscount: 2.5, label: '12 months', recommended: true },
    { months: 24, rentDiscount: 5, label: '24 months' },
  ],
  expiresAt: '2024-02-15',
  benefits: [
    'No application fees',
    'Priority maintenance service',
    'Locked-in rate for full term',
    'Free unit inspection before renewal',
  ],
};

const MOCK_PAYMENT_PLANS = [
  {
    id: 'pp-001',
    status: 'active' as const,
    totalAmount: 45000,
    paidAmount: 15000,
    remainingAmount: 30000,
    monthlyAmount: 15000,
    months: 3,
    startDate: '2024-01-15',
    nextPaymentDate: '2024-02-15',
    payments: [
      { month: 1, amount: 15000, status: 'paid' as const, paidDate: '2024-01-15' },
      { month: 2, amount: 15000, status: 'pending' as const, dueDate: '2024-02-15' },
      { month: 3, amount: 15000, status: 'upcoming' as const, dueDate: '2024-03-15' },
    ],
  },
];

const MOCK_ONBOARDING_STATUS = {
  currentStep: 'welcome' as const,
  completedSteps: [] as string[],
  preferences: {
    language: 'en',
    channel: 'whatsapp',
  },
};

// ============================================================================
// API Service
// ============================================================================

export const api = {
  // ----- Payments -----
  payments: {
    async getBalance() {
      return tryApi(
        () => ensureClient().get('/payments/balance'),
        MOCK_BALANCE
      );
    },

    async getHistory(page = 1, limit = 20) {
      return tryApi(
        () =>
          ensureClient().get('/payments/history', {
            params: { page, limit },
          }),
        []
      );
    },

    async getPending() {
      return tryApi(
        () => ensureClient().get('/payments/pending'),
        []
      );
    },

    async requestPaymentPlan(data: {
      amount: number;
      months: number;
      reason: string;
      startDate: string;
      notes?: string;
    }) {
      return tryApi(
        () => ensureClient().post('/payments/plans', data),
        { id: `PP-${Date.now()}`, status: 'pending', ...data }
      );
    },

    async getPaymentPlans() {
      return tryApi(
        () => ensureClient().get('/payments/plans'),
        MOCK_PAYMENT_PLANS
      );
    },

    async getPaymentPlan(id: string) {
      return tryApi(
        () => ensureClient().get(`/payments/plans/${id}`),
        MOCK_PAYMENT_PLANS[0]
      );
    },
  },

  // ----- Lease -----
  lease: {
    async getCurrent() {
      return tryApi(
        () => ensureClient().get('/leases/current'),
        MOCK_LEASE
      );
    },

    async getRenewalOffer() {
      return tryApi(
        () => ensureClient().get('/leases/current/renewal-offer'),
        MOCK_RENEWAL_OFFER
      );
    },

    async acceptRenewal(data: { termMonths: number; agreedToTerms: boolean }) {
      return tryApi(
        () => ensureClient().post('/leases/current/renew', data),
        { success: true, newLeaseId: 'lease-new' }
      );
    },

    async submitMoveOutNotice(data: {
      moveOutDate: string;
      reason: string;
      forwardingAddress?: string;
      notes?: string;
      inspectionDate?: string;
    }) {
      return tryApi(
        () => ensureClient().post('/leases/current/move-out', data),
        { id: `MO-${Date.now()}`, status: 'submitted', ...data }
      );
    },

    async getMoveOutStatus() {
      return tryApi(
        () => ensureClient().get('/leases/current/move-out'),
        null
      );
    },
  },

  // ----- Onboarding -----
  onboarding: {
    async getStatus() {
      return tryApi(
        () => ensureClient().get('/onboarding/status'),
        MOCK_ONBOARDING_STATUS
      );
    },

    async updateStep(step: string, data: Record<string, unknown>) {
      return tryApi(
        () => ensureClient().post(`/onboarding/steps/${step}`, data),
        { success: true }
      );
    },

    async uploadDocument(formData: FormData) {
      // For file uploads, use fetch directly
      try {
        const token =
          typeof window !== 'undefined'
            ? localStorage.getItem('customer_token')
            : null;

        const res = await fetch(`${API_BASE_URL}/onboarding/documents`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });

        if (res.ok) return res.json();
      } catch {
        // fall through
      }
      // Mock
      return { id: `doc-${Date.now()}`, status: 'uploaded' };
    },

    async submitInspection(data: {
      rooms: unknown[];
      meterReadings: Record<string, number>;
      signature?: string;
    }) {
      return tryApi(
        () => ensureClient().post('/onboarding/inspection', data),
        { success: true }
      );
    },

    async completeOnboarding(data: {
      checkInDate?: string;
      signature?: string;
    }) {
      return tryApi(
        () => ensureClient().post('/onboarding/complete', data),
        { success: true, badge: 'new-tenant' }
      );
    },
  },

  // ----- Customer Profile -----
  profile: {
    async get() {
      return tryApi(
        () => ensureClient().get('/customers/me'),
        {
          id: 'customer-1',
          firstName: 'John',
          lastName: 'Kamau',
          phone: '+254 700 123 456',
          email: 'john.kamau@example.com',
        }
      );
    },

    async update(data: Record<string, unknown>) {
      return tryApi(
        () => ensureClient().put('/customers/me', data),
        { success: true }
      );
    },
  },

  // ----- Inspections -----
  inspections: {
    async schedule(data: {
      type: 'move_in' | 'move_out' | 'routine';
      preferredDate: string;
      preferredTimeSlot?: string;
    }) {
      return tryApi(
        () => ensureClient().post('/inspections', data),
        { id: `insp-${Date.now()}`, status: 'scheduled', ...data }
      );
    },
  },
};
