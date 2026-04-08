/**
 * Retention Worker — Unit Tests
 *
 * These tests exercise the worker with an in-memory repository so the
 * legal-hold exemption, dry-run behaviour, and audit log emission can be
 * asserted without touching a real database.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DataRetentionManager,
  type RetentionPolicy,
} from '@bossnyumba/enterprise-hardening';

import type {
  RetentionCandidate,
  RetentionRepository,
  SweepResult,
} from '../types.js';
import { cutoffFor, runRetentionSweep } from '../worker.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

interface FakeRow extends RetentionCandidate {
  deletedAt?: Date | null;
  hardDeleted?: boolean;
}

class InMemoryRepository implements RetentionRepository {
  readonly rowsByType = new Map<string, FakeRow[]>();
  readonly legalHoldRegistry = new Map<string, Set<string>>();
  readonly auditLogs: SweepResult[] = [];

  add(entityType: string, row: FakeRow): void {
    const list = this.rowsByType.get(entityType) ?? [];
    list.push(row);
    this.rowsByType.set(entityType, list);
  }

  addLegalHold(entityType: string, entityId: string): void {
    const set = this.legalHoldRegistry.get(entityType) ?? new Set<string>();
    set.add(entityId);
    this.legalHoldRegistry.set(entityType, set);
  }

  async findCandidates(args: {
    entityType: string;
    olderThan: Date;
  }): Promise<RetentionCandidate[]> {
    const rows = this.rowsByType.get(args.entityType) ?? [];
    return rows.filter(
      (r) =>
        r.deletedAt == null &&
        r.hardDeleted !== true &&
        new Date(r.createdAt) < args.olderThan,
    );
  }

  async findLegalHoldEntityIds(args: {
    entityType: string;
    entityIds: readonly string[];
  }): Promise<Set<string>> {
    const held = this.legalHoldRegistry.get(args.entityType) ?? new Set();
    return new Set(args.entityIds.filter((id) => held.has(id)));
  }

  async softDelete(args: {
    entityType: string;
    entityIds: readonly string[];
    deletedAt: Date;
  }): Promise<number> {
    const rows = this.rowsByType.get(args.entityType) ?? [];
    let affected = 0;
    for (const row of rows) {
      if (args.entityIds.includes(row.entityId) && row.deletedAt == null) {
        row.deletedAt = args.deletedAt;
        affected += 1;
      }
    }
    return affected;
  }

  async hardDelete(args: {
    entityType: string;
    entityIds: readonly string[];
  }): Promise<number> {
    const rows = this.rowsByType.get(args.entityType) ?? [];
    let affected = 0;
    for (const row of rows) {
      if (args.entityIds.includes(row.entityId) && row.hardDeleted !== true) {
        row.hardDeleted = true;
        affected += 1;
      }
    }
    return affected;
  }

  async writeAuditLog(entry: SweepResult): Promise<void> {
    this.auditLogs.push(entry);
  }
}

function daysAgo(days: number, from: Date = new Date('2026-04-08T00:00:00Z')): string {
  const d = new Date(from);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

/**
 * Build a manager with a single tiny policy so we don't have to seed data
 * for every one of the default policies.
 */
function makeManagerWithPolicy(overrides?: Partial<RetentionPolicy>): DataRetentionManager {
  const manager = new DataRetentionManager();
  // Wipe defaults so the sweep only considers our test policy.
  for (const existing of manager.exportPolicies()) {
    manager.registerPolicy({ ...existing, enabled: false });
  }
  const policy: RetentionPolicy = {
    id: 'TEST_AUDIT',
    name: 'Test Audit Log Retention',
    description: 'test',
    classification: 'AUDIT' as RetentionPolicy['classification'],
    policyType: 'TIME_BASED' as RetentionPolicy['policyType'],
    retentionPeriodDays: 90,
    enabled: true,
    appliesTo: [{ entityType: 'AuditEvent' }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
  manager.registerPolicy(policy);
  return manager;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('cutoffFor', () => {
  it('subtracts the retention period in days from now', () => {
    const now = new Date('2026-04-08T12:00:00Z');
    const policy: RetentionPolicy = {
      id: 'X',
      name: 'X',
      description: 'X',
      classification: 'AUDIT' as RetentionPolicy['classification'],
      policyType: 'TIME_BASED' as RetentionPolicy['policyType'],
      retentionPeriodDays: 30,
      enabled: true,
      appliesTo: [{ entityType: 'Thing' }],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    const cutoff = cutoffFor(policy, now);
    expect(cutoff.toISOString()).toBe('2026-03-09T12:00:00.000Z');
  });
});

describe('runRetentionSweep', () => {
  let repo: InMemoryRepository;
  let manager: DataRetentionManager;
  const now = new Date('2026-04-08T00:00:00Z');

  beforeEach(() => {
    repo = new InMemoryRepository();
    manager = makeManagerWithPolicy();
  });

  it('sweeps records older than the retention period', async () => {
    repo.add('AuditEvent', {
      entityType: 'AuditEvent',
      entityId: 'old-1',
      tenantId: 't1',
      createdAt: daysAgo(120, now), // older than 90 days
    });
    repo.add('AuditEvent', {
      entityType: 'AuditEvent',
      entityId: 'old-2',
      tenantId: 't1',
      createdAt: daysAgo(200, now),
    });
    repo.add('AuditEvent', {
      entityType: 'AuditEvent',
      entityId: 'fresh-1',
      tenantId: 't1',
      createdAt: daysAgo(10, now), // well inside retention
    });

    const result = await runRetentionSweep({ repository: repo, manager }, { now });

    expect(result.totalDeleted).toBe(2);
    expect(result.totalExcludedByLegalHold).toBe(0);

    const rows = repo.rowsByType.get('AuditEvent') ?? [];
    const deletedIds = rows.filter((r) => r.deletedAt != null).map((r) => r.entityId);
    expect(deletedIds.sort()).toEqual(['old-1', 'old-2']);

    const fresh = rows.find((r) => r.entityId === 'fresh-1');
    expect(fresh?.deletedAt).toBeUndefined();
  });

  it('does NOT sweep records marked with row-level legal_hold: true', async () => {
    repo.add('AuditEvent', {
      entityType: 'AuditEvent',
      entityId: 'held-row-level',
      tenantId: 't1',
      createdAt: daysAgo(500, now),
      legalHold: true,
    });
    repo.add('AuditEvent', {
      entityType: 'AuditEvent',
      entityId: 'deletable',
      tenantId: 't1',
      createdAt: daysAgo(500, now),
    });

    const result = await runRetentionSweep({ repository: repo, manager }, { now });

    expect(result.totalDeleted).toBe(1);
    expect(result.totalExcludedByLegalHold).toBe(1);

    const rows = repo.rowsByType.get('AuditEvent') ?? [];
    const held = rows.find((r) => r.entityId === 'held-row-level');
    expect(held?.deletedAt).toBeUndefined();
    expect(held?.hardDeleted).not.toBe(true);
  });

  it('does NOT sweep records in the legal_holds registry table', async () => {
    repo.add('AuditEvent', {
      entityType: 'AuditEvent',
      entityId: 'held-via-registry',
      tenantId: 't1',
      createdAt: daysAgo(500, now),
    });
    repo.add('AuditEvent', {
      entityType: 'AuditEvent',
      entityId: 'normal-old',
      tenantId: 't1',
      createdAt: daysAgo(500, now),
    });
    repo.addLegalHold('AuditEvent', 'held-via-registry');

    const result = await runRetentionSweep({ repository: repo, manager }, { now });

    expect(result.totalDeleted).toBe(1);
    expect(result.totalExcludedByLegalHold).toBe(1);

    const rows = repo.rowsByType.get('AuditEvent') ?? [];
    const held = rows.find((r) => r.entityId === 'held-via-registry');
    expect(held?.deletedAt).toBeUndefined();
  });

  it('respects an in-memory DataRetentionManager legal hold', async () => {
    repo.add('AuditEvent', {
      entityType: 'AuditEvent',
      entityId: 'matter-record',
      tenantId: 'tenant-under-hold',
      createdAt: daysAgo(500, now),
    });
    manager.createLegalHold({
      name: 'Matter 123',
      matter: 'case-123',
      custodianId: 'legal@bossnyumba.test',
      scope: {
        tenantIds: ['tenant-under-hold'],
        entityTypes: ['AuditEvent'],
      },
    });

    const result = await runRetentionSweep({ repository: repo, manager }, { now });

    expect(result.totalDeleted).toBe(0);
    expect(result.totalExcludedByLegalHold).toBe(1);
  });

  it('dry run does NOT actually delete any records', async () => {
    repo.add('AuditEvent', {
      entityType: 'AuditEvent',
      entityId: 'candidate',
      tenantId: 't1',
      createdAt: daysAgo(500, now),
    });

    const softDeleteSpy = vi.spyOn(repo, 'softDelete');
    const hardDeleteSpy = vi.spyOn(repo, 'hardDelete');

    const result = await runRetentionSweep(
      { repository: repo, manager },
      { now, dryRun: true },
    );

    expect(result.dryRun).toBe(true);
    // Reports what WOULD be deleted
    expect(result.totalDeleted).toBe(1);
    // But neither delete path was called
    expect(softDeleteSpy).not.toHaveBeenCalled();
    expect(hardDeleteSpy).not.toHaveBeenCalled();

    const rows = repo.rowsByType.get('AuditEvent') ?? [];
    expect(rows[0]?.deletedAt).toBeUndefined();
    expect(rows[0]?.hardDeleted).not.toBe(true);
  });

  it('writes an audit log entry with counts per policy and legal-hold exclusions', async () => {
    repo.add('AuditEvent', {
      entityType: 'AuditEvent',
      entityId: 'del-1',
      tenantId: 't1',
      createdAt: daysAgo(500, now),
    });
    repo.add('AuditEvent', {
      entityType: 'AuditEvent',
      entityId: 'held-1',
      tenantId: 't1',
      createdAt: daysAgo(500, now),
      legalHold: true,
    });

    const result = await runRetentionSweep({ repository: repo, manager }, { now });

    expect(repo.auditLogs).toHaveLength(1);
    const log = repo.auditLogs[0]!;
    expect(log.sweepId).toBe(result.sweepId);
    expect(log.totalDeleted).toBe(1);
    expect(log.totalExcludedByLegalHold).toBe(1);
    expect(log.policies).toHaveLength(1);
    expect(log.policies[0]?.policyId).toBe('TEST_AUDIT');
    expect(log.policies[0]?.deleted).toBe(1);
    expect(log.policies[0]?.excludedByLegalHold).toBe(1);
    expect(log.policies[0]?.candidatesFound).toBe(2);
  });

  it('hard-deletes when a policy is listed in hardDeletePolicyIds', async () => {
    repo.add('AuditEvent', {
      entityType: 'AuditEvent',
      entityId: 'purge-me',
      tenantId: 't1',
      createdAt: daysAgo(500, now),
    });

    await runRetentionSweep(
      { repository: repo, manager },
      { now, hardDeletePolicyIds: ['TEST_AUDIT'] },
    );

    const rows = repo.rowsByType.get('AuditEvent') ?? [];
    expect(rows[0]?.hardDeleted).toBe(true);
    expect(rows[0]?.deletedAt).toBeUndefined();
  });

  it('records errors per entity type without aborting the sweep', async () => {
    repo.add('AuditEvent', {
      entityType: 'AuditEvent',
      entityId: 'ok',
      tenantId: 't1',
      createdAt: daysAgo(500, now),
    });
    const broken = new Error('boom');
    const findSpy = vi
      .spyOn(repo, 'findCandidates')
      .mockImplementationOnce(() => Promise.reject(broken));

    const result = await runRetentionSweep({ repository: repo, manager }, { now });

    expect(findSpy).toHaveBeenCalled();
    expect(result.policies).toHaveLength(1);
    expect(result.policies[0]?.errors[0]).toContain('boom');
    // Audit log is still written
    expect(repo.auditLogs).toHaveLength(1);
  });
});
