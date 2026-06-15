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

/**
 * A minimal durable-CaptureStore stub. Production has no env-resolved
 * durable store yet (a new migration + Drizzle schema + factory are
 * required — see build-app.ts DURABLE-STORE NOTE), so the prod fail-fast
 * is satisfied ONLY by injecting a store through the seam. buildApp just
 * needs it wired, not exercised, for the boot test.
 */
const stubStore = {
  add: () => undefined,
  listForSurveyor: () => [],
  getById: () => null,
  updateStatus: () => null,
} as unknown as NonNullable<BuildProductionAppOptions['store']>;

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

  it('THROWS in production when an adapter is wired but no durable CaptureStore is', async () => {
    // Bytes backend present, record store absent — the in-memory Map would
    // silently lose / desync capture records across replicas: 2. Must fail
    // fast rather than boot the black hole.
    await expect(
      buildProductionApp({ isProduction: true, storageAdapter: stubAdapter }),
    ).rejects.toThrow(/refusing to start in production without a durable CaptureStore/i);
  });

  it('boots in production when BOTH a real adapter and a durable store are injected', async () => {
    const app = await buildProductionApp({
      isProduction: true,
      storageAdapter: stubAdapter,
      store: stubStore,
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

  it('honours an injected durable store in dev (threaded into buildApp) and serves', async () => {
    const app = await buildProductionApp({
      isProduction: false,
      env: {},
      store: stubStore,
    });
    apps.push(app);
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
  });
});
