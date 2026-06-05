/**
 * md-agentic-tools — descriptor metadata + http-client wiring tests.
 *
 * Mirrors org-admin-tools.test.ts: asserts persona scope / stakes, the
 * WRITE provenance wrap, the row mapping, and the no-client honest-degrade
 * shapes for all seven `plan.*` / `sandbox.*` tools. The honest-degrade
 * assertions are load-bearing — the brain MUST NOT fabricate plan rows,
 * subagent results, or committed writes when no loopback client is bound.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  MD_AGENTIC_TOOLS,
  planProposeTool,
  planDispatchSubagentsTool,
  planAggregateResultsTool,
  sandboxWriteTool,
  sandboxListTool,
  sandboxCommitTool,
  sandboxRejectTool,
} from '../md-agentic-tools.js';
import type { PersonaToolHandlerContext } from '../types.js';

const TEAM = '55555555-5555-5555-5555-555555555555';
const SANDBOX = '66666666-6666-6666-6666-666666666666';
const PLAN = '77777777-7777-7777-7777-777777777777';

function makeCtx(
  client?: Partial<PersonaToolHandlerContext['httpClient']>,
): PersonaToolHandlerContext {
  return {
    tenantId: '00000000-0000-0000-0000-000000000000',
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

describe('MD_AGENTIC_TOOLS catalog', () => {
  it('exports exactly 7 descriptors with the canonical ids', () => {
    expect(MD_AGENTIC_TOOLS).toHaveLength(7);
    expect(MD_AGENTIC_TOOLS.map((t) => t.id)).toEqual([
      'plan.propose',
      'plan.dispatch_subagents',
      'plan.aggregate_results',
      'sandbox.write',
      'sandbox.list',
      'sandbox.commit',
      'sandbox.reject',
    ]);
  });

  it('scopes every tool to owner + admin personas, never a policy literal', () => {
    for (const tool of MD_AGENTIC_TOOLS) {
      expect(tool.personaSlugs).toEqual([
        'T1_owner_strategist',
        'T2_admin_strategist',
      ]);
      expect(tool.requiresPolicyRuleLiteral).toBe(false);
    }
  });

  it('grades stakes + write flags correctly', () => {
    expect(planProposeTool.stakes).toBe('MEDIUM');
    expect(planProposeTool.isWrite).toBe(true);
    expect(planDispatchSubagentsTool.stakes).toBe('MEDIUM');
    expect(planDispatchSubagentsTool.isWrite).toBe(true);
    expect(planAggregateResultsTool.stakes).toBe('LOW');
    expect(planAggregateResultsTool.isWrite).toBe(false);
    expect(sandboxWriteTool.stakes).toBe('MEDIUM');
    expect(sandboxWriteTool.isWrite).toBe(true);
    expect(sandboxListTool.stakes).toBe('LOW');
    expect(sandboxListTool.isWrite).toBe(false);
    // commit is the moment the staged mutation lands — HIGH.
    expect(sandboxCommitTool.stakes).toBe('HIGH');
    expect(sandboxCommitTool.isWrite).toBe(true);
    expect(sandboxRejectTool.stakes).toBe('MEDIUM');
    expect(sandboxRejectTool.isWrite).toBe(true);
  });

  it('carries bilingual EN + SW names on every tool', () => {
    for (const tool of MD_AGENTIC_TOOLS) {
      expect(tool.name).toContain('(en)');
      expect(tool.name).toContain('(sw)');
    }
  });
});

describe('planProposeTool (WRITE)', () => {
  it('POSTs the plan with chat provenance and maps the row', async () => {
    const post = vi.fn().mockResolvedValue({
      success: true,
      data: { id: PLAN, title: 'Q3 hiring', status: 'proposed', step_count: 2 },
    });
    const ctx = makeCtx({ post });
    const res = await planProposeTool.handler(
      {
        title: 'Q3 hiring',
        summary: 'Bring on two caretakers before peak move-in season.',
        steps: [
          { tool: 'staff.create', input: { fullName: 'Asha' }, rationale: 'caretaker' },
          { tool: 'staff.create', input: { fullName: 'Juma' }, rationale: 'caretaker' },
        ],
      },
      ctx,
    );
    expect(post).toHaveBeenCalledOnce();
    const [url, body] = post.mock.calls[0]!;
    expect(url).toBe('/md-agentic/plans');
    expect((body as { provenance: { via: string } }).provenance.via).toBe('chat');
    expect(res).toEqual({
      id: PLAN,
      title: 'Q3 hiring',
      status: 'proposed',
      stepCount: 2,
    });
  });

  it('honest-degrades to an unavailable shape when no http client is present', async () => {
    const ctx = makeCtx();
    const res = await planProposeTool.handler(
      {
        title: 'Plan A',
        summary: 'Do the thing.',
        steps: [{ tool: 'x', input: {}, rationale: 'because' }],
      },
      ctx,
    );
    expect(res.id).toBe('');
    expect(res.status).toBe('unavailable');
    expect(res.stepCount).toBe(1);
  });
});

describe('planDispatchSubagentsTool (WRITE — honest-degrade)', () => {
  it('POSTs the team and maps the persisted pending runs', async () => {
    const post = vi.fn().mockResolvedValue({
      success: true,
      data: {
        teamRunId: TEAM,
        status: 'pending',
        aggregation: 'merge_all',
        memberCount: 2,
        memberIds: ['a', 'b'],
      },
    });
    const ctx = makeCtx({ post });
    const res = await planDispatchSubagentsTool.handler(
      {
        brief: 'Investigate the arrears spike across the north portfolio.',
        members: [
          { role: 'explorer', brief: 'Find which units drove the arrears spike.' },
          { role: 'reviewer', brief: 'Sanity-check the explorer findings.' },
        ],
      },
      ctx,
    );
    expect(post.mock.calls[0]![0]).toBe('/md-agentic/subagents/dispatch');
    expect(res.teamRunId).toBe(TEAM);
    expect(res.status).toBe('pending');
    expect(res.memberIds).toEqual(['a', 'b']);
  });

  it('honest-degrades when no http client is present', async () => {
    const ctx = makeCtx();
    const res = await planDispatchSubagentsTool.handler(
      {
        brief: 'A sufficiently long brief to satisfy the minimum length rule.',
        members: [
          { role: 'explorer', brief: 'Look into the data for anomalies please.' },
          { role: 'synthesizer', brief: 'Summarise what the explorer surfaces.' },
        ],
      },
      ctx,
    );
    expect(res.teamRunId).toBe('');
    expect(res.status).toBe('unavailable');
    expect(res.memberIds).toEqual([]);
  });
});

describe('planAggregateResultsTool (READ — never fabricates)', () => {
  it('GETs the aggregate and surfaces executorWired honestly', async () => {
    const get = vi.fn().mockResolvedValue({
      success: true,
      data: {
        status: 'unavailable',
        aggregation: 'merge_all',
        memberCount: 2,
        completedCount: 0,
        failedCount: 0,
        pendingCount: 2,
        executorWired: false,
        results: [
          { id: 'a', role: 'explorer', status: 'pending' },
          { id: 'b', role: 'reviewer', status: 'pending' },
        ],
      },
    });
    const ctx = makeCtx({ get });
    const res = await planAggregateResultsTool.handler({ teamRunId: TEAM }, ctx);
    expect(get.mock.calls[0]![0]).toBe(
      `/md-agentic/subagents/${TEAM}/aggregate`,
    );
    expect(res.status).toBe('unavailable');
    expect(res.executorWired).toBe(false);
    expect(res.pendingCount).toBe(2);
    expect(res.results).toHaveLength(2);
  });

  it('honest-degrades when no http client is present', async () => {
    const ctx = makeCtx();
    const res = await planAggregateResultsTool.handler({ teamRunId: TEAM }, ctx);
    expect(res.status).toBe('unavailable');
    expect(res.executorWired).toBe(false);
    expect(res.results).toEqual([]);
  });
});

describe('sandboxWriteTool (WRITE — stage)', () => {
  it('POSTs the staged write with chat provenance', async () => {
    const post = vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: SANDBOX,
        target_table: 'staff_members',
        operation: 'insert',
        status: 'pending',
        expires_at: '2026-06-19T00:00:00.000Z',
      },
    });
    const ctx = makeCtx({ post });
    const res = await sandboxWriteTool.handler(
      {
        targetTable: 'staff_members',
        operation: 'insert',
        proposedPayload: { full_name: 'Asha', role: 'caretaker' },
        rationale: 'New caretaker for the north block.',
      },
      ctx,
    );
    expect(post.mock.calls[0]![0]).toBe('/md-agentic/sandbox/writes');
    const body = post.mock.calls[0]![1] as { provenance: { via: string } };
    expect(body.provenance.via).toBe('chat');
    expect(res.sandboxId).toBe(SANDBOX);
    expect(res.status).toBe('pending');
    expect(res.expiresAt).toBe('2026-06-19T00:00:00.000Z');
  });

  it('honest-degrades when no http client is present', async () => {
    const ctx = makeCtx();
    const res = await sandboxWriteTool.handler(
      {
        targetTable: 'org_tasks',
        operation: 'insert',
        proposedPayload: { title: 'Service generator' },
      },
      ctx,
    );
    expect(res.sandboxId).toBe('');
    expect(res.status).toBe('unavailable');
    expect(res.targetTable).toBe('org_tasks');
  });
});

describe('sandboxListTool (READ)', () => {
  it('GETs staged writes and maps the rows', async () => {
    const get = vi.fn().mockResolvedValue({
      success: true,
      data: {
        statusFilter: 'pending',
        tableFilter: 'all',
        count: 1,
        sandboxWrites: [
          {
            id: SANDBOX,
            target_table: 'staff_members',
            operation: 'insert',
            status: 'pending',
            rationale: 'New caretaker.',
            expires_at: '2026-06-19T00:00:00.000Z',
          },
        ],
      },
    });
    const ctx = makeCtx({ get });
    const res = await sandboxListTool.handler({}, ctx);
    expect(get.mock.calls[0]![0]).toBe('/md-agentic/sandbox/writes');
    expect(res.count).toBe(1);
    expect(res.sandboxWrites[0]!.id).toBe(SANDBOX);
    expect(res.sandboxWrites[0]!.rationale).toBe('New caretaker.');
  });

  it('honest-degrades to an empty shape when no http client is present', async () => {
    const ctx = makeCtx();
    const res = await sandboxListTool.handler({ status: 'pending' }, ctx);
    expect(res.count).toBe(0);
    expect(res.sandboxWrites).toEqual([]);
  });
});

describe('sandboxCommitTool (WRITE — atomic real-table write)', () => {
  it('POSTs the commit and maps the result', async () => {
    const post = vi.fn().mockResolvedValue({
      success: true,
      data: {
        sandboxId: SANDBOX,
        targetTable: 'staff_members',
        operation: 'insert',
        targetRowId: '11111111-1111-1111-1111-111111111111',
        hasSnapshot: false,
      },
    });
    const ctx = makeCtx({ post });
    const res = await sandboxCommitTool.handler({ sandboxId: SANDBOX }, ctx);
    expect(post.mock.calls[0]![0]).toBe(
      `/md-agentic/sandbox/writes/${SANDBOX}/commit`,
    );
    expect(res.status).toBe('committed');
    expect(res.targetRowId).toBe('11111111-1111-1111-1111-111111111111');
    expect(res.hasSnapshot).toBe(false);
  });

  it('honest-degrades when no http client is present', async () => {
    const ctx = makeCtx();
    const res = await sandboxCommitTool.handler({ sandboxId: SANDBOX }, ctx);
    expect(res.status).toBe('unavailable');
    expect(res.sandboxId).toBe(SANDBOX);
  });
});

describe('sandboxRejectTool (WRITE — rejection log)', () => {
  it('POSTs the rejection with the reason', async () => {
    const post = vi.fn().mockResolvedValue({
      success: true,
      data: {
        sandboxId: SANDBOX,
        targetTable: 'staff_members',
        previousStatus: 'pending',
        status: 'rejected',
      },
    });
    const ctx = makeCtx({ post });
    const res = await sandboxRejectTool.handler(
      { sandboxId: SANDBOX, reason: 'Wrong role — they are a leasing assistant.' },
      ctx,
    );
    expect(post.mock.calls[0]![0]).toBe(
      `/md-agentic/sandbox/writes/${SANDBOX}/reject`,
    );
    const body = post.mock.calls[0]![1] as { reason: string };
    expect(body.reason).toBe('Wrong role — they are a leasing assistant.');
    expect(res.status).toBe('rejected');
    expect(res.previousStatus).toBe('pending');
  });

  it('honest-degrades when no http client is present', async () => {
    const ctx = makeCtx();
    const res = await sandboxRejectTool.handler(
      { sandboxId: SANDBOX, reason: 'No.' },
      ctx,
    );
    expect(res.status).toBe('unavailable');
    expect(res.sandboxId).toBe(SANDBOX);
  });
});
