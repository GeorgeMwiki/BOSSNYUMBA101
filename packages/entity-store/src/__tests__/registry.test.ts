/**
 * Registry tests — built-in types + runtime registration + scope contract.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  BUILT_IN_TYPES,
  builtInsAsRegistryRows,
  createEntityTypeRegistry,
} from '../registry/index.js';
import {
  AttributeValidationError,
  EntityTypeNotRegisteredError,
  TenantScopeMisuseError,
} from '../types/errors.js';

describe('built-in registry inventory', () => {
  it('ships the 14 required types', () => {
    const names = BUILT_IN_TYPES.map((t) => t.name).sort();
    expect(names).toEqual([
      'campaign',
      'customer-owner',
      'deal',
      'employee',
      'internal-staff',
      'kra-filing',
      'lead',
      'lease',
      'process-step',
      'property',
      'recommendation',
      'tenant-person',
      'ticket',
      'vendor',
    ]);
  });

  it('marks property, lease, employee, kra-filing as jurisdiction-aware', () => {
    const jurAware = BUILT_IN_TYPES.filter((t) => t.jurisdictionAware).map((t) => t.name);
    expect(jurAware).toContain('property');
    expect(jurAware).toContain('lease');
    expect(jurAware).toContain('employee');
    expect(jurAware).toContain('kra-filing');
    expect(jurAware).toContain('tenant-person');
    expect(jurAware).toContain('customer-owner');
  });

  it('marks vendor and lead as both-scope (platform OR tenant)', () => {
    const vendor = BUILT_IN_TYPES.find((t) => t.name === 'vendor');
    const lead = BUILT_IN_TYPES.find((t) => t.name === 'lead');
    expect(vendor?.scope).toBe('both');
    expect(lead?.scope).toBe('both');
  });

  it('locks internal-staff to platform scope', () => {
    const staff = BUILT_IN_TYPES.find((t) => t.name === 'internal-staff');
    expect(staff?.scope).toBe('platform');
  });

  it('locks employee to tenant scope', () => {
    const emp = BUILT_IN_TYPES.find((t) => t.name === 'employee');
    expect(emp?.scope).toBe('tenant');
  });
});

describe('builtInsAsRegistryRows', () => {
  it('returns one row per built-in', () => {
    const rows = builtInsAsRegistryRows();
    expect(rows).toHaveLength(14);
  });

  it('renders schemaZod as a built-in handle', () => {
    const rows = builtInsAsRegistryRows();
    const emp = rows.find((r) => r.name === 'employee');
    expect(emp?.schemaZod).toBe('built-in:employee');
  });
});

describe('createEntityTypeRegistry / lookups', () => {
  const reg = createEntityTypeRegistry();

  it('resolves a built-in spec by name', () => {
    expect(reg.get('employee').name).toBe('employee');
  });

  it('reports has() correctly for built-ins', () => {
    expect(reg.has('employee')).toBe(true);
    expect(reg.has('nonexistent-thing')).toBe(false);
  });

  it('throws EntityTypeNotRegisteredError on unknown name', () => {
    expect(() => reg.get('nonexistent-thing')).toThrow(EntityTypeNotRegisteredError);
  });

  it('lists all known names sorted', () => {
    const names = reg.list();
    expect(names[0]).toBe('campaign');
    expect(names[names.length - 1]).toBe('vendor');
  });
});

describe('createEntityTypeRegistry / validate', () => {
  const reg = createEntityTypeRegistry();

  it('accepts a valid employee bag', () => {
    expect(() =>
      reg.validate('employee', {
        fullName: 'Jane Mwangi',
        role: 'Manager',
        startDate: '2026-06-01',
      }),
    ).not.toThrow();
  });

  it('rejects an employee without fullName', () => {
    expect(() => reg.validate('employee', { role: 'X', startDate: '2026-06-01' }))
      .toThrow(AttributeValidationError);
  });

  it('rejects an employee with invalid email', () => {
    expect(() =>
      reg.validate('employee', {
        fullName: 'Jane',
        email: 'not-an-email',
        role: 'X',
        startDate: '2026-06-01',
      }),
    ).toThrow(AttributeValidationError);
  });

  it('rejects an unknown type at validate-time', () => {
    expect(() => reg.validate('mystery', {})).toThrow(EntityTypeNotRegisteredError);
  });

  it('reports each failing path in the issue list', () => {
    try {
      reg.validate('employee', { role: '', startDate: '' });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(AttributeValidationError);
      const err = e as AttributeValidationError;
      expect(err.issues.length).toBeGreaterThan(0);
      expect(err.issues.join(' ')).toContain('fullName');
    }
  });
});

describe('createEntityTypeRegistry / assertScopeFits', () => {
  const reg = createEntityTypeRegistry();

  it('allows employee in tenant scope', () => {
    expect(() => reg.assertScopeFits('employee', 'tenant')).not.toThrow();
  });

  it('rejects employee in platform scope', () => {
    expect(() => reg.assertScopeFits('employee', 'platform')).toThrow(TenantScopeMisuseError);
  });

  it('allows internal-staff in platform scope', () => {
    expect(() => reg.assertScopeFits('internal-staff', 'platform')).not.toThrow();
  });

  it('rejects internal-staff in tenant scope', () => {
    expect(() => reg.assertScopeFits('internal-staff', 'tenant')).toThrow(TenantScopeMisuseError);
  });

  it('allows vendor in either scope', () => {
    expect(() => reg.assertScopeFits('vendor', 'platform')).not.toThrow();
    expect(() => reg.assertScopeFits('vendor', 'tenant')).not.toThrow();
  });

  it('allows lead in either scope', () => {
    expect(() => reg.assertScopeFits('lead', 'platform')).not.toThrow();
    expect(() => reg.assertScopeFits('lead', 'tenant')).not.toThrow();
  });
});

describe('createEntityTypeRegistry / runtime registration', () => {
  it('accepts a new runtime type and validates against its schema', () => {
    const reg = createEntityTypeRegistry();
    const schema = z.object({
      vehicleReg: z.string().min(4),
      odometer: z.number().int().nonnegative(),
    });
    reg.registerRuntimeType(
      {
        name: 'fleet-vehicle',
        schemaZod: 'runtime:fleet-vehicle',
        jurisdictionAware: false,
        scope: 'tenant',
        description: 'A motor vehicle in the owner-customer fleet',
        createdAt: new Date('2026-05-19T10:00:00Z').toISOString(),
      },
      schema,
    );
    expect(reg.has('fleet-vehicle')).toBe(true);
    expect(() =>
      reg.validate('fleet-vehicle', { vehicleReg: 'KAA-123', odometer: 12000 }),
    ).not.toThrow();
    expect(() =>
      reg.validate('fleet-vehicle', { vehicleReg: 'X', odometer: 0 }),
    ).toThrow(AttributeValidationError);
  });

  it('runtime registration overrides a same-named built-in', () => {
    const reg = createEntityTypeRegistry();
    const stricterSchema = z.object({ requireExtra: z.string() });
    reg.registerRuntimeType(
      {
        name: 'vendor',
        schemaZod: 'runtime:vendor',
        jurisdictionAware: true,
        scope: 'platform',
        description: 'override',
        createdAt: new Date(0).toISOString(),
      },
      stricterSchema,
    );
    expect(reg.get('vendor').description).toBe('override');
    expect(() => reg.validate('vendor', { name: 'X' })).toThrow();
    expect(() => reg.validate('vendor', { requireExtra: 'yes' })).not.toThrow();
  });
});
