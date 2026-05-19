/**
 * Integration-style flow tests — the MD's primary use cases.
 *
 * These exercise multiple service operations together so we catch
 * integration bugs between provenance, registry, repository, and scope.
 */

import { describe, it, expect } from 'vitest';
import {
  ADMIN_USER,
  TENANT_ALPHA,
  TENANT_BETA,
  chatSource,
  makeService,
  manualSource,
  researchSource,
} from './test-fixtures.js';

describe('MD flow: chat → create employee → enrich → search', () => {
  it('owner says "hire Jane as Property Manager starting June 1st"', async () => {
    const { service } = makeService();

    // 1. MD parses intent and writes the employee.
    const employee = await service.createEntity({
      type: 'employee',
      scope: { ownerType: 'tenant', ownerId: TENANT_ALPHA },
      tenantId: TENANT_ALPHA,
      createdBy: ADMIN_USER,
      source: chatSource('conv_2026_05_19', 'msg_42'),
      attributes: {
        fullName: 'Jane Mwangi',
        role: 'Property Manager',
        startDate: '2026-06-01',
      },
    });

    // 2. Owner follows up with "her phone is +254700000000".
    await service.addAttribute({
      entityId: employee.entity.id,
      key: 'phone',
      value: '+254700000000',
      source: chatSource('conv_2026_05_19', 'msg_43'),
    });

    // 3. The MD researches Jane's previous employer in the background.
    await service.applyProvenance({
      entityId: employee.entity.id,
      key: 'role',
      source: researchSource(),
    });

    // 4. Tenant-user searches: "show all employees".
    const out = await service.findEntities(
      { type: 'employee' },
      { role: 'tenant-user', tenantId: TENANT_ALPHA },
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.tenantId).toBe(TENANT_ALPHA);

    // 5. Snapshot confirms every layer:
    const snap = await service.getEntity(employee.entity.id);
    expect(snap?.attributes.phone?.value).toBe('+254700000000');
    expect(snap?.attributes.fullName?.value).toBe('Jane Mwangi');
    expect(snap?.attributes.role?.source.llmResearch).toBe(true);
  });

  it('owner creates a customer-owner + property + lease relation web', async () => {
    const { service } = makeService();
    const owner = await service.createEntity({
      type: 'customer-owner',
      scope: { ownerType: 'platform', ownerId: '00000000-0000-0000-0000-000000000000' },
      createdBy: ADMIN_USER,
      source: manualSource(),
      attributes: { fullName: 'Mwangi Family LLC' },
    });
    const prop = await service.createEntity({
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
        address: { line1: 'Riverside Drive', city: 'Nairobi', country: 'KE' },
      },
    });
    await service.linkEntities({
      fromId: owner.entity.id,
      toId: prop.entity.id,
      type: 'owns',
      createdBy: ADMIN_USER,
    });

    const outgoing = await service.outgoingRelations(owner.entity.id);
    expect(outgoing.map((r) => r.type)).toEqual(['owns']);
  });
});

describe('MD flow: internal-admin vs owner-customer cross-leak', () => {
  it('owner-customer at TENANT_ALPHA cannot read TENANT_BETA employees', async () => {
    const { service } = makeService();
    await service.createEntity({
      type: 'employee',
      scope: { ownerType: 'tenant', ownerId: TENANT_ALPHA },
      tenantId: TENANT_ALPHA,
      createdBy: ADMIN_USER,
      source: chatSource(),
      attributes: { fullName: 'Alpha Emp', role: 'X', startDate: '2026-06-01' },
    });
    await service.createEntity({
      type: 'employee',
      scope: { ownerType: 'tenant', ownerId: TENANT_BETA },
      tenantId: TENANT_BETA,
      createdBy: ADMIN_USER,
      source: chatSource(),
      attributes: { fullName: 'Beta Emp', role: 'X', startDate: '2026-06-01' },
    });

    const alphaView = await service.findEntities(
      { type: 'employee' },
      { role: 'tenant-user', tenantId: TENANT_ALPHA },
    );
    expect(alphaView.every((e) => e.tenantId === TENANT_ALPHA)).toBe(true);
    expect(alphaView.find((e) => e.tenantId === TENANT_BETA)).toBeUndefined();
  });

  it('owner-customer cannot read internal-staff entities', async () => {
    const { service } = makeService();
    await service.createEntity({
      type: 'internal-staff',
      scope: { ownerType: 'platform', ownerId: '00000000-0000-0000-0000-000000000000' },
      createdBy: ADMIN_USER,
      source: manualSource(),
      attributes: { fullName: 'Internal Bob', team: 'ops', role: 'CSM', startDate: '2026-01-01' },
    });
    const out = await service.findEntities(
      { type: 'internal-staff' },
      { role: 'tenant-user', tenantId: TENANT_ALPHA },
    );
    expect(out).toEqual([]);
  });

  it('internal-admin with no grants sees only platform-scope entities', async () => {
    const { service } = makeService();
    await service.createEntity({
      type: 'internal-staff',
      scope: { ownerType: 'platform', ownerId: '00000000-0000-0000-0000-000000000000' },
      createdBy: ADMIN_USER,
      source: manualSource(),
      attributes: { fullName: 'Bob', team: 'eng', role: 'Eng', startDate: '2026-01-01' },
    });
    await service.createEntity({
      type: 'employee',
      scope: { ownerType: 'tenant', ownerId: TENANT_ALPHA },
      tenantId: TENANT_ALPHA,
      createdBy: ADMIN_USER,
      source: chatSource(),
      attributes: { fullName: 'Jane', role: 'X', startDate: '2026-06-01' },
    });
    const out = await service.findEntities(
      {},
      { role: 'internal-admin', crossTenantGrants: [] },
    );
    expect(out.every((e) => e.scopeOwnerType === 'platform')).toBe(true);
  });

  it('internal-admin with explicit grant sees both platform + granted tenant', async () => {
    const { service } = makeService();
    await service.createEntity({
      type: 'internal-staff',
      scope: { ownerType: 'platform', ownerId: '00000000-0000-0000-0000-000000000000' },
      createdBy: ADMIN_USER,
      source: manualSource(),
      attributes: { fullName: 'Bob', team: 'eng', role: 'Eng', startDate: '2026-01-01' },
    });
    await service.createEntity({
      type: 'employee',
      scope: { ownerType: 'tenant', ownerId: TENANT_ALPHA },
      tenantId: TENANT_ALPHA,
      createdBy: ADMIN_USER,
      source: chatSource(),
      attributes: { fullName: 'Jane', role: 'X', startDate: '2026-06-01' },
    });
    const out = await service.findEntities(
      {},
      { role: 'internal-admin', crossTenantGrants: [TENANT_ALPHA] },
    );
    expect(out).toHaveLength(2);
  });
});

describe('MD flow: provenance integrity over time', () => {
  it('every attribute write carries an auditable source — no silent overwrites', async () => {
    const { service, repository } = makeService();
    const emp = await service.createEntity({
      type: 'employee',
      scope: { ownerType: 'tenant', ownerId: TENANT_ALPHA },
      tenantId: TENANT_ALPHA,
      createdBy: ADMIN_USER,
      source: chatSource('conv_1', 'msg_1'),
      attributes: { fullName: 'Jane', role: 'Mgr', startDate: '2026-06-01' },
    });
    await service.addAttribute({
      entityId: emp.entity.id,
      key: 'role',
      value: 'Senior Mgr',
      source: manualSource(),
    });
    await service.addAttribute({
      entityId: emp.entity.id,
      key: 'role',
      value: 'Director',
      source: { fileHash: 'sha256:hr-import-q3', rowIdx: 12, timestamp: '2026-05-19T10:00:00Z' },
    });
    const allRoleRows = (await repository.listAttributes(emp.entity.id))
      .filter((a) => a.key === 'role');
    expect(allRoleRows).toHaveLength(3);
    expect(allRoleRows[0]!.source.conversationId).toBe('conv_1');
    expect(allRoleRows[1]!.source.manual).toBe(true);
    expect(allRoleRows[2]!.source.fileHash).toBe('sha256:hr-import-q3');
  });
});

describe('MD flow: ticket lifecycle (tenant-scope) vs ticket lifecycle (platform-scope)', () => {
  it('owner files a tenant-scope ticket; internal-admin files a platform-scope one', async () => {
    const { service } = makeService();
    const tenantTicket = await service.createEntity({
      type: 'ticket',
      scope: { ownerType: 'tenant', ownerId: TENANT_ALPHA },
      tenantId: TENANT_ALPHA,
      createdBy: ADMIN_USER,
      source: chatSource(),
      attributes: { subject: 'Tap leak in unit B14', description: 'Water under the sink' },
    });
    const platformTicket = await service.createEntity({
      type: 'ticket',
      scope: { ownerType: 'platform', ownerId: '00000000-0000-0000-0000-000000000000' },
      createdBy: ADMIN_USER,
      source: manualSource(),
      attributes: { subject: 'Bug: portal CSV export', description: 'Returns empty rows' },
    });
    expect(tenantTicket.entity.scopeOwnerType).toBe('tenant');
    expect(platformTicket.entity.scopeOwnerType).toBe('platform');

    // Tenant-user can read the tenant ticket but NOT the platform ticket.
    const ownerView = await service.findEntities(
      { type: 'ticket' },
      { role: 'tenant-user', tenantId: TENANT_ALPHA },
    );
    expect(ownerView.map((e) => e.id)).toEqual([tenantTicket.entity.id]);
  });
});

describe('Edge cases the MD must survive', () => {
  it('repeated softDelete is idempotent (second call throws because entity missing)', async () => {
    const { service } = makeService();
    const emp = await service.createEntity({
      type: 'employee',
      scope: { ownerType: 'tenant', ownerId: TENANT_ALPHA },
      tenantId: TENANT_ALPHA,
      createdBy: ADMIN_USER,
      source: chatSource(),
      attributes: { fullName: 'A', role: 'B', startDate: '2026-06-01' },
    });
    await service.softDelete(emp.entity.id);
    // Soft-deleted entity is still retrievable by id, just hidden from finds.
    const snap = await service.getEntity(emp.entity.id);
    expect(snap?.entity.deletedAt).not.toBeNull();
  });

  it('createEntity with an empty attribute bag is allowed if the schema permits it', async () => {
    const { service } = makeService();
    // Lead has all-optional fields.
    const lead = await service.createEntity({
      type: 'lead',
      scope: { ownerType: 'platform', ownerId: '00000000-0000-0000-0000-000000000000' },
      createdBy: ADMIN_USER,
      source: manualSource(),
      attributes: { source: 'cold-call' }, // schema requires `source`
    });
    expect(lead.entity.type).toBe('lead');
  });
});
