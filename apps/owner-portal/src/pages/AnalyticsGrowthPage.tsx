import { useTranslations } from 'next-intl';
import { MissingBackendNotice } from '../components/MissingBackendNotice';

/**
 * AnalyticsGrowthPage — placeholder until the growth analytics
 * endpoint lands.
 *
 * Required gateway route:
 *   GET /api/v1/analytics/growth?range=30d
 */
export default function AnalyticsGrowthPage() {
  const t = useTranslations('analyticsGrowthPage');
  return (
    <MissingBackendNotice
      title={t('title')}
      endpoint="GET /api/v1/analytics/growth"
      description={t('description')}
    />
  );
}
