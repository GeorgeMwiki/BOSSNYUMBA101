/**
 * Tool 1/1 — nin.verify_nin
 *
 * Verifies a Nigerian NIN against NIMC NIVS (mocked in this scaffold;
 * real adapter ships in Phase F). Input includes the 11-digit NIN and
 * an optional SHA-256 biometric hash; output reports verified status,
 * NIMC reference id, and a 0..1 match score.
 *
 * Tenant scoping is mandatory — the adapter logs per-tenant audit
 * trails to the platform's central immutable ledger.
 */

import type { NinTool, ToolDeps } from '../types.js';
import { NinAdapterError } from '../types.js';

export interface VerifyNinInput {
  readonly tenantId: string;
  readonly nin: string;
  readonly biometricHash?: string;
}

export interface VerifyNinOutput {
  readonly verified: boolean;
  readonly referenceId: string;
  readonly matchScore: number;
  readonly reason?: string;
}

export const verifyNinTool: NinTool<VerifyNinOutput> = Object.freeze({
  name: 'nin.verify_nin',
  description:
    'Verify a Nigerian National Identification Number against NIMC NIVS. Returns verified flag, NIMC reference id, and 0..1 match score. Pass `biometricHash` (SHA-256) to bind to a fingerprint scan.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      tenantId: { type: 'string', description: 'Tenant scope' },
      nin: {
        type: 'string',
        description: '11-digit NIN issued by NIMC',
      },
      biometricHash: {
        type: 'string',
        description: 'SHA-256 of captured fingerprint (optional)',
      },
    },
    required: ['tenantId', 'nin'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object' as const,
    properties: {
      verified: { type: 'boolean' },
      referenceId: { type: 'string' },
      matchScore: { type: 'number', minimum: 0, maximum: 1 },
      reason: { type: 'string' },
    },
    required: ['verified', 'referenceId', 'matchScore'],
  },
  async execute(rawInput: unknown, deps: ToolDeps): Promise<VerifyNinOutput> {
    const input = rawInput as VerifyNinInput;
    if (!input?.tenantId || !input?.nin) {
      throw new NinAdapterError(
        'verify_nin requires tenantId and nin',
        'INVALID_INPUT',
      );
    }
    const result = await deps.nin.verifyNin({
      tenantId: input.tenantId,
      nin: input.nin,
      ...(input.biometricHash !== undefined
        ? { biometricHash: input.biometricHash }
        : {}),
    });
    return result;
  },
});
