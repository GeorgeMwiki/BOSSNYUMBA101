import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Search,
  Plus,
  Phone,
  Mail,
  ArrowRight,
  Briefcase,
} from 'lucide-react';
import { Skeleton, Alert, AlertDescription, Button } from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';
import { useVendors } from '../../lib/hooks';

export default function VendorsPage() {
  const t = useTranslations('vendorsPage');
  const { data: vendors = [], isLoading, error, refetch } = useVendors();
  const [search, setSearch] = useState('');

  const filtered = vendors.filter(
    (v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.type.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div aria-busy="true" aria-live="polite" className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
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

  // Live-data only — no hardcoded fallback vendors. Empty state is
  // rendered below when filtered.length === 0.
  const displayVendors = filtered;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-500">{t('subtitle')}</p>
        </div>
        <Link
          to="/vendors/contracts"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
        >
          <Briefcase className="h-4 w-4" />
          {t('viewContracts')}
        </Link>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colVendor')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colType')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colContact')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colProperties')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('colStatus')}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {displayVendors.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-500">
                    {search
                      ? t('noMatch', { query: search })
                      : t('noVendorsYet')}
                  </td>
                </tr>
              )}
              {displayVendors.map((vendor) => (
                <tr key={vendor.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <Building2 className="h-5 w-5 text-blue-600" />
                      </div>
                      <span className="font-medium text-gray-900">{vendor.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                      {vendor.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1 text-sm text-gray-600">
                      {vendor.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-4 w-4" />
                          {vendor.email}
                        </span>
                      )}
                      {vendor.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-4 w-4" />
                          {vendor.phone}
                        </span>
                      )}
                      {!vendor.email && !vendor.phone && '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {t('propertiesCount', { count: vendor.propertiesCount || 0 })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        vendor.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {vendor.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/vendors/${vendor.id}`}
                      className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                      {t('view')} <ArrowRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
