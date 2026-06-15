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
 * PRODUCTION FAIL-FAST: when `NODE_ENV=production` and no durable
 * storage backend is configured, this THROWS a clear, actionable error
 * naming the missing env vars rather than silently falling through to
 * the no-adapter path (which drops every capture). A misconfigured prod
 * deploy crash-loops VISIBLY instead of losing workforce data silently.
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
 * Assemble the production app with a real `StorageAdapter` so workforce
 * captures persist.
 *
 * THROWS with an actionable message when production is required but no
 * durable storage backend is configured — refusing to boot a pod that
 * would silently drop every capture.
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
    // local stacks run; persistBytesIfNeeded no-ops (documented).
    logger.warn(
      '[field-capture-service] composition: no StorageAdapter configured — ' +
        'inline capture bytes will NOT be persisted. DEV ONLY.',
    );
    return buildApp({});
  }

  logger.info('[field-capture-service] composition: StorageAdapter wired', {
    mode: resolved.mode,
  });
  const deps: BuildAppDeps = { storageAdapter: resolved.adapter };
  return buildApp(deps);
}
