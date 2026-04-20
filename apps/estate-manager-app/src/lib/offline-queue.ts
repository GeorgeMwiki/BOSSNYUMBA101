/**
 * Offline-first queue for station-master actions.
 *
 * When the device is offline we push jobs to localStorage; when online
 * again we replay them in submission order. Each job is idempotent by
 * `clientJobId` so a network retry never double-posts.
 *
 * Immutability: readQueue() returns a fresh array, writeQueue() replaces
 * the stored array — callers never mutate in place.
 *
 * Storage shape (JSON):
 *   [
 *     { clientJobId, createdAt, path, method, body }
 *   ]
 */

const STORAGE_KEY = 'bossnyumba:estate-manager:offline-queue';

export interface QueuedJob {
  readonly clientJobId: string;
  readonly createdAt: string;
  readonly path: string;
  readonly method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly body: unknown;
}

export interface EnqueueInput {
  readonly path: string;
  readonly method: QueuedJob['method'];
  readonly body: unknown;
}

function readQueue(): readonly QueuedJob[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as readonly QueuedJob[];
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('offline-queue: failed to parse stored queue', error);
    return [];
  }
}

function writeQueue(jobs: readonly QueuedJob[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
}

function makeClientJobId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Enqueue a job; returns the created clientJobId.
 */
export function enqueue(input: EnqueueInput): string {
  const job: QueuedJob = {
    clientJobId: makeClientJobId(),
    createdAt: new Date().toISOString(),
    path: input.path,
    method: input.method,
    body: input.body,
  };
  const current = readQueue();
  writeQueue([...current, job]);
  return job.clientJobId;
}

export function pendingCount(): number {
  return readQueue().length;
}

export function clearQueue(): void {
  writeQueue([]);
}

export interface DrainResult {
  readonly drained: number;
  readonly failed: readonly QueuedJob[];
}

/**
 * Replay queued jobs against the API. Stops on the first network error so
 * we preserve order; individual HTTP errors (4xx/5xx) are treated as
 * terminal for that job so they don't block the rest of the queue.
 */
export async function drain(params: {
  readonly apiBaseUrl: string;
  readonly authToken?: string;
}): Promise<DrainResult> {
  if (typeof window !== 'undefined' && !window.navigator.onLine) {
    return { drained: 0, failed: readQueue() };
  }
  const jobs = readQueue();
  if (jobs.length === 0) return { drained: 0, failed: [] };

  const remaining: QueuedJob[] = [];
  const failed: QueuedJob[] = [];
  let drained = 0;

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Client-Job-Id': job.clientJobId,
      };
      if (params.authToken) {
        headers.Authorization = `Bearer ${params.authToken}`;
      }
      const res = await fetch(
        `${params.apiBaseUrl.replace(/\/$/, '')}${job.path}`,
        {
          method: job.method,
          headers,
          body: JSON.stringify(job.body),
        },
      );
      if (res.ok) {
        drained++;
      } else {
        // Persistent server-side rejection — drop the job so we don't
        // block the queue forever.
        failed.push(job);
      }
    } catch (error) {
      // Network blip — leave this + everything after in the queue to try again.
      remaining.push(...jobs.slice(i));
      break;
    }
  }

  writeQueue(remaining);
  return { drained, failed };
}

/**
 * Convenience wrapper that wires up auto-drain on 'online' events.
 */
export function attachAutoDrain(params: {
  readonly apiBaseUrl: string;
  readonly getAuthToken: () => string | undefined;
}): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }
  const handler = () =>
    void drain({
      apiBaseUrl: params.apiBaseUrl,
      authToken: params.getAuthToken(),
    });
  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}
