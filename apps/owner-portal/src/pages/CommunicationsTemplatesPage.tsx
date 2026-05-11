import { useTranslations } from 'next-intl';
import { MissingBackendNotice } from '../components/MissingBackendNotice';

/**
 * CommunicationsTemplatesPage — placeholder until the templates API
 * lands. The previous implementation rendered six hardcoded templates
 * (rent reminder, payment confirmation, welcome tenant…) with fixed
 * usage counts and 2024/2025 timestamps. That was sample data, not
 * live state. Reintroduce the searchable list once the gateway exposes
 * `GET /api/v1/owner/messaging/templates`.
 */
export default function CommunicationsTemplatesPage() {
  const tr = useTranslations('templatesPage');
  return (
    <MissingBackendNotice
      title={tr('title')}
      endpoint="GET /api/v1/owner/messaging/templates"
      description={tr('subtitle')}
    />
  );
}
