import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function NotFound() {
  const t = await getTranslations('notFound');
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 p-8 text-white">
      <div className="mx-auto max-w-md text-center">
        <p className="mb-2 text-6xl font-bold text-primary-400">404</p>
        <h2 className="mb-2 text-xl font-semibold">{t('title')}</h2>
        <p className="mb-8 text-sm text-gray-400">
          {t('body')}
        </p>
        <Link
          href="/"
          className="rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          {t('goHome')}
        </Link>
      </div>
    </div>
  );
}
