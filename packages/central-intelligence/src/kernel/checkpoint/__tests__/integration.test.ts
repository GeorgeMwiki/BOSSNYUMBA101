/**
 * Phase K-A integration suite — proves the three new pieces compose:
 *
 *   1. Hook chain (`hook-chain.ts`) — 22-event surface with the new
 *      `updated-tool-output` mutator and `defer` resumeToken.
 *   2. SessionStore (`session-store/`) — durable snapshot store.
 *   3. File checkpointer (`checkpoint/`) — per-message UUID restore
 *      backed by the SessionStore.
 *
 * Each test exercises a realistic end-to-end vignette: a CFO-approval
 * flow that defers on a token, a rewind across a permission-denied
 * branch, a multi-file restore mediated by the post-tool-batch hook.
 */

import { describe, it, expect } from 'vitest';
import {
  createHookChain,
  type HookResult,
  type PreToolUseHook,
  type PostToolUseHook,
  type SessionEndHook,
  type PermissionRequestHook,
  type HookContext,
} from '../../orchestrator/hook-chain.js';
import {
  createInMemorySessionStore,
  createSessionStore,
} from '../../session-store/index.js';
import {
  createFileCheckpointer,
  createInMemoryFileStore,
} from '../file-checkpoint.js';
import type { Decision, DispatchResult } from '../../orchestrator/decision.js';

const ctx: HookContext = {
  threadId: 'th_int',
  scope: {
    kind: 'tenant',
    tenantId: 't_int',
    actorUserId: 'u_int',
    roles: ['owner'],
    personaId: 'p_int',
  },
  tier: 'tenant',
  userMessage: 'hi',
  tickStartedAt: 0,
};

const toolCall = (toolName: string): Decision => ({
  kind: 'tool_call',
  call: { toolName, input: {}, callId: `c_${toolName}` },
});

// ─────────────────────────────────────────────────────────────────────
// Integration 1 — defer with resumeToken + SessionStore persistence
// ─────────────────────────────────────────────────────────────────────

describe('Integration: defer + SessionStore', () => {
  it('hook defer mints a resumeToken; SessionStore persists the snapshot for re-entry', async () => {
    const store = createInMemorySessionStore();
    const RESUME_TOKEN = 'rt_cfo_99';

    // 1. Pre-tool-use hook returns defer with a resumeToken.
    const cfoApproval: PreToolUseHook = {
      name: 'cfo',
      stage: 'pre-tool-use',
      async fn(): Promise<HookResult> {
        return {
          kind: 'defer',
          resumeAfterMs: 86_400_000, // 24h
          reason: 'awaiting CFO sign-off',
          resumeToken: RESUME_TOKEN,
        };
      },
    };
    const chain = createHookChain([cfoApproval]);
    const r = await chain.runPreToolUse(toolCall('tenant.evict'), ctx);
    expect(r.outcome.kind).toBe('defer');
    if (r.outcome.kind !== 'defer') return;

    // 2. Caller persists a snapshot keyed by the resumeToken.
    await store.write({
      sessionId: 'sess_int_1',
      tenantId: 't_int',
      personaId: 'p_int',
      capturedAt: new Date().toISOString(),
      payload: {
        pendingDecision: { kind: 'tool_call', toolName: 'tenant.evict' },
        deferReason: r.outcome.reason,
      },
      resumeToken: r.outcome.resumeToken ?? RESUME_TOKEN,
    });

    // 3. "Later" — re-entry reads the snapshot back.
    const resumed = await store.read('sess_int_1');
    expect(resumed?.resumeToken).toBe(RESUME_TOKEN);
    expect((resumed?.payload as { deferReason: string }).deferReason).toContain(
      'CFO',
    );
  });
});

// ─────────────────────────────────────────────────────────────────────
// Integration 2 — file checkpoint + hook short-circuit + rewind
// ─────────────────────────────────────────────────────────────────────

describe('Integration: hook deny + file rewind', () => {
  it('checkpoints the BEFORE bytes; hook deny triggers a rewind; file state restored', async () => {
    const fs = createInMemoryFileStore({ '/contract.md': 'A1' });
    const store = createInMemorySessionStore();
    let counter = 0;
    const cp = createFileCheckpointer({
      fileStore: fs,
      sessionStore: store,
      uuid: () => `cp_${(counter += 1)}`,
    });

    const sid = 'sess_int_2';
    const m1 = await cp.beginMessage(sid, []);
    await cp.recordFileWrite(sid, m1, '/contract.md', 'A1-edited-by-msg1');
    await fs.write('/contract.md', 'A1-edited-by-msg1');

    const m2 = await cp.beginMessage(sid, [m1]);
    await cp.recordFileWrite(sid, m2, '/contract.md', 'A1-edited-by-msg2');
    await fs.write('/contract.md', 'A1-edited-by-msg2');

    // A post-hook deny triggers a rewind.
    const auditFail: PostToolUseHook = {
      name: 'audit-fail',
      stage: 'post-tool-use',
      async fn(): Promise<HookResult> {
        return {
          kind: 'deny',
          code: 'compliance-trip',
          reason: 'PII detected in /contract.md',
        };
      },
    };
    const r = await createHookChain([auditFail]).runPostToolUse(
      toolCall('write-contract'),
      {
        kind: 'tool_ok',
        callId: 'c1',
        output: null,
        latencyMs: 0,
        tokensIn: 0,
        tokensOut: 0,
        usdCost: 0,
      } satisfies DispatchResult,
      ctx,
    );
    expect(r.kind).toBe('deny');

    // The orchestrator decides: rewind to m1 because m2 violated policy.
    await cp.rewindFiles(sid, m1);
    expect(await fs.read('/contract.md')).toBe('A1-edited-by-msg1');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Integration 3 — SessionStore tenant isolation through the chain
// ─────────────────────────────────────────────────────────────────────

describe('Integration: SessionStore tenant scoping', () => {
  it('list scoped by tenantId never leaks rows from another tenant', async () => {
    const store = createSessionStore({ kind: 'memory' });
    await store.write({
      sessionId: 's_t1',
      tenantId: 't_1',
      personaId: 'p',
      capturedAt: new Date().toISOString(),
      payload: {},
    });
    await store.write({
      sessionId: 's_t2',
      tenantId: 't_2',
      personaId: 'p',
      capturedAt: new Date().toISOString(),
      payload: {},
    });
    const t1Rows = await store.list({ tenantId: 't_1' });
    expect(t1Rows.length).toBe(1);
    expect(t1Rows[0]?.sessionId).toBe('s_t1');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Integration 4 — updated-tool-output + audit hook see the rewrite
// ─────────────────────────────────────────────────────────────────────

describe('Integration: updated-tool-output composes with audit', () => {
  it('redact hook rewrites, audit hook sees the rewritten output', async () => {
    const auditRows: DispatchResult[] = [];
    const redact: PostToolUseHook = {
      name: 'redact',
      stage: 'post-tool-use',
      async fn(_c, _d, r): Promise<HookResult> {
        if (r.kind !== 'tool_ok') return { kind: 'allow' };
        return {
          kind: 'updated-tool-output',
          replacement: { ...r, output: { redacted: true } },
        };
      },
    };
    const audit: PostToolUseHook = {
      name: 'audit',
      stage: 'post-tool-use',
      async fn(_c, _d, r): Promise<HookResult> {
        auditRows.push(r);
        return { kind: 'allow' };
      },
    };
    await createHookChain([redact, audit]).runPostToolUseChain(
      toolCall('x'),
      {
        kind: 'tool_ok',
        callId: 'c',
        output: { secret: 'leak' },
        latencyMs: 0,
        tokensIn: 0,
        tokensOut: 0,
        usdCost: 0,
      } satisfies DispatchResult,
      ctx,
    );
    expect(auditRows.length).toBe(1);
    expect(auditRows[0]?.kind).toBe('tool_ok');
    if (auditRows[0]?.kind === 'tool_ok') {
      expect((auditRows[0].output as { redacted: boolean }).redacted).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// Integration 5 — session-end hook fires + SessionStore cleanup
// ─────────────────────────────────────────────────────────────────────

describe('Integration: session-end + SessionStore cleanup', () => {
  it('session-end hook deletes the SessionStore row for the ending session', async () => {
    const store = createInMemorySessionStore();
    await store.write({
      sessionId: 'sess_end',
      tenantId: 't_int',
      personaId: 'p',
      capturedAt: new Date().toISOString(),
      payload: { active: true },
    });

    const cleanup: SessionEndHook = {
      name: 'cleanup',
      stage: 'session-end',
      async fn(_c, payload): Promise<HookResult> {
        await store.delete(payload.threadId);
        return { kind: 'allow' };
      },
    };
    await createHookChain([cleanup]).runSessionEnd(
      { threadId: 'sess_end', terminationReason: 'logout' },
      ctx,
    );
    expect(await store.read('sess_end')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────
// Integration 6 — permission-request hook persists the request to
// SessionStore for an out-of-band approval handler
// ─────────────────────────────────────────────────────────────────────

describe('Integration: permission-request + SessionStore parking', () => {
  it('a Slack-out-of-band permission-request parks the dialog into SessionStore', async () => {
    const store = createInMemorySessionStore();
    const slack: PermissionRequestHook = {
      name: 'slack',
      stage: 'permission-request',
      async fn(_c, p): Promise<HookResult> {
        await store.write({
          sessionId: 'pr_park_1',
          tenantId: 't_int',
          personaId: 'p',
          capturedAt: new Date().toISOString(),
          payload: { prompt: p.prompt, suggestedRules: [...p.suggestedRules] },
        });
        return { kind: 'allow' };
      },
    };
    await createHookChain([slack]).runPermissionRequest(
      {
        decision: toolCall('rent.adjust'),
        suggestedRules: ['Bash(rent-script)'],
        prompt: 'Approve rent adjustment for unit 4B?',
      },
      ctx,
    );
    const parked = await store.read('pr_park_1');
    expect(parked).not.toBeNull();
    expect((parked?.payload as { prompt: string }).prompt).toContain(
      'rent adjustment',
    );
  });
});

// ─────────────────────────────────────────────────────────────────────
// Integration 7 — file checkpointer rewind composes with post-tool-
// use-failure (rewind triggered by an error path)
// ─────────────────────────────────────────────────────────────────────

describe('Integration: post-tool-use-failure triggers rewind', () => {
  it('a failure hook captures the error and the rewind restores file bytes', async () => {
    const fs = createInMemoryFileStore({ '/budget.md': 'baseline' });
    const store = createInMemorySessionStore();
    let n = 0;
    const cp = createFileCheckpointer({
      fileStore: fs,
      sessionStore: store,
      uuid: () => `cp_${(n += 1)}`,
    });
    const sid = 'sess_int_7';
    const m1 = await cp.beginMessage(sid, []);
    await cp.recordFileWrite(sid, m1, '/budget.md', 'baseline');
    await fs.write('/budget.md', 'baseline');
    const m2 = await cp.beginMessage(sid, [m1]);
    await cp.recordFileWrite(sid, m2, '/budget.md', 'overspent');
    await fs.write('/budget.md', 'overspent');

    let observedFailure = false;
    const chain = createHookChain([
      {
        name: 'failure-rewind',
        stage: 'post-tool-use-failure',
        async fn(): Promise<HookResult> {
          observedFailure = true;
          return { kind: 'allow' };
        },
      },
    ]);
    await chain.runPostToolUseFailure(
      {
        decision: toolCall('budget-update'),
        error: {
          kind: 'tool_error',
          callId: 'cx',
          message: 'limit exceeded',
          latencyMs: 1,
        },
      },
      ctx,
    );
    expect(observedFailure).toBe(true);
    await cp.rewindFiles(sid, m1);
    expect(await fs.read('/budget.md')).toBe('baseline');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Integration 8 — full vignette: 22-event chain + SessionStore +
// file rewind in the SAME end-to-end flow
// ─────────────────────────────────────────────────────────────────────

describe('Integration: full Phase K-A end-to-end', () => {
  it('defer → park → rewind → resume threads through every primitive', async () => {
    const store = createInMemorySessionStore();
    const fs = createInMemoryFileStore({ '/policy.md': 'v0' });
    let n = 0;
    const checkpointer = createFileCheckpointer({
      fileStore: fs,
      sessionStore: store,
      uuid: () => `cp_${(n += 1)}`,
    });

    // 1. The agent edits /policy.md within message 1.
    const sid = 'sess_full';
    const m1 = await checkpointer.beginMessage(sid, []);
    await checkpointer.recordFileWrite(sid, m1, '/policy.md', 'v1');
    await fs.write('/policy.md', 'v1');

    // 2. Message 2 tries another edit but a pre-tool-use hook defers.
    const m2 = await checkpointer.beginMessage(sid, [m1]);
    const deferHook: PreToolUseHook = {
      name: 'wait-for-legal',
      stage: 'pre-tool-use',
      async fn(): Promise<HookResult> {
        return {
          kind: 'defer',
          resumeAfterMs: 0,
          reason: 'awaiting Legal sign-off',
          resumeToken: 'rt_legal_v2',
        };
      },
    };
    const chain = createHookChain([deferHook]);
    const r = await chain.runPreToolUse(toolCall('policy-edit'), ctx);
    expect(r.outcome.kind).toBe('defer');

    // 3. The orchestrator parks the deferred state in the SessionStore.
    if (r.outcome.kind === 'defer') {
      await store.write({
        sessionId: 'park_full',
        tenantId: 't_int',
        personaId: 'p',
        capturedAt: new Date().toISOString(),
        payload: {
          checkpointUuid: m2,
          pendingDecision: { kind: 'tool_call', toolName: 'policy-edit' },
          deferReason: r.outcome.reason,
        },
        resumeToken: r.outcome.resumeToken ?? 'rt_legal_v2',
      });
    }

    // 4. Legal rejects — orchestrator decides to rewind to BEFORE m2.
    await checkpointer.rewindFiles(sid, m1);
    expect(await fs.read('/policy.md')).toBe('v1');

    // 5. The parked snapshot still exists and points at the original
    // checkpoint UUID; the resume handler can decide whether to retry
    // or surface to the user.
    const parked = await store.read('park_full');
    expect(parked?.resumeToken).toBe('rt_legal_v2');
    expect((parked?.payload as { checkpointUuid: string }).checkpointUuid).toBe(
      m2,
    );

    // 6. Clean up.
    await store.delete('park_full');
    expect(await store.read('park_full')).toBeNull();
  });
});
