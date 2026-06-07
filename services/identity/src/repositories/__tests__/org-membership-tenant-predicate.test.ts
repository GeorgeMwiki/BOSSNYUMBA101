/**
 * Tenant-predicate regression test for PostgresOrgMembershipRepository.
 *
 * THREAT: the production gateway connects as a BYPASSRLS role, so RLS is
 * inert and tenant isolation rests on app-level `WHERE tenant_id = ?`
 * predicates. The shadow-user status UPDATE inside `leave()` / `block()`
 * previously filtered by primary key ONLY (`users.id`) — a cross-tenant
 * write surface flagged by scripts/audit-tenant-predicate.mjs.
 *
 * This test pins the fix: both UPDATEs against the tenant-scoped `users`
 * table MUST carry a tenant predicate (`users.tenant_id`) bound to the
 * membership's own `platform_tenant_id`.
 *
 * Strategy: a fake transaction client records every `.update(table)` target
 * and the `.where()` condition. We reconstruct the referenced column names
 * from the Drizzle condition object and assert `tenant_id` is present on the
 * users UPDATE.
 */

import { describe, it, expect } from 'vitest';
import { users, orgMemberships } from '@bossnyumba/database';
import { PostgresOrgMembershipRepository } from '../../postgres-org-membership-repository.js';
import type { OrgMembershipId } from '@bossnyumba/domain-models';

const PLATFORM_TENANT = 'tnt_acme';
const SHADOW_USER = 'usr_shadow';
const MEMBERSHIP_ID = 'mem_1';

/** Recursively collect column names referenced by a Drizzle condition. */
function columnsOf(node: unknown, acc: string[] = []): string[] {
  if (!node || typeof node !== 'object') return acc;
  const n = node as {
    name?: string;
    table?: unknown;
    columnType?: unknown;
    queryChunks?: unknown[];
  };
  if (typeof n.name === 'string' && (n.table || n.columnType)) acc.push(n.name);
  if (Array.isArray(n.queryChunks)) {
    for (const c of n.queryChunks) columnsOf(c, acc);
  }
  return acc;
}

interface UpdateCall {
  readonly table: unknown;
  readonly columns: string[];
}

/**
 * Minimal Drizzle-shaped fake. `update(table)` returns a chainable recorder
 * that captures the `where()` condition's referenced columns. `select()`
 * returns the seeded membership row so `leave`/`block` reach the users UPDATE.
 */
function makeFakeClient(updateCalls: UpdateCall[]) {
  const membershipRow = {
    id: MEMBERSHIP_ID,
    tenantIdentityId: 'tid_1',
    organizationId: 'org_1',
    platformTenantId: PLATFORM_TENANT,
    userId: SHADOW_USER,
    status: 'ACTIVE',
    nickname: null,
    joinedViaInviteCode: null,
    joinedAt: new Date(),
    leftAt: null,
    blockedAt: null,
    blockReason: null,
  };

  const client = {
    select() {
      return {
        from() {
          return {
            where() {
              return {
                limit: async () => [membershipRow],
              };
            },
          };
        },
      };
    },
    update(table: unknown) {
      const call: UpdateCall = { table, columns: [] };
      return {
        set() {
          return {
            where(condition: unknown) {
              call.columns = columnsOf(condition);
              updateCalls.push(call);
              return {
                returning: async () => [membershipRow],
              };
            },
          };
        },
      };
    },
    async transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
      return fn(client);
    },
  };
  return client;
}

describe('PostgresOrgMembershipRepository — shadow-user UPDATE is tenant-scoped', () => {
  it('leave() scopes the users UPDATE by tenant_id', async () => {
    const updateCalls: UpdateCall[] = [];
    const repo = new PostgresOrgMembershipRepository(
      makeFakeClient(updateCalls) as never,
    );
    await repo.leave(MEMBERSHIP_ID as unknown as OrgMembershipId);

    const usersUpdate = updateCalls.find((c) => c.table === users);
    expect(usersUpdate, 'expected an UPDATE against the users table').toBeDefined();
    expect(usersUpdate?.columns).toContain('tenant_id');
    // PK predicate must still be present alongside the tenant predicate.
    expect(usersUpdate?.columns).toContain('id');
    // The membership UPDATE itself is keyed by its own PK (no tenant col).
    expect(updateCalls.some((c) => c.table === orgMemberships)).toBe(true);
  });

  it('block() scopes the users UPDATE by tenant_id', async () => {
    const updateCalls: UpdateCall[] = [];
    const repo = new PostgresOrgMembershipRepository(
      makeFakeClient(updateCalls) as never,
    );
    await repo.block(MEMBERSHIP_ID as unknown as OrgMembershipId, 'fraud');

    const usersUpdate = updateCalls.find((c) => c.table === users);
    expect(usersUpdate, 'expected an UPDATE against the users table').toBeDefined();
    expect(usersUpdate?.columns).toContain('tenant_id');
    expect(usersUpdate?.columns).toContain('id');
  });
});
