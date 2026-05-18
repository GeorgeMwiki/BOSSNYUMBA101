/**
 * Tool 1/2 — nggis.verify_title_deed
 */

import type { NggisTool, ToolDeps } from '../types.js';
import { NggisAdapterError } from '../types.js';

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
      const input = rawInput as VerifyTitleDeedInput;
      if (!input?.tenantId || !input?.deedNumber || !input?.stateCode) {
        throw new NggisAdapterError(
          'verify_title_deed requires tenantId, deedNumber, stateCode',
          'INVALID_INPUT',
        );
      }
      return deps.nggis.verifyTitleDeed(input);
    },
  });
