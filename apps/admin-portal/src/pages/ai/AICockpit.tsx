import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '../../components/LiveDataRequiredPage';

export default function AICockpit() {
  const t = useTranslations('pages');
  return (
    <LiveDataRequiredPage
      title={t('aiCockpitTitle')}
      feature={t('aiCockpitFeature')}
      description={t('aiCockpitDescription')}
    />
  );
}
