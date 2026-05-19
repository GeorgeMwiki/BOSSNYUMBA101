/**
 * Tool 2/3 — firs.verify_tin
 *
 * Verifies a Nigerian taxpayer identifier. Two formats coexist:
 *   - 12 digits: legacy FIRS TIN (pre-2026)
 *   - 13 digits: NRS Tax ID (Nigeria Tax Act 2025, effective 2026-01-01,
 *     derived from NIN or CAC RC number)
 * The adapter discriminates by shape and returns the issuing authority.
 */

import { z } from 'zod';
import type { FirsTool, ToolDeps } from '../types.js';
import { FirsAdapterError } from '../types.js';

const VerifyTinInputSchema = z.object({
  tenantId: z.string().min(1).max(128),
  // 12-digit legacy FIRS TIN or 13-digit NRS Tax ID.
  tin: z.string().regex(/^\d{12,13}$/, 'tin must be 12 or 13 digits'),
}).strict();

export interface VerifyTinInput {
  readonly tenantId: string;
  readonly tin: string;
}

export interface VerifyTinOutput {
  readonly verified: boolean;
  readonly issuer: 'firs' | 'nrs' | 'unknown';
  readonly taxpayerName?: string;
  readonly reason?: string;
}

export const verifyTinTool: FirsTool<VerifyTinOutput> = Object.freeze({
  name: 'firs.verify_tin',
  description:
    'Verify a Nigerian taxpayer identifier (legacy 12-digit FIRS TIN OR 13-digit NRS Tax ID). Returns verified flag, issuer ("firs" | "nrs" | "unknown"), and taxpayer name when verified.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      tenantId: { type: 'string', description: 'Tenant scope' },
      tin: { type: 'string', description: '12 or 13 digits' },
    },
    required: ['tenantId', 'tin'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object' as const,
    properties: {
      verified: { type: 'boolean' },
      issuer: { type: 'string', enum: ['firs', 'nrs', 'unknown'] },
      taxpayerName: { type: 'string' },
      reason: { type: 'string' },
    },
    required: ['verified', 'issuer'],
  },
  async execute(rawInput: unknown, deps: ToolDeps): Promise<VerifyTinOutput> {
    // CRITICAL-4: Zod-validate input BEFORE calling the adapter. The
    // MCP JSON-Schema fragment is documentation-only and is not
    // enforced by the SDK.
    const parsed = VerifyTinInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const path = parsed.error.issues[0]?.path?.join('.') ?? 'input';
      throw new FirsAdapterError(
        `verify_tin input validation failed at '${path}'`,
        'INVALID_INPUT',
      );
    }
    return deps.firs.verifyTin(parsed.data);
  },
});
