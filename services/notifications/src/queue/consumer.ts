/**
 * Notification queue consumer - process jobs with BullMQ.
 *
 * Uses @bossnyumba/queue's createWorker so connection resolution and
 * lifecycle are shared with every other worker in the platform.
 */

import { createWorker, QueueNames, type Job, type Worker } from '@bossnyumba/queue';
import type { NotificationJobData } from './producer.js';
import { notificationProcessor } from '../services/notification.service.js';
import { createLogger } from '../logger.js';

const logger = createLogger('notification-consumer');

export interface ConsumerOptions {
  redisUrl?: string;
  queueName?: string;
  concurrency?: number;
}

let workerInstance: Worker<NotificationJobData> | null = null;

async function processNotificationJob(job: Job<NotificationJobData>): Promise<void> {
  const { recipient, channel, templateId, data, notificationId } = job.data;

  logger.info('Processing notification job', {
    jobId: job.id,
    notificationId,
    channel,
    templateId,
  });

  const result = await notificationProcessor.sendNotification(
    recipient,
    channel,
    templateId,
    data
  );

  if (!result.success) {
    logger.warn('Notification job failed', {
      jobId: job.id,
      error: result.error,
    });
    throw new Error(result.error ?? 'Notification send failed');
  }

  logger.info('Notification job completed', {
    jobId: job.id,
    notificationId: result.id,
  });
}

/**
 * Create and start the notification queue worker.
 */
export function createNotificationWorker(
  options?: ConsumerOptions
): Worker<NotificationJobData> {
  if (workerInstance) {
    return workerInstance;
  }

  workerInstance = createWorker<NotificationJobData>(
    options?.queueName ?? QueueNames.Notifications,
    async (job) => processNotificationJob(job),
    options?.redisUrl,
    { concurrency: options?.concurrency ?? 5 }
  );

  workerInstance.on('completed', (job) => {
    logger.debug('Job completed', { jobId: job.id });
  });

  workerInstance.on('failed', (job, err) => {
    logger.error('Job failed', {
      jobId: job?.id,
      error: err?.message,
      attemptsMade: job?.attemptsMade,
    });
  });

  workerInstance.on('error', (err) => {
    logger.error('Worker error', { error: err.message });
  });

  return workerInstance;
}

/**
 * Stop the notification queue consumer (graceful shutdown).
 */
export async function stopNotificationConsumer(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}
