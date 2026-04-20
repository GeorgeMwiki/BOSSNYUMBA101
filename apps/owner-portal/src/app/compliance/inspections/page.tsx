import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ClipboardList, Building2, Calendar, CheckCircle } from 'lucide-react';
import { Skeleton, Alert, AlertDescription, Button, EmptyState } from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';
import { formatDate } from '../../../lib/api';
import { useInspections } from '../../../lib/hooks';

export default function InspectionsPage() {
  const t = useTranslations('inspectionsPage');
  const { data: inspections = [], isLoading, error, refetch } = useInspections();

  // No fixture fallback — show real data or an empty state.
  const displayInspections = inspections;

  const upcoming = displayInspections.filter((i) => i.status === 'SCHEDULED');
  const completed = displayInspections.filter((i) => i.status === 'PASSED' || i.status === 'COMPLETED');

  if (isLoading) {
    return (
      <div aria-busy="true" aria-live="polite" className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">{t('upcoming')}</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">{upcoming.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">{t('completed')}</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">{completed.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <ClipboardList className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">{t('total')}</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">{displayInspections.length}</p>
        </div>
      </div>

      {displayInspections.length === 0 ? (
        <EmptyState
          title={t('noScheduled')}
          description={t('noScheduledDesc')}
        />
      ) : (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{t('allInspections')}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colType')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colProperty')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colScheduled')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colCompleted')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colStatus')}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {displayInspections.map((inspection) => (
                <tr key={inspection.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <ClipboardList className="h-5 w-5 text-blue-600" />
                      </div>
                      <span className="font-medium text-gray-900">{inspection.type}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/properties/${inspection.propertyId}`}
                      className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600"
                    >
                      <Building2 className="h-4 w-4" />
                      {inspection.propertyName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="h-4 w-4" />
                      {formatDate(inspection.scheduledDate)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {inspection.completedDate ? formatDate(inspection.completedDate) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        inspection.status === 'PASSED' || inspection.status === 'COMPLETED'
                          ? 'bg-green-100 text-green-700'
                          : inspection.status === 'SCHEDULED'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {inspection.status}
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
