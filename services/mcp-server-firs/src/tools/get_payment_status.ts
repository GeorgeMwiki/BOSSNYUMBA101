/**
 * Tool 3/3 — firs.get_payment_status
 *
 * Polls the payment status of a previously-filed VAT return by FIRS
 * acknowledgement id. Returns one of unpaid / paid / partial / overdue
 * plus the outstanding balance in NGN minor units (kobo).
 */

import { z } from 'zod';
import type { FirsTool, ToolDeps } from '../types.js';
import { FirsAdapterError } from '../types.js';

const GetPaymentStatusInputSchema = z.object({
  tenantId: z.string().min(1).max(128),
  acknowledgementId: z.string().min(1).max(256),
}).strict();

export interface GetPaymentStatusInput {
  readonly tenantId: string;
  readonly acknowledgementId: string;
}

export interface GetPaymentStatusOutput {
  readonly status: 'unpaid' | 'paid' | 'partial' | 'overdue';
  readonly balanceKobo: number;
  readonly lastUpdated: string;
}

export const getPaymentStatusTool: FirsTool<GetPaymentStatusOutput> =
  Object.freeze({
    name: 'firs.get_payment_status',
    description:
      'Poll the payment status of a previously-filed Nigerian VAT return by FIRS / NRS acknowledgement id. Returns status + outstanding balance (kobo) + last-updated timestamp.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        tenantId: { type: 'string', description: 'Tenant scope' },
        acknowledgementId: {
          type: 'string',
          description: 'FIRS / NRS ack id returned by file_vat_return',
        },
      },
      required: ['tenantId', 'acknowledgementId'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['unpaid', 'paid', 'partial', 'overdue'],
        },
        balanceKobo: { type: 'integer' },
        lastUpdated: { type: 'string', format: 'date-time' },
      },
      required: ['status', 'balanceKobo', 'lastUpdated'],
    },
    async execute(
      rawInput: unknown,
      deps: ToolDeps,
    ): Promise<GetPaymentStatusOutput> {
      // CRITICAL-4: validate input via Zod before reaching the adapter.
      const parsed = GetPaymentStatusInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        const path = parsed.error.issues[0]?.path?.join('.') ?? 'input';
        throw new FirsAdapterError(
          `get_payment_status input validation failed at '${path}'`,
          'INVALID_INPUT',
        );
      }
      return deps.firs.getPaymentStatus(parsed.data);
    },
  });
