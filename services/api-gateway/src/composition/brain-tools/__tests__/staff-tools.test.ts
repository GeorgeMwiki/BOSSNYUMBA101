/**
 * PT-C — Staff tools — boot + dispatch contract.
 */

import { describe, expect, it } from 'vitest';
import { STAFF_TOOLS } from '../staff-tools.js';
import { toBrainToolHandler } from '../types.js';
import type {
  PersonaToolGate,
  PersonaToolHttpClient,
} from '../types.js';

describe('PT-C — staff-tools', () => {
  it('exposes the expected number of descriptors', () => {
    expect(STAFF_TOOLS.length).toBe(30);
  });

  it('every descriptor has a unique staff.* id', () => {
    const ids = STAFF_TOOLS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^staff\./);
    }
  });

  it('every descriptor is bilingual sw/en in its name', () => {
    for (const d of STAFF_TOOLS) {
      expect(d.name).toContain('(en)');
      expect(d.name).toContain('(sw)');
    }
  });

  it('every descriptor is persona-gated on T4_field_employee', () => {
    for (const d of STAFF_TOOLS) {
      expect(d.personaSlugs).toContain('T4_field_employee');
    }
  });

  it('every WRITE descriptor declares stakes (LOW/MEDIUM/HIGH)', () => {
    for (const d of STAFF_TOOLS) {
      if (d.isWrite) {
        expect(['LOW', 'MEDIUM', 'HIGH']).toContain(d.stakes);
      }
    }
  });

  it('incident.report is MEDIUM stakes (escalates)', () => {
    const t = STAFF_TOOLS.find((d) => d.id === 'staff.incident.report');
    expect(t).toBeDefined();
    expect(t!.stakes).toBe('MEDIUM');
    expect(t!.isWrite).toBe(true);
  });

  it('work_order.submit is MEDIUM stakes (cost reporting)', () => {
    const t = STAFF_TOOLS.find((d) => d.id === 'staff.work_order.submit');
    expect(t).toBeDefined();
    expect(t!.stakes).toBe('MEDIUM');
  });

  it('inspection.complete is MEDIUM stakes (move-in/out reconciliation)', () => {
    const t = STAFF_TOOLS.find((d) => d.id === 'staff.inspection.complete');
    expect(t).toBeDefined();
    expect(t!.stakes).toBe('MEDIUM');
  });

  it('every WRITE descriptor that takes an evidenceRef requires it in schema', () => {
    // Spot check — every catalog tool that mutates state in this list demands
    // evidenceRef in the zod schema. Pick a handful and assert.
    const evidenceRequired = [
      'staff.clock_in',
      'staff.task.complete',
      'staff.work_order.submit',
      'staff.incident.report',
    ];
    for (const id of evidenceRequired) {
      const d = STAFF_TOOLS.find((t) => t.id === id);
      expect(d).toBeDefined();
      const shape = (d!.inputSchema as { shape?: Record<string, unknown> }).shape;
      expect(shape?.evidenceRef).toBeDefined();
    }
  });

  it('dispatch contract: tasks.assigned_today with stub client yields ok=true', async () => {
    const stub: PersonaToolHttpClient = {
      async get<T>(): Promise<T> {
        return { date: '2026-05-29', tasks: [], total: 0 } as unknown as T;
      },
      async post<T>(): Promise<T> {
        return {} as T;
      },
    };
    const gate: PersonaToolGate = {
      killSwitchOpen: false,
      resolvePersonaSlug: () => 'T4_field_employee',
      httpClient: stub,
    };
    const handler = toBrainToolHandler(
      STAFF_TOOLS.find((d) => d.id === 'staff.tasks.assigned_today')!,
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

  it('rejects when persona slug is not staff', async () => {
    const gate: PersonaToolGate = {
      killSwitchOpen: false,
      resolvePersonaSlug: () => 'T1_owner_strategist',
    };
    const handler = toBrainToolHandler(
      STAFF_TOOLS.find((d) => d.id === 'staff.task.list_mine')!,
      gate,
    );
    const result = await handler.execute({}, {
      tenant: { tenantId: 't1' },
      actor: { id: 'a1' },
    } as never);
    expect(result.ok).toBe(false);
  });
});
