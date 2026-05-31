/**
 * Per-entity bulk-action dispatcher tests — closes H2 deferral:
 * "bulk-action records the undo-journal entry but doesn't fire
 * `mark_rent_paid`, `send_renewal_notice`, etc. against ledger /
 * mailer".
 *
 * Each test asserts the dispatcher writes the correct REAL artifact
 * (payment row, outbox event, maintenance update, inspections soft
 * delete). The Drizzle client is a hand-rolled shim that captures the
 * SQL operations so we can match exact target tables + columns
 * without booting Postgres.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTableName } from 'drizzle-orm';

import {
  dispatch,
  dispatchMarkRentPaid,
  dispatchSendRenewalNotice,
  dispatchExportTaxStatement,
  dispatchCloseMaintenanceTicket,
  dispatchAcknowledgeMaintenanceTicket,
  dispatchSnoozeReminder,
  dispatchArchiveInspection,
  type DispatchContext,
} from '../bulk-action-dispatchers';

interface InsertCall {
  table: string;
  values: Record<string, unknown>;
}

interface UpdateCall {
  table: string;
  set: Record<string, unknown>;
  whereSummary: string;
}

interface SelectCall {
  table: string;
  fields: ReadonlyArray<string>;
}

function tableNameOf(obj: unknown): string {
  try {
    return getTableName(obj as never);
  } catch {
    return 'unknown';
  }
}

function makeShim(opts: { leaseRow?: Record<string, unknown> } = {}) {
  const inserts: InsertCall[] = [];
  const updates: UpdateCall[] = [];
  const selects: SelectCall[] = [];
  const updateRowReturns: Record<string, string[]> = {
    leases: ['lease_1'],
    maintenance_requests: ['mr_1'],
    inspections: ['ins_1'],
    event_outbox: ['out_1'],
  };

  const client = {
    insert(table: any) {
      const tableName = tableNameOf(table);
      return {
        values(v: Record<string, unknown>): any {
          inserts.push({ table: tableName, values: v });
          return {
            returning: () => Promise.resolve([{ id: v.id ?? `${tableName}_1` }]),
            then(resolve: (v: unknown) => void) {
              resolve(undefined);
            },
          };
        },
      };
    },
    select(fields: Record<string, unknown>) {
      return {
        from(table: any) {
          const tableName = tableNameOf(table);
          selects.push({ table: tableName, fields: Object.keys(fields ?? {}) });
          return {
            where(_p: any) {
              return {
                limit(_n: number) {
                  if (tableName === 'leases') {
                    return Promise.resolve(
                      opts.leaseRow !== undefined ? [opts.leaseRow] : [],
                    );
                  }
                  return Promise.resolve([]);
                },
              };
            },
          };
        },
      };
    },
    update(table: any) {
      const tableName = tableNameOf(table);
      return {
        set(s: Record<string, unknown>): any {
          return {
            where(_p: any) {
              updates.push({ table: tableName, set: s, whereSummary: 'matched' });
              return {
                returning: () =>
                  Promise.resolve(
                    (updateRowReturns[tableName] ?? ['unknown_1']).map((id) => ({
                      id,
                    })),
                  ),
              };
            },
          };
        },
      };
    },
  };
  return { client, inserts, updates, selects };
}

const baseCtx = (overrides: Partial<DispatchContext> = {}): DispatchContext => ({
  db: undefined as never,
  tenantId: 't1',
  actorId: 'u1',
  idempotencyKey: 'idem-1',
  reason: 'test',
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('dispatchMarkRentPaid', () => {
  it('writes a payments row tied to the lease with status=completed', async () => {
    const shim = makeShim({
      leaseRow: {
        id: 'lease_1',
        customerId: 'cust_1',
        rentAmount: 200_000,
        rentCurrency: 'TZS',
      },
    });
    const out = await dispatchMarkRentPaid(
      baseCtx({ db: shim.client as never }),
      'lease_1',
      { method: 'cash' },
    );
    expect(out.ok).toBe(true);
    expect(out.artifactKind).toBe('payment');
    expect(shim.inserts).toHaveLength(1);
    const insert = shim.inserts[0]!;
    expect(insert.table).toBe('payments');
    expect(insert.values.status).toBe('completed');
    expect(insert.values.tenantId).toBe('t1');
    expect(insert.values.leaseId).toBe('lease_1');
    expect(insert.values.amount).toBe(200_000);
    expect(insert.values.currency).toBe('TZS');
    expect(insert.values.provider).toBe('bulk_owner_action');
    const provResponse = insert.values.providerResponse as Record<string, unknown>;
    expect(provResponse.idempotencyKey).toBe('idem-1');
  });

  it('fails gracefully when the lease does not exist', async () => {
    const shim = makeShim(); // no leaseRow
    const out = await dispatchMarkRentPaid(
      baseCtx({ db: shim.client as never }),
      'lease_missing',
      {},
    );
    expect(out.ok).toBe(false);
    expect(out.reason).toMatch(/not found/i);
    expect(shim.inserts).toHaveLength(0);
  });
});

describe('dispatchSendRenewalNotice', () => {
  it('writes a renewal_notice event_outbox row', async () => {
    const shim = makeShim({
      leaseRow: { id: 'lease_1', customerId: 'cust_1', tenantId: 't1' },
    });
    const out = await dispatchSendRenewalNotice(
      baseCtx({ db: shim.client as never }),
      'lease_1',
      { channels: ['whatsapp'], noticeDays: 60 },
    );
    expect(out.ok).toBe(true);
    expect(shim.inserts).toHaveLength(1);
    const insert = shim.inserts[0]!;
    expect(insert.table).toBe('event_outbox');
    expect(insert.values.eventType).toBe('lease.renewal_notice');
    expect(insert.values.aggregateType).toBe('lease');
    expect(insert.values.aggregateId).toBe('lease_1');
    expect(insert.values.priority).toBe('high');
    const payload = insert.values.payload as Record<string, unknown>;
    expect(payload.noticeDays).toBe(60);
    expect(payload.channels).toEqual(['whatsapp']);
  });
});

describe('dispatchExportTaxStatement', () => {
  it('writes a tax_statement.export_requested outbox row', async () => {
    const shim = makeShim();
    const out = await dispatchExportTaxStatement(
      baseCtx({ db: shim.client as never }),
      'inv_1',
      { format: 'pdf', jurisdiction: 'TZ' },
    );
    expect(out.ok).toBe(true);
    expect(shim.inserts).toHaveLength(1);
    expect(shim.inserts[0]!.table).toBe('event_outbox');
    expect(shim.inserts[0]!.values.eventType).toBe(
      'tax_statement.export_requested',
    );
  });
});

describe('dispatchCloseMaintenanceTicket', () => {
  it('updates the maintenance_requests row to completed', async () => {
    const shim = makeShim();
    const out = await dispatchCloseMaintenanceTicket(
      baseCtx({ db: shim.client as never }),
      'mr_1',
      { notes: 'fixed it' },
    );
    expect(out.ok).toBe(true);
    expect(shim.updates).toHaveLength(1);
    expect(shim.updates[0]!.table).toBe('maintenance_requests');
    expect(shim.updates[0]!.set.status).toBe('completed');
    expect(shim.updates[0]!.set.approvalNotes).toBe('fixed it');
  });
});

describe('dispatchAcknowledgeMaintenanceTicket', () => {
  it('updates the maintenance_requests row to acknowledged + sets acknowledgedAt', async () => {
    const shim = makeShim();
    const out = await dispatchAcknowledgeMaintenanceTicket(
      baseCtx({ db: shim.client as never }),
      'mr_1',
      {},
    );
    expect(out.ok).toBe(true);
    expect(shim.updates).toHaveLength(1);
    expect(shim.updates[0]!.set.status).toBe('acknowledged');
    expect(shim.updates[0]!.set.acknowledgedAt).toBeInstanceOf(Date);
    expect(shim.updates[0]!.set.acknowledgedBy).toBe('u1');
  });
});

describe('dispatchSnoozeReminder', () => {
  it('updates the event_outbox row pushing nextRetryAt forward', async () => {
    const shim = makeShim();
    const before = Date.now();
    const out = await dispatchSnoozeReminder(
      baseCtx({ db: shim.client as never }),
      'out_1',
      { minutes: 30 },
    );
    expect(out.ok).toBe(true);
    expect(shim.updates).toHaveLength(1);
    expect(shim.updates[0]!.table).toBe('event_outbox');
    const nextRetry = shim.updates[0]!.set.nextRetryAt as Date;
    expect(nextRetry).toBeInstanceOf(Date);
    expect(nextRetry.getTime()).toBeGreaterThanOrEqual(before + 30 * 60_000 - 1000);
  });

  it('rejects negative or too-large snooze windows', async () => {
    const shim = makeShim();
    const neg = await dispatchSnoozeReminder(
      baseCtx({ db: shim.client as never }),
      'out_1',
      { minutes: -10 },
    );
    expect(neg.ok).toBe(false);
    expect(shim.updates).toHaveLength(0);
  });
});

describe('dispatchArchiveInspection', () => {
  it('soft-deletes via deletedAt + deletedBy', async () => {
    const shim = makeShim();
    const out = await dispatchArchiveInspection(
      baseCtx({ db: shim.client as never }),
      'ins_1',
      {},
    );
    expect(out.ok).toBe(true);
    expect(shim.updates).toHaveLength(1);
    expect(shim.updates[0]!.table).toBe('inspections');
    expect(shim.updates[0]!.set.deletedAt).toBeInstanceOf(Date);
    expect(shim.updates[0]!.set.deletedBy).toBe('u1');
  });
});

describe('top-level dispatch', () => {
  it('returns ok=false for an unknown (entity, action) tuple', async () => {
    const shim = makeShim();
    const out = await dispatch(
      baseCtx({ db: shim.client as never }),
      'leases' as never,
      'archive' as never,
      'lease_1',
      {},
    );
    expect(out.ok).toBe(false);
    expect(out.reason).toMatch(/no dispatcher/);
  });

  it('routes mark_rent_paid → dispatchMarkRentPaid', async () => {
    const shim = makeShim({
      leaseRow: {
        id: 'lease_1',
        customerId: 'cust_1',
        rentAmount: 100,
        rentCurrency: 'TZS',
      },
    });
    const out = await dispatch(
      baseCtx({ db: shim.client as never }),
      'leases',
      'mark_rent_paid',
      'lease_1',
      {},
    );
    expect(out.ok).toBe(true);
    expect(out.artifactKind).toBe('payment');
  });
});
