import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '../../../components/LiveDataRequiredPage';

export default function CommunicationsBroadcastsPage() {
  const t = useTranslations('communicationsBroadcastsPage');
  return (
    <LiveDataRequiredPage
      title={t('title')}
      feature={t('feature')}
      description={t('description')}
    />
  );
}
