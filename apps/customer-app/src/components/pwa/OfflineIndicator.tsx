'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { WifiOff } from 'lucide-react';

export function OfflineIndicator() {
  const t = useTranslations('offlineIndicator');
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-amber-500/95 px-4 py-2 text-sm font-medium text-amber-950"
      role="status"
      aria-live="polite"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
      <span>{t('message')}</span>
    </div>
  );
}
