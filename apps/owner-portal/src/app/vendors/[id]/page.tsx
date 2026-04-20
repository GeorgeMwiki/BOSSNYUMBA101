import React from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  Briefcase,
  Calendar,
} from 'lucide-react';
import { Skeleton, EmptyState, Button, Alert, AlertDescription } from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';
import { formatCurrency, formatDate } from '../../../lib/api';
import { useVendor } from '../../../lib/hooks';

export default function VendorDetailPage() {
  const t = useTranslations('vendorDetailPage');
  const { id } = useParams<{ id: string }>();
  const { data: vendor, isLoading, error, refetch } = useVendor(id || '');

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

  if (!vendor) {
    return (
      <EmptyState
        icon={<Building2 className="h-8 w-8" />}
        title={t('notFound')}
        description={t('notFoundDesc')}
        action={
          <Link
            to="/vendors"
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('backToVendors')}
          </Link>
        }
      />
    );
  }

  const displayVendor = vendor;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/vendors"
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{displayVendor.name}</h1>
          <p className="text-gray-500">{displayVendor.type} • {displayVendor.status}</p>
        </div>
        <Link
          to="/vendors/contracts"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
        >
          <Briefcase className="h-4 w-4" />
          {t('viewContracts')}
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('contactInformation')}</h3>
          <div className="space-y-4">
            {displayVendor.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">{t('email')}</p>
                  <p className="font-medium text-gray-900">{displayVendor.email}</p>
                </div>
              </div>
            )}
            {displayVendor.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">{t('phone')}</p>
                  <p className="font-medium text-gray-900">{displayVendor.phone}</p>
                </div>
              </div>
            )}
            {displayVendor.address && (
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">{t('address')}</p>
                  <p className="font-medium text-gray-900">{displayVendor.address}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('associatedProperties')}</h3>
          <div className="space-y-3">
            {displayVendor.properties?.map((prop) => (
              <Link
                key={prop.id}
                to={`/properties/${prop.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-gray-900">{prop.name}</span>
                </div>
                <span className="text-sm text-blue-600">{t('view')}</span>
              </Link>
            ))}
            {(!displayVendor.properties || displayVendor.properties.length === 0) && (
              <EmptyState
                icon={<Building2 className="h-8 w-8" />}
                title={t('noPropertiesAssigned')}
                description={t('noPropertiesAssignedDesc')}
              />
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('recentWorkOrders')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colId')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colDescription')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colStatus')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colDate')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {displayVendor.recentWorkOrders?.map((wo) => (
                <tr key={wo.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{wo.id}</td>
                  <td className="px-4 py-3 text-gray-600">{wo.description}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        wo.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                        wo.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {wo.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(wo.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(!displayVendor.recentWorkOrders || displayVendor.recentWorkOrders.length === 0) && (
          <EmptyState
            icon={<FileText className="h-8 w-8" />}
            title={t('noRecentWorkOrders')}
            description={t('noRecentWorkOrdersDesc')}
          />
        )}
      </div>
    </div>
  );
}
