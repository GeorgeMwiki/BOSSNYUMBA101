'use client';

import { Mail, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';
import { safeMailtoHref } from '@/lib/safe-contact-link';

const faqKeys = [
  { qKey: 'faq1Q', aKey: 'faq1A' },
  { qKey: 'faq2Q', aKey: 'faq2A' },
  { qKey: 'faq3Q', aKey: 'faq3A' },
] as const;

export default function HelpPage() {
  const t = useTranslations('helpPage');
  return (
    <>
      <PageHeader title={t('title')} showBack />

      <div className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
        <section>
          <h2 className="text-sm font-medium text-gray-500 mb-3">{t('faqs')}</h2>
          <div className="card divide-y divide-gray-100">
            {faqKeys.map((faq, idx) => (
              <div key={idx} className="p-4">
                <div className="font-medium">{t(faq.qKey)}</div>
                <div className="text-sm text-gray-500 mt-1">{t(faq.aKey)}</div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium text-gray-500 mb-3">{t('contact')}</h2>
          <div className="card divide-y divide-gray-100">
            {(() => {
              // M-6: percent-encode + validate the support email at
              // build time. If the env var is missing or malformed we
              // render nothing rather than a broken/poisoned link.
              const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
              const mailHref = safeMailtoHref(supportEmail);
              if (!supportEmail || !mailHref) return null;
              return (
                <a href={mailHref} className="p-4 flex items-center gap-3 hover:bg-gray-50">
                  <Mail className="w-5 h-5 text-primary-600" />
                  <div>
                    <div className="font-medium">{t('emailSupport')}</div>
                    <div className="text-sm text-gray-500">{supportEmail}</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </a>
              );
            })()}
          </div>
        </section>
      </div>
    </>
  );
}
