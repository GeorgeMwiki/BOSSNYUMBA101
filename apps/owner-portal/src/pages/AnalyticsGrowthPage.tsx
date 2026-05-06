import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '../components/migrated/LiveDataRequiredPage';

export default function AnalyticsGrowthPage() {
  const t = useTranslations('analyticsGrowthPage');
  return (
    <LiveDataRequiredPage
      title={t('title')}
      feature={t('feature')}
      description={t('description')}
    />
  );
}
