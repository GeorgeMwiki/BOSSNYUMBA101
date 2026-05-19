/**
 * InMemoryPermissionRuleStore — scope-aware rule lookup.
 */

import { describe, it, expect } from 'vitest';
import { InMemoryPermissionRuleStore } from '../in-memory-store.js';

describe('InMemoryPermissionRuleStore', () => {
  it('stores + lists session-scoped rules per session', async () => {
    const s = new InMemoryPermissionRuleStore();
    await s.put({
      scope: 'session',
      tenantId: null,
      userId: null,
      sessionId: 'sess1',
      toolName: 'send_sms',
      predicate: null,
      verdict: 'allow',
      reason: null,
    });

    const hit = await s.list({
      toolName: 'send_sms',
      tenantId: 't1',
      userId: 'u1',
      sessionId: 'sess1',
    });
    expect(hit.length).toBe(1);

    const miss = await s.list({
      toolName: 'send_sms',
      tenantId: 't1',
      userId: 'u1',
      sessionId: 'sess2',
    });
    expect(miss.length).toBe(0);
  });

  it('stores + lists tenant-scoped rules per tenant', async () => {
    const s = new InMemoryPermissionRuleStore();
    await s.put({
      scope: 'tenant',
      tenantId: 't1',
      userId: null,
      sessionId: null,
      toolName: 'send_sms',
      predicate: null,
      verdict: 'allow',
      reason: null,
    });

    const hit = await s.list({
      toolName: 'send_sms',
      tenantId: 't1',
      userId: 'anyone',
      sessionId: 'anysess',
    });
    expect(hit.length).toBe(1);

    const miss = await s.list({
      toolName: 'send_sms',
      tenantId: 't2',
      userId: 'anyone',
      sessionId: 'anysess',
    });
    expect(miss.length).toBe(0);
  });

  it('stores + lists forever-scoped rules per user', async () => {
    const s = new InMemoryPermissionRuleStore();
    await s.put({
      scope: 'forever',
      tenantId: null,
      userId: 'u1',
      sessionId: null,
      toolName: 'send_sms',
      predicate: null,
      verdict: 'allow',
      reason: null,
    });

    const hit = await s.list({
      toolName: 'send_sms',
      tenantId: 'anyT',
      userId: 'u1',
      sessionId: 'anysess',
    });
    expect(hit.length).toBe(1);

    const miss = await s.list({
      toolName: 'send_sms',
      tenantId: 'anyT',
      userId: 'u2',
      sessionId: 'anysess',
    });
    expect(miss.length).toBe(0);
  });

  it('filters by toolName', async () => {
    const s = new InMemoryPermissionRuleStore();
    await s.put({
      scope: 'tenant',
      tenantId: 't1',
      userId: null,
      sessionId: null,
      toolName: 'send_sms',
      predicate: null,
      verdict: 'allow',
      reason: null,
    });

    const miss = await s.list({
      toolName: 'send_email',
      tenantId: 't1',
      userId: 'u1',
      sessionId: 's1',
    });
    expect(miss.length).toBe(0);
  });
});
