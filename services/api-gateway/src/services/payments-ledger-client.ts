/**
 * Payments-Ledger service client (api-gateway side).
 *
 * The real M-Pesa STK initiation, double-entry ledger posting, and intent
 * lifecycle live in the standalone `services/payments-ledger` deployable
 * (Express, see its `src/server.ts`). The gateway reaches it over HTTP — it
 * is a separate container in docker-compose, so duplicating STK/Daraja
 * logic in-process would violate the deployment topology and the
 * "money path through one engine" invariant.
 *
 * AUTH: payments-ledger authenticates the SAME Supabase Bearer JWT the
 * customer-app sends to the gateway and derives the tenant from the JWT
 * claim (never from body/headers — its CRITICAL-2 design). We therefore
 * forward the caller's `Authorization` header verbatim; tenant scoping
 * flows through automatically and no cross-tenant claim is possible.
 *
 * This module is a thin, immutable wrapper: it validates the engine's
 * responses with zod at the boundary and surfaces typed results. It never
 * fabricates a status — a missing engine URL or a non-2xx response is an
 * explicit error the route maps to a meaningful client status.
 */
import { z } from 'zod';

/** Engine intent statuses (mirror of payments-ledger `PaymentStatus`). */
export const LEDGER_INTENT_STATUSES = [
  'PENDING',
  'PROCESSING',
  'REQUIRES_ACTION',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
] as const;

const MoneyDataSchema = z.object({
  amount: z.number(),
  currency: z.string(),
});

/**
 * Response of `POST /api/v1/payments` on the engine. When a phone number is
 * supplied as `paymentMethodId`, the engine immediately initiates a real
 * STK push and returns `status: 'PROCESSING'` with the provider's
 * CheckoutRequestID surfaced indirectly via the persisted intent. The
 * `paymentIntentId` is the engine-side handle we link to the gateway row.
 */
const CreateIntentResponseSchema = z.object({
  paymentIntentId: z.string(),
  status: z.enum(LEDGER_INTENT_STATUSES),
  clientSecret: z.string().optional(),
  redirectUrl: z.string().optional(),
  instructions: z.string().optional(),
});
export type CreateIntentResponse = z.infer<typeof CreateIntentResponseSchema>;

/**
 * Response of `GET /api/v1/payments/:id` on the engine — the poll + receipt
 * source of truth. `receiptUrl` is populated once the intent is SUCCEEDED.
 */
const GetIntentResponseSchema = z.object({
  id: z.string(),
  status: z.enum(LEDGER_INTENT_STATUSES),
  amount: MoneyDataSchema.optional(),
  netAmount: MoneyDataSchema.optional(),
  receiptUrl: z.string().optional().nullable(),
  failureReason: z.string().optional().nullable(),
  paidAt: z.union([z.string(), z.date()]).optional().nullable(),
});
export type GetIntentResponse = z.infer<typeof GetIntentResponseSchema>;

/** Payment-intent type accepted by the engine's `CreatePaymentSchema`. */
export const LEDGER_PAYMENT_TYPES = [
  'RENT_PAYMENT',
  'DEPOSIT_PAYMENT',
  'LATE_FEE_PAYMENT',
  'MAINTENANCE_PAYMENT',
  'UTILITY_PAYMENT',
  'CONTRIBUTION',
  'OTHER',
] as const;
export type LedgerPaymentType = (typeof LEDGER_PAYMENT_TYPES)[number];

export interface CreateIntentInput {
  readonly customerId: string;
  readonly leaseId?: string;
  readonly type: LedgerPaymentType;
  /** Minor units (integer) — matches the engine's `amount.amount`. */
  readonly amountMinor: number;
  readonly currency: string;
  readonly description: string;
  /**
   * For M-Pesa this is the payer phone number; the engine routes it to the
   * provider's STK push. Omit to create a PENDING intent without initiation.
   */
  readonly paymentMethodId?: string;
  /** Free-form linkage (e.g. accountReference, gatewayPaymentId). */
  readonly metadata?: Record<string, string>;
  /** Idempotency key — the engine dedups on (key, tenant). */
  readonly idempotencyKey?: string;
}

/** Typed error so the route can map engine failures to a client status. */
export class PaymentsLedgerError extends Error {
  public readonly code: 'NOT_CONFIGURED' | 'UPSTREAM_ERROR' | 'BAD_RESPONSE';
  public readonly status?: number;

  constructor(
    code: 'NOT_CONFIGURED' | 'UPSTREAM_ERROR' | 'BAD_RESPONSE',
    message: string,
    status?: number,
  ) {
    super(message);
    this.name = 'PaymentsLedgerError';
    this.code = code;
    this.status = status;
  }
}

export interface PaymentsLedgerClient {
  /** True when a service URL is configured (env wired). */
  readonly isConfigured: boolean;
  createIntent(
    input: CreateIntentInput,
    authorizationHeader: string,
  ): Promise<CreateIntentResponse>;
  getIntent(
    intentId: string,
    authorizationHeader: string,
  ): Promise<GetIntentResponse>;
}

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Build a payments-ledger HTTP client. The base URL comes from
 * `PAYMENTS_LEDGER_URL` (read at bootstrap and passed in — routes never read
 * `process.env` directly per the project rule).
 */
export function createPaymentsLedgerClient(opts: {
  readonly baseUrl: string | undefined;
  readonly timeoutMs?: number;
  readonly fetchImpl?: typeof fetch;
}): PaymentsLedgerClient {
  const baseUrl = opts.baseUrl?.trim().replace(/\/$/, '');
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const doFetch = opts.fetchImpl ?? fetch;

  function requireBaseUrl(): string {
    if (!baseUrl) {
      throw new PaymentsLedgerError(
        'NOT_CONFIGURED',
        'PAYMENTS_LEDGER_URL is not configured — cannot initiate payment',
      );
    }
    return baseUrl;
  }

  async function call<T>(
    path: string,
    init: RequestInit,
    schema: z.ZodType<T>,
  ): Promise<T> {
    const url = `${requireBaseUrl()}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await doFetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'payments-ledger request failed';
      throw new PaymentsLedgerError('UPSTREAM_ERROR', message);
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      // Read the engine's error body for diagnostics without leaking it raw
      // to the client (the route decides what to surface).
      let detail = '';
      try {
        detail = await res.text();
      } catch {
        detail = '';
      }
      throw new PaymentsLedgerError(
        'UPSTREAM_ERROR',
        `payments-ledger ${path} returned ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
        res.status,
      );
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new PaymentsLedgerError(
        'BAD_RESPONSE',
        `payments-ledger ${path} returned a non-JSON body`,
        res.status,
      );
    }

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new PaymentsLedgerError(
        'BAD_RESPONSE',
        `payments-ledger ${path} response failed validation: ${parsed.error.message}`,
        res.status,
      );
    }
    return parsed.data;
  }

  return {
    isConfigured: Boolean(baseUrl),

    async createIntent(input, authorizationHeader) {
      const body = {
        customerId: input.customerId,
        leaseId: input.leaseId,
        type: input.type,
        amount: { amount: input.amountMinor, currency: input.currency },
        description: input.description,
        paymentMethodId: input.paymentMethodId,
        metadata: input.metadata,
        idempotencyKey: input.idempotencyKey,
      };
      return call('/api/v1/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authorizationHeader,
        },
        body: JSON.stringify(body),
      }, CreateIntentResponseSchema);
    },

    async getIntent(intentId, authorizationHeader) {
      return call(
        `/api/v1/payments/${encodeURIComponent(intentId)}`,
        {
          method: 'GET',
          headers: { Authorization: authorizationHeader },
        },
        GetIntentResponseSchema,
      );
    },
  };
}
