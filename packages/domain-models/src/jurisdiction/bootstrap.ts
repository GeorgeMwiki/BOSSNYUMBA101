/**
 * Jurisdiction Bootstrap
 *
 * Service-boot entrypoint for the jurisdiction registry.
 *
 * Call `bootstrapJurisdictions()` exactly once at service startup
 * (before any route handler runs). It:
 *
 *   1. Registers hardcoded seeds (TZ / KE / NG / ZA) synchronously
 *      so the registry is never empty.
 *   2. If a `dbLoader` is provided, asynchronously pulls rows from
 *      the `jurisdiction_configs` table and upserts them into the
 *      registry (DB rows override seeds — seeds are the fallback).
 *   3. Schedules a periodic refresh (default 5 minutes) so admin
 *      changes in the `jurisdiction_configs` table propagate without
 *      a redeploy.
 *
 * Services should import and call this from their top-level boot
 * sequence. The domain-models package stays DB-agnostic — services
 * pass their own async loader that runs the query.
 */

import { loadSeedJurisdictions } from './seeds.js';
import { registerJurisdiction, type JurisdictionConfig } from './jurisdiction.js';

/**
 * Signature for a DB loader. Services implement this against their
 * drizzle instance and pass it to `bootstrapJurisdictions`.
 */
export type JurisdictionDbLoader = () => Promise<JurisdictionConfig[]>;

export interface BootstrapJurisdictionsOptions {
  /** Async loader that returns JurisdictionConfig rows from the DB. */
  dbLoader?: JurisdictionDbLoader;
  /** Refresh interval in ms. Default 5 minutes. Pass 0 to disable. */
  refreshIntervalMs?: number;
  /** Logger (pino-compatible). Falls back to console. */
  logger?: {
    info?: (obj: unknown, msg?: string) => void;
    warn?: (obj: unknown, msg?: string) => void;
    error?: (obj: unknown, msg?: string) => void;
  };
}

let bootstrapped = false;
let refreshTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Boot the jurisdiction registry. Idempotent — safe to call more than
 * once (subsequent calls are no-ops).
 */
export async function bootstrapJurisdictions(
  options: BootstrapJurisdictionsOptions = {}
): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;

  const logger = options.logger ?? {
    info: (o: unknown, m?: string) => console.log('[jurisdiction]', m ?? '', o),
    warn: (o: unknown, m?: string) => console.warn('[jurisdiction]', m ?? '', o),
    error: (o: unknown, m?: string) => console.error('[jurisdiction]', m ?? '', o),
  };

  // 1. Seed synchronously — registry is never empty.
  loadSeedJurisdictions();
  logger.info?.({ phase: 'seeds' }, 'jurisdiction seeds loaded (TZ, KE, NG, ZA)');

  // 2. Hydrate from DB asynchronously if a loader is provided.
  if (options.dbLoader) {
    try {
      const rows = await options.dbLoader();
      for (const row of rows) {
        registerJurisdiction(row);
      }
      logger.info?.(
        { phase: 'db-hydrate', count: rows.length },
        `jurisdiction registry hydrated from DB (${rows.length} rows)`
      );
    } catch (err) {
      logger.error?.(
        { phase: 'db-hydrate', err: err instanceof Error ? err.message : String(err) },
        'jurisdiction DB hydration failed — falling back to seeds only'
      );
    }

    // 3. Schedule periodic refresh.
    const interval = options.refreshIntervalMs ?? 5 * 60 * 1000;
    if (interval > 0) {
      refreshTimer = setInterval(() => {
        void refreshFromDb(options.dbLoader!, logger);
      }, interval);
      // Don't block process exit on this timer.
      (refreshTimer as { unref?: () => void }).unref?.();
    }
  }
}

async function refreshFromDb(
  loader: JurisdictionDbLoader,
  logger: NonNullable<BootstrapJurisdictionsOptions['logger']>
): Promise<void> {
  try {
    const rows = await loader();
    for (const row of rows) {
      registerJurisdiction(row);
    }
    logger.info?.(
      { phase: 'db-refresh', count: rows.length },
      `jurisdiction registry refreshed from DB (${rows.length} rows)`
    );
  } catch (err) {
    logger.warn?.(
      { phase: 'db-refresh', err: err instanceof Error ? err.message : String(err) },
      'jurisdiction DB refresh failed — keeping existing registry'
    );
  }
}

/**
 * Stop the refresh timer (for tests / graceful shutdown).
 */
export function stopJurisdictionRefresh(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  bootstrapped = false;
}
