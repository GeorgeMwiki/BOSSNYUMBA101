/**
 * Typed gateway helpers for the collections surface (arrears + payments).
 *
 * The `@bossnyumba/api-client` barrel re-exports `getApiClient` with a
 * mangled return type under NodeNext (the known tsup namespace/type
 * drift — see the `*-types` tsconfig aliases). We therefore re-type the
 * resolved client through the source `ApiClient` so the generic
 * `.get<T>()` / `.post<T>()` calls keep their types. No `any`, no
 * non-null casts on the wire payloads.
 */

import { getApiClient } from '@bossnyumba/api-client';
import type { ApiClient } from '@bossnyumba/api-client/client-types';
import type { ArrearsCase } from '@bossnyumba/api-client/arrears-types';

function client(): ApiClient {
  return getApiClient() as unknown as ApiClient;
}

export type { ArrearsCase };

/** Payment intent row as shaped by the gateway `mapPaymentRow`. */
export interface PaymentRow {
  readonly id: string;
  readonly paymentNumber?: string;
  readonly status: string;
  readonly paymentMethod?: string;
  readonly amount: number;
  readonly currency: string;
  readonly netAmount?: number;
  readonly description?: string;
  readonly createdAt?: string;
  readonly completedAt?: string;
}

export type PaymentChannel =
  | 'cash'
  | 'bank_transfer'
  | 'mpesa'
  | 'cheque'
  | 'card';

export interface RecordPaymentInput {
  readonly customerId: string;
  readonly leaseId?: string;
  readonly amount: number;
  readonly currency: string;
  readonly channel: PaymentChannel;
  readonly phoneNumber?: string;
  readonly description?: string;
}

/** List open arrears cases for the authenticated tenant. */
export async function listOpenArrearsCases(): Promise<ReadonlyArray<ArrearsCase>> {
  const res = await client().get<ArrearsCase[]>('/arrears/cases', {
    params: { status: 'open' },
  });
  return res.data ?? [];
}

/** Fetch a single payment intent. */
export async function getPayment(paymentId: string): Promise<PaymentRow> {
  const res = await client().get<PaymentRow>(`/payments/${paymentId}`);
  return res.data;
}

/**
 * Record an operator-initiated payment: create the intent, then settle it
 * on the chosen channel. Returns the processed intent.
 */
export async function recordPayment(
  input: RecordPaymentInput,
): Promise<PaymentRow> {
  const created = await client().post<PaymentRow>('/payments', {
    customerId: input.customerId,
    leaseId:
      input.leaseId && input.leaseId.length > 0 ? input.leaseId : undefined,
    amount: { amount: input.amount, currency: input.currency },
    description:
      input.description && input.description.length > 0
        ? input.description
        : undefined,
  });

  const processed = await client().post<PaymentRow>(
    `/payments/${created.data.id}/process`,
    {
      channel: input.channel,
      ...(input.channel === 'mpesa' && input.phoneNumber
        ? { phoneNumber: input.phoneNumber }
        : {}),
    },
  );
  return processed.data;
}
