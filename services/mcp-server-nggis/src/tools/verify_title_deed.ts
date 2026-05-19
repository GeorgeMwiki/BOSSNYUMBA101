/**
 * Tool 1/2 — nggis.verify_title_deed
 */

import { z } from 'zod';
import type { NggisTool, ToolDeps } from '../types.js';
import { NggisAdapterError } from '../types.js';

const VerifyTitleDeedInputSchema = z.object({
  tenantId: z.string().min(1).max(128),
  deedNumber: z.string().min(1).max(128),
  // 2-letter Nigerian state code (LA, FC, KD, ...).
  stateCode: z.string().regex(/^[A-Z]{2}$/, 'stateCode must be 2 uppercase letters'),
}).strict();

export interface VerifyTitleDeedInput {
  readonly tenantId: string;
  readonly deedNumber: string;
  readonly stateCode: string;
}

export interface VerifyTitleDeedOutput {
  readonly verified: boolean;
  readonly registry: string;
  readonly currentOwner?: string;
  readonly registeredAt?: string;
  readonly encumbrances?: ReadonlyArray<string>;
  readonly reason?: string;
}

export const verifyTitleDeedTool: NggisTool<VerifyTitleDeedOutput> =
  Object.freeze({
    name: 'nggis.verify_title_deed',
    description:
      'Verify a Nigerian title deed by deed number + state code. Fans out to the state registry (LASRRA in Lagos, ABGIS in FCT, KADGIS in Kaduna, fallback per-state lands office). Returns verified flag, current owner, registration date, and any encumbrances.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        tenantId: { type: 'string', description: 'Tenant scope' },
        deedNumber: { type: 'string', description: 'State deed/title number' },
        stateCode: {
          type: 'string',
          description: '2-letter Nigerian state code (LA, FC, KD, ...)',
        },
      },
      required: ['tenantId', 'deedNumber', 'stateCode'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object' as const,
      properties: {
        verified: { type: 'boolean' },
        registry: { type: 'string' },
        currentOwner: { type: 'string' },
        registeredAt: { type: 'string', format: 'date-time' },
        encumbrances: { type: 'array', items: { type: 'string' } },
        reason: { type: 'string' },
      },
      required: ['verified', 'registry'],
    },
    async execute(
      rawInput: unknown,
      deps: ToolDeps,
    ): Promise<VerifyTitleDeedOutput> {
      // CRITICAL-4: validate via Zod before reaching the adapter.
      const parsed = VerifyTitleDeedInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        const path = parsed.error.issues[0]?.path?.join('.') ?? 'input';
        throw new NggisAdapterError(
          `verify_title_deed input validation failed at '${path}'`,
          'INVALID_INPUT',
        );
      }
      return deps.nggis.verifyTitleDeed(parsed.data);
    },
  });
