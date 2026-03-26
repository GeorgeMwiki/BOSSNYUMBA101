'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { tenantsService, propertiesService } from '@bossnyumba/api-client';
import { Link } from 'react-router-dom';
import {
  Building2,
  AlertTriangle,
  RefreshCw,
  Settings,
  ArrowUpRight,
} from 'lucide-react';

export function TenantsPage() {
  const {
    data: tenant,
    isLoading: loadingTenant,
    error: tenantError,
  } = useQuery({
    queryKey: ['admin-tenants-current'],
    queryFn: async () => {
      const res = await tenantsService.getCurrent();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load tenant');
    },
    staleTime: 30_000,
  });

  const {
    data: subscription,
    isLoading: loadingSub,
    error: subError,
  } = useQuery({
    queryKey: ['admin-tenants-subscription'],
    queryFn: async () => {
      const res = await tenantsService.getSubscription();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load subscription');
    },
    staleTime: 30_000,
  });

  const {
    data: properties,
    isLoading: loadingProps,
    error: propsError,
  } = useQuery({
    queryKey: ['admin-tenants-properties'],
    queryFn: async () => {
      const res = await propertiesService.list();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load properties');
    },
    staleTime: 30_000,
  });

  const isLoading = loadingTenant || loadingSub || loadingProps;
  const error = tenantError || subError || propsError;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 text-violet-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
        <h2 className="text-lg font-semibold text-gray-900">Tenants Directory Unavailable</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-md">
          {error instanceof Error ? error.message : 'Unable to load tenant directory.'}
        </p>
      </div>
    );
  }

  const propertyList = Array.isArray(properties) ? properties : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tenants</h1>
          <p className="text-sm text-gray-500 mt-1">Tenant directory and onboarding management</p>
        </div>
        <Link
          to="/tenants/onboard"
          className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700"
        >
          <Building2 className="h-4 w-4" />
          Onboard Tenant
        </Link>
      </div>

      {/* Current Tenant Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-violet-100 rounded-lg w-fit">
            <Building2 className="h-5 w-5 text-violet-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{tenant?.name || '-'}</p>
            <p className="text-sm text-gray-500">Current Tenant</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-green-100 rounded-lg">
              <Settings className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{tenant?.status || '-'}</p>
            <p className="text-sm text-gray-500">Status</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-blue-100 rounded-lg w-fit">
            <Building2 className="h-5 w-5 text-blue-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{subscription?.plan || '-'}</p>
            <p className="text-sm text-gray-500">Plan</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-amber-100 rounded-lg w-fit">
            <Building2 className="h-5 w-5 text-amber-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{propertyList.length}</p>
            <p className="text-sm text-gray-500">Properties</p>
          </div>
        </div>
      </div>

      {/* Tenant Details Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Tenant Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase">Name</p>
            <p className="text-sm font-medium text-gray-900 mt-1">{tenant?.name || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Slug</p>
            <p className="text-sm font-medium text-gray-900 mt-1">{tenant?.slug || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Contact Email</p>
            <p className="text-sm font-medium text-gray-900 mt-1">{tenant?.contactEmail || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Contact Phone</p>
            <p className="text-sm font-medium text-gray-900 mt-1">{tenant?.contactPhone || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Max Units</p>
            <p className="text-sm font-medium text-gray-900 mt-1">{subscription?.maxUnits || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Max Users</p>
            <p className="text-sm font-medium text-gray-900 mt-1">{subscription?.maxUsers || '-'}</p>
          </div>
        </div>
      </div>

      {/* Properties List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Properties</h3>
        </div>
        {propertyList.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No properties found</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Units</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">City</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {propertyList.map((p: any) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    <Link to={`/tenants/${p.tenantId || ''}`} className="text-violet-600 hover:text-violet-700 flex items-center gap-1">
                      {p.name}
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{p.type || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      p.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {p.occupiedUnits || 0}/{p.totalUnits || 0}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{p.address?.city || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
