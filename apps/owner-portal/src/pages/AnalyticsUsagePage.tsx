import { useTranslations } from 'next-intl';
import { MissingBackendNotice } from '../components/MissingBackendNotice';

/**
 * AnalyticsUsagePage — placeholder until the usage analytics endpoint
 * lands.
 *
 * Required gateway route:
 *   GET /api/v1/analytics/usage?range=30d
 */
export default function AnalyticsUsagePage() {
  const t = useTranslations('analyticsUsagePage');
  return (
    <MissingBackendNotice
      title={t('title')}
      endpoint="GET /api/v1/analytics/usage"
      description={t('description')}
    />
  );
}
