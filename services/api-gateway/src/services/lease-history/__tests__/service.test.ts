/**
 * Lease history service — hash-chain + trace verification tests.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  LeaseHistoryError,
  LeaseHistoryService,
  computeStepAuditHash,
} from '../service.js';

interface FakeDb {
  execute: ReturnType<typeof vi.fn>;
}

const TENANT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const LEASE_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

function emptyLatest(): { rows: ReadonlyArray<Record<string, unknown>> } {
  return { rows: [] };
}

describe('LeaseHistoryService.appendStep', () => {
  it('rejects an invalid action', async () => {
    const db: FakeDb = { execute: vi.fn() };
    const svc = new LeaseHistoryService({ db });
    await expect(
      svc.appendStep({
        tenantId: TENANT_ID,
        leaseId: LEASE_ID,
        action: 'invalid_action' as unknown as 'move_in',
        actorId: 'user-1',
        actorRole: 'landlord',
      }),
    ).rejects.toThrow(LeaseHistoryError);
  });

  it('appends step 0 with genesis prev hash when chain is empty', async () => {
    const db: FakeDb = {
      execute: vi
        .fn()
        // First query: latest step lookup — empty.
        .mockResolvedValueOnce(emptyLatest())
        // Second query: INSERT.
        .mockResolvedValueOnce(emptyLatest()),
    };
    const svc = new LeaseHistoryService({ db });
    const step = await svc.appendStep({
      tenantId: TENANT_ID,
      leaseId: LEASE_ID,
      action: 'move_in',
      actorId: 'landlord-1',
      actorRole: 'landlord',
      happenedAt: '2026-05-29T10:00:00.000Z',
      provenance: { unitId: 'unit-1' },
    });

    expect(step.stepIndex).toBe(0);
    expect(step.prevAuditHash).toBe('');
    expect(step.auditHash).toHaveLength(64);
  });
});

describe('LeaseHistoryService.showTrace', () => {
  it('returns verification.ok=true for a valid chain', async () => {
    // Build two synthetic steps with a consistent chain.
    const step0Hash = computeStepAuditHash({
      leaseId: LEASE_ID,
      stepIndex: 0,
      action: 'move_in',
      actorId: 'landlord-1',
      actorRole: 'landlord',
      happenedAt: '2026-05-29T10:00:00.000Z',
      photoCid: null,
      locationLat: null,
      locationLon: null,
      amount: null,
      currencyCode: null,
      prevAuditHash: '',
      provenance: {},
    });
    const step1Hash = computeStepAuditHash({
      leaseId: LEASE_ID,
      stepIndex: 1,
      action: 'rent_payment',
      actorId: 'tenant-1',
      actorRole: 'tenant',
      happenedAt: '2026-06-01T08:00:00.000Z',
      photoCid: null,
      locationLat: null,
      locationLon: null,
      amount: 500000,
      currencyCode: 'TZS',
      prevAuditHash: step0Hash,
      provenance: {},
    });

    const db: FakeDb = {
      execute: vi.fn().mockResolvedValueOnce({
        rows: [
          {
            id: 'row-0',
            tenant_id: TENANT_ID,
            lease_id: LEASE_ID,
            step_index: 0,
            action: 'move_in',
            actor_id: 'landlord-1',
            actor_role: 'landlord',
            happened_at: '2026-05-29T10:00:00.000Z',
            photo_cid: null,
            location_lat: null,
            location_lon: null,
            amount: null,
            currency_code: null,
            audit_hash: step0Hash,
            prev_audit_hash: '',
            provenance: {},
          },
          {
            id: 'row-1',
            tenant_id: TENANT_ID,
            lease_id: LEASE_ID,
            step_index: 1,
            action: 'rent_payment',
            actor_id: 'tenant-1',
            actor_role: 'tenant',
            happened_at: '2026-06-01T08:00:00.000Z',
            photo_cid: null,
            location_lat: null,
            location_lon: null,
            amount: '500000.00',
            currency_code: 'TZS',
            audit_hash: step1Hash,
            prev_audit_hash: step0Hash,
            provenance: {},
          },
        ],
      }),
    };

    const svc = new LeaseHistoryService({ db });
    const trace = await svc.showTrace({
      tenantId: TENANT_ID,
      leaseId: LEASE_ID,
    });

    expect(trace.steps).toHaveLength(2);
    expect(trace.verification.ok).toBe(true);
    expect(trace.verification.brokenAt).toBeNull();
    expect(trace.latestHash).toBe(step1Hash);
  });

  it('detects tamper as verification.ok=false with brokenAt', async () => {
    const db: FakeDb = {
      execute: vi.fn().mockResolvedValueOnce({
        rows: [
          {
            id: 'row-0',
            tenant_id: TENANT_ID,
            lease_id: LEASE_ID,
            step_index: 0,
            action: 'move_in',
            actor_id: 'landlord-1',
            actor_role: 'landlord',
            happened_at: '2026-05-29T10:00:00.000Z',
            photo_cid: null,
            location_lat: null,
            location_lon: null,
            amount: null,
            currency_code: null,
            // Tampered: this is an arbitrary hash, not the computed one.
            audit_hash: 'tampered-hash',
            prev_audit_hash: '',
            provenance: {},
          },
        ],
      }),
    };
    const svc = new LeaseHistoryService({ db });
    const trace = await svc.showTrace({
      tenantId: TENANT_ID,
      leaseId: LEASE_ID,
    });
    expect(trace.verification.ok).toBe(false);
    expect(trace.verification.brokenAt).toBe(0);
  });
});
