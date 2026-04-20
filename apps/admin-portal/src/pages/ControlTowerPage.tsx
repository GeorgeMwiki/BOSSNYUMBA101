import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '../components/LiveDataRequiredPage';

export function ControlTowerPage() {
  const t = useTranslations('pages');
  return (
    <LiveDataRequiredPage
      title={t('controlTowerTitle')}
      feature={t('controlTowerFeature')}
      description={t('controlTowerDescription')}
    />
  );
}
