/**
 * EntityStoreService — addAttribute / linkEntities / applyProvenance /
 * findEntities / outgoingRelations / incomingRelations / softDelete.
 */

import { describe, it, expect } from 'vitest';
import {
  EntityNotFoundError,
  TenantScopeMisuseError,
} from '../types/errors.js';
import { ScopeViolationError } from '../types/scope.js';
import {
  ADMIN_USER,
  TENANT_ALPHA,
  TENANT_BETA,
  chatSource,
  makeService,
  manualSource,
  researchSource,
} from './test-fixtures.js';

async function seedEmployee(svc: ReturnType<typeof makeService>['service']) {
  return svc.createEntity({
    type: 'employee',
    scope: { ownerType: 'tenant', ownerId: TENANT_ALPHA },
    tenantId: TENANT_ALPHA,
    createdBy: ADMIN_USER,
    source: chatSource(),
    attributes: { fullName: 'Jane Mwangi', role: 'Manager', startDate: '2026-06-01' },
  });
}

describe('EntityStoreService.addAttribute', () => {
  it('appends a new key as version 1', async () => {
    const { service } = makeService();
    const emp = await seedEmployee(service);
    const row = await service.addAttribute({
      entityId: emp.entity.id,
      key: 'phone',
      value: '+254700000000',
      source: manualSource(),
    });
    expect(row.version).toBe(1);
    expect(row.value).toBe('+254700000000');
  });

  it('appends a NEW version when key already exists', async () => {
    const { service } = makeService();
    const emp = await seedEmployee(service);
    await service.addAttribute({
      entityId: emp.entity.id,
      key: 'role',
      value: 'Senior Manager',
      source: manualSource(),
    });
    const snap = await service.getEntity(emp.entity.id);
    expect(snap?.attributes.role?.value).toBe('Senior Manager');
    expect(snap?.attributes.role?.version).toBe(2);
  });

  it('rejects on bad provenance', async () => {
    const { service } = makeService();
    const emp = await seedEmployee(service);
    await expect(
      service.addAttribute({
        entityId: emp.entity.id,
        key: 'phone',
        value: '+254700000000',
        source: { timestamp: '2026-05-19T10:00:00Z' } as any,
      }),
    ).rejects.toThrow(/at least one origin signal/);
  });

  it('rejects on entity not found', async () => {
    const { service } = makeService();
    await expect(
      service.addAttribute({
        entityId: 'nope',
        key: 'phone',
        value: '+254700000000',
        source: manualSource(),
      }),
    ).rejects.toThrow(EntityNotFoundError);
  });

  it('rejects when the new bag violates the type schema', async () => {
    const { service } = makeService();
    const emp = await seedEmployee(service);
    await expect(
      service.addAttribute({
        entityId: emp.entity.id,
        key: 'email',
        value: 'not-an-email',
        source: manualSource(),
      }),
    ).rejects.toThrow(/email/);
  });

  it('rejects when principal cannot access the entity', async () => {
    const { service } = makeService();
    const emp = await seedEmployee(service);
    await expect(
      service.addAttribute({
        entityId: emp.entity.id,
        key: 'phone',
        value: '+254700000000',
        source: manualSource(),
        principal: { role: 'tenant-user', tenantId: TENANT_BETA },
      }),
    ).rejects.toThrow(ScopeViolationError);
  });
});

describe('EntityStoreService.getEntity', () => {
  it('returns null for missing id', async () => {
    const { service } = makeService();
    expect(await service.getEntity('nope')).toBeNull();
  });

  it('returns header + current attribute snapshot', async () => {
    const { service } = makeService();
    const emp = await seedEmployee(service);
    const snap = await service.getEntity(emp.entity.id);
    expect(snap?.entity.id).toBe(emp.entity.id);
    expect(snap?.attributes.fullName?.value).toBe('Jane Mwangi');
  });

  it('reflects the latest version after addAttribute', async () => {
    const { service } = makeService();
    const emp = await seedEmployee(service);
    await service.addAttribute({
      entityId: emp.entity.id,
      key: 'role',
      value: 'Director',
      source: manualSource(),
    });
    const snap = await service.getEntity(emp.entity.id);
    expect(snap?.attributes.role?.value).toBe('Director');
    expect(snap?.attributes.role?.version).toBe(2);
  });

  it('rejects when principal cannot access', async () => {
    const { service } = makeService();
    const emp = await seedEmployee(service);
    await expect(
      service.getEntity(emp.entity.id, { role: 'tenant-user', tenantId: TENANT_BETA }),
    ).rejects.toThrow(ScopeViolationError);
  });
});

describe('EntityStoreService.findEntities', () => {
  it('narrows tenant-user calls to their own tenant', async () => {
    const { service } = makeService();
    await seedEmployee(service);
    // Same service instance, second tenant
    await service.createEntity({
      type: 'employee',
      scope: { ownerType: 'tenant', ownerId: TENANT_BETA },
      tenantId: TENANT_BETA,
      createdBy: ADMIN_USER,
      source: chatSource(),
      attributes: { fullName: 'Other Tenant Employee', role: 'X', startDate: '2026-06-01' },
    });
    const out = await service.findEntities(
      { type: 'employee' },
      { role: 'tenant-user', tenantId: TENANT_ALPHA },
    );
    expect(out.map((e) => e.tenantId)).toEqual([TENANT_ALPHA]);
  });

  it('returns empty list for tenant-user querying a foreign tenant', async () => {
    const { service } = makeService();
    await seedEmployee(service);
    const out = await service.findEntities(
      { type: 'employee', tenantId: TENANT_ALPHA },
      { role: 'tenant-user', tenantId: TENANT_BETA },
    );
    expect(out).toEqual([]);
  });

  it('allows internal-admin with cross-tenant grant to see another tenant', async () => {
    const { service } = makeService();
    await seedEmployee(service);
    const out = await service.findEntities(
      { type: 'employee' },
      { role: 'internal-admin', crossTenantGrants: [TENANT_ALPHA] },
    );
    expect(out).toHaveLength(1);
  });

  it('hides ungranted tenants from internal-admin', async () => {
    const { service } = makeService();
    await seedEmployee(service);
    const out = await service.findEntities(
      { type: 'employee' },
      { role: 'internal-admin', crossTenantGrants: [] },
    );
    expect(out).toEqual([]);
  });

  it('returns empty list when no principal supplied and no entities match', async () => {
    const { service } = makeService();
    const out = await service.findEntities({ type: 'employee' });
    expect(out).toEqual([]);
  });
});

describe('EntityStoreService.linkEntities', () => {
  it('creates a directed edge', async () => {
    const { service } = makeService();
    const emp = await seedEmployee(service);
    const property = await service.createEntity({
      type: 'property',
      scope: { ownerType: 'tenant', ownerId: TENANT_ALPHA },
      tenantId: TENANT_ALPHA,
      createdBy: ADMIN_USER,
      source: chatSource(),
      attributes: {
        propertyCode: 'PRP-001',
        name: 'Sunny Apartments',
        type: 'apartment_complex',
        status: 'active',
        address: { line1: 'Riverside', city: 'Nairobi', country: 'KE' },
      },
    });
    const rel = await service.linkEntities({
      fromId: emp.entity.id,
      toId: property.entity.id,
      type: 'manages',
      createdBy: ADMIN_USER,
    });
    expect(rel.type).toBe('manages');
    const out = await service.outgoingRelations(emp.entity.id);
    expect(out).toHaveLength(1);
  });

  it('rejects when from-entity is missing', async () => {
    const { service } = makeService();
    const emp = await seedEmployee(service);
    await expect(
      service.linkEntities({
        fromId: 'nope',
        toId: emp.entity.id,
        type: 'manages',
        createdBy: ADMIN_USER,
      }),
    ).rejects.toThrow(EntityNotFoundError);
  });

  it('rejects when to-entity is missing', async () => {
    const { service } = makeService();
    const emp = await seedEmployee(service);
    await expect(
      service.linkEntities({
        fromId: emp.entity.id,
        toId: 'nope',
        type: 'manages',
        createdBy: ADMIN_USER,
      }),
    ).rejects.toThrow(EntityNotFoundError);
  });

  it('rejects cross-tenant edge between two tenant-scope entities', async () => {
    const { service } = makeService();
    const emp = await seedEmployee(service);
    const otherEmp = await service.createEntity({
      type: 'employee',
      scope: { ownerType: 'tenant', ownerId: TENANT_BETA },
      tenantId: TENANT_BETA,
      createdBy: ADMIN_USER,
      source: chatSource(),
      attributes: { fullName: 'Other', role: 'X', startDate: '2026-06-01' },
    });
    await expect(
      service.linkEntities({
        fromId: emp.entity.id,
        toId: otherEmp.entity.id,
        type: 'introduced',
        createdBy: ADMIN_USER,
      }),
    ).rejects.toThrow(TenantScopeMisuseError);
  });

  it('allows platform → tenant edge (customer-owner -[owns]-> property)', async () => {
    const { service } = makeService();
    const owner = await service.createEntity({
      type: 'customer-owner',
      scope: { ownerType: 'platform', ownerId: '00000000-0000-0000-0000-000000000000' },
      createdBy: ADMIN_USER,
      source: manualSource(),
      attributes: { fullName: 'Mwangi Family' },
    });
    const property = await service.createEntity({
      type: 'property',
      scope: { ownerType: 'tenant', ownerId: TENANT_ALPHA },
      tenantId: TENANT_ALPHA,
      createdBy: ADMIN_USER,
      source: chatSource(),
      attributes: {
        propertyCode: 'PRP-X',
        name: 'X',
        type: 'apartment_complex',
        status: 'active',
        address: { line1: 'A', city: 'B', country: 'KE' },
      },
    });
    await expect(
      service.linkEntities({
        fromId: owner.entity.id,
        toId: property.entity.id,
        type: 'owns',
        createdBy: ADMIN_USER,
      }),
    ).resolves.toBeDefined();
  });
});

describe('EntityStoreService.applyProvenance', () => {
  it('attaches research provenance to the LATEST attribute version', async () => {
    const { service } = makeService();
    const emp = await seedEmployee(service);
    const updated = await service.applyProvenance({
      entityId: emp.entity.id,
      key: 'role',
      source: researchSource(),
    });
    expect(updated.source.llmResearch).toBe(true);
  });

  it('targets a specific version when asked', async () => {
    const { service } = makeService();
    const emp = await seedEmployee(service);
    await service.addAttribute({
      entityId: emp.entity.id,
      key: 'role',
      value: 'Director',
      source: manualSource(),
    });
    await service.applyProvenance({
      entityId: emp.entity.id,
      key: 'role',
      version: 1,
      source: researchSource(),
    });
    const snap = await service.getEntity(emp.entity.id);
    // The CURRENT (v2) row keeps its manual source; v1 got the research stamp.
    expect(snap?.attributes.role?.version).toBe(2);
    expect(snap?.attributes.role?.source.manual).toBe(true);
  });

  it('throws when key has no attribute rows', async () => {
    const { service } = makeService();
    const emp = await seedEmployee(service);
    await expect(
      service.applyProvenance({
        entityId: emp.entity.id,
        key: 'no-such-key',
        source: researchSource(),
      }),
    ).rejects.toThrow(EntityNotFoundError);
  });

  it('throws on bad provenance envelope', async () => {
    const { service } = makeService();
    const emp = await seedEmployee(service);
    await expect(
      service.applyProvenance({
        entityId: emp.entity.id,
        key: 'role',
        source: { timestamp: '2026-05-19T10:00:00Z' } as any,
      }),
    ).rejects.toThrow(/at least one origin signal/);
  });
});

describe('EntityStoreService.softDelete', () => {
  it('marks the entity as deleted', async () => {
    const { service } = makeService();
    const emp = await seedEmployee(service);
    await service.softDelete(emp.entity.id);
    const out = await service.findEntities({ type: 'employee' });
    expect(out).toEqual([]);
  });

  it('throws on missing id', async () => {
    const { service } = makeService();
    await expect(service.softDelete('nope')).rejects.toThrow(EntityNotFoundError);
  });

  it('respects scope on the principal', async () => {
    const { service } = makeService();
    const emp = await seedEmployee(service);
    await expect(
      service.softDelete(emp.entity.id, { role: 'tenant-user', tenantId: TENANT_BETA }),
    ).rejects.toThrow(ScopeViolationError);
  });
});

describe('EntityStoreService.outgoingRelations / incomingRelations', () => {
  it('finds outgoing by type', async () => {
    const { service } = makeService();
    const emp = await seedEmployee(service);
    const property = await service.createEntity({
      type: 'property',
      scope: { ownerType: 'tenant', ownerId: TENANT_ALPHA },
      tenantId: TENANT_ALPHA,
      createdBy: ADMIN_USER,
      source: chatSource(),
      attributes: {
        propertyCode: 'P1',
        name: 'P',
        type: 'apartment_complex',
        status: 'active',
        address: { line1: 'A', city: 'B', country: 'KE' },
      },
    });
    await service.linkEntities({
      fromId: emp.entity.id,
      toId: property.entity.id,
      type: 'manages',
      createdBy: ADMIN_USER,
    });
    const out = await service.outgoingRelations(emp.entity.id, 'manages');
    expect(out).toHaveLength(1);
  });

  it('finds incoming by type', async () => {
    const { service } = makeService();
    const emp = await seedEmployee(service);
    const property = await service.createEntity({
      type: 'property',
      scope: { ownerType: 'tenant', ownerId: TENANT_ALPHA },
      tenantId: TENANT_ALPHA,
      createdBy: ADMIN_USER,
      source: chatSource(),
      attributes: {
        propertyCode: 'P1',
        name: 'P',
        type: 'apartment_complex',
        status: 'active',
        address: { line1: 'A', city: 'B', country: 'KE' },
      },
    });
    await service.linkEntities({
      fromId: emp.entity.id,
      toId: property.entity.id,
      type: 'manages',
      createdBy: ADMIN_USER,
    });
    const out = await service.incomingRelations(property.entity.id);
    expect(out).toHaveLength(1);
  });
});
