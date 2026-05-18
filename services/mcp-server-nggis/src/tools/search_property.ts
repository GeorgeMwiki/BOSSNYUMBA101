/**
 * Tool 2/2 — nggis.search_property
 */

import type { NggisTool, ToolDeps } from '../types.js';
import { NggisAdapterError } from '../types.js';

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
    const input = rawInput as SearchPropertyInput;
    if (!input?.tenantId || !input?.stateCode || !input?.query) {
      throw new NggisAdapterError(
        'search_property requires tenantId, stateCode, query',
        'INVALID_INPUT',
      );
    }
    return deps.nggis.searchProperty(input);
  },
});
