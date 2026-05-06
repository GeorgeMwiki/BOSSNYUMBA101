import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '../components/migrated/LiveDataRequiredPage';

export function SupportToolingPage() {
  const t = useTranslations('pages');
  return (
    <LiveDataRequiredPage
      title={t('supportToolingTitleLabel')}
      feature={t('supportToolingFeature')}
      description={t('supportToolingDescription')}
    />
  );
}
