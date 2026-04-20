import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '../../../components/LiveDataRequiredPage';

export default function PlatformBillingPage() {
  const t = useTranslations('platformBillingPage');
  return (
    <LiveDataRequiredPage
      title={t('title')}
      feature={t('feature')}
      description={t('description')}
    />
  );
}
