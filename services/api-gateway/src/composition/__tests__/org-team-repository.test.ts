/**
 * OrgTeamRepository unit tests (Wave ORG-ADMIN-TOOLS, migration 0305).
 *
 * Mocks `db.execute` and verifies the honest behaviours ported from
 * LitFin's org-management tools: case-insensitive DUPLICATE detection,
 * manager FK validation, resolve NOT_FOUND / AMBIGUOUS, and per-row bulk
 * error collection with manager_name resolution.
 *
 * `db.execute` returns an ARRAY of rows (postgres.js shape); the
 * repository's `extractRows` also tolerates the `{ rows: [] }` shape.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  OrgTeamRepository,
  type StaffMemberRow,
  type BulkParsedRow,
} from '../org-team-repository.js';

const TENANT = '00000000-0000-0000-0000-000000000000';

function staffRow(over: Partial<StaffMemberRow>): StaffMemberRow {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    full_name: 'Asha Mwamba',
    role: 'caretaker',
    hire_date: '2026-06-01T00:00:00.000Z',
    manager_id: null,
    status: 'active',
    metadata: {},
    created_at: '2026-06-01T00:00:00.000Z',
    ...over,
  };
}

describe('OrgTeamRepository.createStaffMember', () => {
  it('refuses a case-insensitive duplicate name unless forced', async () => {
    // 1st execute = findStaffByName (dup check) → returns an existing row.
    const execute = vi.fn().mockResolvedValueOnce([staffRow({})]);
    const repo = new OrgTeamRepository({ execute });
    const res = await repo.createStaffMember(
      TENANT,
      {
        fullName: 'asha mwamba',
        role: 'caretaker',
        hireDateIso: '2026-06-01T00:00:00.000Z',
        managerId: null,
        metadata: {},
        allowDuplicate: false,
      },
      'actor',
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('DUPLICATE');
    // No INSERT issued — only the dup-check query ran.
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('rejects a dangling manager FK', async () => {
    const execute = vi
      .fn()
      // dup check → none
      .mockResolvedValueOnce([])
      // manager lookup → none
      .mockResolvedValueOnce([]);
    const repo = new OrgTeamRepository({ execute });
    const res = await repo.createStaffMember(
      TENANT,
      {
        fullName: 'New Person',
        role: 'leasing_assistant',
        hireDateIso: '2026-06-01T00:00:00.000Z',
        managerId: '99999999-9999-9999-9999-999999999999',
        metadata: {},
        allowDuplicate: false,
      },
      'actor',
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('NOT_FOUND');
  });

  it('inserts and returns the new row when no duplicate + no manager', async () => {
    const newRow = staffRow({
      id: '22222222-2222-2222-2222-222222222222',
      full_name: 'Juma Said',
      role: 'groundskeeper',
    });
    const execute = vi
      .fn()
      // dup check → none
      .mockResolvedValueOnce([])
      // INSERT → (no rows needed)
      .mockResolvedValueOnce([])
      // findStaffById after insert → the new row
      .mockResolvedValueOnce([newRow]);
    const repo = new OrgTeamRepository({ execute });
    const res = await repo.createStaffMember(
      TENANT,
      {
        fullName: 'Juma Said',
        role: 'groundskeeper',
        hireDateIso: '2026-06-01T00:00:00.000Z',
        managerId: null,
        metadata: { phone: '+255712345678' },
        allowDuplicate: false,
      },
      'actor',
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.staff.full_name).toBe('Juma Said');
      expect(res.staff.role).toBe('groundskeeper');
    }
  });
});

describe('OrgTeamRepository.resolveStaff', () => {
  it('resolves by id', async () => {
    const execute = vi.fn().mockResolvedValueOnce([staffRow({})]);
    const repo = new OrgTeamRepository({ execute });
    const res = await repo.resolveStaff(
      TENANT,
      { id: '11111111-1111-1111-1111-111111111111' },
      'staff member',
    );
    expect(res.ok).toBe(true);
  });

  it('surfaces NOT_FOUND for an unknown name', async () => {
    const execute = vi.fn().mockResolvedValueOnce([]);
    const repo = new OrgTeamRepository({ execute });
    const res = await repo.resolveStaff(
      TENANT,
      { name: 'Nobody' },
      'staff member',
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('NOT_FOUND');
  });

  it('surfaces AMBIGUOUS when two staff share a name', async () => {
    const execute = vi.fn().mockResolvedValueOnce([
      staffRow({ id: 'aaaaaaaa-1111-1111-1111-111111111111' }),
      staffRow({ id: 'bbbbbbbb-2222-2222-2222-222222222222', role: 'accountant' }),
    ]);
    const repo = new OrgTeamRepository({ execute });
    const res = await repo.resolveStaff(
      TENANT,
      { name: 'Asha Mwamba' },
      'staff member',
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('AMBIGUOUS');
  });

  it('returns INVALID_INPUT when neither id nor name supplied', async () => {
    const execute = vi.fn();
    const repo = new OrgTeamRepository({ execute });
    const res = await repo.resolveStaff(TENANT, {}, 'staff member');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('INVALID_INPUT');
    expect(execute).not.toHaveBeenCalled();
  });
});

describe('OrgTeamRepository.bulkIngestStaff', () => {
  function parsed(over: Partial<BulkParsedRow>): BulkParsedRow {
    return {
      line: 2,
      fullName: 'Asha',
      role: 'caretaker',
      hireDateIso: '2026-06-01T00:00:00.000Z',
      managerName: null,
      metadata: {},
      ...over,
    };
  }

  it('collects inserted / skipped_duplicate / rejected per row', async () => {
    // 1st execute = preload existing names → one existing "Existing Boss".
    const execute = vi
      .fn()
      .mockResolvedValueOnce([
        { id: 'eeeeeeee-0000-0000-0000-000000000000', full_name: 'Existing Boss' },
      ])
      // INSERT for line 2 (Asha) → ok
      .mockResolvedValueOnce([]);
    const repo = new OrgTeamRepository({ execute });
    const outcomes = await repo.bulkIngestStaff(
      TENANT,
      [
        parsed({ line: 2, fullName: 'Asha' }),
        // duplicate of preloaded existing → skipped
        parsed({ line: 3, fullName: 'existing boss' }),
        // manager not found anywhere → rejected
        parsed({ line: 4, fullName: 'Newbie', managerName: 'Ghost' }),
      ],
      false,
    );
    expect(outcomes).toHaveLength(3);
    expect(outcomes[0]!.status).toBe('inserted');
    expect(outcomes[1]!.status).toBe('skipped_duplicate');
    expect(outcomes[2]!.status).toBe('rejected');
    expect(outcomes[2]!.reason).toContain('NOT_FOUND');
  });

  it('resolves a manager named earlier in the same CSV', async () => {
    const execute = vi
      .fn()
      // preload existing → none
      .mockResolvedValueOnce([])
      // INSERT boss (line 2) → ok
      .mockResolvedValueOnce([])
      // INSERT report (line 3) → ok
      .mockResolvedValueOnce([]);
    const repo = new OrgTeamRepository({ execute });
    const outcomes = await repo.bulkIngestStaff(
      TENANT,
      [
        parsed({ line: 2, fullName: 'Boss Lady', role: 'accountant' }),
        parsed({ line: 3, fullName: 'Report One', managerName: 'boss lady' }),
      ],
      false,
    );
    expect(outcomes[0]!.status).toBe('inserted');
    expect(outcomes[1]!.status).toBe('inserted');
  });
});
