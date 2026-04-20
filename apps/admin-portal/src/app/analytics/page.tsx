import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '../../components/LiveDataRequiredPage';

export default function AnalyticsPage() {
  const t = useTranslations('analyticsPage');
  return (
    <LiveDataRequiredPage
      title={t('title')}
      feature={t('feature')}
      description={t('description')}
    />
  );
}
