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
import { getAccessToken, getSupabase } from '@/lib/supabase';

/**
 * Resolve the api-gateway base URL. Always returns a `/api/v1`-suffixed
 * URL.
 *
 * Production guard: when `NEXT_PUBLIC_API_URL` / `API_URL` is unset AND
 * `NODE_ENV=production`, this THROWS rather than silently falling back to
 * `http://localhost:4001/api/v1` (which would either ERR_CONNECTION or —
 * worse — hit a colocated dev API by accident).
 *
 * Exported so every customer-app page imports the same single helper —
 * previously four pages (`lease/renewal`, `maintenance/triage`,
 * `maintenance/new`, `notifications`) each duplicated the dev-fallback
 * without the production throw. Audited as CRITICAL in
 * `.audit/production-readiness-gaps.md`.
 */
export function getApiBaseUrl(): string {
  // Accept either variable on any runtime. Server-side only envs (API_URL)
  // are preferred when available; otherwise fall back to the public var,
  // which is inlined at build time and therefore always defined the same
  // way on both client and server.
  const url =
    process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL;

  if (url?.trim()) {
    const base = url.trim().replace(/\/$/, '');
    return base.endsWith('/api/v1') ? base : `${base}/api/v1`;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEXT_PUBLIC_API_URL (or API_URL server-side) is required in production');
  }

  // Dev fallback: the gateway binds to PORT=4001 by default (matches every
  // other app's vite proxy target). The legacy `:4000` default broke
  // every API call in customer-app dev with ERR_CONNECTION_REFUSED —
  // caught by Wave-20 Agent N's Playwright smoke.
  return 'http://localhost:4001/api/v1';
}

function ensureClient() {
  if (!hasApiClient()) {
    const client = initializeApiClient({
      baseUrl: getApiBaseUrl(),
      timeout: 15000,
      retries: 1,
      onAuthError: () => {
        // The Supabase access token is the single credential. On a 401 the
        // session is stale/expired — clear it and bounce to login. signOut
        // is fire-and-forget; the AuthContext's onAuthStateChange resets
        // React state when it completes.
        void getSupabase().auth.signOut().catch(() => undefined);
        if (typeof window !== 'undefined') {
          window.location.href = '/auth/login';
        }
      },
    });

    // Resolve the bearer from the live Supabase session on EVERY request,
    // so the data API, chat, and brain all use one credential and pick up
    // token refreshes automatically. getAccessToken() refreshes on the fly
    // via supabase-js and returns null when signed out (no Authorization
    // header is then sent and the gateway replies 401 → onAuthError).
    client.addRequestInterceptor(async (config) => {
      const token = await getAccessToken();
      if (token) {
        client.setAccessToken(token);
      } else {
        client.clearTokens();
      }
      return config;
    });

    return client;
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

/** A payment intent row as returned by `POST /payments` / `GET /payments/:id`. */
export interface PaymentIntent {
  readonly id: string;
  readonly status: string;
  readonly amount: number;
  readonly currency: string;
  readonly paymentNumber?: string;
  readonly description?: string;
}

/** A payment list row (`/payments/pending`, `/payments/history`). */
export interface PaymentRow {
  readonly id: string;
  readonly status: string;
  readonly amount: number;
  readonly currency: string;
  readonly paymentNumber?: string;
  readonly description?: string;
  readonly paymentMethod?: string;
  readonly completedAt?: string;
  readonly createdAt?: string;
}

/** A single money amount + ISO-4217 code. */
export interface MoneyAmount {
  readonly amount: number;
  readonly currency: string;
}

/**
 * One section of a real onboarding document. `data` carries the
 * tenant's actual lease values (dates, money amounts, etc.) keyed by
 * field; the client formats money via its currency-preference hook and
 * never trusts a server-side currency symbol.
 */
export interface OnboardingDocumentSection {
  readonly title: string;
  readonly data: Readonly<Record<string, unknown>>;
}

/**
 * A real document the resident must e-sign, built server-side from
 * their actual lease. No field is fabricated.
 */
export interface OnboardingDocument {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly leaseNumber?: string;
  readonly where?: string;
  readonly property?: string;
  readonly unit?: string;
  readonly currency?: string;
  readonly documentUrl?: string | null;
  readonly sections: ReadonlyArray<OnboardingDocumentSection>;
  readonly signed: boolean;
  readonly signedAt?: string;
}

/** Response of `GET /onboarding/documents`. Empty array = nothing to sign yet. */
export interface OnboardingDocumentsResponse {
  readonly documents: ReadonlyArray<OnboardingDocument>;
}

/** A real utility account/meter provisioned for the resident's unit. */
export interface OnboardingUtilityAccount {
  readonly id: string;
  readonly utilityType: string;
  readonly provider: string;
  readonly accountNumber: string;
  readonly meterNumber: string | null;
}

/** Response of `GET /onboarding/utilities`. Empty array = no meters assigned yet. */
export interface OnboardingUtilitiesResponse {
  readonly utilities: ReadonlyArray<OnboardingUtilityAccount>;
}

/** Response of `GET /payments/balance`. */
export interface PaymentBalance {
  readonly totalDue: MoneyAmount;
  readonly breakdown: ReadonlyArray<{ readonly type: string; readonly amount: MoneyAmount }>;
}

/**
 * Result of `POST /payments/:id/process`. For M-Pesa the gateway links the
 * row to a payments-ledger engine intent and echoes `instructions` for the
 * STK prompt. Polling still keys off the gateway `id`, not `intentId`.
 */
export interface ProcessPaymentResult {
  readonly id: string;
  readonly status: string;
  readonly intentId?: string;
  readonly instructions?: string;
}

/** Status payload returned by `GET /payments/:id/status`. */
export interface IntentStatus {
  readonly status: string;
  readonly receiptNumber?: string;
  readonly reason?: string;
}

/** A maintenance/dispute case as returned by the `/cases` endpoints. */
export interface CaseRecord {
  readonly id: string;
  readonly caseNumber: string;
  readonly title: string;
  readonly description?: string;
  readonly type: string;
  readonly severity: string;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt?: string;
}

/** A durable case evidence attachment as returned by the evidence endpoints. */
export interface EvidenceRecord {
  readonly id: string;
  readonly caseId: string;
  readonly fileName: string;
  readonly fileUrl: string;
  readonly mimeType?: string | null;
  readonly fileSizeBytes?: number | null;
  readonly caption?: string | null;
  readonly createdAt?: string;
}

/** A tenant document as returned by `GET /documents`. */
export interface DocumentRecord {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly category: string;
  readonly mimeType?: string;
  readonly size?: number;
  readonly url?: string;
  readonly verificationStatus?: string;
  readonly createdAt?: string;
}

export const api = {
  payments: {
    async getBalance(): Promise<PaymentBalance> {
      return requireLiveData<PaymentBalance>(() => ensureClient().get('/payments/balance'));
    },

    async getHistory(page = 1, limit = 20): Promise<PaymentRow[]> {
      return requireLiveData<PaymentRow[]>(() =>
        ensureClient().get('/payments/history', {
          params: { page, limit },
        })
      );
    },

    async getPending(): Promise<PaymentRow[]> {
      return requireLiveData<PaymentRow[]>(() => ensureClient().get('/payments/pending'));
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

    /**
     * Create a payment intent row (status `pending`) for the given amount.
     * The returned `id` is the gateway payment id that `processPayment`,
     * `getIntentStatus`, and `getReceiptUrl` all key off. Used by the
     * generic "Pay Now" flow where no pending row exists yet — pending
     * payments returned by `getPending` already carry an `id` and skip
     * this step.
     */
    async createIntent(data: {
      amount: number;
      currency: string;
      description?: string;
      leaseId?: string;
    }): Promise<PaymentIntent> {
      return requireLiveData<PaymentIntent>(() =>
        ensureClient().post('/payments', {
          amount: { amount: data.amount, currency: data.currency },
          description: data.description,
          leaseId: data.leaseId,
        }),
      );
    },

    /**
     * Trigger settlement of an existing payment intent. For M-Pesa this
     * fires a live STK push (the gateway calls payments-ledger → Daraja).
     * Idempotent server-side via a deterministic key derived from `id`, so
     * a retry reuses the same engine intent rather than prompting the
     * customer's phone twice.
     */
    async processPayment(
      id: string,
      data: { channel: string; phoneNumber?: string; accountReference?: string },
    ): Promise<ProcessPaymentResult> {
      return requireLiveData<ProcessPaymentResult>(() =>
        ensureClient().post(`/payments/${id}/process`, data),
      );
    },

    /**
     * Fetch the signed receipt URL for a completed payment intent. Used by
     * `ReceiptDownloadButton` after Stripe/M-Pesa report SUCCEEDED — the
     * gateway returns a short-lived URL pointing at storage.
     */
    async getReceiptUrl(intentId: string): Promise<{ url: string }> {
      return requireLiveData(() =>
        ensureClient().get(`/payments/${intentId}/receipt`),
      );
    },

    /**
     * Poll a payment intent's status while the user is waiting for an
     * STK Push to resolve. Returns the canonical `PENDING | PROCESSING |
     * REQUIRES_ACTION | SUCCEEDED | FAILED | CANCELLED` status plus, when
     * terminal, the receipt/failure detail the gateway reconciled from the
     * payments-ledger engine.
     */
    async getIntentStatus(intentId: string): Promise<IntentStatus> {
      return requireLiveData<IntentStatus>(() =>
        ensureClient().get(`/payments/${intentId}/status`),
      );
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

    /**
     * Fetch the REAL documents the signed-in resident must e-sign,
     * derived server-side from their actual lease (unit, rent, deposit,
     * term dates — all the tenant's own record). A fresh resident with
     * no lease yet receives `{ documents: [] }` so the UI can render an
     * honest "nothing to sign yet" pending state. Never fabricated.
     */
    async getDocuments(): Promise<OnboardingDocumentsResponse> {
      return requireLiveData<OnboardingDocumentsResponse>(() =>
        ensureClient().get('/onboarding/documents'),
      );
    },

    /**
     * Fetch the REAL utility accounts/meters provisioned for the
     * resident's unit (provider, account number, meter number). A fresh
     * resident whose unit has no utility accounts yet receives
     * `{ utilities: [] }` → honest empty/pending state. Meter
     * identifiers are NEVER fabricated.
     */
    async getUtilities(): Promise<OnboardingUtilitiesResponse> {
      return requireLiveData<OnboardingUtilitiesResponse>(() =>
        ensureClient().get('/onboarding/utilities'),
      );
    },

    async updateStep(step: string, data: Record<string, unknown>) {
      return requireLiveData(() => ensureClient().post(`/onboarding/steps/${step}`, data));
    },

    async uploadDocument(formData: FormData) {
      // Multipart upload bypasses the api-client (which JSON-encodes), so we
      // resolve the Supabase bearer directly here to keep one credential.
      const token = await getAccessToken();

      const response = await fetch(`${getApiBaseUrl()}/onboarding/documents`, {
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

  cases: {
    /**
     * Create a maintenance case. The gateway defaults `type` to
     * `maintenance_dispute` and `severity` to `medium` when omitted; the
     * tenant maintenance form maps its priority/category onto these.
     */
    async create(data: {
      title: string;
      description?: string;
      type?: string;
      severity?: string;
      tags?: readonly string[];
    }): Promise<CaseRecord> {
      return requireLiveData<CaseRecord>(() =>
        ensureClient().post('/cases', data),
      );
    },

    /** List the tenant's cases, newest first. */
    async list(params?: { page?: number; pageSize?: number; status?: string }): Promise<CaseRecord[]> {
      return requireLiveData<CaseRecord[]>(() =>
        ensureClient().get('/cases', { params: params ?? {} }),
      );
    },

    /**
     * Upload one photo/document as durable evidence for a case. The blob
     * is streamed to the gateway as multipart/form-data; the gateway
     * stores it in tenant-scoped object storage and persists an
     * `evidence_attachments` row. Multipart bypasses the JSON api-client,
     * so the Supabase bearer is resolved directly here (same single
     * credential the rest of the app uses — see `onboarding.uploadDocument`).
     *
     * Throws on any non-2xx so callers can surface a per-file failure
     * honestly rather than reporting a phantom success.
     */
    async uploadEvidence(
      caseId: string,
      file: File,
      meta?: { caption?: string; fileName?: string },
    ): Promise<EvidenceRecord> {
      const formData = new FormData();
      formData.append('file', file, meta?.fileName ?? file.name);
      if (meta?.caption || meta?.fileName) {
        formData.append(
          'metadata',
          JSON.stringify({
            ...(meta.caption ? { caption: meta.caption } : {}),
            ...(meta.fileName ? { fileName: meta.fileName } : {}),
          }),
        );
      }

      const token = await getAccessToken();
      const response = await fetch(
        `${getApiBaseUrl()}/cases/${encodeURIComponent(caseId)}/evidence`,
        {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        },
      );

      if (!response.ok) {
        let message = 'Evidence upload failed';
        try {
          const data = await response.json();
          message = data?.error?.message ?? data?.message ?? message;
        } catch {
          // Keep the default message when the error body is not JSON.
        }
        throw new Error(message);
      }

      const body = await response.json();
      return (body?.data ?? body) as EvidenceRecord;
    },

    /** List a case's durable evidence attachments, newest first. */
    async listEvidence(caseId: string): Promise<EvidenceRecord[]> {
      return requireLiveData<EvidenceRecord[]>(() =>
        ensureClient().get(`/cases/${encodeURIComponent(caseId)}/evidence`),
      );
    },
  },

  documents: {
    /** List the tenant's documents (lease, statements, IDs, reports). */
    async list(params?: {
      page?: number;
      pageSize?: number;
      type?: string;
    }): Promise<DocumentRecord[]> {
      return requireLiveData<DocumentRecord[]>(() =>
        ensureClient().get('/documents', { params: params ?? {} }),
      );
    },
  },
};
