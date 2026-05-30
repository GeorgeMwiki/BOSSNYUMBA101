/**
 * Seed-registry shape tests — verify the real-estate seed covers the
 * eight customer signal sections + the platform-staff section, scopes
 * are correct, and the `createSeedRegistry` factory works.
 */

import { describe, expect, it } from 'vitest';
import {
  createSeedRegistry,
  seedSections,
  seedSectionKeys,
  sectionSignalKeys,
} from '../seed/index.js';
import { filterSections } from '../registry/filter.js';
import type { SectionContext } from '../contracts/section.js';

function ctx(over: Partial<SectionContext> = {}): SectionContext {
  return {
    tenantId: 't1',
    scope: 'owner-customer',
    entityCounts: {},
    roles: [],
    featureFlags: [],
    ...over,
  };
}

describe('seedSections', () => {
  it('covers all nine real-estate seed sections', () => {
    const expected = [
      'active-leases',
      'rent-due-soon',
      'maintenance-open',
      'lease-renewal-window',
      'kra-vat-filing',
      'tra-vat-filing',
      'vacancy-listings',
      'accountant-month-end',
      'internal-staff',
    ].sort();
    expect([...seedSectionKeys].sort()).toEqual(expected);
  });

  it('emits stable, unique keys', () => {
    const keys = seedSections.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('each section has a sort_order, label, and icon', () => {
    for (const s of seedSections) {
      expect(typeof s.sort_order).toBe('number');
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.icon.length).toBeGreaterThan(0);
    }
  });

  it('owner-customer with zero signals sees zero sections', () => {
    const visible = filterSections(seedSections, ctx());
    expect(visible).toEqual([]);
  });

  it('owner-customer with active-leases + rent-due-soon sees exactly those two sections', () => {
    const visible = filterSections(
      seedSections,
      ctx({
        entityCounts: {
          [sectionSignalKeys.activeLeases]: 3,
          [sectionSignalKeys.rentDueSoon]: 2,
        },
      }),
    );
    expect(visible.map((s) => s.key)).toEqual([
      'active-leases',
      'rent-due-soon',
    ]);
  });

  it('owner-customer in the KRA filing window sees the kra-vat-filing section', () => {
    const visible = filterSections(
      seedSections,
      ctx({
        entityCounts: { [sectionSignalKeys.kraVatFilingWindow]: 1 },
      }),
    );
    expect(visible.map((s) => s.key)).toContain('kra-vat-filing');
  });

  it('owner-customer in the month-end window sees the accountant-month-end section', () => {
    const visible = filterSections(
      seedSections,
      ctx({
        entityCounts: { [sectionSignalKeys.accountantMonthEnd]: 1 },
      }),
    );
    expect(visible.map((s) => s.key)).toContain('accountant-month-end');
  });

  it('internal-admin with zero signals + platform_ops role sees the eight customer-section overrides', () => {
    const visible = filterSections(
      seedSections,
      ctx({
        scope: 'internal-admin',
        roles: ['platform_ops'],
      }),
    );
    // Eight customer sections; internal-staff still requires `has-entities`.
    expect(visible.map((s) => s.key)).toEqual([
      'active-leases',
      'rent-due-soon',
      'maintenance-open',
      'lease-renewal-window',
      'kra-vat-filing',
      'tra-vat-filing',
      'vacancy-listings',
      'accountant-month-end',
    ]);
  });

  it('internal-admin with internal-staff signal + platform_ops role sees the staff section', () => {
    const visible = filterSections(
      seedSections,
      ctx({
        scope: 'internal-admin',
        roles: ['platform_ops'],
        entityCounts: { [sectionSignalKeys.internalStaff]: 4 },
      }),
    );
    expect(visible.map((s) => s.key)).toContain('internal-staff');
  });

  it('owner-customer never sees the internal-staff section even with signals', () => {
    const visible = filterSections(
      seedSections,
      ctx({
        scope: 'owner-customer',
        roles: ['platform_ops'],
        entityCounts: { [sectionSignalKeys.internalStaff]: 4 },
      }),
    );
    expect(visible.map((s) => s.key)).not.toContain('internal-staff');
  });

  it('internal-staff requires platform role, not just signal presence', () => {
    const visible = filterSections(
      seedSections,
      ctx({
        scope: 'internal-admin',
        roles: ['owner'],
        entityCounts: { [sectionSignalKeys.internalStaff]: 4 },
      }),
    );
    expect(visible.map((s) => s.key)).not.toContain('internal-staff');
  });

  it('createSeedRegistry returns a SectionRegistry with all 9 sections', () => {
    const reg = createSeedRegistry();
    expect(reg.all.map((s) => s.key).sort()).toEqual(
      [...seedSectionKeys].sort(),
    );
  });

  it('createSeedRegistry produces immutable instances (re-registering throws)', () => {
    const reg = createSeedRegistry();
    expect(() => reg.register(seedSections[0]!)).toThrow(
      /duplicate section key/,
    );
  });

  it('sort_order is unique across the seed (deterministic ordering)', () => {
    const orders = seedSections.map((s) => s.sort_order);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('each seed component_loader returns a default-exported component', async () => {
    for (const s of seedSections) {
      const mod = await s.component_loader();
      expect(typeof mod.default).toBe('function');
    }
  });
});
