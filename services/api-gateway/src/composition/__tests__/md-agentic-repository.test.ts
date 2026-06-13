/**
 * MdAgenticRepository unit tests (Wave MD-AGENTIC-TOOLS, migration 0306).
 *
 * Mocks `db.execute` and verifies the honest behaviours ported from
 * LitFin's plan-mode + agent-teams / sandbox tools:
 *   - proposePlan persists + returns the row.
 *   - dispatchSubagentTeam persists one row per member at status 'pending'.
 *   - aggregateSubagentResults honest-degrades to UNAVAILABLE with no
 *     executor wired, NOT_READY mid-flight, and aggregates once terminal —
 *     NEVER fabricating subagent output.
 *   - commitSandboxWrite validates payload + FK existence, performs the
 *     atomic real-table write, writes the audit row, flips status.
 *   - rejectSandboxWrite writes the rejection log + flips status.
 *   - terminal rows refuse a second commit / reject.
 *
 * `db.execute` returns an ARRAY of rows (postgres.js shape); the
 * repository's `extractRows` also tolerates the `{ rows: [] }` shape.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  MdAgenticRepository,
  type SandboxWriteRow,
} from '../md-agentic-repository.js';

const TENANT = '00000000-0000-0000-0000-000000000000';
const SANDBOX = '66666666-6666-6666-6666-666666666666';
const STAFF = '11111111-1111-1111-1111-111111111111';
const TEAM = '55555555-5555-5555-5555-555555555555';

function sandboxRow(over: Partial<SandboxWriteRow>): SandboxWriteRow {
  return {
    id: SANDBOX,
    target_table: 'staff_members',
    operation: 'insert',
    target_row_id: null,
    proposed_payload: { full_name: 'Asha', role: 'caretaker' },
    rationale: 'New caretaker.',
    status: 'pending',
    expires_at: '2999-01-01T00:00:00.000Z',
    created_at: '2026-06-01T00:00:00.000Z',
    ...over,
  };
}

describe('MdAgenticRepository.proposePlan', () => {
  it('persists and returns the plan row', async () => {
    const execute = vi
      .fn()
      // INSERT → (no rows needed)
      .mockResolvedValueOnce([])
      // SELECT back the row
      .mockResolvedValueOnce([
        { id: 'p1', title: 'Q3 hiring', status: 'proposed', step_count: 2 },
      ]);
    const repo = new MdAgenticRepository({ execute });
    const res = await repo.proposePlan(
      TENANT,
      {
        title: 'Q3 hiring',
        summary: 'Bring on caretakers.',
        steps: [
          { tool: 'staff.create', input: {}, rationale: 'a' },
          { tool: 'staff.create', input: {}, rationale: 'b' },
        ],
        estimatedImpact: null,
      },
      'actor',
      null,
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.plan.title).toBe('Q3 hiring');
      expect(res.plan.step_count).toBe(2);
    }
  });
});

describe('MdAgenticRepository.dispatchSubagentTeam', () => {
  it('persists one pending run per member', async () => {
    // 2 members → 2 INSERTs (no plan FK check).
    const execute = vi.fn().mockResolvedValue([]);
    const repo = new MdAgenticRepository({ execute });
    const res = await repo.dispatchSubagentTeam(
      TENANT,
      {
        brief: 'Investigate arrears.',
        aggregation: 'merge_all',
        members: [
          { role: 'explorer', brief: 'find', allowedTools: [], tokenBudget: 8000 },
          { role: 'reviewer', brief: 'check', allowedTools: [], tokenBudget: 12000 },
        ],
        planId: null,
      },
      'actor',
      null,
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.memberIds).toHaveLength(2);
      expect(res.teamRunId).toMatch(/^[0-9a-f-]{36}$/i);
    }
    // 2 member INSERTs.
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('rejects a dangling planId FK', async () => {
    const execute = vi.fn().mockResolvedValueOnce([]); // plan lookup → none
    const repo = new MdAgenticRepository({ execute });
    const res = await repo.dispatchSubagentTeam(
      TENANT,
      {
        brief: 'x',
        aggregation: 'merge_all',
        members: [
          { role: 'explorer', brief: 'a', allowedTools: [], tokenBudget: 1 },
          { role: 'reviewer', brief: 'b', allowedTools: [], tokenBudget: 1 },
        ],
        planId: '99999999-9999-9999-9999-999999999999',
      },
      'actor',
      null,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('NOT_FOUND');
  });
});

describe('MdAgenticRepository.aggregateSubagentResults (honest-degrade)', () => {
  it('returns NOT_FOUND for an unknown team', async () => {
    const execute = vi.fn().mockResolvedValueOnce([]);
    const repo = new MdAgenticRepository({ execute });
    const res = await repo.aggregateSubagentResults(TENANT, TEAM);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('NOT_FOUND');
  });

  it('returns UNAVAILABLE when every run is still pending (no executor)', async () => {
    const execute = vi.fn().mockResolvedValueOnce([
      { id: 'a', role: 'explorer', status: 'pending', result: null, error: null, aggregation: 'merge_all' },
      { id: 'b', role: 'reviewer', status: 'pending', result: null, error: null, aggregation: 'merge_all' },
    ]);
    const repo = new MdAgenticRepository({ execute });
    const res = await repo.aggregateSubagentResults(TENANT, TEAM);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('UNAVAILABLE');
      expect(res.message).toContain('never fabricates');
    }
  });

  it('returns NOT_READY when some are done but others still run', async () => {
    const execute = vi.fn().mockResolvedValueOnce([
      { id: 'a', role: 'explorer', status: 'completed', result: { x: 1 }, error: null, aggregation: 'merge_all' },
      { id: 'b', role: 'reviewer', status: 'running', result: null, error: null, aggregation: 'merge_all' },
    ]);
    const repo = new MdAgenticRepository({ execute });
    const res = await repo.aggregateSubagentResults(TENANT, TEAM);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('NOT_READY');
  });

  it('aggregates best_of_n once all runs are terminal', async () => {
    const execute = vi.fn().mockResolvedValueOnce([
      { id: 'a', role: 'explorer', status: 'completed', result: { v: 'lo', confidence: 0.2 }, error: null, aggregation: 'best_of_n' },
      { id: 'b', role: 'reviewer', status: 'completed', result: { v: 'hi', confidence: 0.9 }, error: null, aggregation: 'best_of_n' },
    ]);
    const repo = new MdAgenticRepository({ execute });
    const res = await repo.aggregateSubagentResults(TENANT, TEAM);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.executorWired).toBe(true);
      expect(res.completedCount).toBe(2);
      expect((res.winner as { v: string }).v).toBe('hi');
    }
  });
});

describe('MdAgenticRepository.commitSandboxWrite', () => {
  it('NOT_FOUND when the sandbox row is missing', async () => {
    const execute = vi.fn().mockResolvedValueOnce([]); // findSandboxWrite → none
    const repo = new MdAgenticRepository({ execute });
    const res = await repo.commitSandboxWrite(TENANT, SANDBOX, 'actor', null);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('NOT_FOUND');
  });

  it('refuses an already-terminal sandbox row', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce([sandboxRow({ status: 'committed' })]);
    const repo = new MdAgenticRepository({ execute });
    const res = await repo.commitSandboxWrite(TENANT, SANDBOX, 'actor', null);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('CONFLICT');
  });

  it('rejects an invalid staged payload before any write', async () => {
    // payload missing required `role` for staff_members insert.
    const execute = vi
      .fn()
      .mockResolvedValueOnce([
        sandboxRow({ proposed_payload: { full_name: 'Asha' } }),
      ]);
    const repo = new MdAgenticRepository({ execute });
    const res = await repo.commitSandboxWrite(TENANT, SANDBOX, 'actor', null);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('INVALID_INPUT');
    // Only the lookup ran — NO write was attempted.
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('validates FK existence (manager_id) and surfaces NOT_FOUND', async () => {
    const execute = vi
      .fn()
      // findSandboxWrite
      .mockResolvedValueOnce([
        sandboxRow({
          proposed_payload: {
            full_name: 'Asha',
            role: 'caretaker',
            manager_id: '99999999-9999-9999-9999-999999999999',
          },
        }),
      ])
      // rowExists(manager) → none
      .mockResolvedValueOnce([]);
    const repo = new MdAgenticRepository({ execute });
    const res = await repo.commitSandboxWrite(TENANT, SANDBOX, 'actor', null);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('NOT_FOUND');
  });

  it('performs the atomic insert + audit row on a valid payload', async () => {
    const execute = vi
      .fn()
      // findSandboxWrite → pending insert (no FK columns present)
      .mockResolvedValueOnce([sandboxRow({})])
      // applyInsert → RETURNING id
      .mockResolvedValueOnce([{ id: STAFF }])
      // INSERT md_sandbox_commits
      .mockResolvedValueOnce([])
      // UPDATE md_sandbox_writes → committed
      .mockResolvedValueOnce([]);
    const repo = new MdAgenticRepository({ execute });
    const res = await repo.commitSandboxWrite(TENANT, SANDBOX, 'actor', null);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.targetRowId).toBe(STAFF);
      expect(res.operation).toBe('insert');
      expect(res.hasSnapshot).toBe(false);
    }
    // lookup + insert + audit + flip = 4 statements.
    expect(execute).toHaveBeenCalledTimes(4);
  });

  it('captures a pre-commit snapshot on UPDATE', async () => {
    const execute = vi
      .fn()
      // findSandboxWrite → pending update
      .mockResolvedValueOnce([
        sandboxRow({
          operation: 'update',
          target_row_id: STAFF,
          proposed_payload: { role: 'leasing_assistant' },
        }),
      ])
      // snapshotTargetRow → current row
      .mockResolvedValueOnce([{ id: STAFF, role: 'caretaker', version: 1 }])
      // applyUpdate → RETURNING id
      .mockResolvedValueOnce([{ id: STAFF }])
      // INSERT md_sandbox_commits
      .mockResolvedValueOnce([])
      // UPDATE md_sandbox_writes → committed
      .mockResolvedValueOnce([]);
    const repo = new MdAgenticRepository({ execute });
    const res = await repo.commitSandboxWrite(TENANT, SANDBOX, 'actor', null);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.hasSnapshot).toBe(true);
      expect(res.operation).toBe('update');
    }
  });

  it('NOT_FOUND when an UPDATE targets a missing row', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce([
        sandboxRow({
          operation: 'update',
          target_row_id: STAFF,
          proposed_payload: { role: 'accountant' },
        }),
      ])
      // snapshotTargetRow → none
      .mockResolvedValueOnce([]);
    const repo = new MdAgenticRepository({ execute });
    const res = await repo.commitSandboxWrite(TENANT, SANDBOX, 'actor', null);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('NOT_FOUND');
  });
});

describe('MdAgenticRepository.rejectSandboxWrite', () => {
  it('writes a rejection log row + flips status', async () => {
    const execute = vi
      .fn()
      // findSandboxWrite → pending
      .mockResolvedValueOnce([sandboxRow({})])
      // INSERT md_sandbox_rejects
      .mockResolvedValueOnce([])
      // UPDATE md_sandbox_writes → rejected
      .mockResolvedValueOnce([]);
    const repo = new MdAgenticRepository({ execute });
    const res = await repo.rejectSandboxWrite(
      TENANT,
      SANDBOX,
      'Wrong role.',
      'actor',
      null,
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.previousStatus).toBe('pending');
      expect(res.targetTable).toBe('staff_members');
    }
    expect(execute).toHaveBeenCalledTimes(3);
  });

  it('refuses to reject an already-terminal row', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce([sandboxRow({ status: 'rejected' })]);
    const repo = new MdAgenticRepository({ execute });
    const res = await repo.rejectSandboxWrite(
      TENANT,
      SANDBOX,
      'again',
      'actor',
      null,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('CONFLICT');
  });
});

describe('MdAgenticRepository — executor claim + finalize', () => {
  it('claims pending members and decodes the folded team brief', async () => {
    // The UPDATE … RETURNING returns the just-claimed rows. The stored brief
    // carries the team objective via the SAFE_MARKER envelope, split back here.
    const execute = vi.fn().mockResolvedValueOnce([
      {
        id: 'm-1',
        team_run_id: TEAM,
        role: 'explorer',
        brief: 'find arrears\n\n[[md-team-objective]]\nDraft a collections plan.',
        allowed_tools: ['ledger.read'],
        token_budget: 8000,
        aggregation: 'merge_all',
        origin_session_id: 'sess-1',
      },
    ]);
    const repo = new MdAgenticRepository({ execute });
    const members = await repo.claimPendingTeamMembers(TENANT, TEAM);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(members).toHaveLength(1);
    expect(members[0]!.brief).toBe('find arrears');
    expect(members[0]!.teamBrief).toBe('Draft a collections plan.');
    expect(members[0]!.allowedTools).toEqual(['ledger.read']);
    expect(members[0]!.tokenBudget).toBe(8000);
    expect(members[0]!.originSessionId).toBe('sess-1');
  });

  it('decodes a legacy brief with no marker into an empty teamBrief', async () => {
    const execute = vi.fn().mockResolvedValueOnce([
      {
        id: 'm-2',
        team_run_id: TEAM,
        role: 'reviewer',
        brief: 'plain brief, no marker',
        allowed_tools: [],
        token_budget: 12000,
        aggregation: 'merge_all',
        origin_session_id: null,
      },
    ]);
    const repo = new MdAgenticRepository({ execute });
    const members = await repo.claimPendingTeamMembers(TENANT, TEAM);
    expect(members[0]!.brief).toBe('plain brief, no marker');
    expect(members[0]!.teamBrief).toBe('');
  });

  it('completeSubagentRun returns true when a running row is finalized', async () => {
    const execute = vi.fn().mockResolvedValueOnce([{ id: 'm-1' }]);
    const repo = new MdAgenticRepository({ execute });
    const ok = await repo.completeSubagentRun(TENANT, 'm-1', { text: 'done' });
    expect(ok).toBe(true);
  });

  it('completeSubagentRun returns false when the row is no longer running', async () => {
    const execute = vi.fn().mockResolvedValueOnce([]); // status guard matched 0
    const repo = new MdAgenticRepository({ execute });
    const ok = await repo.completeSubagentRun(TENANT, 'm-1', { text: 'late' });
    expect(ok).toBe(false);
  });

  it('failSubagentRun records an error and returns true on a running row', async () => {
    const execute = vi.fn().mockResolvedValueOnce([{ id: 'm-1' }]);
    const repo = new MdAgenticRepository({ execute });
    const ok = await repo.failSubagentRun(TENANT, 'm-1', 'provider down');
    expect(ok).toBe(true);
  });
});
