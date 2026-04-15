/**
 * Retention worker entrypoint.
 *
 * Registers all entity adapters (audit_events, chat_messages,
 * communication_logs, ai_interactions, deleted_user_pii), starts the cron
 * scheduler, and installs SIGINT/SIGTERM handlers for graceful shutdown.
 *
 * This file is both the library entry (for tests/imports) AND the
 * executable entry (when run via `node dist/index.js`). The executable
 * branch is gated on import.meta.url so importing it as a module does not
 * spawn a cron.
 */

import { loadConfig } from './config.js';
import { createDefaultAdapters, runSweep } from './worker.js';
import { startRetentionCron, type CronHandle } from './cron.js';
import { createLogger } from './logger.js';

// Re-exports for library consumers / tests.
export { loadConfig } from './config.js';
export { runSweep, createDefaultAdapters } from './worker.js';
export { startRetentionCron } from './cron.js';
export type { SweepSummary } from './worker.js';
export type { RetentionConfig } from './config.js';
export type { RetentionAdapter, AdapterResult, AdapterRunOptions } from './adapters/index.js';

const logger = createLogger('retention');

/**
 * Boot sequence:
 *   1. Load config (throws on invalid numeric envs).
 *   2. Register adapters - we log the roster up front so ops can confirm
 *      from the first log line that each entity is covered.
 *   3. Start cron. runOnStart=true so containers that come up mid-window
 *      still perform an initial sweep.
 *   4. Wire graceful shutdown.
 */
export async function bootstrap(): Promise<CronHandle> {
  const config = loadConfig();

  const adapters = createDefaultAdapters(config);
  logger.info('retention adapters registered', {
    adapters: adapters.map((a) => ({
      name: a.name,
      retentionDays: a.retentionDays,
    })),
    cron: config.cronSchedule,
    timezone: config.cronTimezone,
    dryRun: config.dryRun,
    batchLimit: config.batchLimit,
  });

  const handle = startRetentionCron({ config, runOnStart: true });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info('shutdown signal received', { signal });
    handle.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  return handle;
}

// When invoked directly (node dist/index.js), run bootstrap. Avoid doing
// this at import time so unit tests can import runSweep without starting
// a scheduler.
const isDirectRun =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] !== undefined &&
  // import.meta.url resolves to file://.../dist/index.js; the node CLI
  // argv[1] is the absolute path. Compare normalized URLs.
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isDirectRun) {
  bootstrap().catch((err) => {
    // Use console.error directly - logger may not flush before exit.
    // eslint-disable-next-line no-console
    console.error('retention-worker failed to start', err);
    process.exit(1);
  });
}

// Default export for one-shot CLI mode: `node -e "import('...').then(m => m.runOnce())"`.
export async function runOnce(): Promise<void> {
  const summary = await runSweep();
  if (!summary.ok) {
    process.exit(1);
  }
}
