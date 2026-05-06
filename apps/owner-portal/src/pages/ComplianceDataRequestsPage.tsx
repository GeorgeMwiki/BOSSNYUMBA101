import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '../components/migrated/LiveDataRequiredPage';

export default function ComplianceDataRequestsPage() {
  const t = useTranslations('complianceDataRequestsPage');
  return (
    <LiveDataRequiredPage
      title={t('title')}
      feature={t('feature')}
      description={t('description')}
    />
  );
}
