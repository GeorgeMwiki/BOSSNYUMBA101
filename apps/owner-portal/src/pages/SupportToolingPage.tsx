import { useTranslations } from 'next-intl';
import { MissingBackendNotice } from '../components/MissingBackendNotice';

/**
 * SupportToolingPage — placeholder until the support tooling endpoints
 * land.
 *
 * Required gateway routes:
 *   GET  /api/v1/support/tickets
 *   POST /api/v1/support/tickets
 *   GET  /api/v1/support/macros
 */
export function SupportToolingPage() {
  const t = useTranslations('pages');
  return (
    <MissingBackendNotice
      title={t('supportToolingTitleLabel')}
      endpoint="GET /api/v1/support/tickets"
      description={t('supportToolingDescription')}
    />
  );
}
