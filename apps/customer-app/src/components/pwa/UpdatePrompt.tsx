'use client';

import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { registerServiceWorker, onServiceWorkerUpdate, skipWaiting } from '@/lib/pwa/register-sw';

export function UpdatePrompt() {
  const [show, setShow] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    let unsubscribe;

    registerServiceWorker().then((result) => {
      if (!result.success) return;

      setRegistration(result.registration);

      unsubscribe = onServiceWorkerUpdate(result.registration, () => {
        setShow(true);
      });
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const handleUpdate = () => {
    if (registration) {
      skipWaiting(registration);
      setShow(false);
    }
  };

  const handleDismiss = () => {
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      className="fixed bottom-20 left-4 right-4 z-50 rounded-xl border border-gray-200 bg-white p-4 shadow-lg  md:left-auto md:right-4 md:max-w-sm"
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-500/10">
          <RefreshCw className="h-5 w-5 text-primary" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-gray-900">Update available</h3>
          <p className="mt-0.5 text-sm text-gray-500">
            A new version is ready. Refresh to get the latest features.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleUpdate}
              className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500/90"
            >
              Refresh now
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-100"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
