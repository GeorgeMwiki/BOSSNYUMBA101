/**
 * Notification queue producer - add jobs to BullMQ queue.
 *
 * Uses the shared @bossnyumba/queue package for Redis connection handling
 * and default job options so the behaviour stays consistent with every
 * other BullMQ producer in the platform.
 */

import { createQueue, QueueNames, type Queue } from '@bossnyumba/queue';
import type { NotificationRecipient } from '../types/index.js';
import type { NotificationChannel, NotificationTemplateId } from '../types/index.js';

export interface NotificationJobData {
  recipient: NotificationRecipient;
  channel: NotificationChannel;
  templateId: NotificationTemplateId;
  data: Record<string, string>;
  notificationId?: string;
}

export interface QueueOptions {
  redisUrl?: string;
  queueName?: string;
}

let queueInstance: Queue<NotificationJobData> | null = null;

/**
 * Get or create the notification queue. Cached so repeated calls share a
 * single Redis connection.
 */
export function getNotificationQueue(options?: QueueOptions): Queue<NotificationJobData> {
  if (queueInstance) {
    return queueInstance;
  }

  queueInstance = createQueue<NotificationJobData>(
    options?.queueName ?? QueueNames.Notifications,
    options?.redisUrl
  );

  return queueInstance;
}

/**
 * Add a notification to the queue.
 */
export async function addToQueue(
  data: NotificationJobData,
  options?: { delay?: number; priority?: number }
): Promise<string> {
  const queue = getNotificationQueue();
  const job = await queue.add('send-notification', data, {
    delay: options?.delay,
    priority: options?.priority,
  });
  return job.id ?? '';
}

/**
 * Add bulk notifications to the queue.
 */
export async function addBulkToQueue(
  items: NotificationJobData[],
  options?: { delay?: number }
): Promise<string[]> {
  const queue = getNotificationQueue();
  const jobs = await queue.addBulk(
    items.map((data, index) => ({
      name: 'send-notification',
      data,
      opts: {
        delay: options?.delay,
        priority: index,
      },
    }))
  );
  return jobs.map((j) => j.id ?? '');
}
