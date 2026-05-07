import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '../components/migrated/LiveDataRequiredPage';

/**
 * CommunicationsCampaignsPage — placeholder until the campaigns API
 * lands. The previous implementation rendered five hardcoded campaign
 * objects (Q1 rent reminder, lease renewal promo, etc.) with fixed
 * sent / open-rate / click-rate numbers and 2025-01 dates. That is
 * dishonest sample data, not live state. Reintroduce the real
 * filterable list once the gateway exposes
 * `GET /owner/messaging/campaigns` (and the matching state-mutation
 * endpoints to start / pause / archive a campaign).
 */
export default function CommunicationsCampaignsPage() {
  const t = useTranslations('campaignsPage');
  return (
    <LiveDataRequiredPage
      title={t('title')}
      feature={t('subtitle')}
      description={t('subtitle')}
    />
  );
}
