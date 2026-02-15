'use client';

const SW_URL = '/sw.js';
const SW_SCOPE = '/';

export type RegistrationResult =
  | { success: true; registration: ServiceWorkerRegistration }
  | { success: false; error: Error };

export async function registerServiceWorker(): Promise<RegistrationResult> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return { success: false, error: new Error('Service workers not supported') };
  }

  try {
    const registration = await navigator.serviceWorker.register(SW_URL, {
      scope: SW_SCOPE,
      updateViaCache: 'none',
    });

    return { success: true, registration };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

export function onServiceWorkerUpdate(
  registration: ServiceWorkerRegistration,
  callback: () => void
): () => void {
  const handler = () => {
    if (registration.waiting) {
      callback();
    }
  };

  registration.addEventListener('updatefound', () => {
    const newWorker = registration.installing;
    if (!newWorker) return;
    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        handler();
      }
    });
  });

  if (registration.waiting && navigator.serviceWorker.controller) {
    handler();
  }

  return () => registration.removeEventListener('updatefound', handler);
}

export function skipWaiting(registration: ServiceWorkerRegistration): void {
  if (registration.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
}
