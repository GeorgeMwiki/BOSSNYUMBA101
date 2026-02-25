export { I18nProvider, useI18n, useT, useLocale, useSetLocale, useDict } from './context';
export { LanguageSwitcher, T } from './components';
export { en } from './translations/en';
export { sw } from './translations/sw';
export {
  SUPPORTED_LOCALES,
  LOCALE_NAMES,
  DEFAULT_LOCALE,
} from './types';
export type {
  Locale,
  TranslationDictionary,
  TranslationKey,
} from './types';
