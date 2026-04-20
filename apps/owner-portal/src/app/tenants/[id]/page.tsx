import React from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  Building2,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  FileText,
  MessageSquare,
} from 'lucide-react';
import { Skeleton, EmptyState, Alert, AlertDescription, Button } from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';
import { formatCurrency, formatDate } from '../../../lib/api';
import { useTenant } from '../../../lib/hooks';

export default function TenantDetailPage() {
  const t = useTranslations('tenantDetailPage');
  const { id } = useParams<{ id: string }>();
  const { data: tenant, isLoading, error, refetch } = useTenant(id || '');

  if (isLoading) {
    return (
      <div aria-busy="true" aria-live="polite" className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-48 w-full" />
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

  // Live data only — render an empty state instead of fabricating a tenant.
  if (!tenant) {
    return (
      <EmptyState
        icon={<Users className="h-8 w-8" />}
        title={t('notFound')}
        description={t('notFoundDesc', { id: id ?? '' })}
      />
    );
  }
  const displayTenant = tenant;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/tenants" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{displayTenant.name}</h1>
          <p className="text-gray-500">
            {displayTenant.propertyName} • {t('unitPrefix', { unit: displayTenant.unitNumber })}
          </p>
        </div>
        <Link
          to="/tenants/communications"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
        >
          <MessageSquare className="h-4 w-4" />
          {t('message')}
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('contactInformation')}</h3>
          <div className="space-y-4">
            {displayTenant.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">{t('email')}</p>
                  <p className="font-medium text-gray-900">{displayTenant.email}</p>
                </div>
              </div>
            )}
            {displayTenant.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">{t('phone')}</p>
                  <p className="font-medium text-gray-900">{displayTenant.phone}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('leaseDetails')}</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">{t('property')}</p>
                <Link
                  to={`/properties/${displayTenant.propertyId}`}
                  className="font-medium text-gray-900 hover:text-blue-600"
                >
                  {displayTenant.propertyName}
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">{t('unit')}</p>
                <p className="font-medium text-gray-900">{displayTenant.unitNumber}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">{t('leasePeriod')}</p>
                <p className="font-medium text-gray-900">
                  {formatDate(displayTenant.leaseStartDate)} - {formatDate(displayTenant.leaseEndDate)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">{t('monthlyRent')}</p>
                <p className="font-medium text-gray-900">
                  {formatCurrency(displayTenant.rentAmount)}
                </p>
              </div>
            </div>
            {displayTenant.balance !== undefined && displayTenant.balance > 0 && (
              <div className="p-3 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-800">
                  {t('outstandingBalance', { amount: formatCurrency(displayTenant.balance) })}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('recentPayments')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colDate')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('colAmount')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colStatus')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {displayTenant.payments?.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{formatDate(payment.date)}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {formatCurrency(payment.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        payment.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {payment.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(!displayTenant.payments || displayTenant.payments.length === 0) && (
          <EmptyState
            icon={<DollarSign className="h-8 w-8" />}
            title={t('noPaymentHistory')}
            description={t('noPaymentHistoryDesc')}
          />
        )}
      </div>
    </div>
  );
}
