/**
 * field-capture-service composition root — the standalone-pod boot contract.
 *
 * Guards the R2 mode-c deployment-blocker fix: the prod pod previously called
 * the bare `buildApp({})` with NO StorageAdapter, so `persistBytesIfNeeded`
 * silently dropped every inline-bytes capture (a 200 black hole). The
 * composition root now wires a durable adapter or fails fast — a misconfigured
 * prod deploy crash-loops VISIBLY instead of losing workforce data silently.
 */
import { afterEach, describe, expect, it } from 'vitest';

import {
  buildProductionApp,
  resolveStorageAdapter,
  type BuildProductionAppOptions,
} from '../build-app.js';

/** A minimal StorageAdapter stub — buildApp only needs it wired, not exercised. */
const stubAdapter = {
  put: async () => ({ key: 'k', url: 'memory://k' }),
  get: async () => null,
  delete: async () => undefined,
} as unknown as NonNullable<BuildProductionAppOptions['storageAdapter']>;

describe('resolveStorageAdapter — backend selection (first match wins)', () => {
  it('returns mode "none" with a null adapter when nothing is configured', () => {
    const r = resolveStorageAdapter({ env: {} });
    expect(r.mode).toBe('none');
    expect(r.adapter).toBeNull();
  });

  it('selects a local-disk adapter when FIELD_CAPTURE_STORAGE_DIR is set', () => {
    const r = resolveStorageAdapter({ env: { localStorageDir: '/tmp/fc-test' } });
    expect(r.mode).toBe('local-disk');
    expect(r.adapter).not.toBeNull();
  });

  it('honours an injected adapter verbatim (test seam)', () => {
    const r = resolveStorageAdapter({ storageAdapter: stubAdapter });
    expect(r.mode).toBe('supabase');
    expect(r.adapter).toBe(stubAdapter);
  });
});

describe('buildProductionApp — fail-fast vs boot', () => {
  const apps: Array<{ close: () => Promise<void> }> = [];
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((a) => a.close()));
  });

  it('THROWS in production when no durable storage backend is configured', async () => {
    await expect(
      buildProductionApp({ isProduction: true, env: {} }),
    ).rejects.toThrow(/refusing to start in production without a StorageAdapter/i);
  });

  it('boots in production when a real adapter is injected', async () => {
    const app = await buildProductionApp({
      isProduction: true,
      storageAdapter: stubAdapter,
    });
    apps.push(app);
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
  });

  it('tolerates no backend in dev (warns, no-ops persistence) and still serves', async () => {
    const app = await buildProductionApp({ isProduction: false, env: {} });
    apps.push(app);
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
  });
});
