import React from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  FileCheck,
  AlertTriangle,
  CheckCircle,
  ClipboardList,
  ArrowRight,
} from 'lucide-react';
import { Skeleton, Alert, AlertDescription, Button } from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';
import { formatDate } from '../../lib/api';
import { useComplianceSummary } from '../../lib/hooks';

export default function CompliancePage() {
  const t = useTranslations('compliancePage');
  const { data: stats, isLoading, error, refetch } = useComplianceSummary();

  const displayStats = stats || {
    compliant: 12,
    expiringSoon: 3,
    overdue: 1,
    totalItems: 16,
  };

  const recentItems = [
    { type: 'license', name: t('sampleRentalLicense'), status: 'EXPIRING_SOON', date: '2024-03-15' },
    { type: 'insurance', name: t('samplePropertyInsurance'), status: 'COMPLIANT', date: '2024-12-31' },
    { type: 'inspection', name: t('sampleFireSafety'), status: 'DUE', date: '2024-02-28' },
  ];

  if (isLoading) {
    return (
      <div aria-busy="true" aria-live="polite" className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-500">{t('subtitle')}</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/compliance/licenses"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
          >
            <FileCheck className="h-4 w-4" />
            {t('licenses')}
          </Link>
          <Link
            to="/compliance/insurance"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
          >
            <Shield className="h-4 w-4" />
            {t('insurance')}
          </Link>
          <Link
            to="/compliance/inspections"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
          >
            <ClipboardList className="h-4 w-4" />
            {t('inspections')}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">{t('compliant')}</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">{displayStats.compliant}</p>
          <p className="text-sm text-gray-500">{t('itemsUpToDate')}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">{t('expiringSoon')}</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">{displayStats.expiringSoon}</p>
          <Link to="/compliance/licenses" className="text-sm text-blue-600 hover:text-blue-700 mt-1 flex items-center gap-1">
            {t('review')} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">{t('overdue')}</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">{displayStats.overdue}</p>
          <p className="text-sm text-gray-500">{t('requiresAttention')}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Shield className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">{t('totalItems')}</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">{displayStats.totalItems}</p>
          <p className="text-sm text-gray-500">{t('tracked')}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('requiresAttentionHeader')}</h3>
        <div className="space-y-4">
          {recentItems.map((item, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`p-2 rounded-lg ${
                    item.status === 'COMPLIANT' ? 'bg-green-100' :
                    item.status === 'EXPIRING_SOON' ? 'bg-yellow-100' : 'bg-red-100'
                  }`}
                >
                  <FileCheck
                    className={`h-5 w-5 ${
                      item.status === 'COMPLIANT' ? 'text-green-600' :
                      item.status === 'EXPIRING_SOON' ? 'text-yellow-600' : 'text-red-600'
                    }`}
                  />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="text-sm text-gray-500">
                    {item.status === 'COMPLIANT' ? t('validUntil') : item.status === 'EXPIRING_SOON' ? t('expires') : t('due')}{' '}
                    {formatDate(item.date)}
                  </p>
                </div>
              </div>
              <span
                className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  item.status === 'COMPLIANT' ? 'bg-green-100 text-green-700' :
                  item.status === 'EXPIRING_SOON' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                }`}
              >
                {item.status.replace('_', ' ')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
