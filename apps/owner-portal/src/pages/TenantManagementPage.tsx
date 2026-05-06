import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '../components/migrated/LiveDataRequiredPage';

export function TenantManagementPage() {
  const t = useTranslations('pages');
  return (
    <LiveDataRequiredPage
      title={t('tenantManagementTitle')}
      feature={t('tenantManagementFeature')}
      description={t('tenantManagementDescription')}
    />
  );
}
