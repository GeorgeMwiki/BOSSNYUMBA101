import { getTranslations } from 'next-intl/server';
import { LiveDataRequiredPanel } from '@/components/LiveDataRequired';

export default async function ChatPage() {
  const t = await getTranslations('screenUnavailable');
  return (
    <div className="px-4 py-4">
      <LiveDataRequiredPanel
        title={t('chatTitle')}
        message={t('chatMessage')}
      />
    </div>
  );
}
