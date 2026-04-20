import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '../../../components/LiveDataRequiredPage';

export default function FeatureFlagsPage() {
  const t = useTranslations('featureFlagsPage');
  return (
    <LiveDataRequiredPage
      title={t('title')}
      feature={t('feature')}
      description={t('description')}
    />
  );
}
