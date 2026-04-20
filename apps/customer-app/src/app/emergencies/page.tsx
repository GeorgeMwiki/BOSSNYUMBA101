'use client';

import Link from 'next/link';
import { Phone, AlertTriangle, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';
import { getEmergencyContacts } from '@/lib/constants';

export default function EmergenciesPage() {
  const t = useTranslations('emergenciesPage');
  const emergencyContacts = getEmergencyContacts();
  return (
    <>
      <PageHeader
        title={t('title')}
        action={
          <Link href="/emergencies/report" className="btn-primary text-sm">
            <Plus className="w-4 h-4 mr-1" />
            {t('reportCta')}
          </Link>
        }
      />

      <div className="px-4 py-4 space-y-6">
        <div className="card p-4 bg-danger-50 border-danger-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-danger-600 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-danger-900">
                {t('lifeThreateningTitle')}
              </h3>
              <p className="text-sm text-danger-700 mt-1">
                {t.rich('lifeThreateningBody', {
                  strong: (chunks) => <strong>{chunks}</strong>,
                })}
              </p>
            </div>
          </div>
        </div>

        <Link
          href="/emergencies/report"
          className="card p-4 flex items-center justify-between bg-primary-50 border-primary-100 hover:bg-primary-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-500 rounded-lg">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-medium">{t('reportEmergency')}</div>
              <div className="text-sm text-gray-600">
                {t('reportExamples')}
              </div>
            </div>
          </div>
        </Link>

        <section>
          <h3 className="text-sm font-medium text-gray-500 mb-3">
            {t('emergencyNumbers')}
          </h3>
          <div className="card divide-y divide-gray-100">
            {emergencyContacts.map((contact, index) => (
              <a
                key={index}
                href={`tel:${contact.phone.replace(/\s/g, '')}`}
                className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-50 rounded-lg">
                    <Phone className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <div className="font-medium">{contact.name}</div>
                    <div className="text-sm text-primary-600 font-medium">
                      {contact.phone}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {t('availableLabel')}: {contact.available}
                    </div>
                  </div>
                </div>
                <Phone className="w-5 h-5 text-primary-600 flex-shrink-0" />
              </a>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
