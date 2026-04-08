'use client';

const DB_NAME = 'bossnyumba-offline';
// v2 adds listings cache + mutation queue stores. Bump this when adding new
// object stores to ensure onupgradeneeded fires for existing clients.
const DB_VERSION = 2;
const PENDING_PAYMENTS_STORE = 'pending_payments';
const CACHE_STORE = 'offline_cache';
const LISTINGS_STORE = 'cached_listings';
const MUTATION_QUEUE_STORE = 'mutation_queue';

const MAX_CACHED_LISTINGS = 50;
const MUTATION_SYNC_TAG = 'mutation-queue-sync';

let dbInstance: IDBDatabase | null = null;

// Exposed for tests to reset the module-level singleton between cases.
export function __resetOfflineStorageForTests(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // ignore
    }
  }
  dbInstance = null;
}

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(PENDING_PAYMENTS_STORE)) {
        db.createObjectStore(PENDING_PAYMENTS_STORE, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(LISTINGS_STORE)) {
        const store = db.createObjectStore(LISTINGS_STORE, { keyPath: 'id' });
        store.createIndex('cachedAt', 'cachedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(MUTATION_QUEUE_STORE)) {
        db.createObjectStore(MUTATION_QUEUE_STORE, {
          keyPath: 'id',
          autoIncrement: true,
        });
      }
    };
  });
}

export interface PendingPayment {
  id?: number;
  amount: number;
  reference: string;
  method: string;
  payload: Record<string, unknown>;
  createdAt: number;
}

const PAYMENT_SYNC_TAG = 'payment-sync';

export async function addPendingPayment(payment: Omit<PendingPayment, 'id' | 'createdAt'>): Promise<number> {
  const db = await openDB();
  const id = await new Promise<number>((resolve, reject) => {
    const tx = db.transaction(PENDING_PAYMENTS_STORE, 'readwrite');
    const store = tx.objectStore(PENDING_PAYMENTS_STORE);
    const record: PendingPayment = {
      ...payment,
      createdAt: Date.now(),
    };
    const request = store.add(record);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });

  // Register for background sync when offline (SW will fire sync event when back online)
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration.sync) {
        await registration.sync.register(PAYMENT_SYNC_TAG);
      }
    } catch {
      // Sync not supported or registration failed - payments will sync on next online visit
    }
  }

  return id;
}

export async function getPendingPayments(): Promise<PendingPayment[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING_PAYMENTS_STORE, 'readonly');
    const store = tx.objectStore(PENDING_PAYMENTS_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(request.error);
  });
}

export async function removePendingPayment(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING_PAYMENTS_STORE, 'readwrite');
    const store = tx.objectStore(PENDING_PAYMENTS_STORE);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearPendingPayments(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING_PAYMENTS_STORE, 'readwrite');
    const store = tx.objectStore(PENDING_PAYMENTS_STORE);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function setOfflineCache<T>(key: string, value: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE, 'readwrite');
    const store = tx.objectStore(CACHE_STORE);
    const request = store.put({ key, value, updatedAt: Date.now() });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getOfflineCache<T>(key: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE, 'readonly');
    const store = tx.objectStore(CACHE_STORE);
    const request = store.get(key);
    request.onsuccess = () => {
      const row = request.result;
      resolve(row?.value ?? null);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function removeOfflineCache(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE, 'readwrite');
    const store = tx.objectStore(CACHE_STORE);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ----------------------------------------------------------------------------
// Cached listings (last N viewed by the user)
// ----------------------------------------------------------------------------

export interface CachedListing {
  id: string;
  data: Record<string, unknown>;
  cachedAt: number;
}

/**
 * Cache up to [MAX_CACHED_LISTINGS] listings in IndexedDB. Called whenever
 * the app successfully fetches listings while online. Older entries are
 * evicted (oldest-first) when the cap is exceeded.
 */
export async function cacheListings(
  listings: Array<{ id: string | number; [k: string]: unknown }>,
): Promise<void> {
  if (!listings.length) return;
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(LISTINGS_STORE, 'readwrite');
    const store = tx.objectStore(LISTINGS_STORE);
    for (const listing of listings) {
      const id = String(listing.id);
      const record: CachedListing = {
        id,
        data: listing as Record<string, unknown>,
        cachedAt: Date.now(),
      };
      store.put(record);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  await evictOldListings();
}

async function evictOldListings(): Promise<void> {
  const db = await openDB();
  const all = await new Promise<CachedListing[]>((resolve, reject) => {
    const tx = db.transaction(LISTINGS_STORE, 'readonly');
    const store = tx.objectStore(LISTINGS_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as CachedListing[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  if (all.length <= MAX_CACHED_LISTINGS) return;
  all.sort((a, b) => a.cachedAt - b.cachedAt);
  const toRemove = all.slice(0, all.length - MAX_CACHED_LISTINGS);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(LISTINGS_STORE, 'readwrite');
    const store = tx.objectStore(LISTINGS_STORE);
    for (const row of toRemove) {
      store.delete(row.id);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function getCachedListings(): Promise<CachedListing[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LISTINGS_STORE, 'readonly');
    const store = tx.objectStore(LISTINGS_STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      const rows = (req.result as CachedListing[]) ?? [];
      rows.sort((a, b) => b.cachedAt - a.cachedAt);
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function clearCachedListings(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LISTINGS_STORE, 'readwrite');
    const req = tx.objectStore(LISTINGS_STORE).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ----------------------------------------------------------------------------
// Mutation queue (POST/PUT/DELETE replay)
// ----------------------------------------------------------------------------

export type MutationMethod = 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface QueuedMutation {
  id?: number;
  url: string;
  method: MutationMethod;
  headers?: Record<string, string>;
  body?: unknown;
  createdAt: number;
  attempts: number;
  lastError?: string;
}

export interface EnqueueMutationInput {
  url: string;
  method: MutationMethod;
  headers?: Record<string, string>;
  body?: unknown;
}

/**
 * Queues a mutation for later replay. Called by the fetch wrapper whenever
 * `navigator.onLine === false` or when a live request fails with a network
 * error. Attempts to register a Background Sync tag so the service worker can
 * flush when connectivity returns; otherwise the app falls back to flushing
 * on the next successful `fetch` (see [flushMutationQueue]).
 */
export async function enqueueMutation(
  input: EnqueueMutationInput,
): Promise<number> {
  const db = await openDB();
  const id = await new Promise<number>((resolve, reject) => {
    const tx = db.transaction(MUTATION_QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(MUTATION_QUEUE_STORE);
    const record: QueuedMutation = {
      url: input.url,
      method: input.method,
      headers: input.headers,
      body: input.body,
      createdAt: Date.now(),
      attempts: 0,
    };
    const req = store.add(record);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });

  // Best-effort Background Sync registration. SW listens for this tag and
  // calls back into `flushMutationQueue()`.
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const registration = (await navigator.serviceWorker.ready) as
        | (ServiceWorkerRegistration & {
            sync?: { register: (tag: string) => Promise<void> };
          })
        | undefined;
      if (registration?.sync) {
        await registration.sync.register(MUTATION_SYNC_TAG);
      }
    } catch {
      // SW not available or Background Sync unsupported. Fallback path lives
      // in `flushMutationQueueOnNextOnline`.
    }
  }

  return id;
}

export async function getMutationQueue(): Promise<QueuedMutation[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MUTATION_QUEUE_STORE, 'readonly');
    const req = tx.objectStore(MUTATION_QUEUE_STORE).getAll();
    req.onsuccess = () => {
      const rows = (req.result as QueuedMutation[]) ?? [];
      rows.sort((a, b) => a.createdAt - b.createdAt);
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function removeQueuedMutation(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MUTATION_QUEUE_STORE, 'readwrite');
    const req = tx.objectStore(MUTATION_QUEUE_STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function updateQueuedMutation(record: QueuedMutation): Promise<void> {
  if (record.id == null) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MUTATION_QUEUE_STORE, 'readwrite');
    const req = tx.objectStore(MUTATION_QUEUE_STORE).put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export interface FlushResult {
  flushed: number;
  failed: number;
}

/**
 * Replays every queued mutation against the network in FIFO order. Successful
 * calls are deleted; failures leave the record in place with an updated
 * `attempts` + `lastError`. Callers can invoke this on `window.online`, on
 * SW `sync` events, or proactively before critical reads.
 */
export async function flushMutationQueue(
  fetchImpl: typeof fetch = fetch,
): Promise<FlushResult> {
  const queue = await getMutationQueue();
  let flushed = 0;
  let failed = 0;
  for (const mutation of queue) {
    try {
      const resp = await fetchImpl(mutation.url, {
        method: mutation.method,
        headers: {
          'Content-Type': 'application/json',
          ...(mutation.headers ?? {}),
        },
        body: mutation.body != null ? JSON.stringify(mutation.body) : undefined,
      });
      if (resp.ok) {
        if (mutation.id != null) await removeQueuedMutation(mutation.id);
        flushed++;
      } else {
        failed++;
        await updateQueuedMutation({
          ...mutation,
          attempts: mutation.attempts + 1,
          lastError: `HTTP ${resp.status}`,
        });
      }
    } catch (err) {
      failed++;
      await updateQueuedMutation({
        ...mutation,
        attempts: mutation.attempts + 1,
        lastError: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { flushed, failed };
}

export async function getMutationQueueLength(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MUTATION_QUEUE_STORE, 'readonly');
    const req = tx.objectStore(MUTATION_QUEUE_STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ----------------------------------------------------------------------------
// Network-aware fetch helper
// ----------------------------------------------------------------------------

/**
 * Wraps `fetch` so that mutations made while offline are enqueued instead of
 * failing hard. Reads still go through the network. Callers typically use
 * this via a higher-level API client.
 */
export async function offlineAwareFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const isMutation =
    method === 'POST' ||
    method === 'PUT' ||
    method === 'DELETE' ||
    method === 'PATCH';
  const isOffline =
    typeof navigator !== 'undefined' && navigator.onLine === false;

  if (isMutation && isOffline) {
    let body: unknown;
    if (typeof init?.body === 'string') {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    } else {
      body = init?.body;
    }
    const url = typeof input === 'string' ? input : input.toString();
    await enqueueMutation({
      url,
      method: method as MutationMethod,
      headers: (init?.headers as Record<string, string>) ?? undefined,
      body,
    });
    // Return a synthetic 202 Accepted so callers can distinguish "queued".
    return new Response(
      JSON.stringify({ queued: true, offline: true }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  return fetch(input, init);
}

/**
 * Fallback when Background Sync is unavailable: registers a one-shot online
 * listener that flushes the queue on the next `online` event. Safe to call
 * multiple times — subsequent calls are no-ops until the listener fires.
 */
let _onlineFlushListenerAttached = false;
export function flushMutationQueueOnNextOnline(): void {
  if (typeof window === 'undefined') return;
  if (_onlineFlushListenerAttached) return;
  _onlineFlushListenerAttached = true;
  const handler = () => {
    _onlineFlushListenerAttached = false;
    window.removeEventListener('online', handler);
    void flushMutationQueue();
  };
  window.addEventListener('online', handler);
}
