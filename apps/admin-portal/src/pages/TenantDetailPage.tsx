import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '../components/LiveDataRequiredPage';

export function TenantDetailPage() {
  const t = useTranslations('pages');
  return (
    <LiveDataRequiredPage
      title={t('tenantDetailTitle')}
      feature={t('tenantDetailFeature')}
      description={t('tenantDetailDescription')}
    />
  );
}
