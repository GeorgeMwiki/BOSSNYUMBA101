/**
 * BOSSNYUMBA Retention Worker — entry point
 *
 * Two operating modes:
 *
 *   1. `node dist/index.js` — daemon mode. Starts a node-cron schedule
 *      that fires once a day at 02:00 UTC (configurable via
 *      `RETENTION_CRON_SCHEDULE`).
 *
 *   2. `node dist/index.js --once [--dry-run]` — run a single sweep and
 *      exit. Useful for ops runbooks and first-of-month audits.
 *
 * The worker intentionally does NOT modify the main API process; it runs
 * as its own long-lived container.
 */

import { startRetentionSchedule, DEFAULT_CRON_SCHEDULE } from './cron.js';
import { createLogger } from './logger.js';
import { RegistryRetentionRepository } from './repository.js';
import { runRetentionSweep } from './worker.js';

export { runRetentionSweep } from './worker.js';
export { startRetentionSchedule, DEFAULT_CRON_SCHEDULE } from './cron.js';
export { RegistryRetentionRepository } from './repository.js';
export type {
  RetentionRepository,
  RetentionCandidate,
  RunRetentionSweepOptions,
  SweepResult,
  PolicyRunResult,
} from './types.js';
export type { EntityAdapter, AuditLogSink } from './repository.js';

interface CliFlags {
  readonly once: boolean;
  readonly dryRun: boolean;
}

function parseArgs(argv: readonly string[]): CliFlags {
  return {
    once: argv.includes('--once'),
    dryRun: argv.includes('--dry-run'),
  };
}

async function main(): Promise<void> {
  const logger = createLogger('retention-worker');
  const flags = parseArgs(process.argv.slice(2));

  // In production this registry is populated by service-specific adapters
  // (e.g. audit-log adapter, messages adapter, ledger adapter). Until
  // those land, the worker runs safely as a no-op against unknown
  // entity types — it will log a warning per type but never touch rows
  // it does not understand.
  const repository = new RegistryRetentionRepository({ logger });

  if (flags.once) {
    logger.info('running single retention sweep', { dryRun: flags.dryRun });
    const result = await runRetentionSweep(
      { repository, logger },
      { dryRun: flags.dryRun },
    );
    logger.info('single sweep complete', {
      sweepId: result.sweepId,
      totalDeleted: result.totalDeleted,
      totalExcludedByLegalHold: result.totalExcludedByLegalHold,
    });
    return;
  }

  const handle = startRetentionSchedule({ repository, logger });
  logger.info('retention worker daemon started', {
    defaultSchedule: DEFAULT_CRON_SCHEDULE,
  });

  const shutdown = (signal: string): void => {
    logger.info('received shutdown signal', { signal });
    handle.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Only run `main` when this module is executed directly (not when
// imported from tests or other services).
const isDirectRun =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('retention-worker/dist/index.js') === true;

if (isDirectRun) {
  main().catch((err: unknown) => {
    const logger = createLogger('retention-worker');
    const message = err instanceof Error ? err.message : String(err);
    logger.error('retention worker failed to start', { error: message });
    process.exit(1);
  });
}
