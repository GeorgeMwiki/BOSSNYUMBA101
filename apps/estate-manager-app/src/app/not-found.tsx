import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function NotFound() {
  const t = useTranslations('notFoundPage');
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white p-8">
      <div className="mx-auto max-w-md text-center">
        <p className="mb-2 text-6xl font-bold text-sky-500">404</p>
        <h2 className="mb-2 text-xl font-semibold text-gray-900">{t('heading')}</h2>
        <p className="mb-8 text-sm text-gray-500">
          {t('desc')}
        </p>
        <Link
          href="/"
          className="rounded-lg bg-sky-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-sky-700"
        >
          {t('goHome')}
        </Link>
      </div>
    </div>
  );
}
