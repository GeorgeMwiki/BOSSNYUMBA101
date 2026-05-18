/**
 * Tool 3/3 — opay.cashflow_lookup
 *
 * Reads aggregated daily inflows / outflows on an OPay wallet over a
 * date window. Used by the underwriting brain to estimate a payer's
 * net cashflow before extending in-app credit / installment plans.
 */

import type { OpayTool, ToolDeps } from '../types.js';
import { OpayAdapterError } from '../types.js';

export interface CashflowLookupInput {
  readonly tenantId: string;
  readonly payerPhone: string;
  readonly fromDate: string;
  readonly toDate: string;
}

export interface CashflowSample {
  readonly date: string;
  readonly inflowsKobo: number;
  readonly outflowsKobo: number;
}

export interface CashflowLookupOutput {
  readonly samples: ReadonlyArray<CashflowSample>;
  readonly totalInflowsKobo: number;
  readonly totalOutflowsKobo: number;
}

export const cashflowLookupTool: OpayTool<CashflowLookupOutput> = Object.freeze({
  name: 'opay.cashflow_lookup',
  description:
    'Read daily inflows / outflows on a Nigerian OPay wallet across a date window. Returns daily samples plus totals (NGN minor units). Used by underwriting to estimate net cashflow before extending credit.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      tenantId: { type: 'string', description: 'Tenant scope' },
      payerPhone: {
        type: 'string',
        description: 'Payer wallet phone (Nigerian E.164)',
      },
      fromDate: {
        type: 'string',
        format: 'date',
        description: 'YYYY-MM-DD inclusive lower bound',
      },
      toDate: {
        type: 'string',
        format: 'date',
        description: 'YYYY-MM-DD inclusive upper bound',
      },
    },
    required: ['tenantId', 'payerPhone', 'fromDate', 'toDate'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object' as const,
    properties: {
      samples: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string', format: 'date' },
            inflowsKobo: { type: 'integer' },
            outflowsKobo: { type: 'integer' },
          },
          required: ['date', 'inflowsKobo', 'outflowsKobo'],
        },
      },
      totalInflowsKobo: { type: 'integer' },
      totalOutflowsKobo: { type: 'integer' },
    },
    required: ['samples', 'totalInflowsKobo', 'totalOutflowsKobo'],
  },
  async execute(
    rawInput: unknown,
    deps: ToolDeps,
  ): Promise<CashflowLookupOutput> {
    const input = rawInput as CashflowLookupInput;
    if (
      !input?.tenantId ||
      !input?.payerPhone ||
      !input?.fromDate ||
      !input?.toDate
    ) {
      throw new OpayAdapterError(
        'cashflow_lookup requires tenantId, payerPhone, fromDate, toDate',
        'INVALID_INPUT',
      );
    }
    return deps.opay.cashflowLookup(input);
  },
});
