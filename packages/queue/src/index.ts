/**
 * @bossnyumba/queue
 *
 * Shared BullMQ infrastructure for BOSSNYUMBA services. Exports factories
 * for creating queues and workers, canonical queue names, Redis connection
 * helpers, and strongly-typed shared job payloads.
 */

export { createQueue, createWorker, closeAll } from './queue.js';
export type { CreateQueueOptions, CreateWorkerOptions } from './queue.js';

export { resolveRedisConnection } from './connection.js';
export type { RedisConnection } from './connection.js';

export {
  QueueNames,
  DefaultJobOptions,
} from './jobs.js';
export type {
  QueueName,
  SendNotificationJob,
  RetryEtimsSubmissionJob,
  GeneratePdfJob,
  KnownJobPayload,
} from './jobs.js';

// Re-export commonly used BullMQ types so consumers don't need to depend on
// bullmq directly for simple processor signatures.
export type { Queue, Worker, Job, Processor, JobsOptions } from 'bullmq';
