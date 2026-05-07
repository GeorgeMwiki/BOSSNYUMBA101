import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '../components/migrated/LiveDataRequiredPage';

/**
 * CommunicationsTemplatesPage — placeholder until the templates API
 * lands. The previous implementation rendered six hardcoded templates
 * (rent reminder, payment confirmation, welcome tenant…) with fixed
 * usage counts and 2024/2025 timestamps. That was sample data, not
 * live state. Reintroduce the searchable list once the gateway exposes
 * `GET /owner/messaging/templates`.
 */
export default function CommunicationsTemplatesPage() {
  const tr = useTranslations('templatesPage');
  return (
    <LiveDataRequiredPage
      title={tr('title')}
      feature={tr('subtitle')}
      description={tr('subtitle')}
    />
  );
}
