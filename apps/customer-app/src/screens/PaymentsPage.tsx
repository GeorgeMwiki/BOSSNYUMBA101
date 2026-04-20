import { getTranslations } from 'next-intl/server';
import { LiveDataRequiredPanel } from '@/components/LiveDataRequired';

export default async function PaymentsPage() {
  const t = await getTranslations('screenUnavailable');
  return (
    <div className="px-4 py-4">
      <LiveDataRequiredPanel
        title={t('paymentsTitle')}
        message={t('paymentsMessage')}
      />
    </div>
  );
}
