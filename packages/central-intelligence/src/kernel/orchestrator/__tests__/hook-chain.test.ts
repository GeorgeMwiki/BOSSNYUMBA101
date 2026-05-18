import { describe, it, expect } from 'vitest';
import {
  createHookChain,
  type Hook,
  type HookContext,
  type HookResult,
  type PreToolUseHook,
  type PostToolUseHook,
  type StopHook,
} from '../hook-chain.js';
import type { Decision, DispatchResult } from '../decision.js';
import { createPiiScrubHook } from '../hooks/pre-tool-use/pii-scrub-hook.js';
import { createPermissionHook } from '../hooks/pre-tool-use/permission-hook.js';
import { createFourEyeHook } from '../hooks/pre-tool-use/four-eye-hook.js';
import { createToolDenylistHook } from '../hooks/pre-tool-use/tool-denylist-hook.js';
import {
  createRateLimitHook,
  createInMemoryRateLimitCounter,
} from '../hooks/pre-tool-use/rate-limit-hook.js';
import { createCostCircuitHook } from '../hooks/pre-tool-use/cost-circuit-hook.js';
import { createSandboxDivertHook } from '../hooks/pre-tool-use/sandbox-divert-hook.js';
import {
  createAuditEmissionHook,
  createInMemoryAuditEmissionSink,
} from '../hooks/post-tool-use/audit-emission-hook.js';
import {
  createLedgerSealHook,
  createInMemoryLedgerSeal,
} from '../hooks/stop/ledger-seal-hook.js';

// ─────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────

const tenantCtx: HookContext = {
  threadId: 'th_1',
  scope: {
    kind: 'tenant',
    tenantId: 't_1',
    actorUserId: 'u_1',
    roles: ['owner'],
    personaId: 'p_1',
  },
  tier: 'tenant',
  userMessage: 'hello',
  tickStartedAt: 0,
  grantedScopes: ['tenants.read'],
};

const platformCtx: HookContext = {
  threadId: 'th_2',
  scope: {
    kind: 'platform',
    actorUserId: 'admin',
    roles: ['platform-admin'],
    personaId: 'pi_1',
  },
  tier: 'industry',
  userMessage: 'hi',
  tickStartedAt: 0,
};

const toolCall = (
  toolName: string,
  input: Record<string, unknown> = {},
  estimatedCostUsd?: number,
): Decision => ({
  kind: 'tool_call',
  call: {
    toolName,
    input,
    callId: `call_${toolName}`,
    ...(estimatedCostUsd !== undefined ? { estimatedCostUsd } : {}),
  },
});

const respond: Decision = { kind: 'respond_to_owner', text: 'done' };

// ─────────────────────────────────────────────────────────────────────
// HookChain core
// ─────────────────────────────────────────────────────────────────────

describe('createHookChain', () => {
  it('returns allow when no hooks are registered', async () => {
    const chain = createHookChain([]);
    expect((await chain.runPreToolUse(respond, tenantCtx)).kind).toBe('allow');
    expect(chain.list()).toEqual([]);
  });

  it('short-circuits at the first non-allow result', async () => {
    let secondCalled = false;
    const first: PreToolUseHook = {
      name: 'denier',
      stage: 'pre-tool-use',
      async fn(): Promise<HookResult> {
        return { kind: 'deny', code: 'X', reason: 'no' };
      },
    };
    const second: PreToolUseHook = {
      name: 'never',
      stage: 'pre-tool-use',
      async fn(): Promise<HookResult> {
        secondCalled = true;
        return { kind: 'allow' };
      },
    };
    const chain = createHookChain([first, second]);
    const result = await chain.runPreToolUse(toolCall('any'), tenantCtx);
    expect(result.kind).toBe('deny');
    expect(secondCalled).toBe(false);
  });

  it('respects scope filters by tool name', async () => {
    const hook: PreToolUseHook = {
      name: 'scoped',
      stage: 'pre-tool-use',
      scope: { toolNames: ['tenant.delete'] },
      async fn(): Promise<HookResult> {
        return { kind: 'deny', code: 'D', reason: 'scoped deny' };
      },
    };
    const chain = createHookChain([hook]);
    expect((await chain.runPreToolUse(toolCall('tenant.read'), tenantCtx)).kind)
      .toBe('allow');
    expect((await chain.runPreToolUse(toolCall('tenant.delete'), tenantCtx)).kind)
      .toBe('deny');
  });

  it('runs post-tool-use and stop chains independently', async () => {
    let postFired = false;
    let stopFired = false;
    const post: PostToolUseHook = {
      name: 'p',
      stage: 'post-tool-use',
      async fn(): Promise<HookResult> {
        postFired = true;
        return { kind: 'allow' };
      },
    };
    const stop: StopHook = {
      name: 's',
      stage: 'stop',
      async fn(): Promise<HookResult> {
        stopFired = true;
        return { kind: 'allow' };
      },
    };
    const hooks: Hook[] = [post, stop];
    const chain = createHookChain(hooks);
    const dispatchResult: DispatchResult = {
      kind: 'tool_ok',
      callId: 'c',
      output: null,
      latencyMs: 1,
      tokensIn: 1,
      tokensOut: 1,
      usdCost: 0,
    };
    await chain.runPostToolUse(toolCall('x'), dispatchResult, tenantCtx);
    await chain.runStop(
      { threadId: 'th', turnCount: 1, finalText: null, exhaustedAxis: null },
      tenantCtx,
    );
    expect(postFired).toBe(true);
    expect(stopFired).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 7 built-in pre-tool-use hooks
// ─────────────────────────────────────────────────────────────────────

describe('built-in hooks', () => {
  describe('pii-scrub-hook', () => {
    it('transforms tool input when the scrubber flags PII', async () => {
      const hook = createPiiScrubHook({
        scrubber: {
          scrub: (text: string) =>
            text.includes('+255')
              ? { scrubbed: text.replace(/\+255\d+/g, '[redacted]'), hasPii: true }
              : { scrubbed: text, hasPii: false },
        },
      });
      const decision = toolCall('contact', { phone: '+255712345678', note: 'ok' });
      const result = await hook.fn(tenantCtx, decision);
      expect(result.kind).toBe('transform');
      if (result.kind === 'transform' && result.replacement.kind === 'tool_call') {
        expect(result.replacement.call.input.phone).toBe('[redacted]');
        expect(result.replacement.call.input.note).toBe('ok');
      }
    });

    it('allows when no PII is found', async () => {
      const hook = createPiiScrubHook({
        scrubber: { scrub: (t) => ({ scrubbed: t, hasPii: false }) },
      });
      expect((await hook.fn(tenantCtx, toolCall('safe', { a: 'b' }))).kind)
        .toBe('allow');
    });

    it('passes through non-tool decisions', async () => {
      const hook = createPiiScrubHook({
        scrubber: { scrub: (t) => ({ scrubbed: t, hasPii: true }) },
      });
      expect((await hook.fn(tenantCtx, respond)).kind).toBe('allow');
    });
  });

  describe('permission-hook', () => {
    it('denies when a required scope is missing', async () => {
      const hook = createPermissionHook({
        scopes: { requiredScopes: () => ['tenants.write'] },
      });
      const r = await hook.fn(tenantCtx, toolCall('tenant.update'));
      expect(r.kind).toBe('deny');
      if (r.kind === 'deny') expect(r.code).toBe('permission-missing-scopes');
    });

    it('allows when granted scopes cover the required set', async () => {
      const hook = createPermissionHook({
        scopes: { requiredScopes: () => ['tenants.read'] },
      });
      expect((await hook.fn(tenantCtx, toolCall('tenant.read'))).kind).toBe('allow');
    });
  });

  describe('four-eye-hook', () => {
    const hook = createFourEyeHook({
      policy: {
        requiresApproval: (n) => n === 'tenant.evict',
        approvalStatus: async ({ toolName }) =>
          toolName === 'tenant.evict' ? 'none' : 'approved',
      },
    });

    it('returns ask-owner when approval is missing', async () => {
      const r = await hook.fn(tenantCtx, toolCall('tenant.evict'));
      expect(r.kind).toBe('ask-owner');
    });

    it('returns allow when approval is approved', async () => {
      const allowHook = createFourEyeHook({
        policy: {
          requiresApproval: () => true,
          approvalStatus: async () => 'approved',
        },
      });
      expect((await allowHook.fn(tenantCtx, toolCall('x'))).kind).toBe('allow');
    });

    it('returns deny when approval was rejected', async () => {
      const denyHook = createFourEyeHook({
        policy: {
          requiresApproval: () => true,
          approvalStatus: async () => 'rejected',
        },
      });
      const r = await denyHook.fn(tenantCtx, toolCall('x'));
      expect(r.kind).toBe('deny');
      if (r.kind === 'deny') expect(r.code).toBe('four-eye-rejected');
    });
  });

  describe('tool-denylist-hook', () => {
    it('denies globally banned tools', async () => {
      const hook = createToolDenylistHook({
        globalDenylist: ['tenant.delete_all'],
      });
      const r = await hook.fn(tenantCtx, toolCall('tenant.delete_all'));
      expect(r.kind).toBe('deny');
      if (r.kind === 'deny') expect(r.code).toBe('tool-globally-denied');
    });

    it('respects the dynamic killswitch port', async () => {
      const hook = createToolDenylistHook({
        dynamic: { isDenied: async (n) => n === 'cost.spike' },
      });
      expect((await hook.fn(tenantCtx, toolCall('cost.spike'))).kind).toBe('deny');
      expect((await hook.fn(tenantCtx, toolCall('cost.normal'))).kind).toBe('allow');
    });
  });

  describe('rate-limit-hook', () => {
    it('allows under the threshold and denies past it', async () => {
      const counter = createInMemoryRateLimitCounter();
      const hook = createRateLimitHook({
        counter,
        maxCallsPerWindow: 2,
        windowMs: 1_000,
      });
      expect((await hook.fn(tenantCtx, toolCall('t1'))).kind).toBe('allow');
      expect((await hook.fn(tenantCtx, toolCall('t1'))).kind).toBe('allow');
      const third = await hook.fn(tenantCtx, toolCall('t1'));
      expect(third.kind).toBe('deny');
      if (third.kind === 'deny') expect(third.code).toBe('rate-limit-exceeded');
    });
  });

  describe('cost-circuit-hook', () => {
    it('denies when projection breaches the ceiling', async () => {
      const hook = createCostCircuitHook({
        breaker: {
          project: async ({ estimatedCostUsd }) => ({
            projectedUsd: estimatedCostUsd + 90,
            ceilingUsd: 100,
          }),
        },
      });
      const allow = await hook.fn(tenantCtx, toolCall('x', {}, 5));
      expect(allow.kind).toBe('allow');
      const deny = await hook.fn(tenantCtx, toolCall('x', {}, 50));
      expect(deny.kind).toBe('deny');
      if (deny.kind === 'deny') expect(deny.code).toBe('cost-ceiling-breach');
    });

    it('uses _platform as the tenantId for platform scope', async () => {
      let receivedTenant = '';
      const hook = createCostCircuitHook({
        breaker: {
          project: async ({ tenantId }) => {
            receivedTenant = tenantId;
            return { projectedUsd: 1, ceilingUsd: 10 };
          },
        },
      });
      await hook.fn(platformCtx, toolCall('x', {}, 1));
      expect(receivedTenant).toBe('_platform');
    });
  });

  describe('sandbox-divert-hook', () => {
    it('returns sandbox when the resolver supplies a sandbox id', async () => {
      const hook = createSandboxDivertHook({
        resolver: { resolve: async () => 'sbx_42' },
      });
      const r = await hook.fn(tenantCtx, toolCall('x'));
      expect(r.kind).toBe('sandbox');
      if (r.kind === 'sandbox') expect(r.sandboxId).toBe('sbx_42');
    });

    it('passes through when the resolver returns null', async () => {
      const hook = createSandboxDivertHook({
        resolver: { resolve: async () => null },
      });
      expect((await hook.fn(tenantCtx, toolCall('x'))).kind).toBe('allow');
    });
  });

  describe('audit-emission-hook', () => {
    it('records both tool_ok and tool_error dispatch outcomes', async () => {
      const sink = createInMemoryAuditEmissionSink();
      const hook = createAuditEmissionHook({ sink });
      await hook.fn(tenantCtx, toolCall('x'), {
        kind: 'tool_ok',
        callId: 'cx',
        output: { ok: true },
        latencyMs: 5,
        tokensIn: 10,
        tokensOut: 20,
        usdCost: 0.5,
      });
      await hook.fn(tenantCtx, toolCall('y'), {
        kind: 'tool_error',
        callId: 'cy',
        message: 'boom',
        latencyMs: 1,
      });
      expect(sink.rows.length).toBe(2);
      expect(sink.rows[0]?.outcome).toBe('ok');
      expect(sink.rows[1]?.outcome).toBe('error');
      expect(sink.rows[1]?.errorMessage).toBe('boom');
    });

    it('never throws when the sink fails', async () => {
      const hook = createAuditEmissionHook({
        sink: {
          record: async () => {
            throw new Error('sink down');
          },
        },
      });
      const r = await hook.fn(tenantCtx, toolCall('x'), {
        kind: 'tool_ok',
        callId: 'cx',
        output: null,
        latencyMs: 0,
        tokensIn: 0,
        tokensOut: 0,
        usdCost: 0,
      });
      expect(r.kind).toBe('allow');
    });
  });

  describe('ledger-seal-hook', () => {
    it('writes one seal per stop invocation', async () => {
      const ledger = createInMemoryLedgerSeal();
      const hook = createLedgerSealHook({ ledger });
      await hook.fn(tenantCtx, {
        threadId: 'th_1',
        turnCount: 4,
        finalText: 'bye',
        exhaustedAxis: null,
      });
      expect(ledger.seals.length).toBe(1);
      expect(ledger.seals[0]?.turnCount).toBe(4);
    });

    it('records the exhaustion axis on the seal envelope', async () => {
      const ledger = createInMemoryLedgerSeal();
      const hook = createLedgerSealHook({ ledger });
      await hook.fn(tenantCtx, {
        threadId: 'th_1',
        turnCount: 20,
        finalText: null,
        exhaustedAxis: 'turns',
      });
      expect(ledger.seals[0]?.exhaustedAxis).toBe('turns');
    });
  });
});
