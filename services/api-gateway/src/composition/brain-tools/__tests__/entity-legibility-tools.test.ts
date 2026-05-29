/**
 * Entity legibility tools — handler integrity tests.
 *
 * Verifies the six read-only entity tools (resolve / full_picture /
 * recent / search / trace / deduplicate) wire the HTTP client correctly,
 * pass `tenantId` and the input shape, and fall back to empty results
 * when no HTTP client is injected (offline / test path).
 *
 * Real-estate retailored — examples use properties / units / leases /
 * tenants / rent_invoices.
 */

import { describe, expect, it } from 'vitest';
import {
  entityResolveTool,
  entityFullPictureTool,
  entityRecentTool,
  entitySearchTool,
  entityTraceTool,
  entityDeduplicateTool,
  ENTITY_LEGIBILITY_TOOLS,
} from '../entity-legibility-tools.js';
import type { PersonaToolHttpClient } from '../types.js';

const baseCtx = {
  tenantId: 'tnt-test',
  actorId: 'usr-test',
  personaSlug: 'T1_owner_strategist',
};

interface CapturedCall {
  readonly path: string;
  readonly body: Readonly<Record<string, unknown>>;
}

function makeCapturingClient(
  fixedResponse: unknown,
): { client: PersonaToolHttpClient; calls: CapturedCall[] } {
  const calls: CapturedCall[] = [];
  const client: PersonaToolHttpClient = {
    async get() {
      throw new Error('GET not used by entity-legibility tools');
    },
    async post<T = unknown>(
      path: string,
      body: Readonly<Record<string, unknown>>,
    ): Promise<T> {
      calls.push({ path, body });
      return fixedResponse as T;
    },
  };
  return { client, calls };
}

describe('ENTITY_LEGIBILITY_TOOLS — catalog shape', () => {
  it('exports exactly 6 tools', () => {
    expect(ENTITY_LEGIBILITY_TOOLS.length).toBe(6);
  });

  it('every tool is LOW stakes + isWrite=false', () => {
    for (const tool of ENTITY_LEGIBILITY_TOOLS) {
      expect(tool.stakes).toBe('LOW');
      expect(tool.isWrite).toBe(false);
      expect(tool.requiresPolicyRuleLiteral).toBe(false);
    }
  });

  it('every tool is owner + admin only', () => {
    for (const tool of ENTITY_LEGIBILITY_TOOLS) {
      expect(tool.personaSlugs).toEqual([
        'T1_owner_strategist',
        'T2_admin_strategist',
      ]);
    }
  });
});

describe('entityResolveTool', () => {
  it('returns empty candidates when no httpClient is injected', async () => {
    const out = await entityResolveTool.handler(
      { phrase: 'the Westlands flat', limit: 5 },
      baseCtx,
    );
    expect(out.candidates).toEqual([]);
    expect(typeof out.queriedAt).toBe('string');
  });

  it('forwards tenantId + phrase + optional hints to the HTTP client', async () => {
    const { client, calls } = makeCapturingClient({
      candidates: [
        {
          kind: 'property',
          id: 'prop-1',
          displayName: 'Westlands Greenfield Apartments',
          summary: '24-unit walk-up',
          lifecycleStage: 'active',
          confidence: 0.92,
        },
      ],
      queriedAt: '2026-05-29T20:00:00Z',
    });
    const out = await entityResolveTool.handler(
      {
        phrase: 'the Westlands flat',
        kindHint: 'property',
        scopeIds: ['scope-1'],
        limit: 3,
      },
      { ...baseCtx, httpClient: client },
    );
    expect(out.candidates.length).toBe(1);
    expect(calls.length).toBe(1);
    expect(calls[0]!.path).toBe('/internal/entity-legibility/resolve');
    expect(calls[0]!.body).toMatchObject({
      tenantId: 'tnt-test',
      phrase: 'the Westlands flat',
      kindHint: 'property',
      scopeIds: ['scope-1'],
      limit: 3,
    });
  });
});

describe('entityFullPictureTool', () => {
  it('returns empty 1-hop graph when offline', async () => {
    const out = await entityFullPictureTool.handler(
      { kind: 'lease', id: 'lease-1' },
      baseCtx,
    );
    expect(out.relatedEntities).toEqual([]);
    expect(out.entity.kind).toBe('lease');
    expect(out.entity.id).toBe('lease-1');
  });
});

describe('entityRecentTool', () => {
  it('forwards optional kind + sinceIso when provided', async () => {
    const { client, calls } = makeCapturingClient({
      entities: [],
      queriedAt: '2026-05-29T20:00:00Z',
    });
    await entityRecentTool.handler(
      { kind: 'maintenance_ticket', sinceIso: '2026-05-29T00:00:00Z', limit: 10 },
      { ...baseCtx, httpClient: client },
    );
    expect(calls[0]!.body).toMatchObject({
      kind: 'maintenance_ticket',
      sinceIso: '2026-05-29T00:00:00Z',
      limit: 10,
    });
  });

  it('omits sinceIso when not provided', async () => {
    const { client, calls } = makeCapturingClient({
      entities: [],
      queriedAt: '2026-05-29T20:00:00Z',
    });
    await entityRecentTool.handler({ limit: 20 }, { ...baseCtx, httpClient: client });
    expect(calls[0]!.body).not.toHaveProperty('sinceIso');
  });
});

describe('entitySearchTool', () => {
  it('passes kindFilter when supplied', async () => {
    const { client, calls } = makeCapturingClient({
      hits: [],
      queriedAt: '2026-05-29T20:00:00Z',
    });
    await entitySearchTool.handler(
      {
        query: 'anything related to Westlands',
        kindFilter: ['property', 'lease'],
        limit: 10,
      },
      { ...baseCtx, httpClient: client },
    );
    expect(calls[0]!.body).toMatchObject({
      query: 'anything related to Westlands',
      kindFilter: ['property', 'lease'],
      limit: 10,
    });
  });
});

describe('entityTraceTool', () => {
  it('caps maxHops at 5 via schema', () => {
    const result = entityTraceTool.inputSchema.safeParse({
      sourceKind: 'maintenance_ticket',
      sourceId: 'tkt-1',
      maxHops: 99,
    });
    expect(result.success).toBe(false);
  });

  it('defaults maxHops to 3 when omitted', () => {
    const result = entityTraceTool.inputSchema.parse({
      sourceKind: 'maintenance_ticket',
      sourceId: 'tkt-1',
    });
    expect(result.maxHops).toBe(3);
  });
});

describe('entityDeduplicateTool', () => {
  it('returns empty duplicates when offline', async () => {
    const out = await entityDeduplicateTool.handler(
      { kind: 'tenant', id: 'tnt-resident-1' },
      baseCtx,
    );
    expect(out.suspectedDuplicates).toEqual([]);
  });
});

describe('input schema rejection — real-estate vocab is open but bounded', () => {
  it('rejects phrase > 300 chars', () => {
    const long = 'x'.repeat(301);
    const result = entityResolveTool.inputSchema.safeParse({ phrase: long });
    expect(result.success).toBe(false);
  });

  it('rejects empty phrase', () => {
    const result = entityResolveTool.inputSchema.safeParse({ phrase: '' });
    expect(result.success).toBe(false);
  });
});
