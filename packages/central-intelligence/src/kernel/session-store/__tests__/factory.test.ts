/**
 * createSessionStore — factory tests (Phase K-A).
 *
 * Verifies the env-driven adapter selection + the fail-closed
 * contract: an unset `SESSION_STORE` in production THROWS.
 */

import { describe, it, expect, vi } from 'vitest';
import { createSessionStore } from '../factory.js';

describe('createSessionStore factory', () => {
  it('SESSION_STORE=memory returns an in-memory store', async () => {
    const store = createSessionStore({
      kind: 'memory',
      nodeEnv: 'production',
    });
    await store.write({
      sessionId: 's1',
      tenantId: 't1',
      personaId: 'p1',
      capturedAt: '2026-05-19T00:00:00Z',
      payload: { k: 1 },
    });
    const back = await store.read('s1');
    expect(back?.sessionId).toBe('s1');
  });

  it('SESSION_STORE=redis with no client falls back to in-memory + warns', async () => {
    const warn = vi.fn();
    const store = createSessionStore({
      kind: 'redis',
      logger: { warn },
      nodeEnv: 'development',
    });
    expect(typeof store.read).toBe('function');
    // Two warns can fire (factory + adapter) — assert at least one.
    expect(warn).toHaveBeenCalled();
  });

  it('SESSION_STORE=postgres with no client falls back to in-memory + warns', async () => {
    const warn = vi.fn();
    const store = createSessionStore({
      kind: 'postgres',
      logger: { warn },
      nodeEnv: 'development',
    });
    expect(typeof store.read).toBe('function');
    expect(warn).toHaveBeenCalled();
  });

  it('unset SESSION_STORE in production throws (fail-closed)', () => {
    expect(() =>
      createSessionStore({
        env: { SESSION_STORE: undefined },
        nodeEnv: 'production',
      }),
    ).toThrow(/SESSION_STORE env is required in production/);
  });

  it('unset SESSION_STORE in development returns in-memory + warns', () => {
    const warn = vi.fn();
    const store = createSessionStore({
      env: { SESSION_STORE: undefined },
      nodeEnv: 'development',
      logger: { warn },
    });
    expect(typeof store.read).toBe('function');
    expect(warn).toHaveBeenCalled();
  });

  it('invalid SESSION_STORE value throws', () => {
    expect(() =>
      createSessionStore({
        env: { SESSION_STORE: 'wat' },
        nodeEnv: 'development',
      }),
    ).toThrow(/SESSION_STORE env must be one of/);
  });

  it('env-driven selection: SESSION_STORE=memory', () => {
    const store = createSessionStore({
      env: { SESSION_STORE: 'memory' },
      nodeEnv: 'production',
    });
    expect(typeof store.read).toBe('function');
  });

  it('override kind takes precedence over env', () => {
    const warn = vi.fn();
    const store = createSessionStore({
      kind: 'memory',
      env: { SESSION_STORE: 'redis' },
      nodeEnv: 'production',
      logger: { warn },
    });
    // memory adapter doesn't warn about missing redis client.
    expect(warn).not.toHaveBeenCalled();
    expect(typeof store.read).toBe('function');
  });
});
