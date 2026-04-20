import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '../components/LiveDataRequiredPage';

export function BillingPage() {
  const t = useTranslations('pages');
  return (
    <LiveDataRequiredPage
      title={t('billingTitleLabel')}
      feature={t('billingFeature')}
      description={t('billingDescription')}
    />
  );
}
