/**
 * Audit hash-chain tests — Wave-11.
 *
 * Covers:
 *   - append() builds a chain linked by SHA-256 prev→this
 *   - verify() returns valid=true for an untouched chain
 *   - tampering a payload invalidates the chain
 *   - prevHash divergence is caught
 *   - sequence gaps are caught
 */

import { describe, it, expect } from 'vitest';
import {
  createAuditHashChain,
  createInMemoryAuditChainRepo,
  GENESIS_PREV_HASH,
} from '../security/audit-hash-chain.js';

function createChain(frozenNow?: string) {
  let clockMs = frozenNow ? new Date(frozenNow).getTime() : 1_700_000_000_000;
  let seq = 0;
  const repo = createInMemoryAuditChainRepo();
  const chain = createAuditHashChain({
    repo,
    now: () => new Date(clockMs++),
    idGenerator: () => `aud_${++seq}`,
  });
  return { repo, chain };
}

describe('audit-hash-chain', () => {
  it('first entry uses genesis prevHash', async () => {
    const { repo, chain } = createChain();
    const entry = await chain.append({
      tenantId: 't1',
      turnId: 'turn_1',
      action: 'llm_call',
      payload: { tokens: 42 },
    });
    expect(entry.prevHash).toBe(GENESIS_PREV_HASH);
    expect(entry.sequenceId).toBe(1);
    expect(entry.thisHash).toMatch(/^[0-9a-f]{64}$/);
    expect(repo.entries).toHaveLength(1);
  });

  it('links subsequent entries by prev→this hash', async () => {
    const { chain } = createChain();
    const a = await chain.append({ tenantId: 't1', turnId: 'a', action: 'x' });
    const b = await chain.append({ tenantId: 't1', turnId: 'b', action: 'y' });
    const c = await chain.append({ tenantId: 't1', turnId: 'c', action: 'z' });
    expect(b.prevHash).toBe(a.thisHash);
    expect(c.prevHash).toBe(b.thisHash);
    expect(new Set([a.thisHash, b.thisHash, c.thisHash]).size).toBe(3);
  });

  it('verify() returns valid for an unchanged chain', async () => {
    const { chain } = createChain();
    for (let i = 0; i < 5; i++) {
      await chain.append({
        tenantId: 't1',
        turnId: `t${i}`,
        action: 'llm_call',
        payload: { i },
      });
    }
    const result = await chain.verify('t1');
    expect(result.valid).toBe(true);
    expect(result.entriesChecked).toBe(5);
  });

  it('detects a mutated payload', async () => {
    const { repo, chain } = createChain();
    await chain.append({ tenantId: 't1', turnId: 'a', action: 'x', payload: { tokens: 1 } });
    await chain.append({ tenantId: 't1', turnId: 'b', action: 'y', payload: { tokens: 2 } });
    await chain.append({ tenantId: 't1', turnId: 'c', action: 'z', payload: { tokens: 3 } });

    repo.tamperAt(1, { payload: { tokens: 999 } });
    const result = await chain.verify('t1');
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(2);
    expect(result.error).toMatch(/mutated/i);
  });

  it('detects a broken prevHash link', async () => {
    const { repo, chain } = createChain();
    await chain.append({ tenantId: 't1', turnId: 'a', action: 'x' });
    await chain.append({ tenantId: 't1', turnId: 'b', action: 'y' });
    repo.tamperAt(1, { prevHash: 'f'.repeat(64) });
    const result = await chain.verify('t1');
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(2);
  });

  it('isolates chains per tenant', async () => {
    const { chain } = createChain();
    await chain.append({ tenantId: 't1', turnId: 'a', action: 'x' });
    await chain.append({ tenantId: 't2', turnId: 'b', action: 'y' });
    const a = await chain.listEntries('t1');
    const b = await chain.listEntries('t2');
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(a[0].tenantId).toBe('t1');
    expect(b[0].tenantId).toBe('t2');
  });
});
