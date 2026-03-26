'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { tenantsService } from '@bossnyumba/api-client';
import {
  Building2,
  Users,
  CreditCard,
  Settings,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  ArrowLeft,
} from 'lucide-react';
import { useParams } from 'react-router-dom';

export function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();

  const {
    data: tenant,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['admin-tenant-detail', id],
    queryFn: async () => {
      const res = await tenantsService.getCurrent();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load tenant details');
    },
    staleTime: 30_000,
  });

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
        <h2 className="text-lg font-semibold text-gray-900">Tenant Not Found</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-md">
          {error instanceof Error ? error.message : 'Unable to load tenant details.'}
        </p>
      </div>
    );
  }

  const t: any = tenant || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t.name || 'Tenant Detail'}</h1>
        <p className="text-sm text-gray-500 mt-1">Tenant policy, billing, and operational data</p>
      </div>

      {/* Status Badge */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-violet-600" />
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">{t.name || '-'}</h3>
            <p className="text-sm text-gray-500">{t.email || t.domain || '-'}</p>
          </div>
          <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
            t.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
            t.status === 'SUSPENDED' ? 'bg-red-100 text-red-700' :
            t.status === 'TRIAL' ? 'bg-blue-100 text-blue-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {t.status || 'Unknown'}
          </span>
        </div>
      </div>

      {/* Detail Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-violet-100 rounded-lg w-fit">
            <CreditCard className="h-5 w-5 text-violet-600" />
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-900">Plan</p>
            <p className="text-sm text-gray-500">{t.plan || t.subscriptionPlan || '-'}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-green-100 rounded-lg w-fit">
            <Users className="h-5 w-5 text-green-600" />
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-900">Users</p>
            <p className="text-sm text-gray-500">{t.userCount ?? 0}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-blue-100 rounded-lg w-fit">
            <Building2 className="h-5 w-5 text-blue-600" />
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-900">Properties</p>
            <p className="text-sm text-gray-500">{t.propertyCount ?? 0}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-amber-100 rounded-lg w-fit">
            <Settings className="h-5 w-5 text-amber-600" />
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-900">Created</p>
            <p className="text-sm text-gray-500">
              {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '-'}
            </p>
          </div>
        </div>
      </div>

      {/* Additional Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Tenant Configuration</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Industry</p>
            <p className="text-sm font-medium text-gray-900">{t.industry || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Country</p>
            <p className="text-sm font-medium text-gray-900">{t.country || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Phone</p>
            <p className="text-sm font-medium text-gray-900">{t.phone || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Website</p>
            <p className="text-sm font-medium text-gray-900">{t.website || '-'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
