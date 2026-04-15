/**
 * Bulkhead - Concurrency isolation.
 *
 * Limits the number of concurrently executing operations for a given logical
 * resource, with an optional queue of waiting callers. Prevents a single slow
 * dependency from exhausting the process-wide event loop / thread pool.
 */

export interface BulkheadConfig {
  /** Maximum concurrent operations allowed. */
  readonly maxConcurrent: number;
  /** Maximum number of queued operations waiting for a slot. */
  readonly maxQueueSize: number;
  /** Optional timeout in ms a queued operation will wait before rejecting. */
  readonly queueTimeoutMs?: number;
}

/** Error thrown when the bulkhead queue is full or a queued call times out. */
export class BulkheadRejectedError extends Error {
  readonly code: 'QUEUE_FULL' | 'QUEUE_TIMEOUT';

  constructor(code: 'QUEUE_FULL' | 'QUEUE_TIMEOUT', message: string) {
    super(message);
    this.name = 'BulkheadRejectedError';
    this.code = code;
  }
}

interface Waiter {
  resolve: () => void;
  reject: (err: Error) => void;
  timer?: NodeJS.Timeout;
}

/**
 * Async bulkhead that gates entry to a critical section.
 */
export class Bulkhead {
  private active = 0;
  private readonly queue: Waiter[] = [];

  constructor(private readonly config: BulkheadConfig) {
    if (config.maxConcurrent <= 0) {
      throw new Error('Bulkhead.maxConcurrent must be > 0');
    }
    if (config.maxQueueSize < 0) {
      throw new Error('Bulkhead.maxQueueSize must be >= 0');
    }
  }

  /**
   * Execute `fn` under bulkhead control. Rejects with BulkheadRejectedError if
   * the queue is full.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /** Snapshot of the current bulkhead occupancy. */
  stats(): { active: number; queued: number; maxConcurrent: number } {
    return {
      active: this.active,
      queued: this.queue.length,
      maxConcurrent: this.config.maxConcurrent,
    };
  }

  private acquire(): Promise<void> {
    if (this.active < this.config.maxConcurrent) {
      this.active++;
      return Promise.resolve();
    }
    if (this.queue.length >= this.config.maxQueueSize) {
      return Promise.reject(
        new BulkheadRejectedError('QUEUE_FULL', 'Bulkhead queue is full')
      );
    }
    return new Promise<void>((resolve, reject) => {
      const waiter: Waiter = { resolve, reject };
      if (this.config.queueTimeoutMs !== undefined) {
        waiter.timer = setTimeout(() => {
          const idx = this.queue.indexOf(waiter);
          if (idx >= 0) {
            this.queue.splice(idx, 1);
            reject(
              new BulkheadRejectedError(
                'QUEUE_TIMEOUT',
                'Bulkhead queue wait timed out'
              )
            );
          }
        }, this.config.queueTimeoutMs);
      }
      this.queue.push(waiter);
    });
  }

  private release(): void {
    this.active = Math.max(0, this.active - 1);
    const next = this.queue.shift();
    if (next) {
      if (next.timer) clearTimeout(next.timer);
      this.active++;
      next.resolve();
    }
  }
}
