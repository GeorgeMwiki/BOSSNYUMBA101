import { describe, expect, it } from 'vitest';
import { createMemoryAdapter, pickBackend } from './memory-adapter.js';

describe('pickBackend', () => {
  it('returns "sessionstore" by default', () => {
    expect(pickBackend({})).toBe('sessionstore');
  });

  it('returns "managed-agents" when env requests', () => {
    expect(pickBackend({ MEMORY_BACKEND: 'managed-agents' })).toBe(
      'managed-agents',
    );
  });

  it('returns "sessionstore" when env requests', () => {
    expect(pickBackend({ MEMORY_BACKEND: 'sessionstore' })).toBe('sessionstore');
  });

  it('throws for unknown MEMORY_BACKEND', () => {
    expect(() => pickBackend({ MEMORY_BACKEND: 'redis' })).toThrow();
  });
});

describe('createMemoryAdapter — sessionstore backend (default)', () => {
  it('round-trips a note', async () => {
    const a = createMemoryAdapter();
    await a.create('tnt-001', 'playbooks/eviction.md', '# Eviction SOP');
    const v = await a.view('tnt-001', 'playbooks/eviction.md');
    expect(v).toContain('Eviction SOP');
  });

  it('returns null for missing note', async () => {
    const a = createMemoryAdapter();
    const v = await a.view('tnt-001', 'vendors/missing.md');
    expect(v).toBeNull();
  });

  it('supports str_replace', async () => {
    const a = createMemoryAdapter();
    await a.create('tnt-001', 'playbooks/eviction.md', 'old line\nfoo');
    await a.strReplace(
      'tnt-001',
      'playbooks/eviction.md',
      'old line',
      'new line',
    );
    const v = await a.view('tnt-001', 'playbooks/eviction.md');
    expect(v).toBe('new line\nfoo');
  });

  it('refuses str_replace when oldStr is absent', async () => {
    const a = createMemoryAdapter();
    await a.create('tnt-001', 'x.md', 'aaa');
    await expect(
      a.strReplace('tnt-001', 'x.md', 'missing', 'new'),
    ).rejects.toThrow(/not found/i);
  });

  it('supports insert at a specific line', async () => {
    const a = createMemoryAdapter();
    await a.create('tnt-001', 'x.md', 'a\nb\nc');
    await a.insert('tnt-001', 'x.md', 1, 'X');
    const v = await a.view('tnt-001', 'x.md');
    expect(v).toBe('a\nX\nb\nc');
  });

  it('supports delete', async () => {
    const a = createMemoryAdapter();
    await a.create('tnt-001', 'tmp.md', 'data');
    await a.delete('tnt-001', 'tmp.md');
    const v = await a.view('tnt-001', 'tmp.md');
    expect(v).toBeNull();
  });

  it('supports rename', async () => {
    const a = createMemoryAdapter();
    await a.create('tnt-001', 'old.md', 'X');
    await a.rename('tnt-001', 'old.md', 'new.md');
    expect(await a.view('tnt-001', 'old.md')).toBeNull();
    expect(await a.view('tnt-001', 'new.md')).toBe('X');
  });

  it('isolates tenants — tenant A cannot see tenant B notes', async () => {
    const a = createMemoryAdapter();
    await a.create('tnt-A', 'playbooks/A.md', 'secret-A');
    await a.create('tnt-B', 'playbooks/B.md', 'secret-B');
    // Tenant A path resolves to /sessionstore://memory/tnt-A/...
    // Tenant B path resolves to /sessionstore://memory/tnt-B/...
    // These are entirely disjoint keys in the synthetic store.
    expect(await a.view('tnt-A', 'playbooks/B.md')).toBeNull();
    expect(await a.view('tnt-B', 'playbooks/A.md')).toBeNull();
  });

  it('persists cross-session by retaining state within an adapter instance', async () => {
    const a = createMemoryAdapter();
    await a.create('tnt-001', 'x.md', 'session-1');
    // simulate a new turn:
    const v = await a.view('tnt-001', 'x.md');
    expect(v).toBe('session-1');
  });
});

describe('createMemoryAdapter — managed-agents backend', () => {
  it('uses managedAgentsFs hooks when backend=managed-agents', async () => {
    const store = new Map<string, string>();
    const a = createMemoryAdapter({
      env: { MEMORY_BACKEND: 'managed-agents' },
      managedAgentsFs: {
        async read(p) { return store.get(p) ?? null; },
        async write(p, c) { store.set(p, c); },
        async remove(p) { store.delete(p); },
        async rename(from, to) {
          const v = store.get(from);
          if (v === undefined) throw new Error('nope');
          store.delete(from);
          store.set(to, v);
        },
        async list(dir) {
          const prefix = dir.endsWith('/') ? dir : `${dir}/`;
          return Array.from(store.keys()).filter((k) => k.startsWith(prefix));
        },
      },
    });
    expect(a.backend).toBe('managed-agents');
    await a.create('tnt-001', 'playbooks/x.md', 'pinned');
    // Confirm key landed under /mnt/memory/<tenant>/...
    const keys = Array.from(store.keys());
    expect(keys.some((k) => k.startsWith('/mnt/memory/tnt-001/'))).toBe(true);
  });
});
