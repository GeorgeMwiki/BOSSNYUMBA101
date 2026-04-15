/**
 * Customer App API Surface
 *
 * Type-safe thin wrappers on top of @bossnyumba/api-client. All calls route
 * through the shared ApiClient (initialized in `@/lib/api`), include auth
 * credentials, and normalize errors to `Error` for react-query consumers.
 */

import {
  ApiClientError,
  getApiClient,
  hasApiClient,
  initializeApiClient,
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
    throw new Error(
      'NEXT_PUBLIC_API_URL (or API_URL server-side) is required in production'
    );
  }

  return 'http://localhost:4000/api/v1';
}

const API_BASE_URL = getApiBaseUrl();

export function ensureClient() {
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

export function normalizeError(error: unknown): Error {
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

async function unwrap<T>(p: () => Promise<{ data: T }>): Promise<T> {
  try {
    const r = await p();
    return r.data;
  } catch (e) {
    throw normalizeError(e);
  }
}

// ---------------------------------------------------------------------------
// Types (loosely typed where the backend is still stabilizing)
// ---------------------------------------------------------------------------

export interface Money {
  amount: number;
  currency: string;
}

export interface BalanceSummary {
  totalDue: Money;
  breakdown: Array<{ type: string; amount: Money }>;
}

export interface PaymentRecord {
  id: string;
  description?: string;
  paymentNumber?: string;
  status: string;
  amount: number;
  currency: string;
  completedAt?: string;
  createdAt?: string;
  dueDate?: string;
  paymentType?: string;
  channel?: string;
  reference?: string;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber?: string;
  status: string;
  amount: number;
  currency: string;
  dueDate: string;
  paidDate?: string;
  propertyName?: string;
  unitNumber?: string;
  lineItems?: Array<{ description: string; amount: number; quantity?: number }>;
  channel?: string;
  reference?: string;
  createdAt?: string;
}

export interface WorkOrderRecord {
  id: string;
  workOrderNumber?: string;
  title: string;
  description?: string;
  category: string;
  status: string;
  priority: string;
  location?: string;
  slaStatus?: 'on_track' | 'at_risk' | 'breached';
  scheduledDate?: string;
  scheduledTimeSlot?: string;
  photoCount?: number;
  attachments?: Array<{ type: string; url: string; filename: string }>;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
  assignedTo?: { id: string; name: string; role?: string };
}

export interface NotificationRecord {
  id: string;
  title: string;
  body?: string;
  message?: string;
  category: string;
  status?: string;
  read?: boolean;
  readAt?: string;
  createdAt: string;
  data?: Record<string, unknown>;
  actionUrl?: string;
}

export interface ConversationRecord {
  id: string;
  subject?: string;
  participants?: Array<{ id: string; type: string; name?: string }>;
  lastMessage?: {
    id: string;
    content: string;
    senderId: string;
    createdAt: string;
  };
  unreadCount: number;
  updatedAt: string;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: 'customer' | 'manager' | 'system';
  content: string;
  status?: string;
  attachments?: Array<{ type: string; url: string; filename: string }>;
  createdAt: string;
}

export interface MeterReading {
  id?: string;
  type: 'water' | 'electricity' | 'gas' | string;
  value: number;
  unit: string;
  readingDate?: string;
  photoUrl?: string;
  previousValue?: number;
}

export interface UtilityBillRecord {
  id: string;
  month: string;
  total: number;
  currency?: string;
  status: 'pending' | 'paid' | 'overdue';
}

export interface CustomerProfile {
  id: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
}

export interface LeaseRecord {
  id: string;
  propertyName?: string;
  unitNumber?: string;
  type?: string;
  status: string;
  startDate: string;
  endDate: string;
  rentAmount: number;
  currency?: string;
  depositAmount?: number;
  paymentDueDay?: number;
  daysRemaining?: number;
}

export interface RenewalOfferRecord {
  leaseId: string;
  currentRent: number;
  proposedRent: number;
  currency: string;
  termOptions: Array<{ months: number; monthlyRent: number }>;
  offerExpiresAt: string;
}

export interface MoveOutStatusRecord {
  id?: string;
  status: string;
  moveOutDate?: string;
  submittedAt?: string;
  inspectionDate?: string;
}

export interface PaymentPlanRecord {
  id: string;
  amount: number;
  months: number;
  status: string;
  startDate: string;
  installments: Array<{
    dueDate: string;
    amount: number;
    paid: boolean;
  }>;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Surface
// ---------------------------------------------------------------------------

export const api = {
  payments: {
    async getBalance(): Promise<BalanceSummary> {
      return unwrap(() => ensureClient().get<BalanceSummary>('/payments/balance'));
    },
    async getHistory(page = 1, limit = 20): Promise<PaymentRecord[]> {
      return unwrap(() =>
        ensureClient().get<PaymentRecord[]>('/payments/history', {
          params: { page, limit },
        })
      );
    },
    async getPending(): Promise<PaymentRecord[]> {
      return unwrap(() => ensureClient().get<PaymentRecord[]>('/payments/pending'));
    },
    async getPayment(id: string): Promise<PaymentRecord> {
      return unwrap(() => ensureClient().get<PaymentRecord>(`/payments/${id}`));
    },
    async initiateMpesa(data: {
      amount: number;
      currency?: string;
      phoneNumber: string;
      reference?: string;
      paymentIntentId?: string;
    }): Promise<{ paymentId: string; status: string; reference?: string }> {
      return unwrap(() => ensureClient().post('/payments/mpesa/initiate', data));
    },
    async getMpesaStatus(
      paymentId: string
    ): Promise<{ status: string; reference?: string; completedAt?: string }> {
      return unwrap(() => ensureClient().get(`/payments/mpesa/${paymentId}/status`));
    },
    async getBankTransferInstructions(): Promise<{
      banks: Array<{
        bankName: string;
        accountName: string;
        accountNumber: string;
        branch?: string;
        swift?: string;
      }>;
      paymentReference: string;
    }> {
      return unwrap(() => ensureClient().get('/payments/bank-transfer/instructions'));
    },
    async confirmBankTransfer(data: {
      amount: number;
      bank: string;
      referenceNumber: string;
      transferDate: string;
      notes?: string;
    }): Promise<{ id: string; status: string }> {
      return unwrap(() => ensureClient().post('/payments/bank-transfer/confirm', data));
    },
    async requestPaymentPlan(data: {
      amount: number;
      months: number;
      reason: string;
      startDate: string;
      notes?: string;
    }): Promise<PaymentPlanRecord> {
      return unwrap(() =>
        ensureClient().post<PaymentPlanRecord>('/payments/plans', data)
      );
    },
    async getPaymentPlans(): Promise<PaymentPlanRecord[]> {
      return unwrap(() =>
        ensureClient().get<PaymentPlanRecord[]>('/payments/plans')
      );
    },
    async getPaymentPlan(id: string): Promise<PaymentPlanRecord> {
      return unwrap(() =>
        ensureClient().get<PaymentPlanRecord>(`/payments/plans/${id}`)
      );
    },
  },

  invoices: {
    async get(id: string): Promise<InvoiceRecord> {
      return unwrap(() => ensureClient().get<InvoiceRecord>(`/invoices/${id}`));
    },
    async downloadPdfUrl(id: string): Promise<{ downloadUrl: string }> {
      return unwrap(() =>
        ensureClient().get<{ downloadUrl: string }>(`/invoices/${id}/download`)
      );
    },
  },

  workOrders: {
    async list(params?: { status?: string }): Promise<WorkOrderRecord[]> {
      return unwrap(() =>
        ensureClient().get<WorkOrderRecord[]>('/work-orders/my-requests', {
          params,
        })
      );
    },
    async get(id: string): Promise<WorkOrderRecord> {
      return unwrap(() =>
        ensureClient().get<WorkOrderRecord>(`/work-orders/${id}`)
      );
    },
    async create(data: {
      title: string;
      description: string;
      category: string;
      priority: string;
      location?: string;
      preferredTimeSlot?: string;
      permissionToEnter?: boolean;
      attachments?: Array<{ type: string; url: string; filename: string }>;
    }): Promise<WorkOrderRecord> {
      return unwrap(() =>
        ensureClient().post<WorkOrderRecord>('/work-orders', data)
      );
    },
    async rate(
      id: string,
      data: {
        rating: number;
        feedback?: string;
        issueResolved?: boolean;
        issueDetails?: string;
        categoryRatings?: Record<string, number>;
        tags?: string[];
        wouldRecommend?: boolean;
      }
    ): Promise<WorkOrderRecord> {
      return unwrap(() =>
        ensureClient().post<WorkOrderRecord>(`/work-orders/${id}/rate`, data)
      );
    },
    async listMessages(id: string): Promise<MessageRecord[]> {
      return unwrap(() =>
        ensureClient().get<MessageRecord[]>(`/work-orders/${id}/messages`)
      );
    },
    async sendMessage(
      id: string,
      content: string
    ): Promise<MessageRecord> {
      return unwrap(() =>
        ensureClient().post<MessageRecord>(`/work-orders/${id}/messages`, {
          content,
        })
      );
    },
    async cancel(id: string, reason: string): Promise<WorkOrderRecord> {
      return unwrap(() =>
        ensureClient().post<WorkOrderRecord>(`/work-orders/${id}/cancel`, {
          reason,
        })
      );
    },
  },

  notifications: {
    async list(): Promise<NotificationRecord[]> {
      return unwrap(() =>
        ensureClient().get<NotificationRecord[]>('/notifications')
      );
    },
    async getUnreadCount(): Promise<{ count: number }> {
      return unwrap(() =>
        ensureClient().get<{ count: number }>('/notifications/unread-count')
      );
    },
    async markRead(id: string): Promise<NotificationRecord> {
      return unwrap(() =>
        ensureClient().post<NotificationRecord>(`/notifications/${id}/read`, {})
      );
    },
    async markAllRead(): Promise<{ count: number }> {
      return unwrap(() =>
        ensureClient().post<{ count: number }>('/notifications/read-all', {})
      );
    },
  },

  messaging: {
    async listConversations(): Promise<ConversationRecord[]> {
      return unwrap(() =>
        ensureClient().get<ConversationRecord[]>('/messaging/conversations')
      );
    },
    async getConversation(id: string): Promise<ConversationRecord> {
      return unwrap(() =>
        ensureClient().get<ConversationRecord>(
          `/messaging/conversations/${id}`
        )
      );
    },
    async listMessages(conversationId: string): Promise<MessageRecord[]> {
      return unwrap(() =>
        ensureClient().get<MessageRecord[]>(
          `/messaging/conversations/${conversationId}/messages`
        )
      );
    },
    async sendMessage(
      conversationId: string,
      content: string
    ): Promise<MessageRecord> {
      return unwrap(() =>
        ensureClient().post<MessageRecord>(
          `/messaging/conversations/${conversationId}/messages`,
          { content }
        )
      );
    },
    async markRead(conversationId: string): Promise<ConversationRecord> {
      return unwrap(() =>
        ensureClient().post<ConversationRecord>(
          `/messaging/conversations/${conversationId}/read`,
          {}
        )
      );
    },
    async createConversation(data: {
      subject: string;
      initialMessage: string;
      category?: string;
    }): Promise<ConversationRecord> {
      return unwrap(() =>
        ensureClient().post<ConversationRecord>(
          '/messaging/conversations',
          data
        )
      );
    },
  },

  utilities: {
    async getMeters(): Promise<MeterReading[]> {
      return unwrap(() =>
        ensureClient().get<MeterReading[]>('/utilities/meters')
      );
    },
    async submitReading(data: {
      readings: Array<{ type: string; value: number; unit: string }>;
      photoDataUrl?: string;
      notes?: string;
    }): Promise<{ id: string }> {
      return unwrap(() =>
        ensureClient().post<{ id: string }>('/utilities/readings', data)
      );
    },
    async listBills(): Promise<UtilityBillRecord[]> {
      return unwrap(() =>
        ensureClient().get<UtilityBillRecord[]>('/utilities/bills')
      );
    },
  },

  profile: {
    async get(): Promise<CustomerProfile> {
      return unwrap(() =>
        ensureClient().get<CustomerProfile>('/customers/me')
      );
    },
    async update(data: Partial<CustomerProfile>): Promise<CustomerProfile> {
      return unwrap(() =>
        ensureClient().put<CustomerProfile>('/customers/me', data)
      );
    },
  },

  lease: {
    async getCurrent(): Promise<LeaseRecord> {
      return unwrap(() =>
        ensureClient().get<LeaseRecord>('/leases/current')
      );
    },
    async getRenewalOffer(): Promise<RenewalOfferRecord> {
      return unwrap(() =>
        ensureClient().get<RenewalOfferRecord>(
          '/leases/current/renewal-offer'
        )
      );
    },
    async acceptRenewal(data: {
      termMonths: number;
      agreedToTerms: boolean;
    }): Promise<LeaseRecord> {
      return unwrap(() =>
        ensureClient().post<LeaseRecord>('/leases/current/renew', data)
      );
    },
    async submitMoveOutNotice(data: {
      moveOutDate: string;
      reason: string;
      forwardingAddress?: string;
      notes?: string;
      inspectionDate?: string;
    }): Promise<MoveOutStatusRecord> {
      return unwrap(() =>
        ensureClient().post<MoveOutStatusRecord>(
          '/leases/current/move-out',
          data
        )
      );
    },
    async getMoveOutStatus(): Promise<MoveOutStatusRecord | null> {
      try {
        return await unwrap(() =>
          ensureClient().get<MoveOutStatusRecord>('/leases/current/move-out')
        );
      } catch (err) {
        // Treat 404 as "no notice submitted"
        if (err instanceof Error && /not found|404/i.test(err.message)) {
          return null;
        }
        throw err;
      }
    },
  },

  feedback: {
    async submit(data: {
      subject: string;
      description: string;
      type?: 'COMPLAINT' | 'SUGGESTION' | 'PRAISE' | 'GENERAL';
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
      rating?: number;
    }): Promise<{ id: string }> {
      return unwrap(() =>
        ensureClient().post<{ id: string }>('/feedback', {
          type: data.type ?? 'GENERAL',
          priority: data.priority ?? 'MEDIUM',
          subject: data.subject,
          description: data.description,
          rating: data.rating,
        })
      );
    },
  },

  onboarding: {
    async getStatus() {
      return unwrap(() => ensureClient().get('/onboarding/status'));
    },
    async updateStep(step: string, data: Record<string, unknown>) {
      return unwrap(() =>
        ensureClient().post(`/onboarding/steps/${step}`, data)
      );
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
          // swallow
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
      return unwrap(() =>
        ensureClient().post('/onboarding/inspection', data)
      );
    },
    async complete(data: { checkInDate?: string; signature?: string }) {
      return unwrap(() => ensureClient().post('/onboarding/complete', data));
    },
    async completeOnboarding(data: { checkInDate?: string; signature?: string }) {
      return unwrap(() => ensureClient().post('/onboarding/complete', data));
    },
  },

  inspections: {
    async schedule(data: {
      type: 'move_in' | 'move_out' | 'routine';
      preferredDate: string;
      preferredTimeSlot?: string;
    }) {
      return unwrap(() => ensureClient().post('/inspections', data));
    },
  },

  auth: {
    async requestOtp(phone: string) {
      return unwrap(() =>
        ensureClient().post('/auth/login/otp/request', { phone })
      );
    },
    async verifyOtp(phone: string, otp: string) {
      return unwrap(() =>
        ensureClient().post('/auth/login/otp/verify', { phone, otp })
      );
    },
    async loginWithPassword(identifier: string, password: string) {
      return unwrap(() =>
        ensureClient().post('/auth/login', { identifier, password })
      );
    },
    async register(data: {
      phone: string;
      firstName: string;
      lastName: string;
      email?: string;
      nationalId?: string;
      inviteCode?: string;
    }) {
      return unwrap(() => ensureClient().post('/auth/register', data));
    },
  },

  support: {
    async listTickets() {
      return unwrap(() => ensureClient().get('/support/tickets'));
    },
    async createTicket(data: {
      subject: string;
      description: string;
      category?: string;
      priority?: string;
    }) {
      return unwrap(() => ensureClient().post('/support/tickets', data));
    },
    async getTicket(id: string) {
      return unwrap(() => ensureClient().get(`/support/tickets/${id}`));
    },
    async replyToTicket(id: string, message: string) {
      return unwrap(() =>
        ensureClient().post(`/support/tickets/${id}/replies`, { message })
      );
    },
  },

  emergencies: {
    async report(data: {
      type: string;
      description: string;
      location: string;
      canBeReached: boolean;
      photos?: string[];
    }) {
      return unwrap(() =>
        ensureClient().post('/emergencies/report', data)
      );
    },
  },

  maintenance: {
    async list(status?: string) {
      return unwrap(() =>
        ensureClient().get('/work-orders', {
          params: status ? { status } : undefined,
        })
      );
    },
    async get(id: string) {
      return unwrap(() => ensureClient().get(`/work-orders/${id}`));
    },
    async create(data: {
      category: string;
      title: string;
      description: string;
      priority: string;
      location?: string;
      photos?: string[];
      permissionToEnter?: boolean;
      preferredSlot?: string;
    }) {
      return unwrap(() => ensureClient().post('/work-orders', data));
    },
    async submitFeedback(
      id: string,
      data: { rating: number; comment?: string; photos?: string[] }
    ) {
      return unwrap(() =>
        ensureClient().post(`/work-orders/${id}/feedback`, data)
      );
    },
  },
};

export type CustomerApi = typeof api;
