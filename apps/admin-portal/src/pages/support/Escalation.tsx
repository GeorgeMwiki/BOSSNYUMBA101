import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '../../components/LiveDataRequiredPage';

export default function Escalation() {
  const t = useTranslations('pages');
  return (
    <LiveDataRequiredPage
      title={t('escalationTitle')}
      feature={t('escalationFeature')}
      description={t('escalationDescription')}
    />
  );
}
