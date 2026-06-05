/**
 * org-admin-tools — descriptor metadata + http-client wiring tests.
 *
 * Mirrors cooperative-tools.test.ts: asserts persona scope / stakes, the
 * WRITE provenance wrap, the snake_case row mapping, and the no-client
 * honest-degrade shapes for all five `staff.*` tools.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  ORG_ADMIN_TOOLS,
  staffCreateTool,
  staffAssignKpiTool,
  staffScheduleTaskTool,
  staffEscalateToHumanTool,
  staffBulkIngestCsvTool,
} from '../org-admin-tools.js';
import type { PersonaToolHandlerContext } from '../types.js';

const TENANT = '00000000-0000-0000-0000-000000000000';
const STAFF = '11111111-1111-1111-1111-111111111111';
const KPI = '22222222-2222-2222-2222-222222222222';
const TASK = '33333333-3333-3333-3333-333333333333';
const ESC = '44444444-4444-4444-4444-444444444444';

function makeCtx(
  client?: Partial<PersonaToolHandlerContext['httpClient']>,
): PersonaToolHandlerContext {
  return {
    tenantId: TENANT,
    actorId: 'actor-owner',
    personaSlug: 'T1_owner_strategist',
    ...(client
      ? {
          httpClient: {
            get: vi.fn(),
            post: vi.fn(),
            ...client,
          } as unknown as PersonaToolHandlerContext['httpClient'],
        }
      : {}),
  };
}

describe('ORG_ADMIN_TOOLS catalog', () => {
  it('exports exactly 5 descriptors with the canonical ids', () => {
    expect(ORG_ADMIN_TOOLS).toHaveLength(5);
    expect(ORG_ADMIN_TOOLS.map((t) => t.id)).toEqual([
      'staff.create',
      'staff.assign_kpi',
      'staff.schedule_task',
      'staff.escalate_to_human',
      'staff.bulk_ingest_csv',
    ]);
  });

  it('scopes every tool to owner + admin personas, never a policy literal', () => {
    for (const tool of ORG_ADMIN_TOOLS) {
      expect(tool.personaSlugs).toEqual([
        'T1_owner_strategist',
        'T2_admin_strategist',
      ]);
      expect(tool.isWrite).toBe(true);
      expect(tool.requiresPolicyRuleLiteral).toBe(false);
    }
  });

  it('grades stakes: create/kpi/task MEDIUM, escalate/bulk HIGH', () => {
    expect(staffCreateTool.stakes).toBe('MEDIUM');
    expect(staffAssignKpiTool.stakes).toBe('MEDIUM');
    expect(staffScheduleTaskTool.stakes).toBe('MEDIUM');
    expect(staffEscalateToHumanTool.stakes).toBe('HIGH');
    expect(staffBulkIngestCsvTool.stakes).toBe('HIGH');
  });

  it('carries bilingual EN + SW names on every tool', () => {
    for (const tool of ORG_ADMIN_TOOLS) {
      expect(tool.name).toContain('(en)');
      expect(tool.name).toContain('(sw)');
    }
  });
});

describe('staffCreateTool (WRITE)', () => {
  it('POSTs the staff member with chat provenance and maps the row', async () => {
    const post = vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: STAFF,
        full_name: 'Asha Mwamba',
        role: 'caretaker',
        status: 'active',
        hire_date: '2026-06-01T00:00:00.000Z',
        manager_id: null,
      },
    });
    const ctx = makeCtx({ post });
    const res = await staffCreateTool.handler(
      { fullName: 'Asha Mwamba', role: 'caretaker' },
      ctx,
    );
    expect(res).toEqual({
      id: STAFF,
      fullName: 'Asha Mwamba',
      role: 'caretaker',
      status: 'active',
      hireDate: '2026-06-01T00:00:00.000Z',
      managerId: null,
    });
    expect(post).toHaveBeenCalledOnce();
    const [url, body] = post.mock.calls[0]!;
    expect(url).toBe('/org-admin/staff');
    expect((body as { provenance: { via: string } }).provenance.via).toBe(
      'chat',
    );
    expect((body as { allowDuplicate: boolean }).allowDuplicate).toBe(false);
  });

  it('honest-degrades to an unavailable shape when no http client is present', async () => {
    const ctx = makeCtx();
    const res = await staffCreateTool.handler(
      { fullName: 'Asha', role: 'caretaker' },
      ctx,
    );
    expect(res.id).toBe('');
    expect(res.status).toBe('unavailable');
    expect(res.fullName).toBe('Asha');
  });
});

describe('staffAssignKpiTool (WRITE)', () => {
  it('POSTs the KPI by staff name and maps the row', async () => {
    const post = vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: KPI,
        name: 'Units leased',
        staffMemberName: 'Asha Mwamba',
        target_value: '12.0000',
        metric_unit: 'count',
        period: 'quarter',
        period_end: null,
        status: 'active',
      },
    });
    const ctx = makeCtx({ post });
    const res = await staffAssignKpiTool.handler(
      { staffMemberName: 'Asha Mwamba', name: 'Units leased', targetValue: 12 },
      ctx,
    );
    expect(post).toHaveBeenCalledOnce();
    expect(post.mock.calls[0]![0]).toBe('/org-admin/staff/kpis');
    expect(res.id).toBe(KPI);
    expect(res.targetValue).toBe('12.0000');
    expect(res.staffMemberName).toBe('Asha Mwamba');
    expect(res.metricUnit).toBe('count');
  });

  it('honest-degrades when no http client is present', async () => {
    const ctx = makeCtx();
    const res = await staffAssignKpiTool.handler(
      { staffMemberName: 'Asha', name: 'NPS', targetValue: 90, metricUnit: 'percent' },
      ctx,
    );
    expect(res.status).toBe('unavailable');
    expect(res.metricUnit).toBe('percent');
    expect(res.targetValue).toBe('90');
  });
});

describe('staffScheduleTaskTool (WRITE)', () => {
  it('POSTs a task with the move-out-inspection example shape', async () => {
    const post = vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: TASK,
        title: 'Move-out inspection unit 4B',
        status: 'open',
        priority: 'high',
        due_at: '2026-06-12T09:00:00.000Z',
        assigned_to: STAFF,
      },
    });
    const ctx = makeCtx({ post });
    const res = await staffScheduleTaskTool.handler(
      {
        title: 'Move-out inspection unit 4B',
        assignedToStaffName: 'Asha',
        dueAt: '2026-06-12T09:00:00.000Z',
        priority: 'high',
      },
      ctx,
    );
    expect(post.mock.calls[0]![0]).toBe('/org-admin/tasks');
    expect(res.id).toBe(TASK);
    expect(res.priority).toBe('high');
    expect(res.assignedTo).toBe(STAFF);
  });

  it('honest-degrades when no http client is present', async () => {
    const ctx = makeCtx();
    const res = await staffScheduleTaskTool.handler(
      { title: 'Service generator' },
      ctx,
    );
    expect(res.status).toBe('unavailable');
    expect(res.title).toBe('Service generator');
  });
});

describe('staffEscalateToHumanTool (WRITE)', () => {
  it('POSTs an escalation with a real-estate category', async () => {
    const post = vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: ESC,
        title: 'Smoke alarm fault unit 7',
        category: 'maintenance_incident',
        severity: 'high',
        status: 'open',
        escalated_to_staff_id: null,
        related_task_id: null,
      },
    });
    const ctx = makeCtx({ post });
    const res = await staffEscalateToHumanTool.handler(
      {
        title: 'Smoke alarm fault unit 7',
        reason: 'Tenant reports the smoke alarm is dead; safety risk.',
        category: 'maintenance_incident',
        severity: 'high',
      },
      ctx,
    );
    expect(post.mock.calls[0]![0]).toBe('/org-admin/escalations');
    expect(res.id).toBe(ESC);
    expect(res.category).toBe('maintenance_incident');
    expect(res.severity).toBe('high');
  });

  it('honest-degrades when no http client is present', async () => {
    const ctx = makeCtx();
    const res = await staffEscalateToHumanTool.handler(
      {
        title: 'Late rent — unit 2',
        reason: 'Three months in arrears.',
        category: 'payment_default',
      },
      ctx,
    );
    expect(res.status).toBe('unavailable');
    expect(res.category).toBe('payment_default');
  });
});

describe('staffBulkIngestCsvTool (WRITE)', () => {
  it('POSTs the CSV and maps the per-row outcomes', async () => {
    const post = vi.fn().mockResolvedValue({
      success: true,
      data: {
        totalRows: 2,
        inserted: 1,
        skippedDuplicates: 1,
        rejected: 0,
        outcomes: [
          { line: 2, status: 'inserted', staffMemberId: STAFF },
          { line: 3, status: 'skipped_duplicate', reason: 'Asha already exists' },
        ],
      },
    });
    const ctx = makeCtx({ post });
    const res = await staffBulkIngestCsvTool.handler(
      { csv: 'name,role\nAsha,caretaker\nAsha,caretaker' },
      ctx,
    );
    expect(post.mock.calls[0]![0]).toBe('/org-admin/staff/bulk-csv');
    expect(res.totalRows).toBe(2);
    expect(res.inserted).toBe(1);
    expect(res.skippedDuplicates).toBe(1);
    expect(res.outcomes).toHaveLength(2);
    expect(res.outcomes[0]).toEqual({
      line: 2,
      status: 'inserted',
      staffMemberId: STAFF,
    });
  });

  it('honest-degrades to an empty outcome shape when no http client is present', async () => {
    const ctx = makeCtx();
    const res = await staffBulkIngestCsvTool.handler(
      { csv: 'name,role\nAsha,caretaker' },
      ctx,
    );
    expect(res.totalRows).toBe(0);
    expect(res.inserted).toBe(0);
    expect(res.outcomes).toEqual([]);
  });
});
