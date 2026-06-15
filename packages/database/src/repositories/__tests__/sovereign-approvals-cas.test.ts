/**
 * casMarkExecuted — the atomic one-shot consumption guard (TOCTOU fix).
 *
 * Two concurrent executors must NOT both flip executed false→true and fire the
 * same sovereign-tier action. The Pg store delegates atomicity to a single
 * `UPDATE … SET executed=true WHERE action_id=$1 AND executed=false RETURNING *`
 * (Postgres guarantees exactly one winner). This test models that DB guarantee
 * and asserts exactly one of two concurrent casMarkExecuted calls returns a
 * non-null record, and that the store maps an empty returning() → null.
 */
import { describe, expect, it } from 'vitest';

import { createPgApprovalStore } from '../sovereign-approvals.repository.js';

function camelRow() {
  return {
    actionId: 'a1',
    proposerUserId: 'u',
    thoughtId: 't',
    summary: 's',
    toolName: 'tool',
    payload: {},
    stakes: 'critical',
    status: 'approved',
    signatures: [],
    proposedAt: new Date('2026-06-15T00:00:00Z'),
    expiresAt: new Date('2026-06-15T01:00:00Z'),
  };
}

/**
 * Mock Drizzle update chain that models Postgres's atomic CAS: the FIRST
 * `.returning()` flips the flag and returns the row; every subsequent one sees
 * executed=true → empty (exactly what `WHERE executed=false` does in the DB).
 */
function makeCasDb() {
  const state = { executed: false };
  const chain = {
    set: () => chain,
    where: () => chain,
    returning: async () => {
      if (!state.executed) {
        state.executed = true;
        return [camelRow()];
      }
      return [];
    },
  };
  return { update: () => chain } as never;
}

describe('createPgApprovalStore.casMarkExecuted — atomic one-shot guard', () => {
  it('returns the record for the WINNER and null for the LOSER of a concurrent CAS', async () => {
    const store = createPgApprovalStore(makeCasDb(), { tenantId: 'tenant-A' });
    const [a, b] = await Promise.all([
      store.casMarkExecuted!('a1'),
      store.casMarkExecuted!('a1'),
    ]);
    const nonNull = [a, b].filter((x) => x !== null);
    expect(nonNull).toHaveLength(1);
    expect(nonNull[0]?.action.id).toBe('a1');
  });

  it('returns null once the action is already executed (CAS lost)', async () => {
    const store = createPgApprovalStore(makeCasDb(), { tenantId: 'tenant-A' });
    expect(await store.casMarkExecuted!('a1')).not.toBeNull(); // first wins
    expect(await store.casMarkExecuted!('a1')).toBeNull(); // already executed
  });
});
