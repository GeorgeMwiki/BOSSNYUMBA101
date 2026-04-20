import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileCheck, Building2, Calendar } from 'lucide-react';
import { Skeleton, Alert, AlertDescription, Button, EmptyState } from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';
import { formatDate } from '../../../lib/api';
import { useLicenses } from '../../../lib/hooks';

export default function LicensesPage() {
  const t = useTranslations('licensesPage');
  const { data: licenses = [], isLoading, error, refetch } = useLicenses();

  // No fixture fallback — show real data or an empty state.
  const displayLicenses = licenses;

  if (isLoading) {
    return (
      <div aria-busy="true" aria-live="polite" className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger">
        <AlertDescription>
          {error instanceof Error ? error.message : t('failedToLoad')}
          <Button size="sm" onClick={() => refetch?.()} className="ml-2">{t('retry')}</Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/compliance" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-500">{t('subtitle')}</p>
        </div>
      </div>

      {displayLicenses.length === 0 ? (
        <EmptyState
          title={t('noLicenses')}
          description={t('noLicensesDesc')}
        />
      ) : (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colLicense')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colProperty')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colAuthority')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colValidity')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colStatus')}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {displayLicenses.map((license) => (
                <tr key={license.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <FileCheck className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{license.type}</p>
                        <p className="text-sm text-gray-500">{license.number}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/properties/${license.propertyId}`}
                      className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600"
                    >
                      <Building2 className="h-4 w-4" />
                      {license.propertyName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{license.issuingAuthority}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="h-4 w-4" />
                      {formatDate(license.issueDate)} - {formatDate(license.expiryDate)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        license.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                        license.status === 'EXPIRING_SOON' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {license.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button className="text-sm font-medium text-blue-600 hover:text-blue-700">
                      {t('view')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}
