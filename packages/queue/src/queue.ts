/**
 * BullMQ Queue and Worker factories.
 *
 * Most services only need one or two queues. Rather than re-implement
 * connection parsing, default job options, and graceful shutdown in every
 * service, they should call `createQueue` / `createWorker` from here.
 */

import { Queue, Worker, type Processor, type WorkerOptions, type QueueOptions } from 'bullmq';
import { resolveRedisConnection } from './connection.js';
import { DefaultJobOptions } from './jobs.js';

export interface CreateQueueOptions {
  /**
   * Redis URL override. Falls back to process.env.REDIS_URL, then to
   * localhost in non-production.
   */
  redisUrl?: string;
  /** Additional BullMQ queue options (default job options, prefix, etc.) */
  queueOptions?: Partial<QueueOptions>;
}

export interface CreateWorkerOptions {
  redisUrl?: string;
  /** Concurrent jobs per worker instance. Defaults to 5. */
  concurrency?: number;
  /** Additional BullMQ worker options. */
  workerOptions?: Partial<WorkerOptions>;
}

/**
 * Create a named BullMQ queue. Callers should cache the result - creating
 * many Queue instances for the same name leaks Redis connections.
 */
export function createQueue<TData = unknown, TResult = unknown, TName extends string = string>(
  name: string,
  redisUrl?: string,
  options?: CreateQueueOptions
): Queue<TData, TResult, TName> {
  const connection = resolveRedisConnection(redisUrl ?? options?.redisUrl);
  return new Queue<TData, TResult, TName>(name, {
    connection,
    defaultJobOptions: DefaultJobOptions,
    ...(options?.queueOptions ?? {}),
  });
}

/**
 * Create a BullMQ worker that consumes from the named queue. The processor
 * callback receives each job and must either resolve (success) or throw
 * (triggering BullMQ's retry/backoff).
 */
export function createWorker<TData = unknown, TResult = unknown, TName extends string = string>(
  name: string,
  processor: Processor<TData, TResult, TName>,
  redisUrl?: string,
  options?: CreateWorkerOptions
): Worker<TData, TResult, TName> {
  const connection = resolveRedisConnection(redisUrl ?? options?.redisUrl);
  const worker = new Worker<TData, TResult, TName>(name, processor, {
    connection,
    concurrency: options?.concurrency ?? 5,
    ...(options?.workerOptions ?? {}),
  });
  return worker;
}

/**
 * Gracefully shut down one or more queues/workers. Use in SIGTERM handlers.
 */
export async function closeAll(
  instances: Array<Queue | Worker | undefined | null>
): Promise<void> {
  await Promise.all(
    instances.filter((x): x is Queue | Worker => !!x).map((x) => x.close())
  );
}
