import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  Calendar,
  Building2,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { Skeleton, Alert, AlertDescription, Button, EmptyState } from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';
import { formatCurrency, formatDate } from '../../../lib/api';
import { useVendorContracts } from '../../../lib/hooks';

export default function VendorContractsPage() {
  const t = useTranslations('vendorContractsPage');
  const { data: contracts = [], isLoading, error, refetch } = useVendorContracts();

  // No fixture fallback — show real data or an empty state.
  const displayContracts = contracts;

  const expiringSoon = displayContracts.filter((c) => c.status === 'EXPIRING_SOON' || c.status === 'EXPIRING');

  if (isLoading) {
    return (
      <div aria-busy="true" aria-live="polite" className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger">
        <AlertDescription>
          {error instanceof Error ? error.message : 'Failed to load vendor contracts'}
          <Button size="sm" onClick={() => refetch?.()} className="ml-2">{t('retry')}</Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/vendors"
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-500">{t('subtitle')}</p>
        </div>
      </div>

      {expiringSoon.length > 0 && (
        <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-yellow-800">{expiringSoon.length} {t('contractsExpiringSoon')}</p>
            <p className="text-sm text-yellow-700">{t('reviewAndRenew')}</p>
          </div>
        </div>
      )}

      {displayContracts.length === 0 ? (
        <EmptyState
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      ) : (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('thVendor')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('thProperty')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('thType')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('thPeriod')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('thValue')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('thStatus')}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {displayContracts.map((contract) => (
                <tr key={contract.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      to={`/vendors/${contract.vendorId}`}
                      className="flex items-center gap-2 font-medium text-gray-900 hover:text-blue-600"
                    >
                      <FileText className="h-4 w-4" />
                      {contract.vendorName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/properties/${contract.propertyId}`}
                      className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600"
                    >
                      <Building2 className="h-4 w-4" />
                      {contract.propertyName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{contract.type}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="h-4 w-4" />
                      {formatDate(contract.startDate)} - {formatDate(contract.endDate)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {formatCurrency(contract.value)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                        contract.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-700'
                          : contract.status === 'EXPIRING_SOON' || contract.status === 'EXPIRING'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {contract.status === 'ACTIVE' ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                      {contract.status.replace('_', ' ')}
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
