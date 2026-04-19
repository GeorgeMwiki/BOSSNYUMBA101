'use client';

import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';

const SUPPORTED_LOCALES = ['en', 'sw'] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
const LOCALE_COOKIE = 'NEXT_LOCALE';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

type LocaleSwitcherProps = {
  className?: string;
};

export function LocaleSwitcher({ className }: LocaleSwitcherProps) {
  const active = useLocale();
  const t = useTranslations('locale');
  const [isPending, startTransition] = useTransition();

  function onChange(next: SupportedLocale) {
    if (next === active) return;
    const cookieValue = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
    document.cookie = cookieValue;
    startTransition(() => {
      window.location.reload();
    });
  }

  return (
    <label className={className ?? 'inline-flex items-center gap-2 text-sm'}>
      <span className="sr-only">{t('label')}</span>
      <select
        aria-label={t('label')}
        value={active}
        disabled={isPending}
        onChange={(event) => onChange(event.target.value as SupportedLocale)}
        className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
      >
        {SUPPORTED_LOCALES.map((code) => (
          <option key={code} value={code}>
            {t(code)}
          </option>
        ))}
      </select>
    </label>
  );
}

export default LocaleSwitcher;
