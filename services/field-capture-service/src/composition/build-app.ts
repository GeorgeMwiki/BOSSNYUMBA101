/**
 * Composition root for the field-capture-service pod.
 *
 * This is the file the process entrypoint (`index.ts main()`) calls to
 * assemble a PRODUCTION-wired app. The standalone pod ships its OWN
 * deployment (`infra/k8s/field-capture-service`, replicas: 2) — it is
 * NOT mounted inside the api-gateway — so this composition root is the
 * only place a real `StorageAdapter` can be wired before boot.
 *
 * Why this exists (R2 mode-c finding):
 *
 *   `index.ts buildApp({})` builds the app with NO `storageAdapter`. In
 *   `routes/captures.ts`, `persistBytesIfNeeded` short-circuits and
 *   returns the payload UNCHANGED when no adapter is wired — so every
 *   inline-bytes workforce capture was accepted with a 200 but its bytes
 *   were silently dropped (never written to object storage). A
 *   production deploy was a black hole for field captures.
 *
 *   This module closes the gap: it resolves a real `StorageAdapter` from
 *   the environment (Supabase Storage — the platform-standard backend,
 *   same one the api-gateway document pipeline uses) and passes it to
 *   `buildApp({ storageAdapter })` so captured bytes actually persist.
 *
 * PRODUCTION FAIL-FAST (two black holes, both closed here):
 *
 *   (a) StorageAdapter — the raw capture BYTES. When `NODE_ENV=production`
 *       and no durable storage backend is configured, this THROWS a clear,
 *       actionable error naming the missing env vars rather than silently
 *       falling through to the no-adapter path (which drops every byte).
 *
 *   (b) CaptureStore — the capture RECORDS (the queue, status, the
 *       `GET /v1/field/queue/:surveyorId` listing). `index.ts buildApp()`
 *       defaults to `createInMemoryCaptureStore()` — a `Map` in process
 *       memory. The prod pod runs `replicas: 2`, so an in-memory store is
 *       BOTH non-durable (records vanish on restart / rollout) AND
 *       per-replica (a capture POSTed to pod A is invisible to pod B's
 *       queue read — load-balanced reads silently miss records). That is a
 *       second silent black hole on top of (a). A genuinely durable
 *       `CaptureStore` for the geo-intelligence `FieldCapture` shape does
 *       not exist yet (see DURABLE-STORE NOTE below), so until it lands
 *       this composition root FAILS FAST in production rather than booting
 *       a pod that quietly loses capture records — same crash-loop-visibly
 *       discipline as (a). A test/dev caller may inject a durable
 *       `store` via `BuildProductionAppOptions.store` to satisfy the gate.
 *
 * DURABLE-STORE NOTE (surfaced, not silently papered over): the only
 * `CaptureStore` implementation today is `createInMemoryCaptureStore()` in
 * `@bossnyumba/geo-intelligence`. The existing `field_captures` table
 * (migration 0326) is a DIFFERENT entity — the staff-mobile manager-sync
 * sink (`capture_type` ∈ attendance/task_ack/incident/shift_report) — and
 * cannot hold the geo-intelligence capture shape (`kind` ∈
 * photo/video/audio/inspection/polygon/sensor/drone/pano, plus
 * `surveyorUserId`, `c2paSignature`, `capturedLocation`, `exifMetadata`,
 * `aiInferences`, `storageUri`, `status` ∈ queued/processed/rejected). A
 * durable store therefore requires a NEW migration + a new Drizzle schema
 * in `@bossnyumba/database` + a `createDrizzleCaptureStore` factory in
 * `@bossnyumba/geo-intelligence` — cross-package work outside this
 * composition root. Until that lands, this file closes the SILENT half of
 * the bug (a prod pod no longer boots on an in-memory record store) and a
 * caller may inject a durable `store` through the seam below.
 *
 * Backend selection (first match wins):
 *   1. Supabase Storage — `NEXT_PUBLIC_SUPABASE_URL` +
 *      `SUPABASE_SERVICE_ROLE_KEY` present.
 *   2. Local-disk        — `FIELD_CAPTURE_STORAGE_DIR` set (dev / single
 *      -node; honest durable backend, not in-memory).
 *   3. Otherwise         — null. Dev tolerates it (warn); production
 *      throws.
 *
 * TOPOLOGY NOTE (surfaced, not silently guessed): the prod ExternalSecret
 * (`infra/k8s/field-capture-service/base/externalsecret.yaml`) projects
 * `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_BUCKET`, implying an
 * S3/R2 backend. `@bossnyumba/storage-adapter` ships Supabase, local-disk,
 * and in-memory adapters but NO S3-shaped `StorageAdapter` today (the only
 * S3 impl, `services/domain-services/.../s3-storage.provider.ts`,
 * implements the legacy `StorageProvider` interface — a different shape).
 * So this wiring targets the Supabase adapter and the prod env must
 * provide the Supabase keys. Until an S3 `StorageAdapter` exists, the
 * fail-fast guard ensures the pod refuses to boot (rather than dropping
 * captures) when only the S3 keys are set — making the gap LOUD.
 */

import {
  createSupabaseStorageAdapter,
  createLocalDiskStorageAdapter,
  type StorageAdapter,
} from '@bossnyumba/storage-adapter';
import { createSupabaseAdminClient } from '@bossnyumba/supabase-client';
import type { CaptureStore } from '@bossnyumba/geo-intelligence';
import { buildApp, type BuildAppDeps } from '../index.js';
import type { FastifyInstance } from 'fastify';
import { logger } from '../logger.js';

export type StorageMode = 'supabase' | 'local-disk' | 'none';

export interface BuildProductionAppOptions {
  /**
   * Inject a pre-built StorageAdapter (tests). Production resolves one
   * from the environment.
   */
  readonly storageAdapter?: StorageAdapter;
  /**
   * Inject a DURABLE `CaptureStore` for the capture RECORDS (queue /
   * status / listing). When provided, it satisfies the production
   * fail-fast gate and is threaded into `buildApp({ store })` so reads and
   * writes hit the durable backend instead of the per-replica in-memory
   * `Map`. Production has no env-resolved durable store yet (see the
   * DURABLE-STORE NOTE in the module header), so omitting this in
   * production THROWS rather than silently booting an in-memory store
   * across `replicas: 2`. Tests inject a durable-enough stub here.
   */
  readonly store?: CaptureStore;
  /**
   * Override the production gate (tests). When omitted it is derived
   * from `NODE_ENV === 'production'`.
   */
  readonly isProduction?: boolean;
  /** Override env reads (tests). */
  readonly env?: {
    readonly supabaseUrl?: string;
    readonly supabaseServiceRoleKey?: string;
    readonly supabaseEnvironment?: string;
    readonly localStorageDir?: string;
  };
}

interface ResolvedStorage {
  readonly adapter: StorageAdapter | null;
  readonly mode: StorageMode;
}

/**
 * Resolve a durable `StorageAdapter` from the environment. Returns
 * `{ adapter: null, mode: 'none' }` when nothing is configured — the
 * caller decides whether that is fatal.
 */
export function resolveStorageAdapter(
  options: BuildProductionAppOptions = {},
): ResolvedStorage {
  if (options.storageAdapter) {
    return { adapter: options.storageAdapter, mode: 'supabase' };
  }

  const env = options.env ?? {};
  const supabaseUrl =
    env.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseServiceRoleKey =
    env.supabaseServiceRoleKey ??
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const environment =
    env.supabaseEnvironment ??
    process.env.SUPABASE_ENVIRONMENT?.trim() ??
    process.env.NODE_ENV?.trim() ??
    'development';
  const localDir =
    env.localStorageDir ?? process.env.FIELD_CAPTURE_STORAGE_DIR?.trim();

  // 1. Supabase Storage — platform-standard production backend.
  if (supabaseUrl && supabaseServiceRoleKey) {
    const supabase = createSupabaseAdminClient({
      url: supabaseUrl,
      serviceRoleKey: supabaseServiceRoleKey,
    });
    const adapter = createSupabaseStorageAdapter({ supabase, environment });
    return { adapter, mode: 'supabase' };
  }

  // 2. Local-disk — honest durable backend for dev / single-node.
  if (localDir) {
    const adapter = createLocalDiskStorageAdapter({ rootDir: localDir });
    return { adapter, mode: 'local-disk' };
  }

  // 3. Nothing configured.
  return { adapter: null, mode: 'none' };
}

/**
 * Assemble the production app with a real `StorageAdapter` (capture bytes)
 * AND a durable `CaptureStore` (capture records) so workforce captures
 * persist across restarts and are visible across `replicas: 2`.
 *
 * THROWS with an actionable message when production is required but either
 * the durable storage backend OR a durable record store is missing —
 * refusing to boot a pod that would silently drop captures (bytes) or lose
 * / desync capture records (the per-replica in-memory `Map`).
 */
export async function buildProductionApp(
  options: BuildProductionAppOptions = {},
): Promise<FastifyInstance> {
  const isProd = options.isProduction ?? process.env.NODE_ENV === 'production';

  let resolved: ResolvedStorage;
  try {
    resolved = resolveStorageAdapter(options);
  } catch (err) {
    // A backend was configured but its client failed to construct
    // (e.g. malformed Supabase URL). That is fatal in production — never
    // degrade to the no-adapter silent-drop path.
    throw new Error(
      'field-capture-service: storage backend is configured but failed to ' +
        `initialise — ${err instanceof Error ? err.message : String(err)}. ` +
        'Fix NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (or ' +
        'FIELD_CAPTURE_STORAGE_DIR) so captures can persist.',
    );
  }

  if (!resolved.adapter) {
    if (isProd) {
      throw new Error(
        'field-capture-service: refusing to start in production without a ' +
          'StorageAdapter — captured bytes would be silently dropped. ' +
          'Set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY for ' +
          'Supabase Storage (or FIELD_CAPTURE_STORAGE_DIR for a local-disk ' +
          'backend). NOTE: the prod ExternalSecret currently projects S3_* ' +
          'keys, but no S3 StorageAdapter exists yet — provide the Supabase ' +
          'keys or add an S3 adapter.',
      );
    }
    // Dev/test only — no durable backend. Boot without an adapter so
    // local stacks run; persistBytesIfNeeded no-ops (documented). A
    // caller-supplied durable `store` is still honoured if present.
    logger.warn(
      '[field-capture-service] composition: no StorageAdapter configured — ' +
        'inline capture bytes will NOT be persisted. DEV ONLY.',
    );
    return buildApp({
      ...(options.store ? { store: options.store } : {}),
    });
  }

  // (b) Capture RECORDS — fail fast in production on the in-memory store.
  // Checked AFTER the StorageAdapter gate so a prod deploy missing BOTH
  // surfaces the bytes-backend error first (the more common misconfig),
  // then this one once an adapter is supplied. No env-resolved durable
  // `CaptureStore` exists yet (see the DURABLE-STORE NOTE in the module
  // header), so the ONLY durable store a prod pod can run with is one
  // injected through this seam. Without it, `buildApp` would default to
  // `createInMemoryCaptureStore()` — a per-replica `Map` that loses
  // records on restart and hides pod A's captures from pod B's queue
  // reads. Refuse to boot rather than serve that silent black hole.
  if (isProd && !options.store) {
    throw new Error(
      'field-capture-service: refusing to start in production without a ' +
        'durable CaptureStore — capture RECORDS would live in a per-replica ' +
        'in-memory Map (lost on restart, invisible across replicas: 2). No ' +
        'env-resolved durable CaptureStore exists yet for the geo-intelligence ' +
        'FieldCapture shape: it needs a new migration + Drizzle schema in ' +
        '@bossnyumba/database and a createDrizzleCaptureStore factory in ' +
        '@bossnyumba/geo-intelligence. Until that lands, inject a durable ' +
        'store via buildProductionApp({ store }). See composition/build-app.ts.',
    );
  }

  logger.info('[field-capture-service] composition: StorageAdapter wired', {
    mode: resolved.mode,
    captureStore: options.store ? 'durable (injected)' : 'in-memory (dev)',
  });
  const deps: BuildAppDeps = {
    storageAdapter: resolved.adapter,
    ...(options.store ? { store: options.store } : {}),
  };
  return buildApp(deps);
}
