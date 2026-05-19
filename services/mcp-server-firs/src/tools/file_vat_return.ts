/**
 * Tool 1/3 — firs.file_vat_return
 *
 * Files a monthly VAT return with FIRS TaxProMax (or NRS equivalent).
 * Input is a per-tenant TIN + period (YYYY-MM) + gross sales + input
 * VAT credit, all in NGN minor units (kobo). Output is the FIRS
 * acknowledgement id, computed output VAT, net payable, and a status
 * enum.
 */

import { z } from 'zod';
import type { FirsTool, ToolDeps } from '../types.js';
import { FirsAdapterError } from '../types.js';

const FileVatReturnInputSchema = z.object({
  tenantId: z.string().min(1).max(128),
  tin: z.string().regex(/^\d{12,13}$/, 'tin must be 12 or 13 digits'),
  // VAT is monthly in Nigeria; period is YYYY-MM.
  period: z.string().regex(/^\d{4}-\d{2}$/, 'period must be YYYY-MM'),
  grossSalesKobo: z.number().int().nonnegative().max(10_000_000_000_000),
  inputVatKobo: z.number().int().nonnegative().max(10_000_000_000_000),
}).strict();

export interface FileVatReturnInput {
  readonly tenantId: string;
  readonly tin: string;
  readonly period: string;
  readonly grossSalesKobo: number;
  readonly inputVatKobo: number;
}

export interface FileVatReturnOutput {
  readonly acknowledgementId: string;
  readonly outputVatKobo: number;
  readonly netPayableKobo: number;
  readonly filingStatus: 'accepted' | 'pending' | 'rejected';
}

export const fileVatReturnTool: FirsTool<FileVatReturnOutput> = Object.freeze({
  name: 'firs.file_vat_return',
  description:
    'File a Nigerian monthly VAT return with FIRS TaxProMax / NRS. Computes output VAT at 7.5 % of gross sales (Finance Act 2020), nets off input-VAT credit, returns the FIRS acknowledgement id and filing status.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      tenantId: { type: 'string', description: 'Tenant scope' },
      tin: {
        type: 'string',
        description: '12-digit FIRS TIN or 13-digit NRS Tax ID',
      },
      period: {
        type: 'string',
        description: 'YYYY-MM (filing period — VAT is monthly in Nigeria)',
      },
      grossSalesKobo: {
        type: 'integer',
        minimum: 0,
        description: 'Taxable sales in NGN minor units (kobo)',
      },
      inputVatKobo: {
        type: 'integer',
        minimum: 0,
        description: 'Recoverable input-VAT credit in kobo',
      },
    },
    required: ['tenantId', 'tin', 'period', 'grossSalesKobo', 'inputVatKobo'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object' as const,
    properties: {
      acknowledgementId: { type: 'string' },
      outputVatKobo: { type: 'integer' },
      netPayableKobo: { type: 'integer' },
      filingStatus: { type: 'string', enum: ['accepted', 'pending', 'rejected'] },
    },
    required: ['acknowledgementId', 'outputVatKobo', 'netPayableKobo', 'filingStatus'],
  },
  async execute(rawInput: unknown, deps: ToolDeps): Promise<FileVatReturnOutput> {
    // CRITICAL-4: validate via Zod before reaching the adapter.
    const parsed = FileVatReturnInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const path = parsed.error.issues[0]?.path?.join('.') ?? 'input';
      throw new FirsAdapterError(
        `file_vat_return input validation failed at '${path}'`,
        'INVALID_INPUT',
      );
    }
    return deps.firs.fileVatReturn(parsed.data);
  },
});
