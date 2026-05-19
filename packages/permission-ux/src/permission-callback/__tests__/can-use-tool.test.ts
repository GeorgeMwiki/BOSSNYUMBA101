/**
 * createCanUseTool — wraps caller's policy with persisted-rule lookup.
 * Persisted-rule lookup tested across the three scopes; deny-wins-over-
 * allow tested within a single scope.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createCanUseTool,
  persistPermissionUpdate,
} from '../can-use-tool.js';
import { InMemoryPermissionRuleStore } from '../in-memory-store.js';
import type { CanUseToolContext, CanUseToolFn } from '../types.js';
import type { PermissionDecision } from '../../types.js';

const CTX: CanUseToolContext = {
  tenantId: 't1',
  userId: 'u1',
  sessionId: 's1',
};

describe('createCanUseTool', () => {
  it('falls back to the policy when no rule matches', async () => {
    const store = new InMemoryPermissionRuleStore();
    const policy: CanUseToolFn = vi.fn(async () => ({ kind: 'allow' }));
    const can = createCanUseTool({ store, policy });

    const decision = await can('send_sms', { to: '+255' }, CTX);
    expect(decision.kind).toBe('allow');
    expect(policy).toHaveBeenCalledOnce();
  });

  it('honours a persisted session-scope allow rule', async () => {
    const store = new InMemoryPermissionRuleStore();
    await store.put({
      scope: 'session',
      tenantId: null,
      userId: null,
      sessionId: 's1',
      toolName: 'send_sms',
      predicate: null,
      verdict: 'allow',
      reason: 'one-time',
    });
    const policy: CanUseToolFn = vi.fn(async () => ({
      kind: 'deny',
      message: 'should not be called',
    }));
    const can = createCanUseTool({ store, policy });

    const decision = await can('send_sms', {}, CTX);
    expect(decision.kind).toBe('allow');
    expect(policy).not.toHaveBeenCalled();
  });

  it('honours a persisted tenant-scope allow rule across sessions', async () => {
    const store = new InMemoryPermissionRuleStore();
    await store.put({
      scope: 'tenant',
      tenantId: 't1',
      userId: null,
      sessionId: null,
      toolName: 'send_sms',
      predicate: null,
      verdict: 'allow',
      reason: null,
    });
    const policy: CanUseToolFn = vi.fn(async () => ({
      kind: 'deny',
      message: 'fallback',
    }));
    const can = createCanUseTool({ store, policy });

    const a = await can('send_sms', {}, CTX);
    const b = await can('send_sms', {}, { ...CTX, sessionId: 'sNew' });
    expect(a.kind).toBe('allow');
    expect(b.kind).toBe('allow');
    expect(policy).not.toHaveBeenCalled();
  });

  it('honours a persisted forever-scope allow rule for the same user', async () => {
    const store = new InMemoryPermissionRuleStore();
    await store.put({
      scope: 'forever',
      tenantId: null,
      userId: 'u1',
      sessionId: null,
      toolName: 'send_sms',
      predicate: null,
      verdict: 'allow',
      reason: null,
    });
    const policy: CanUseToolFn = vi.fn(async () => ({
      kind: 'deny',
      message: 'fallback',
    }));
    const can = createCanUseTool({ store, policy });

    const a = await can('send_sms', {}, CTX);
    expect(a.kind).toBe('allow');

    const b = await can('send_sms', {}, { ...CTX, userId: 'u2' });
    expect(b.kind).toBe('deny');
  });

  it('predicate gates rule application', async () => {
    const store = new InMemoryPermissionRuleStore();
    await store.put({
      scope: 'tenant',
      tenantId: 't1',
      userId: null,
      sessionId: null,
      toolName: 'send_sms',
      predicate: { 'args.channel': 'sms' },
      verdict: 'allow',
      reason: null,
    });
    const fallback: PermissionDecision = {
      kind: 'deny',
      message: 'no match',
    };
    const policy: CanUseToolFn = vi.fn(async () => fallback);
    const can = createCanUseTool({ store, policy });

    const a = await can('send_sms', { channel: 'sms' }, CTX);
    expect(a.kind).toBe('allow');

    const b = await can('send_sms', { channel: 'email' }, CTX);
    expect(b.kind).toBe('deny');
  });

  it('deny rule beats allow rule in the same scope', async () => {
    const store = new InMemoryPermissionRuleStore();
    await store.put({
      scope: 'tenant',
      tenantId: 't1',
      userId: null,
      sessionId: null,
      toolName: 'send_sms',
      predicate: null,
      verdict: 'allow',
      reason: null,
    });
    await store.put({
      scope: 'tenant',
      tenantId: 't1',
      userId: null,
      sessionId: null,
      toolName: 'send_sms',
      predicate: null,
      verdict: 'deny',
      reason: 'compliance lock',
    });
    const policy: CanUseToolFn = vi.fn(async () => ({ kind: 'allow' }));
    const can = createCanUseTool({ store, policy });

    const a = await can('send_sms', {}, CTX);
    expect(a.kind).toBe('deny');
    expect(policy).not.toHaveBeenCalled();
  });
});

describe('persistPermissionUpdate', () => {
  it('persists a session-scope allow rule with the right scope fields', async () => {
    const store = new InMemoryPermissionRuleStore();
    const entity = await persistPermissionUpdate(
      {
        kind: 'persist-allow',
        scope: 'session',
        toolName: 'send_sms',
      },
      CTX,
      store,
    );
    expect(entity.scope).toBe('session');
    expect(entity.sessionId).toBe('s1');
    expect(entity.tenantId).toBeNull();
    expect(entity.userId).toBeNull();
  });

  it('persists a tenant-scope rule', async () => {
    const store = new InMemoryPermissionRuleStore();
    const entity = await persistPermissionUpdate(
      {
        kind: 'persist-allow',
        scope: 'tenant',
        toolName: 'send_sms',
      },
      CTX,
      store,
    );
    expect(entity.scope).toBe('tenant');
    expect(entity.tenantId).toBe('t1');
    expect(entity.sessionId).toBeNull();
    expect(entity.userId).toBeNull();
  });

  it('persists a forever-scope rule', async () => {
    const store = new InMemoryPermissionRuleStore();
    const entity = await persistPermissionUpdate(
      {
        kind: 'persist-allow',
        scope: 'forever',
        toolName: 'send_sms',
        predicate: { 'args.channel': 'sms' },
        reason: 'always-on for SMS',
      },
      CTX,
      store,
    );
    expect(entity.scope).toBe('forever');
    expect(entity.userId).toBe('u1');
    expect(entity.predicate).toEqual({ 'args.channel': 'sms' });
    expect(entity.reason).toBe('always-on for SMS');
  });
});
