import { useTranslations } from 'next-intl';
import { MissingBackendNotice } from '../components/MissingBackendNotice';

/**
 * CommunicationsBroadcastsPage — placeholder until the broadcasts API
 * lands.
 *
 * Required gateway routes:
 *   GET  /api/v1/owner/messaging/broadcasts
 *   POST /api/v1/owner/messaging/broadcasts
 */
export default function CommunicationsBroadcastsPage() {
  const t = useTranslations('communicationsBroadcastsPage');
  return (
    <MissingBackendNotice
      title={t('title')}
      endpoint="GET /api/v1/owner/messaging/broadcasts"
      description={t('description')}
    />
  );
}
