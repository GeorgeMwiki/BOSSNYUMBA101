import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '../components/LiveDataRequiredPage';

export function TenantsPage() {
  const t = useTranslations('pages');
  return (
    <LiveDataRequiredPage
      title={t('tenantsTitle')}
      feature={t('tenantsFeature')}
      description={t('tenantsDescription')}
    />
  );
}
