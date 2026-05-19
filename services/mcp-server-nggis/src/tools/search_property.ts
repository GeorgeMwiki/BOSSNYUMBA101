/**
 * Tool 2/2 — nggis.search_property
 */

import { z } from 'zod';
import type { NggisTool, ToolDeps } from '../types.js';
import { NggisAdapterError } from '../types.js';

const SearchPropertyInputSchema = z.object({
  tenantId: z.string().min(1).max(128),
  stateCode: z.string().regex(/^[A-Z]{2}$/, 'stateCode must be 2 uppercase letters'),
  // Free-text search; cap length to bound payload size.
  query: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(100).optional(),
}).strict();

export interface SearchPropertyInput {
  readonly tenantId: string;
  readonly stateCode: string;
  readonly query: string;
  readonly limit?: number;
}

export interface PropertyMatch {
  readonly deedNumber: string;
  readonly address: string;
  readonly registry: string;
  readonly status: 'active' | 'lapsed' | 'disputed';
}

export interface SearchPropertyOutput {
  readonly matches: ReadonlyArray<PropertyMatch>;
}

export const searchPropertyTool: NggisTool<SearchPropertyOutput> = Object.freeze({
  name: 'nggis.search_property',
  description:
    'Search a Nigerian state lands registry by free-text query (address, plot, owner). Returns matching deed numbers + addresses + registry + status (active / lapsed / disputed).',
  inputSchema: {
    type: 'object' as const,
    properties: {
      tenantId: { type: 'string', description: 'Tenant scope' },
      stateCode: {
        type: 'string',
        description: '2-letter Nigerian state code',
      },
      query: { type: 'string', description: 'Free-text search query' },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        description: 'Cap on number of results (default 10)',
      },
    },
    required: ['tenantId', 'stateCode', 'query'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object' as const,
    properties: {
      matches: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            deedNumber: { type: 'string' },
            address: { type: 'string' },
            registry: { type: 'string' },
            status: {
              type: 'string',
              enum: ['active', 'lapsed', 'disputed'],
            },
          },
          required: ['deedNumber', 'address', 'registry', 'status'],
        },
      },
    },
    required: ['matches'],
  },
  async execute(rawInput: unknown, deps: ToolDeps): Promise<SearchPropertyOutput> {
    // CRITICAL-4: validate via Zod before reaching the adapter.
    const parsed = SearchPropertyInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const path = parsed.error.issues[0]?.path?.join('.') ?? 'input';
      throw new NggisAdapterError(
        `search_property input validation failed at '${path}'`,
        'INVALID_INPUT',
      );
    }
    return deps.nggis.searchProperty(parsed.data);
  },
});
