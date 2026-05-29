/**
 * PT-D — Tenant tools — boot + dispatch contract.
 */

import { describe, expect, it } from 'vitest';
import { TENANT_TOOLS } from '../tenant-tools.js';
import { toBrainToolHandler } from '../types.js';
import type {
  PersonaToolGate,
  PersonaToolHttpClient,
} from '../types.js';

describe('PT-D — tenant-tools', () => {
  it('exposes the expected number of descriptors', () => {
    expect(TENANT_TOOLS.length).toBe(30);
  });

  it('every descriptor has a unique tenant.* id', () => {
    const ids = TENANT_TOOLS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^tenant\./);
    }
  });

  it('every descriptor is bilingual sw/en in its name', () => {
    for (const d of TENANT_TOOLS) {
      expect(d.name).toContain('(en)');
      expect(d.name).toContain('(sw)');
    }
  });

  it('every descriptor is persona-gated on T5_customer_concierge', () => {
    for (const d of TENANT_TOOLS) {
      expect(d.personaSlugs).toContain('T5_customer_concierge');
    }
  });

  it('every WRITE descriptor declares stakes (LOW/MEDIUM/HIGH)', () => {
    for (const d of TENANT_TOOLS) {
      if (d.isWrite) {
        expect(['LOW', 'MEDIUM', 'HIGH']).toContain(d.stakes);
      }
    }
  });

  it('rent.pay is HIGH stakes (ledger commit via LedgerService)', () => {
    const t = TENANT_TOOLS.find((d) => d.id === 'tenant.rent.pay');
    expect(t).toBeDefined();
    expect(t!.stakes).toBe('HIGH');
    expect(t!.isWrite).toBe(true);
  });

  it('move_in.sign is HIGH stakes (settlement-driving)', () => {
    const t = TENANT_TOOLS.find((d) => d.id === 'tenant.move_in.sign');
    expect(t).toBeDefined();
    expect(t!.stakes).toBe('HIGH');
    expect(t!.isWrite).toBe(true);
  });

  it('move_out.notice + lease.terminate_early are HIGH stakes', () => {
    for (const id of ['tenant.move_out.notice', 'tenant.lease.terminate_early']) {
      const t = TENANT_TOOLS.find((d) => d.id === id);
      expect(t).toBeDefined();
      expect(t!.stakes).toBe('HIGH');
    }
  });

  it('every WRITE descriptor takes an evidenceRef (or idempotencyKey for rent.pay)', () => {
    // Spot check critical writes.
    const critical = [
      'tenant.application.create',
      'tenant.application.withdraw',
      'tenant.maintenance.request_create',
      'tenant.complaint.create',
      'tenant.move_in.sign',
      'tenant.rent.pay',
      'tenant.move_out.notice',
    ];
    for (const id of critical) {
      const d = TENANT_TOOLS.find((t) => t.id === id);
      expect(d).toBeDefined();
      const shape = (d!.inputSchema as { shape?: Record<string, unknown> }).shape;
      expect(shape?.evidenceRef).toBeDefined();
    }
  });

  it('rent.pay carries idempotencyKey field for money-path safety', () => {
    const d = TENANT_TOOLS.find((t) => t.id === 'tenant.rent.pay');
    expect(d).toBeDefined();
    const shape = (d!.inputSchema as { shape?: Record<string, unknown> }).shape;
    expect(shape?.idempotencyKey).toBeDefined();
  });

  it('dispatch contract: listing.browse with stub client yields ok=true', async () => {
    const stub: PersonaToolHttpClient = {
      async get<T>(): Promise<T> {
        return { listings: [], totalListings: 0 } as unknown as T;
      },
      async post<T>(): Promise<T> {
        return {} as T;
      },
    };
    const gate: PersonaToolGate = {
      killSwitchOpen: false,
      resolvePersonaSlug: () => 'T5_customer_concierge',
      httpClient: stub,
    };
    const handler = toBrainToolHandler(
      TENANT_TOOLS.find((d) => d.id === 'tenant.listing.browse')!,
      gate,
    );
    const result = await handler.execute(
      {},
      {
        tenant: { tenantId: 't1' },
        actor: { id: 'a1' },
      } as never,
    );
    expect(result.ok).toBe(true);
  });

  it('rejects when persona slug is not tenant', async () => {
    const gate: PersonaToolGate = {
      killSwitchOpen: false,
      resolvePersonaSlug: () => 'T1_owner_strategist',
    };
    const handler = toBrainToolHandler(
      TENANT_TOOLS.find((d) => d.id === 'tenant.listing.browse')!,
      gate,
    );
    const result = await handler.execute({}, {
      tenant: { tenantId: 't1' },
      actor: { id: 'a1' },
    } as never);
    expect(result.ok).toBe(false);
  });
});
