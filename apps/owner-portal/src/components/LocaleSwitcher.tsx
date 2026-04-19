import { useTranslations } from 'next-intl';
import { SUPPORTED_LOCALES, type Locale } from '../i18n';
import { useLocaleContext } from '../contexts/LocaleProvider';

type LocaleSwitcherProps = {
  className?: string;
};

export function LocaleSwitcher({ className }: LocaleSwitcherProps) {
  const { locale, setLocale } = useLocaleContext();
  const t = useTranslations('locale');

  return (
    <label className={className ?? 'inline-flex items-center gap-2 text-sm'}>
      <span className="sr-only">{t('label')}</span>
      <select
        aria-label={t('label')}
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
        className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
