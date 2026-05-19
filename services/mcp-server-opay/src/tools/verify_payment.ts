/**
 * Tool 2/3 — opay.verify_payment
 */

import { z } from 'zod';
import type { OpayTool, ToolDeps } from '../types.js';
import { OpayAdapterError } from '../types.js';

const VerifyPaymentInputSchema = z.object({
  tenantId: z.string().min(1).max(128),
  transactionId: z.string().min(1).max(256),
}).strict();

export interface VerifyPaymentInput {
  readonly tenantId: string;
  readonly transactionId: string;
}

export interface VerifyPaymentOutput {
  readonly status: 'pending' | 'succeeded' | 'failed' | 'reversed';
  readonly amountKobo: number;
  readonly settledAt?: string;
}

export const verifyPaymentTool: OpayTool<VerifyPaymentOutput> = Object.freeze({
  name: 'opay.verify_payment',
  description:
    'Poll OPay for the settlement status of a previously-initiated transaction. Returns status (pending / succeeded / failed / reversed), settled amount (kobo), and settlement timestamp.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      tenantId: { type: 'string', description: 'Tenant scope' },
      transactionId: {
        type: 'string',
        description: 'OPay transaction id from initiate_payment',
      },
    },
    required: ['tenantId', 'transactionId'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object' as const,
    properties: {
      status: {
        type: 'string',
        enum: ['pending', 'succeeded', 'failed', 'reversed'],
      },
      amountKobo: { type: 'integer' },
      settledAt: { type: 'string', format: 'date-time' },
    },
    required: ['status', 'amountKobo'],
  },
  async execute(
    rawInput: unknown,
    deps: ToolDeps,
  ): Promise<VerifyPaymentOutput> {
    const parsed = VerifyPaymentInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const path = parsed.error.issues[0]?.path?.join('.') ?? 'input';
      throw new OpayAdapterError(
        `verify_payment input validation failed at '${path}'`,
        'INVALID_INPUT',
      );
    }
    return deps.opay.verifyPayment(parsed.data);
  },
});
