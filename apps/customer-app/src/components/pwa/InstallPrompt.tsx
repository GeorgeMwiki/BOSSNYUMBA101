'use client';

import { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';
import {
  isInstallable,
  isStandalone,
  onInstallPrompt,
  promptInstall,
  clearInstallPrompt,
} from '@/lib/pwa/install-prompt';

export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    const unsubscribe = onInstallPrompt(() => {
      setShow(true);
    });

    return unsubscribe;
  }, []);

  const handleInstall = async () => {
    const accepted = await promptInstall();
    if (accepted) {
      setShow(false);
    }
  };

  const handleDismiss = () => {
    setShow(false);
    setDismissed(true);
    clearInstallPrompt();
  };

  if (!show || dismissed || !isInstallable()) return null;

  return (
    <div
      className="fixed bottom-20 left-4 right-4 z-50 rounded-xl border border-gray-200 bg-white p-4 shadow-lg  md:left-auto md:right-4 md:max-w-sm"
      role="banner"
      aria-label="Install app"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-500/10">
          <Download className="h-5 w-5 text-primary" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-gray-900">Install BOSSNYUMBA</h3>
          <p className="mt-0.5 text-sm text-gray-500">
            Add to your home screen for quick access and offline use.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleInstall}
              className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500/90"
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-100"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          aria-label="Dismiss"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
