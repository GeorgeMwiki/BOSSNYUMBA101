import { useTranslations } from 'next-intl';
import { MissingBackendNotice } from '../components/MissingBackendNotice';

/**
 * AnalyticsExportsPage — placeholder until the export-templates and
 * recent-exports endpoints land.
 *
 * Required gateway routes:
 *   GET  /api/v1/analytics/exports/templates
 *   GET  /api/v1/analytics/exports/recent
 *   POST /api/v1/analytics/exports
 */
export default function AnalyticsExportsPage() {
  const t = useTranslations('analyticsExports');
  return (
    <MissingBackendNotice
      title={t('title')}
      endpoint="GET /api/v1/analytics/exports/templates"
      description={t('subtitle')}
    />
  );
}
