'use client';

const DB_NAME = 'bossnyumba-offline';
const DB_VERSION = 1;
const PENDING_PAYMENTS_STORE = 'pending_payments';
const CACHE_STORE = 'offline_cache';

let dbInstance: IDBDatabase | null = null;

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
