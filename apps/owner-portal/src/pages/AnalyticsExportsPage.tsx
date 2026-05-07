import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '../components/migrated/LiveDataRequiredPage';

/**
 * AnalyticsExportsPage — placeholder until the export-templates and
 * recent-exports endpoints land.
 *
 * The previous implementation rendered hand-built sample templates with
 * `Date.now()`-derived "last exported" timestamps that always looked
 * fresh. That was dishonest UI: nothing was actually exported. The
 * page now declares the gap explicitly so an operator can't mistake
 * the surface for working analytics tooling.
 */
export default function AnalyticsExportsPage() {
  const t = useTranslations('analyticsExports');
  return (
    <LiveDataRequiredPage
      title={t('title')}
      feature={t('subtitle')}
      description={t('subtitle')}
    />
  );
}
