/**
 * Retry failed notifications
 */

import { Queue } from 'bullmq';
import type { NotificationJobData } from './producer.js';
import { getNotificationQueue } from './producer.js';
import { createLogger } from '../logger.js';

const logger = createLogger('notification-retry');

export interface RetryOptions {
  maxAttempts?: number;
  jobIds?: string[];
}

/**
 * Retry failed jobs in the notifications queue
 */
export async function retryFailedNotifications(
  options?: RetryOptions
): Promise<{ retried: number; failed: string[] }> {
  const queue = getNotificationQueue();
  const failed: string[] = [];
  let retried = 0;

  try {
    const failedJobs = await queue.getFailed();
    const maxAttempts = options?.maxAttempts ?? 3;

    for (const job of failedJobs) {
      const jobId = job.id;
      if (options?.jobIds && jobId && !options.jobIds.includes(jobId)) {
        continue;
      }

      if (job.attemptsMade >= maxAttempts) {
        logger.warn('Skipping job - max attempts reached', {
          jobId,
          attemptsMade: job.attemptsMade,
        });
        failed.push(jobId ?? '');
        continue;
      }

      try {
        await job.retry();
        retried++;
        logger.info('Retried failed job', { jobId });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('Failed to retry job', { jobId, error: msg });
        failed.push(jobId ?? '');
      }
    }

    return { retried, failed };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('Error retrying failed notifications', { error: msg });
    throw err;
  }
}

/**
 * Get failed job details for inspection
 */
export async function getFailedJobs(): Promise<
  Array<{
    id: string;
    data: NotificationJobData;
    attemptsMade: number;
    failedReason?: string;
    timestamp: number;
  }>
> {
  const queue = getNotificationQueue();
  const failedJobs = await queue.getFailed();

  return failedJobs.map((job) => ({
    id: job.id ?? '',
    data: job.data,
    attemptsMade: job.attemptsMade ?? 0,
    failedReason: job.failedReason,
    timestamp: job.timestamp ?? 0,
  }));
}
