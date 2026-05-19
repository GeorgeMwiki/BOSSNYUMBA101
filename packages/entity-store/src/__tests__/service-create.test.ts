/**
 * EntityStoreService.createEntity — the MD's primary write path.
 *
 * Covers:
 *   - happy path (chat-driven employee creation)
 *   - rejects on registry-unknown type
 *   - rejects on schema mismatch
 *   - rejects on bad provenance
 *   - rejects on scope/type mismatch
 *   - rejects on tenant_id mismatch with scope_owner_id
 *   - emits version=1 for every initial attribute
 *   - source provenance carries through to every initial attribute row
 */

import { describe, it, expect } from 'vitest';
import {
  AttributeValidationError,
  EntityTypeNotRegisteredError,
  InvalidProvenanceError,
  TenantScopeMisuseError,
} from '../types/errors.js';
import { ScopeViolationError } from '../types/scope.js';
import {
  ADMIN_USER,
  TENANT_ALPHA,
  TENANT_BETA,
  chatSource,
  fileSource,
  makeService,
  manualSource,
} from './test-fixtures.js';

describe('EntityStoreService.createEntity / happy path', () => {
  it('MD auto-creates employee from chat → returns header + attributes', async () => {
    const { service } = makeService();
    const snap = await service.createEntity({
      type: 'employee',
      scope: { ownerType: 'tenant', ownerId: TENANT_ALPHA },
      tenantId: TENANT_ALPHA,
      createdBy: ADMIN_USER,
      source: chatSource('conv_md_001', 'msg_42'),
      attributes: {
        fullName: 'Jane Mwangi',
        role: 'Property Manager',
        startDate: '2026-06-01',
      },
    });
    expect(snap.entity.id).toBe('id_0001');
    expect(snap.entity.type).toBe('employee');
    expect(snap.entity.scopeOwnerType).toBe('tenant');
    expect(snap.entity.tenantId).toBe(TENANT_ALPHA);
    expect(snap.attributes.fullName?.value).toBe('Jane Mwangi');
    expect(snap.attributes.role?.value).toBe('Property Manager');
    expect(snap.attributes.startDate?.value).toBe('2026-06-01');
  });

  it('writes version=1 for every initial attribute', async () => {
    const { service } = makeService();
    const snap = await service.createEntity({
      type: 'employee',
      scope: { ownerType: 'tenant', ownerId: TENANT_ALPHA },
      tenantId: TENANT_ALPHA,
      createdBy: ADMIN_USER,
      source: chatSource(),
      attributes: { fullName: 'A', role: 'B', startDate: '2026-06-01' },
    });
    for (const a of Object.values(snap.attributes)) {
      expect(a.version).toBe(1);
    }
  });

  it('propagates source provenance onto every initial attribute', async () => {
    const { service } = makeService();
    const src = chatSource('conv_md_001', 'msg_42');
    const snap = await service.createEntity({
      type: 'employee',
      scope: { ownerType: 'tenant', ownerId: TENANT_ALPHA },
      tenantId: TENANT_ALPHA,
      createdBy: ADMIN_USER,
      source: src,
      attributes: { fullName: 'A', role: 'B', startDate: '2026-06-01' },
    });
    for (const a of Object.values(snap.attributes)) {
      expect(a.source.conversationId).toBe('conv_md_001');
      expect(a.source.messageId).toBe('msg_42');
    }
    expect(snap.entity.sourceProvenance).toEqual(src);
  });

  it('creates platform-scope internal-staff', async () => {
    const { service } = makeService();
    const snap = await service.createEntity({
      type: 'internal-staff',
      scope: { ownerType: 'platform', ownerId: '00000000-0000-0000-0000-000000000000' },
      createdBy: ADMIN_USER,
      source: manualSource(),
      attributes: {
        fullName: 'Eng Bob',
        team: 'platform-eng',
        role: 'Senior Engineer',
        startDate: '2026-01-01',
      },
    });
    expect(snap.entity.scopeOwnerType).toBe('platform');
    expect(snap.entity.tenantId).toBeUndefined();
  });

  it('creates a platform-scope lead', async () => {
    const { service } = makeService();
    const snap = await service.createEntity({
      type: 'lead',
      scope: { ownerType: 'platform', ownerId: '00000000-0000-0000-0000-000000000000' },
      createdBy: ADMIN_USER,
      source: fileSource(),
      attributes: { source: 'web-form' },
    });
    expect(snap.entity.scopeOwnerType).toBe('platform');
  });

  it('creates a tenant-scope vendor (both-scope type)', async () => {
    const { service } = makeService();
    const snap = await service.createEntity({
      type: 'vendor',
      scope: { ownerType: 'tenant', ownerId: TENANT_ALPHA },
      tenantId: TENANT_ALPHA,
      createdBy: ADMIN_USER,
      source: chatSource(),
      attributes: { name: 'Plumber Co', categories: ['plumbing'] },
    });
    expect(snap.entity.type).toBe('vendor');
  });
});

describe('EntityStoreService.createEntity / rejections', () => {
  it('rejects unknown type', async () => {
    const { service } = makeService();
    await expect(
      service.createEntity({
        type: 'mystery-type',
        scope: { ownerType: 'tenant', ownerId: TENANT_ALPHA },
        tenantId: TENANT_ALPHA,
        createdBy: ADMIN_USER,
        source: chatSource(),
        attributes: {},
      }),
    ).rejects.toThrow(EntityTypeNotRegisteredError);
  });

  it('rejects schema mismatch', async () => {
    const { service } = makeService();
    await expect(
      service.createEntity({
        type: 'employee',
        scope: { ownerType: 'tenant', ownerId: TENANT_ALPHA },
        tenantId: TENANT_ALPHA,
        createdBy: ADMIN_USER,
        source: chatSource(),
        attributes: { fullName: 'A' }, // missing role + startDate
      }),
    ).rejects.toThrow(AttributeValidationError);
  });

  it('rejects bad provenance', async () => {
    const { service } = makeService();
    await expect(
      service.createEntity({
        type: 'employee',
        scope: { ownerType: 'tenant', ownerId: TENANT_ALPHA },
        tenantId: TENANT_ALPHA,
        createdBy: ADMIN_USER,
        source: { timestamp: '2026-05-19T10:00:00Z' } as any,
        attributes: { fullName: 'A', role: 'B', startDate: '2026-06-01' },
      }),
    ).rejects.toThrow(InvalidProvenanceError);
  });

  it('rejects employee in platform scope (type forbids it)', async () => {
    const { service } = makeService();
    await expect(
      service.createEntity({
        type: 'employee',
        scope: { ownerType: 'platform', ownerId: '00000000-0000-0000-0000-000000000000' },
        createdBy: ADMIN_USER,
        source: chatSource(),
        attributes: { fullName: 'A', role: 'B', startDate: '2026-06-01' },
      }),
    ).rejects.toThrow(TenantScopeMisuseError);
  });

  it('rejects internal-staff in tenant scope (type forbids it)', async () => {
    const { service } = makeService();
    await expect(
      service.createEntity({
        type: 'internal-staff',
        scope: { ownerType: 'tenant', ownerId: TENANT_ALPHA },
        tenantId: TENANT_ALPHA,
        createdBy: ADMIN_USER,
        source: manualSource(),
        attributes: { fullName: 'A', team: 'X', role: 'Y', startDate: '2026-01-01' },
      }),
    ).rejects.toThrow(TenantScopeMisuseError);
  });

  it('rejects tenantId missing on tenant scope', async () => {
    const { service } = makeService();
    await expect(
      service.createEntity({
        type: 'employee',
        scope: { ownerType: 'tenant', ownerId: TENANT_ALPHA },
        createdBy: ADMIN_USER,
        source: chatSource(),
        attributes: { fullName: 'A', role: 'B', startDate: '2026-06-01' },
      }),
    ).rejects.toThrow(TenantScopeMisuseError);
  });

  it('rejects tenantId mismatching scope ownerId', async () => {
    const { service } = makeService();
    await expect(
      service.createEntity({
        type: 'employee',
        scope: { ownerType: 'tenant', ownerId: TENANT_ALPHA },
        tenantId: TENANT_BETA,
        createdBy: ADMIN_USER,
        source: chatSource(),
        attributes: { fullName: 'A', role: 'B', startDate: '2026-06-01' },
      }),
    ).rejects.toThrow(TenantScopeMisuseError);
  });

  it('rejects tenantId set when scope is platform', async () => {
    const { service } = makeService();
    await expect(
      service.createEntity({
        type: 'internal-staff',
        scope: { ownerType: 'platform', ownerId: '00000000-0000-0000-0000-000000000000' },
        tenantId: TENANT_ALPHA,
        createdBy: ADMIN_USER,
        source: manualSource(),
        attributes: { fullName: 'A', team: 'X', role: 'Y', startDate: '2026-01-01' },
      }),
    ).rejects.toThrow(TenantScopeMisuseError);
  });

  it('rejects when caller principal lacks scope grant', async () => {
    const { service } = makeService();
    await expect(
      service.createEntity({
        type: 'employee',
        scope: { ownerType: 'tenant', ownerId: TENANT_ALPHA },
        tenantId: TENANT_ALPHA,
        createdBy: ADMIN_USER,
        source: chatSource(),
        attributes: { fullName: 'A', role: 'B', startDate: '2026-06-01' },
        principal: { role: 'tenant-user', tenantId: TENANT_BETA },
      }),
    ).rejects.toThrow(ScopeViolationError);
  });
});
