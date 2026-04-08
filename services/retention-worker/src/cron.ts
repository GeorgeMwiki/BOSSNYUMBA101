/**
 * Cron Scheduler
 *
 * Wires up `node-cron` to trigger a nightly retention sweep. The schedule
 * defaults to 02:00 UTC (a quiet slot after EOD batches and before early
 * user traffic) and is overridable via the `RETENTION_CRON_SCHEDULE`
 * environment variable so ops can shift it without a redeploy.
 */

import cron, { type ScheduledTask } from 'node-cron';

import { createLogger, type Logger } from './logger.js';
import type { RetentionRepository, RunRetentionSweepOptions } from './types.js';
import { runRetentionSweep } from './worker.js';

/**
 * Default cron expression: 02:00 UTC every day.
 * Format: `m h dom mon dow`
 */
export const DEFAULT_CRON_SCHEDULE = '0 2 * * *';

export interface StartScheduleOptions {
  readonly repository: RetentionRepository;
  readonly schedule?: string;
  readonly timezone?: string;
  readonly logger?: Logger;
  readonly sweepOptions?: RunRetentionSweepOptions;
}

export interface ScheduleHandle {
  readonly task: ScheduledTask;
  stop: () => void;
}

/**
 * Schedule the nightly retention sweep.
 *
 * Returns a handle the caller can use to stop the task (useful for
 * graceful shutdown on SIGTERM).
 */
export function startRetentionSchedule(
  options: StartScheduleOptions,
): ScheduleHandle {
  const logger = options.logger ?? createLogger('retention-cron');
  const schedule =
    options.schedule ??
    process.env['RETENTION_CRON_SCHEDULE'] ??
    DEFAULT_CRON_SCHEDULE;
  const timezone = options.timezone ?? process.env['RETENTION_CRON_TZ'] ?? 'UTC';

  if (!cron.validate(schedule)) {
    throw new Error(
      `Invalid RETENTION_CRON_SCHEDULE: "${schedule}". Expected a valid cron expression.`,
    );
  }

  logger.info('scheduling retention sweep', { schedule, timezone });

  const task = cron.schedule(
    schedule,
    async () => {
      logger.info('cron tick - launching retention sweep');
      try {
        await runRetentionSweep(
          { repository: options.repository, logger },
          options.sweepOptions ?? {},
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('retention sweep crashed', { error: message });
      }
    },
    { timezone },
  );

  // node-cron v3 schedules started tasks by default; make this explicit
  // so the behaviour is obvious to readers.
  task.start();

  return {
    task,
    stop: () => {
      logger.info('stopping retention schedule');
      task.stop();
    },
  };
}
