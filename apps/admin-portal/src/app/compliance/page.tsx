import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '../../components/LiveDataRequiredPage';

export default function CompliancePage() {
  const t = useTranslations('compliancePage');
  return (
    <LiveDataRequiredPage
      title={t('title')}
      feature={t('feature')}
      description={t('description')}
    />
  );
}
