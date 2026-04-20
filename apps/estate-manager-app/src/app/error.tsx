'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errorPage');
  useEffect(() => {
    console.error('[App Error]', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white p-8">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="mb-2 text-xl font-semibold text-gray-900">{t('heading')}</h2>
        <p className="mb-6 text-sm text-gray-600">
          {t('desc')}
        </p>
        <button
          onClick={reset}
          className="rounded-lg bg-sky-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-sky-700"
        >
          {t('tryAgain')}
        </button>
      </div>
    </div>
  );
}
