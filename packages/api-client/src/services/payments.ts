/**
 * Payments API Service
 */

import { getApiClient, ApiResponse } from '../client';
import type {
  PaymentIntent,
  PaymentIntentId,
  PaymentStatus,
  PaymentIntentType,
  PaymentChannel,
  PaymentMethod,
  PaymentMethodId,
  Statement,
  StatementId,
} from '@bossnyumba/domain-models';

/** Payment type alias used in API layer */
export type PaymentType = PaymentIntentType;

export interface PaymentFilters {
  status?: PaymentStatus[];
<<<<<<< HEAD
  type?: PaymentIntentType[];
=======
  type?: PaymentType[];
>>>>>>> worktree-agent-a793f70a
  channel?: PaymentChannel[];
  customerId?: string;
  leaseId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CreatePaymentRequest {
  leaseId?: string;
  amount: { amount: number; currency: string };
  paymentType: PaymentIntentType;
  description: string;
  dueDate?: string;
}

export interface ProcessPaymentRequest {
  paymentMethodId: string;
  channel: PaymentChannel;
  phoneNumber?: string; // For M-Pesa
}

/**
 * Simplified payment creation payload used by the customer app
 * payments form (amount + method + optional reference).
 */
export interface CustomerCreatePaymentInput {
  tenantId: string;
  amount: number;
  currency?: string;
  method: 'mpesa' | 'card' | 'bank';
  reference?: string;
  leaseId?: string;
  description?: string;
  phoneNumber?: string;
}

export interface ListPaymentsInput {
  tenantId: string;
  limit?: number;
  page?: number;
}

export const paymentsService = {
  /**
   * List payment intents with optional filters
   */
  async list(filters?: PaymentFilters, page = 1, limit = 20): Promise<ApiResponse<PaymentIntent[]>> {
    const params: Record<string, string> = {
      page: String(page),
      limit: String(limit),
    };

    if (filters?.status?.length) {
      params.status = filters.status.join(',');
    }
    if (filters?.type?.length) {
      params.type = filters.type.join(',');
    }
    if (filters?.channel?.length) {
      params.channel = filters.channel.join(',');
    }
    if (filters?.customerId) {
      params.customerId = filters.customerId;
    }
    if (filters?.leaseId) {
      params.leaseId = filters.leaseId;
    }
    if (filters?.dateFrom) {
      params.dateFrom = filters.dateFrom;
    }
    if (filters?.dateTo) {
      params.dateTo = filters.dateTo;
    }

    return getApiClient().get<PaymentIntent[]>('/payments', { params });
  },

  /**
   * Get a single payment intent
   */
  async get(id: PaymentIntentId): Promise<ApiResponse<PaymentIntent>> {
    return getApiClient().get<PaymentIntent>(`/payments/${id}`);
  },

  /**
   * Create a payment intent
   */
  async create(request: CreatePaymentRequest): Promise<ApiResponse<PaymentIntent>> {
    return getApiClient().post<PaymentIntent>('/payments', request);
  },

  /**
   * Process a payment (initiate payment flow)
   */
  async process(
    id: PaymentIntentId,
    request: ProcessPaymentRequest
  ): Promise<ApiResponse<PaymentIntent>> {
    return getApiClient().post<PaymentIntent>(`/payments/${id}/process`, request);
  },

  /**
   * Get customer's pending payments
   */
  async getPendingPayments(): Promise<ApiResponse<PaymentIntent[]>> {
    return getApiClient().get<PaymentIntent[]>('/payments/pending');
  },

  /**
   * Get customer's payment history
   */
  async getHistory(page = 1, limit = 20): Promise<ApiResponse<PaymentIntent[]>> {
    return getApiClient().get<PaymentIntent[]>('/payments/history', {
      params: { page: String(page), limit: String(limit) },
    });
  },

  /**
   * Get current balance due
   */
  async getBalance(): Promise<
    ApiResponse<{
      totalDue: { amount: number; currency: string };
      breakdown: Array<{ type: PaymentIntentType; amount: { amount: number; currency: string } }>;
    }>
  > {
    return getApiClient().get('/payments/balance');
  },

  /**
   * Customer-app oriented payment creation used by PaymentsPage.
   * Posts to `/api/payments` with a normalized shape.
   */
  async createPayment(
    input: CustomerCreatePaymentInput
  ): Promise<ApiResponse<PaymentIntent>> {
    const body = {
      tenantId: input.tenantId,
      amount: {
        amount: input.amount,
        currency: input.currency ?? 'KES',
      },
      method: input.method,
      reference: input.reference,
      leaseId: input.leaseId,
      description: input.description,
      phoneNumber: input.phoneNumber,
    };
    return getApiClient().post<PaymentIntent>('/api/payments', body);
  },

  /**
   * Customer-app oriented payment listing used by PaymentsPage.
   * Returns the most recent payments for the given tenant.
   */
  async listPayments(
    input: ListPaymentsInput
  ): Promise<ApiResponse<PaymentIntent[]>> {
    const params: Record<string, string> = {
      tenantId: input.tenantId,
      limit: String(input.limit ?? 20),
      page: String(input.page ?? 1),
    };
    return getApiClient().get<PaymentIntent[]>('/api/payments', { params });
  },
};

export const paymentMethodsService = {
  /**
   * List customer's payment methods
   */
  async list(): Promise<ApiResponse<PaymentMethod[]>> {
    return getApiClient().get<PaymentMethod[]>('/payment-methods');
  },

  /**
   * Get a payment method
   */
  async get(id: PaymentMethodId): Promise<ApiResponse<PaymentMethod>> {
    return getApiClient().get<PaymentMethod>(`/payment-methods/${id}`);
  },

  /**
   * Add M-Pesa payment method
   */
  async addMpesa(phoneNumber: string, isDefault = false): Promise<ApiResponse<PaymentMethod>> {
    return getApiClient().post<PaymentMethod>('/payment-methods/mpesa', {
      phoneNumber,
      isDefault,
    });
  },

  /**
   * Set default payment method
   */
  async setDefault(id: PaymentMethodId): Promise<ApiResponse<PaymentMethod>> {
    return getApiClient().post<PaymentMethod>(`/payment-methods/${id}/default`, {});
  },

  /**
   * Remove a payment method
   */
  async remove(id: PaymentMethodId): Promise<ApiResponse<void>> {
    return getApiClient().delete(`/payment-methods/${id}`);
  },
};

export const statementsService = {
  /**
   * List customer's statements
   */
  async list(page = 1, limit = 12): Promise<ApiResponse<Statement[]>> {
    return getApiClient().get<Statement[]>('/statements', {
      params: { page: String(page), limit: String(limit) },
    });
  },

  /**
   * Get a statement
   */
  async get(id: StatementId): Promise<ApiResponse<Statement>> {
    return getApiClient().get<Statement>(`/statements/${id}`);
  },

  /**
   * Download statement PDF
   */
  async downloadPdf(id: StatementId): Promise<ApiResponse<{ downloadUrl: string }>> {
    return getApiClient().get<{ downloadUrl: string }>(`/statements/${id}/download`);
  },

  /**
   * Mark statement as viewed
   */
  async markViewed(id: StatementId): Promise<ApiResponse<Statement>> {
    return getApiClient().post<Statement>(`/statements/${id}/viewed`, {});
  },
};

/**
 * Namespaced alias used by customer-app surfaces that expect
 * `payments.createPayment(...)` and `payments.listPayments(...)`.
 */
export const payments = {
  createPayment: paymentsService.createPayment,
  listPayments: paymentsService.listPayments,
};
