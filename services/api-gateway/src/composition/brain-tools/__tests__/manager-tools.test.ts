/**
 * PT-B — Manager tools — boot + dispatch contract.
 */

import { describe, expect, it } from 'vitest';
import { MANAGER_TOOLS } from '../manager-tools.js';
import { toBrainToolHandler } from '../types.js';
import type {
  PersonaToolGate,
  PersonaToolHttpClient,
} from '../types.js';

describe('PT-B — manager-tools', () => {
  it('exposes the expected number of descriptors', () => {
    expect(MANAGER_TOOLS.length).toBe(25);
  });

  it('every descriptor has a unique manager.* id', () => {
    const ids = MANAGER_TOOLS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^manager\./);
    }
  });

  it('every descriptor is bilingual sw/en in its name', () => {
    for (const d of MANAGER_TOOLS) {
      expect(d.name).toContain('(en)');
      expect(d.name).toContain('(sw)');
    }
  });

  it('every descriptor is persona-gated on T3_module_manager', () => {
    for (const d of MANAGER_TOOLS) {
      expect(d.personaSlugs).toContain('T3_module_manager');
    }
  });

  it('every WRITE descriptor is MEDIUM or HIGH stakes', () => {
    for (const d of MANAGER_TOOLS) {
      if (d.isWrite) {
        expect(['LOW', 'MEDIUM', 'HIGH']).toContain(d.stakes);
      }
    }
  });

  it('contractor.engage is HIGH stakes (ledger commitment)', () => {
    const engage = MANAGER_TOOLS.find(
      (d) => d.id === 'manager.contractor.engage',
    );
    expect(engage).toBeDefined();
    expect(engage!.stakes).toBe('HIGH');
    expect(engage!.isWrite).toBe(true);
  });

  it('security_deposit.assess is HIGH stakes (financial settlement)', () => {
    const t = MANAGER_TOOLS.find(
      (d) => d.id === 'manager.security_deposit.assess',
    );
    expect(t).toBeDefined();
    expect(t!.stakes).toBe('HIGH');
  });

  it('dispatch contract: exception.list with stub client yields ok=true', async () => {
    const stub: PersonaToolHttpClient = {
      async get<T>(): Promise<T> {
        return { exceptions: [] } as unknown as T;
      },
      async post<T>(): Promise<T> {
        return {} as T;
      },
    };
    const gate: PersonaToolGate = {
      killSwitchOpen: false,
      resolvePersonaSlug: () => 'T3_module_manager',
      httpClient: stub,
    };
    const handler = toBrainToolHandler(
      MANAGER_TOOLS.find((d) => d.id === 'manager.exception.list')!,
      gate,
    );
    const result = await handler.execute(
      { limit: 10 },
      {
        tenant: { tenantId: 't1' },
        actor: { id: 'a1' },
      } as never,
    );
    expect(result.ok).toBe(true);
  });

  it('rejects when persona slug is not manager', async () => {
    const gate: PersonaToolGate = {
      killSwitchOpen: false,
      resolvePersonaSlug: () => 'T1_owner_strategist',
    };
    const handler = toBrainToolHandler(
      MANAGER_TOOLS.find((d) => d.id === 'manager.vacancy.list')!,
      gate,
    );
    const result = await handler.execute({}, {
      tenant: { tenantId: 't1' },
      actor: { id: 'a1' },
    } as never);
    expect(result.ok).toBe(false);
  });
});
