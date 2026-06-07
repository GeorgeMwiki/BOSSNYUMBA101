/**
 * C-1: PostgresTenantIdentityRepository.merge is tenant-scoped.
 *
 * tenant_identities is a GLOBAL, no-RLS table and the prod role is BYPASSRLS,
 * so the merge MUST predicate every write on platform_tenant_id. These tests
 * drive a faithful fake transaction client and assert:
 *
 *   1. every membership SELECT/UPDATE in the merge carries a platform_tenant_id
 *      predicate (so rows in other tenants are never read or mutated);
 *   2. the global duplicate identity is DEACTIVATED only when it has NO
 *      memberships left in any OTHER tenant;
 *   3. when the duplicate is still shared by another tenant, the identity row
 *      is left untouched (no DEACTIVATED write) — only in-tenant memberships
 *      are merged.
 */

import { describe, it, expect } from 'vitest';
import { PostgresTenantIdentityRepository } from '../postgres-tenant-identity-repository.js';
import type { TenantIdentityId } from '@bossnyumba/domain-models';

const PRIMARY = 'tid_primary' as TenantIdentityId;
const DUPLICATE = 'tid_duplicate' as TenantIdentityId;
const TENANT = 'tnt_acme';

/** Serialize a drizzle condition/SQL node to detect referenced columns. */
function describeCondition(node: unknown): string {
  const chunks = (node as { queryChunks?: ReadonlyArray<unknown> })?.queryChunks;
  if (!Array.isArray(chunks)) return String(node);
  return chunks
    .map((c) => {
      if (c && typeof c === 'object') {
        const obj = c as { value?: unknown; name?: unknown; queryChunks?: unknown };
        if (Array.isArray(obj.value)) return obj.value.join('');
        if (typeof obj.name === 'string') return `COL(${obj.name})`;
        if (obj.queryChunks) return describeCondition(c);
      }
      return '';
    })
    .join('');
}

function refersToPlatformTenant(node: unknown): boolean {
  return describeCondition(node).includes('platform_tenant_id');
}

interface SelectRecord {
  scopedToTenant: boolean;
}
interface UpdateRecord {
  set: Record<string, unknown>;
  scopedToTenant: boolean;
}

/**
 * Build a fake transaction client. `selectResults` is a queue consumed in
 * call order by the merge: [primaryIdentity, duplicateIdentity,
 * primaryMemberships, duplicateMemberships, otherTenantRows, refreshedPrimary].
 */
function makeFakeTx(selectResults: ReadonlyArray<ReadonlyArray<unknown>>) {
  const selects: SelectRecord[] = [];
  const updates: UpdateRecord[] = [];
  let selectIdx = 0;

  const tx = {
    select() {
      return {
        from() {
          return {
            where(cond: unknown) {
              const scopedToTenant = refersToPlatformTenant(cond);
              const finish = () => {
                const rows = selectResults[selectIdx] ?? [];
                selectIdx += 1;
                selects.push({ scopedToTenant });
                return rows;
              };
              // Some selects chain `.limit(1)`, others are awaited directly.
              const result = finish();
              return Object.assign(Promise.resolve(result), {
                limit() {
                  return Promise.resolve(result);
                },
              });
            },
          };
        },
      };
    },
    update() {
      return {
        set(values: Record<string, unknown>) {
          return {
            where(cond: unknown) {
              updates.push({
                set: values,
                scopedToTenant: refersToPlatformTenant(cond),
              });
              return Promise.resolve([]);
            },
          };
        },
      };
    },
  };

  return { tx, selects, updates };
}

function makeRepo(selectResults: ReadonlyArray<ReadonlyArray<unknown>>) {
  const fake = makeFakeTx(selectResults);
  const client = {
    async transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
      return fn(fake.tx);
    },
  };
  const repo = new PostgresTenantIdentityRepository(client as never);
  return { repo, ...fake };
}

const IDENTITY_ROW = {
  id: PRIMARY,
  phoneNormalized: '255712345678',
  phoneCountryCode: 'TZ',
  email: null,
  emailVerified: false,
  profile: {},
  status: 'ACTIVE',
  createdAt: new Date('2026-06-07T00:00:00.000Z'),
  lastActivityAt: null,
};

describe('PostgresTenantIdentityRepository.merge — tenant scoping (C-1)', () => {
  it('requires a non-empty platformTenantId', async () => {
    const { repo } = makeRepo([]);
    await expect(repo.merge(PRIMARY, DUPLICATE, '')).rejects.toThrow(
      /platformTenantId is required/,
    );
  });

  it('still rejects primaryId === duplicateId', async () => {
    const { repo } = makeRepo([]);
    await expect(repo.merge(PRIMARY, PRIMARY, TENANT)).rejects.toThrow(
      /primaryId === duplicateId/,
    );
  });

  it('scopes every membership read + write to platform_tenant_id and deactivates a non-shared identity', async () => {
    const { repo, selects, updates } = makeRepo([
      [IDENTITY_ROW], // primary identity
      [{ ...IDENTITY_ROW, id: DUPLICATE }], // duplicate identity
      [{ organizationId: 'org_existing' }], // primary memberships (in-tenant)
      [
        { id: 'mem_dup_same', organizationId: 'org_existing' }, // -> drop
        { id: 'mem_dup_new', organizationId: 'org_fresh' }, // -> reparent
      ], // duplicate memberships (in-tenant)
      [], // other-tenant rows: NONE -> safe to deactivate
      [IDENTITY_ROW], // refreshed primary
    ]);

    const result = await repo.merge(PRIMARY, DUPLICATE, TENANT);
    expect(result.id).toBe(PRIMARY);

    // selects[2] = primary memberships, selects[3] = duplicate memberships,
    // selects[4] = other-tenant probe — all must be tenant-scoped.
    expect(selects[2].scopedToTenant).toBe(true);
    expect(selects[3].scopedToTenant).toBe(true);
    expect(selects[4].scopedToTenant).toBe(true);

    // Three updates: drop (LEFT), reparent (tenantIdentityId), deactivate.
    const drop = updates.find((u) => u.set.status === 'LEFT');
    const reparent = updates.find((u) => 'tenantIdentityId' in u.set);
    const deactivate = updates.find((u) => u.set.status === 'DEACTIVATED');
    expect(drop?.scopedToTenant).toBe(true);
    expect(reparent?.scopedToTenant).toBe(true);
    expect(reparent?.set.tenantIdentityId).toBe(PRIMARY);
    // The duplicate has no other-tenant memberships, so deactivate runs.
    expect(deactivate).toBeDefined();
    expect(deactivate?.set.mergedIntoId).toBe(PRIMARY);
  });

  it('does NOT deactivate a duplicate identity that is still shared by another tenant', async () => {
    const { repo, updates } = makeRepo([
      [IDENTITY_ROW], // primary identity
      [{ ...IDENTITY_ROW, id: DUPLICATE }], // duplicate identity
      [], // primary memberships (in-tenant): none
      [{ id: 'mem_dup_new', organizationId: 'org_fresh' }], // dup in-tenant -> reparent
      [{ id: 'mem_other_tenant' }], // other-tenant rows: PRESENT -> keep identity ACTIVE
      [IDENTITY_ROW], // refreshed primary
    ]);

    await repo.merge(PRIMARY, DUPLICATE, TENANT);

    // In-tenant membership still re-parented...
    const reparent = updates.find((u) => 'tenantIdentityId' in u.set);
    expect(reparent?.set.tenantIdentityId).toBe(PRIMARY);
    // ...but the shared global identity is left untouched (no DEACTIVATED).
    const deactivate = updates.find((u) => u.set.status === 'DEACTIVATED');
    expect(deactivate).toBeUndefined();
  });
});
