/**
 * Cron scheduler for retention sweeps.
 *
 * Uses `node-cron` to schedule runSweep on the configured cron expression
 * (default: 02:15 UTC daily). A small mutex prevents overlapping runs if
 * a previous sweep is still in-flight when the next tick fires (e.g. after
 * a large backlog).
 */

import cron from 'node-cron';
import { loadConfig, type RetentionConfig } from './config.js';
import { runSweep, type SweepSummary } from './worker.js';
import { createLogger } from './logger.js';

const logger = createLogger('retention.cron');

export interface StartCronOptions {
  config?: RetentionConfig;
  /**
   * When true, run the sweep immediately on startup instead of waiting for
   * the first cron tick. Useful for short-running containers that may not
   * live long enough to see the scheduled time.
   */
  runOnStart?: boolean;
}

export interface CronHandle {
  task: cron.ScheduledTask;
  stop: () => void;
  /** Trigger a sweep manually, respecting the in-flight mutex. */
  triggerNow: () => Promise<SweepSummary | null>;
}

/**
 * Start the cron scheduler. Returns a handle for graceful shutdown.
 */
export function startRetentionCron(options: StartCronOptions = {}): CronHandle {
  const config = options.config ?? loadConfig();

  if (!cron.validate(config.cronSchedule)) {
    throw new Error(
      `Invalid RETENTION_CRON expression: "${config.cronSchedule}". ` +
        'Expected a standard 5-field cron expression.'
    );
  }

  let running = false;

  const runGuarded = async (): Promise<SweepSummary | null> => {
    if (running) {
      logger.warn('skip tick: previous retention sweep still in flight');
      return null;
    }
    running = true;
    try {
      return await runSweep(config);
    } catch (err) {
      logger.error('retention sweep threw unexpectedly', {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    } finally {
      running = false;
    }
  };

  logger.info('scheduling retention sweep', {
    cron: config.cronSchedule,
    timezone: config.cronTimezone,
    runOnStart: Boolean(options.runOnStart),
  });

  const task = cron.schedule(
    config.cronSchedule,
    () => {
      void runGuarded();
    },
    {
      scheduled: true,
      timezone: config.cronTimezone,
    }
  );

  if (options.runOnStart) {
    // Fire-and-forget: do not block startup on the first sweep.
    void runGuarded();
  }

  return {
    task,
    stop: () => {
      task.stop();
      logger.info('retention cron stopped');
    },
    triggerNow: runGuarded,
  };
}
