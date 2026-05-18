/**
 * Tool 1/3 — opay.initiate_payment
 */

import type { OpayTool, ToolDeps } from '../types.js';
import { OpayAdapterError } from '../types.js';

export interface InitiatePaymentInput {
  readonly tenantId: string;
  readonly payerPhone: string;
  readonly amountKobo: number;
  readonly reference: string;
  readonly narration?: string;
}

export interface InitiatePaymentOutput {
  readonly transactionId: string;
  readonly status: 'pending' | 'succeeded' | 'failed';
  readonly reason?: string;
}

export const initiatePaymentTool: OpayTool<InitiatePaymentOutput> =
  Object.freeze({
    name: 'opay.initiate_payment',
    description:
      'Initiate an OPay collection on a Nigerian mobile wallet (payerPhone in E.164, amount in NGN minor units). Returns OPay transactionId + initial status (pending until the payer confirms in the OPay app).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        tenantId: { type: 'string', description: 'Tenant scope' },
        payerPhone: {
          type: 'string',
          description: 'Payer wallet phone (Nigerian E.164: +234...)',
        },
        amountKobo: {
          type: 'integer',
          minimum: 1,
          description: 'Amount in NGN minor units (kobo)',
        },
        reference: {
          type: 'string',
          description: 'Per-tenant idempotency key',
        },
        narration: {
          type: 'string',
          description: 'Optional narration shown in the OPay app',
        },
      },
      required: ['tenantId', 'payerPhone', 'amountKobo', 'reference'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object' as const,
      properties: {
        transactionId: { type: 'string' },
        status: {
          type: 'string',
          enum: ['pending', 'succeeded', 'failed'],
        },
        reason: { type: 'string' },
      },
      required: ['transactionId', 'status'],
    },
    async execute(
      rawInput: unknown,
      deps: ToolDeps,
    ): Promise<InitiatePaymentOutput> {
      const input = rawInput as InitiatePaymentInput;
      if (
        !input?.tenantId ||
        !input?.payerPhone ||
        typeof input.amountKobo !== 'number' ||
        !input?.reference
      ) {
        throw new OpayAdapterError(
          'initiate_payment requires tenantId, payerPhone, amountKobo, reference',
          'INVALID_INPUT',
        );
      }
      return deps.opay.initiatePayment(input);
    },
  });
