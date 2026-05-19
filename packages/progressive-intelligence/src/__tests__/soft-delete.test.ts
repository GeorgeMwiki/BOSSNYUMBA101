import { describe, expect, it } from 'vitest';

import {
  DEFAULT_RETENTION_DAYS,
  InMemorySoftDeleteStore,
  NotDeletedError,
  resolveRetentionDays,
  RetentionExpiredError,
} from '../soft-delete/index.js';

function baseInput(over: { entityKind?: string; entityId?: string } = {}) {
  return {
    tenantId: 't1',
    entityId: over.entityId ?? 'e1',
    entityKind: over.entityKind ?? 'customer',
    actor: { kind: 'owner' as const, id: 'usr_1' },
    reason: 'tested',
  };
}

describe('soft-delete · softDelete', () => {
  it('1: sets deletedAt + deletedBy + deleteReason; row is frozen', async () => {
    const store = new InMemorySoftDeleteStore();
    const row = await store.softDelete(baseInput());
    expect(row.deletedAt).not.toBeNull();
    expect(row.deletedBy).toBe('usr_1');
    expect(row.deleteReason).toBe('tested');
    expect(Object.isFrozen(row)).toBe(true);
  });

  it('2: idempotent — re-deleting an already-deleted row preserves deletedAt', async () => {
    const store = new InMemorySoftDeleteStore();
    const first = await store.softDelete(baseInput());
    await new Promise((r) => setTimeout(r, 5));
    const second = await store.softDelete(baseInput());
    expect(second.deletedAt).toBe(first.deletedAt);
  });

  it('3: isDeleted reports true after softDelete', async () => {
    const store = new InMemorySoftDeleteStore();
    await store.softDelete(baseInput());
    expect(await store.isDeleted('t1', 'e1')).toBe(true);
  });

  it('4: isDeleted reports false for never-deleted entity', async () => {
    const store = new InMemorySoftDeleteStore();
    expect(await store.isDeleted('t1', 'unknown')).toBe(false);
  });
});

describe('soft-delete · undoDelete', () => {
  it('5: clears deletedAt within retention window', async () => {
    const store = new InMemorySoftDeleteStore();
    await store.softDelete(baseInput());
    const restored = await store.undoDelete({ tenantId: 't1', entityId: 'e1', actor: { kind: 'owner', id: 'usr_1' }, reason: 'oops' });
    expect(restored.deletedAt).toBeNull();
    expect(restored.deletedBy).toBeNull();
    expect(restored.deleteReason).toBeNull();
  });

  it('6: rejects when entity is not deleted', async () => {
    const store = new InMemorySoftDeleteStore();
    await expect(
      store.undoDelete({ tenantId: 't1', entityId: 'never-deleted', actor: { kind: 'owner', id: 'usr_1' }, reason: 'noop' }),
    ).rejects.toBeInstanceOf(NotDeletedError);
  });

  it('7: rejects after retention expires', async () => {
    const store = new InMemorySoftDeleteStore();
    // 0-day retention override → immediately expired
    store.setRetentionOverride('t1', 'customer', 0);
    await store.softDelete(baseInput());
    await new Promise((r) => setTimeout(r, 5));
    await expect(
      store.undoDelete({ tenantId: 't1', entityId: 'e1', actor: { kind: 'owner', id: 'usr_1' }, reason: 'too late' }),
    ).rejects.toBeInstanceOf(RetentionExpiredError);
  });
});

describe('soft-delete · retention resolution', () => {
  it('8: lease defaults to 2555 days (≈ 7 yr legal retention)', () => {
    expect(resolveRetentionDays('lease')).toBe(2555);
  });

  it('9: customer defaults to 1095 days (3 yr commercial record)', () => {
    expect(resolveRetentionDays('customer')).toBe(1095);
  });

  it('10: unknown entity kind falls back to default 30 days', () => {
    expect(resolveRetentionDays('mystery')).toBe(DEFAULT_RETENTION_DAYS['default']);
  });

  it('11: explicit override wins over the table default', () => {
    expect(resolveRetentionDays('customer', 7)).toBe(7);
  });
});

describe('soft-delete · purgeExpired', () => {
  it('12: removes rows past their retention and emits signed PurgeCertificate', async () => {
    const store = new InMemorySoftDeleteStore();
    store.setRetentionOverride('t1', 'customer', 0); // immediate expiry
    await store.softDelete(baseInput());
    await new Promise((r) => setTimeout(r, 5));
    const certs = await store.purgeExpired();
    expect(certs).toHaveLength(1);
    expect(certs[0]?.certificateHash).toMatch(/^[0-9a-f]{64}$/);
    expect(await store.getRow('t1', 'e1')).toBeNull(); // physically removed
  });
});
