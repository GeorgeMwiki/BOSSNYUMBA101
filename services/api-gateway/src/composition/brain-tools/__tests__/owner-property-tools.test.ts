/**
 * PT-A — Owner property tools — boot + dispatch contract.
 *
 * Verifies:
 *   - all 42 tools exist with unique ids
 *   - every id is prefixed `owner.`
 *   - every tool is bilingual sw/en in its name field
 *   - every WRITE tool is HIGH/MEDIUM stakes and carries an
 *     `evidenceRef` field or equivalent on its input schema
 *   - every tool is gated on the T1_owner_strategist persona slug
 *   - dispatch through `toBrainToolHandler` succeeds for a representative
 *     read tool with a stub HTTP client
 */

import { describe, expect, it } from 'vitest';
import { OWNER_PROPERTY_TOOLS } from '../owner-property-tools.js';
import { toBrainToolHandler } from '../types.js';
import type {
  PersonaToolGate,
  PersonaToolHttpClient,
} from '../types.js';

describe('PT-A — owner-property-tools', () => {
  it('exposes the expected number of descriptors', () => {
    expect(OWNER_PROPERTY_TOOLS.length).toBe(42);
  });

  it('every descriptor has a unique owner.* id', () => {
    const ids = OWNER_PROPERTY_TOOLS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^owner\./);
    }
  });

  it('every descriptor is bilingual sw/en in its name', () => {
    for (const d of OWNER_PROPERTY_TOOLS) {
      expect(d.name).toContain('(en)');
      expect(d.name).toContain('(sw)');
    }
  });

  it('every descriptor is persona-gated on T1_owner_strategist', () => {
    for (const d of OWNER_PROPERTY_TOOLS) {
      expect(d.personaSlugs).toContain('T1_owner_strategist');
    }
  });

  it('every WRITE descriptor is MEDIUM or HIGH stakes', () => {
    for (const d of OWNER_PROPERTY_TOOLS) {
      if (d.isWrite) {
        expect(['MEDIUM', 'HIGH']).toContain(d.stakes);
      }
    }
  });

  it('high-stakes WRITE descriptors require evidence on the input', () => {
    const highStakesWrites = OWNER_PROPERTY_TOOLS.filter(
      (d) => d.isWrite && d.stakes === 'HIGH',
    );
    expect(highStakesWrites.length).toBeGreaterThan(0);
    for (const d of highStakesWrites) {
      const shape = (
        d.inputSchema as unknown as {
          shape?: Record<string, unknown>;
        }
      ).shape;
      // High-stakes WRITES must accept either evidenceRef or
      // approvalEvidenceRef or reasonEvidenceRef.
      const keys = shape ? Object.keys(shape) : [];
      const hasEvidence = keys.some((k) =>
        k.toLowerCase().includes('evidence'),
      );
      expect(hasEvidence).toBe(true);
    }
  });

  it('dispatch contract: cashflow.forecast yields a structured result via stub client', async () => {
    const stub: PersonaToolHttpClient = {
      async get<T>(): Promise<T> {
        return {
          horizonMonths: 6,
          byMonth: [],
          currency: 'TZS',
        } as unknown as T;
      },
      async post<T>(): Promise<T> {
        return {} as T;
      },
    };
    const gate: PersonaToolGate = {
      killSwitchOpen: false,
      resolvePersonaSlug: () => 'T1_owner_strategist',
      httpClient: stub,
    };
    const handler = toBrainToolHandler(
      OWNER_PROPERTY_TOOLS.find(
        (d) => d.id === 'owner.cashflow.forecast',
      )!,
      gate,
    );
    const result = await handler.execute(
      { horizonMonths: 6 },
      {
        tenant: { tenantId: 't1' },
        actor: { id: 'a1' },
      } as never,
    );
    expect(result.ok).toBe(true);
  });

  it('dispatch contract: rejects the catalog when persona slug is not owner', async () => {
    const gate: PersonaToolGate = {
      killSwitchOpen: false,
      resolvePersonaSlug: () => 'T3_module_manager',
    };
    const handler = toBrainToolHandler(
      OWNER_PROPERTY_TOOLS.find(
        (d) => d.id === 'owner.portfolio.metrics',
      )!,
      gate,
    );
    const result = await handler.execute({}, {
      tenant: { tenantId: 't1' },
      actor: { id: 'a1' },
    } as never);
    expect(result.ok).toBe(false);
  });
});
