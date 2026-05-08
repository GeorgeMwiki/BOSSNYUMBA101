import { useTranslations } from 'next-intl';
import { MissingBackendNotice } from '../components/MissingBackendNotice';

/**
 * BillingPage — placeholder until the platform-billing endpoints land.
 * (Per-tenant invoices live under invoicesService; this page is for
 * the SaaS subscription / platform-fee surface.)
 *
 * Required gateway routes:
 *   GET /api/v1/billing/subscription
 *   GET /api/v1/billing/invoices
 *   GET /api/v1/billing/payment-methods
 */
export function BillingPage() {
  const t = useTranslations('pages');
  return (
    <MissingBackendNotice
      title={t('billingTitleLabel')}
      endpoint="GET /api/v1/billing/subscription"
      description={t('billingDescription')}
    />
  );
}
